/* Numérique Responsable — moteur d'audit
 * Exposé via globalThis.__nrAudit(mode)
 *
 * Modèle de résultat par règle : RuleResult {
 *   status  : 'C' (conforme) | 'NC' (non-conforme) | 'NA' (non applicable) | 'NT' (non testé, manuel)
 *   count   : nombre d'occurrences (0 si C ou NA)
 *   measure?: texte descriptif
 *   samples?: [{ auditId, selector, outer }]
 *   manualPrompt? : question à poser à l'auditeur si NT
 * }
 *
 * Organisation :
 *   §1  Contexte & snapshots
 *   §2  Utilitaires DOM + nom accessible
 *   §3  Utilitaires couleur + contraste
 *   §4  Règles A11y (106 critères RGAA 4.1, regroupés par thème 1 à 13)
 *   §5  Règles Eco (RGESN 2024, 9 thèmes)
 *   §6  Runner __nrAudit(mode)
 */

globalThis.__nrAudit = async function (mode) {

// ═══════════════════════════════════════════════════════════════
// §1  Contexte & snapshots
// ═══════════════════════════════════════════════════════════════
const NR_REFERENCE_VIEWPORT = { width: 1280, height: 900, dpr: 1 };
const RGAA_THEMES = [
  null,
  'Images', 'Cadres', 'Couleurs', 'Multimédia', 'Tableaux',
  'Liens', 'Scripts', 'Éléments obligatoires', 'Structuration',
  'Présentation', 'Formulaires', 'Navigation', 'Consultation'
];
const RGESN_THEMES = [
  'Stratégie','Spécifications','Architecture','Expérience et interface utilisateur',
  'Contenus','Frontend','Backend','Hébergement','Algorithmie'
];

// Navigation snapshot (stable : pris une fois lors du chargement initial de la page).
let nrNavSnapshot = null;
try { nrNavSnapshot = performance.getEntriesByType('navigation')[0] || null; } catch {}

// Attend que les images soient chargées (ou timeout 3 s) pour stabiliser naturalWidth/currentSrc.
const nrImages = [...document.querySelectorAll('img')];
await Promise.race([
  Promise.all(nrImages.map(img =>
    img.complete ? null : new Promise(r => {
      const done = () => { img.removeEventListener('load', done); img.removeEventListener('error', done); r(); };
      img.addEventListener('load', done);
      img.addEventListener('error', done);
    })
  )),
  new Promise(r => setTimeout(r, 3000))
]);

// Resource snapshot pris APRÈS l'attente images pour inclure leurs requêtes réseau.
// On agrandit le buffer à 500 avant de lire pour éviter les pertes sur pages lourdes (défaut Chrome : 150).
let nrResourceSnapshot = [];
try {
  performance.setResourceTimingBufferSize(500);
  nrResourceSnapshot = performance.getEntriesByType('resource').slice();
} catch {
  try { nrResourceSnapshot = performance.getEntriesByType('resource').slice(); } catch {}
}

// ═══════════════════════════════════════════════════════════════
// §2  Utilitaires DOM + nom accessible
// ═══════════════════════════════════════════════════════════════
const isVisible = (el) => {
  if (!el) return false;
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
  const s = getComputedStyle(el);
  return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0;
};
const isAnchorable = (el) => el && el.nodeType === 1 &&
  el !== document.documentElement && el !== document.body && el !== document.head;

let __nrCounter = (globalThis.__nrAuditIdCounter || 0);
const tagElement = (el) => {
  if (!isAnchorable(el)) return null;
  let id = el.getAttribute('data-nr-audit-id');
  if (!id) {
    id = `nr-${++__nrCounter}`;
    el.setAttribute('data-nr-audit-id', id);
  }
  return id;
};

const describe = (el) => {
  try {
    const tag = el.tagName?.toLowerCase() || '?';
    const id = el.id ? `#${el.id}` : '';
    const cls = (el.className && typeof el.className === 'string')
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
    const outer = (el.outerHTML || '').replace(/\s*data-nr-audit-id="[^"]*"/g, '').slice(0, 300).replace(/\s+/g, ' ');
    let selector = `${tag}${id}${cls}`;
    if (tag === 'img' && !id) {
      const alt = el.getAttribute('alt');
      const src = (el.getAttribute('src') || el.getAttribute('data-src') || '').split('/').pop()?.split('?')[0] || '';
      if (alt && alt.trim()) selector += `[alt="${alt.trim().slice(0, 50)}"]`;
      else if (src) selector += `[src="${src}"]`;
    } else if (!id && ['span','p','a','li','td','th','label','button','em','strong',
        'h1','h2','h3','h4','h5','h6','figcaption','blockquote','cite','dt','dd','small','code'].includes(tag)) {
      const text = el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 40);
      if (text) selector += `[text="${text}"]`;
    }
    return { auditId: tagElement(el), selector, outer };
  } catch { return { auditId: null, selector: '?', outer: '' }; }
};

const inNoscript = (el) => {
  let p = el.parentElement;
  while (p) {
    if (p.tagName === 'NOSCRIPT') return true;
    p = p.parentElement;
  }
  return false;
};

const sampleElements = (els, n = 5) => {
  const decorated = els.map(el => ({ el, desc: describe(el) }));
  decorated.sort((a, b) =>
    a.desc.selector.localeCompare(b.desc.selector) ||
    (a.desc.outer || '').localeCompare(b.desc.outer || '')
  );
  return decorated.slice(0, n).map(d => d.desc);
};

// Algorithme simplifié du calcul du nom accessible WAI-ARIA 1.2
// https://www.w3.org/TR/accname-1.2/
const accessibleName = (el) => {
  if (!el || el.nodeType !== 1) return '';
  // 1. aria-labelledby — gestion self-référence
  const lb = el.getAttribute('aria-labelledby');
  if (lb) {
    const txts = lb.trim().split(/\s+/).map(id => {
      const ref = document.getElementById(id);
      if (ref === el) return el.textContent?.trim() || '';
      return ref?.textContent?.trim() || '';
    }).filter(Boolean);
    if (txts.length) return txts.join(' ');
  }
  // 2. aria-label
  const al = el.getAttribute('aria-label');
  if (al?.trim()) return al.trim();
  // 3. label associé (for ou ancêtre)
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl?.textContent.trim()) return lbl.textContent.trim();
  }
  const lblParent = el.closest?.('label');
  if (lblParent?.textContent.trim()) return lblParent.textContent.trim();
  // 3bis. fieldset > legend pour les champs groupés
  const fs = el.closest?.('fieldset');
  if (fs) {
    const legend = fs.querySelector(':scope > legend');
    if (legend?.textContent.trim()) return legend.textContent.trim();
  }
  // 4. alt (<img>, <area>)
  const alt = el.getAttribute?.('alt');
  if (alt?.trim()) return alt.trim();
  // 5. value (boutons input)
  if (el.tagName === 'INPUT' && /^(submit|button|reset)$/i.test(el.type)) {
    if (el.value?.trim()) return el.value.trim();
  }
  // 5bis. summary de details
  if (el.tagName === 'SUMMARY') return el.textContent?.replace(/\s+/g, ' ').trim() || '';
  // 6. title
  const t = el.getAttribute?.('title');
  if (t?.trim()) return t.trim();
  // 7. Contenu textuel (inclut alt des <img> descendantes et <title> des <svg>)
  const textOf = (node) => {
    if (!node) return '';
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return '';
    const tag = node.tagName?.toLowerCase();
    if (tag === 'img' && node.alt) return ' ' + node.alt + ' ';
    if (tag === 'svg') {
      const svgTitle = node.querySelector(':scope > title');
      if (svgTitle?.textContent?.trim()) return ' ' + svgTitle.textContent + ' ';
    }
    if (node.getAttribute?.('aria-label')) return ' ' + node.getAttribute('aria-label') + ' ';
    return [...node.childNodes].map(textOf).join('');
  };
  return textOf(el).replace(/\s+/g, ' ').trim();
};

// Texte générique pour détection 6.2 (lien peu explicite)
const GENERIC_LINK_TEXTS = new Set([
  'cliquez ici','click here','lire la suite','read more','en savoir plus','learn more',
  'ici','here','suite','voir plus','plus','more','ok','détails','details','link','lien'
]);

// ═══════════════════════════════════════════════════════════════
// §3  Utilitaires couleur + contraste
// ═══════════════════════════════════════════════════════════════
let _nrColorCanvas;
const normalizeColor = (c) => {
  if (!c || c === 'transparent') return 'rgba(0,0,0,0)';
  try {
    if (!_nrColorCanvas) _nrColorCanvas = document.createElement('canvas').getContext('2d');
    _nrColorCanvas.fillStyle = '#000';
    _nrColorCanvas.fillStyle = c;
    return _nrColorCanvas.fillStyle;
  } catch { return null; }
};
const parseColor = (c) => {
  const norm = normalizeColor(c);
  if (!norm) return null;
  if (norm === 'rgba(0,0,0,0)') return [0, 0, 0, 0];
  if (norm.startsWith('#')) {
    const hex = norm.slice(1);
    return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16),
            hex.length === 8 ? parseInt(hex.slice(6,8),16)/255 : 1];
  }
  const m = norm.match(/[\d.]+/g);
  if (!m) return null;
  return [+m[0], +m[1], +m[2], m[3] !== undefined ? +m[3] : 1];
};

// Compose le fond effectif d'un élément en remontant dans la hiérarchie et
// en alpha-blendant les fonds semi-transparents. Retourne null si une image
// de fond (gradient, url) est rencontrée → contraste non testable auto.
const bgChain = (el) => {
  let cur = el; const stack = [];
  while (cur) {
    const cs = getComputedStyle(cur);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
    const c = parseColor(cs.backgroundColor);
    if (c && c[3] > 0) {
      stack.push(c);
      if (c[3] === 1) break;
    }
    if (cur === document.documentElement) break;
    cur = cur.parentElement;
  }
  // Blanc par défaut
  let r = 255, g = 255, b = 255;
  for (let i = stack.length - 1; i >= 0; i--) {
    const [fr, fg, fb, fa] = stack[i];
    r = r * (1 - fa) + fr * fa;
    g = g * (1 - fa) + fg * fa;
    b = b * (1 - fa) + fb * fa;
  }
  return [r, g, b, 1];
};

const luminance = (r, g, b) => {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};
const contrastRatio = (c1, c2) => {
  const l1 = luminance(c1[0], c1[1], c1[2]);
  const l2 = luminance(c2[0], c2[1], c2[2]);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

// ═══════════════════════════════════════════════════════════════
// §4  Règles A11y — 106 critères RGAA 4.1
// ═══════════════════════════════════════════════════════════════
// Chaque règle : { id, num, theme (1-13), level ('A'|'AA'|'AAA'), title, advice, run: () => RuleResult }
// `run` retourne { status, count, measure?, samples?, manualPrompt? }.
// Un helper NT() produit les entrées non-automatisables (status 'NT' + prompt).

// Rule générique « pas de marqueur technique de non-conformité » : statut C par défaut.
// Peut prendre une heuristique optionnelle retournant un RuleResult alternatif (NC / NA / C enrichi).
const AUTO_C = (id, num, theme, title, advice, heuristic = null, level = 'A') => ({
  id, num, theme, level, title, advice,
  run: () => {
    if (heuristic) {
      const r = heuristic();
      if (r) return r;
    }
    return { status: 'C', count: 0, measure: 'Aucun marqueur technique de non-conformité détecté' };
  }
});
const NT = (id, num, theme, title, advice, manualPrompt = 'Vérification manuelle requise.', level = 'A') => ({
  id, num, theme, level, title, advice,
  run: () => ({ status: 'NT', count: 0, measure: 'Non testable automatiquement', manualPrompt })
});

const RULES_IMAGES = [
  { id: 'img-1.1-alt-missing', num: '1.1', theme: 1, level: 'A',
    title: "Chaque image porteuse d'information a-t-elle une alternative textuelle ?",
    advice: "Ajoutez un attribut alt à chaque <img>. Vide (alt=\"\") si décorative, descriptif sinon.",
    run: () => {
      const all = [...document.querySelectorAll('img, input[type=image], area')].filter(i => !inNoscript(i));
      if (!all.length) return { status: 'NA', count: 0, measure: 'Aucune image' };
      const bad = all.filter(i => !i.hasAttribute('alt'));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} image(s) sans alt sur ${all.length}`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${all.length} image(s) avec alt` };
    }},
  { id: 'img-1.2-decorative', num: '1.2', theme: 1, level: 'A',
    title: "Chaque image décorative est-elle correctement ignorée ?",
    advice: "Les images de décoration doivent avoir alt=\"\" (ou role=\"presentation\"/aria-hidden=\"true\") et pas de title.",
    run: () => {
      const decor = [...document.querySelectorAll('img[alt=""], img[role=presentation], img[role=none], img[aria-hidden=true]')].filter(i => !inNoscript(i));
      if (!decor.length) return { status: 'NA', count: 0, measure: 'Aucune image décorative détectée' };
      const bad = decor.filter(i => i.getAttribute('title')?.trim() || i.getAttribute('aria-label')?.trim());
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} image(s) décorative(s) avec texte accessible parasite`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${decor.length} image(s) décorative(s) correctement ignorée(s)` };
    }},
  AUTO_C('img-1.3-alt-relevant', '1.3', 1,
    "Pour chaque image porteuse d'information, l'alternative textuelle est-elle pertinente ?",
    "Chaque alt doit décrire le contenu de l'image (hors contexte).",
    () => {
      const imgs = [...document.querySelectorAll('img[alt]')].filter(i => !inNoscript(i) && i.getAttribute('alt')?.trim());
      if (!imgs.length) return { status: 'NA', count: 0, measure: 'Aucune image avec alt non vide' };
      const generic = /^(image|photo|picture|img|icon|icône|logo|banner|bannière)\.?$/i;
      const bad = imgs.filter(i => {
        const a = i.getAttribute('alt').trim();
        if (a.length < 2) return true;
        if (/^[A-Z]{2,3}$/.test(a)) return false; // sigles courts légitimes (EU, UN, IA…)
        return generic.test(a);
      });
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} alt trop court(s) ou générique(s) sur ${imgs.length}`, samples: sampleElements(bad) }
        : null;
    }),
  AUTO_C('img-1.4-captcha', '1.4', 1,
    "Chaque image-CAPTCHA a-t-elle une alternative ?",
    "Chaque CAPTCHA image doit proposer une alternative accessible (audio, question textuelle).",
    () => {
      const captchas = [...document.querySelectorAll('img[src*=captcha i], img[name*=captcha i], img[id*=captcha i], img[alt*=captcha i]')].filter(i => !inNoscript(i));
      if (!captchas.length) return { status: 'NA', count: 0, measure: 'Aucune image-CAPTCHA détectée' };
      const bad = captchas.filter(i => !i.getAttribute('alt')?.trim());
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} CAPTCHA sans alternative`, samples: sampleElements(bad) }
        : null;
    }),
  AUTO_C('img-1.5-captcha-relevant', '1.5', 1,
    "Chaque image-CAPTCHA a-t-elle une alternative pertinente ?",
    "L'alternative du CAPTCHA doit permettre réellement de valider le formulaire.",
    () => {
      const captchas = [...document.querySelectorAll('img[src*=captcha i], img[name*=captcha i], img[id*=captcha i]')];
      if (!captchas.length) return { status: 'NA', count: 0, measure: 'Aucun CAPTCHA' };
      return null; // présence d'alternative audio non vérifiable → C par défaut
    }),
  { id: 'img-1.6-long-desc', num: '1.6', theme: 1, level: 'A',
    title: "Chaque image porteuse d'information complexe a-t-elle une description détaillée ?",
    advice: "Pour les graphiques, cartes, infographies : fournissez une description longue via longdesc, aria-describedby ou texte adjacent.",
    run: () => {
      // Ne cibler que les figures contenant une image visible (img, svg, picture, canvas)
      const figs = [...document.querySelectorAll('figure')].filter(f =>
        f.querySelector('img, svg, picture, canvas')
      );
      if (!figs.length) return { status: 'NA', count: 0, measure: 'Aucune figure contenant une image détectée' };
      const bad = figs.filter(f => {
        // Conforme si une figcaption est présente (non vide), ou aria-describedby, ou longdesc
        const figcap = f.querySelector('figcaption');
        const hasDesc = (figcap && figcap.textContent.trim().length > 0)
          || f.getAttribute('aria-describedby')
          || f.querySelector('img,svg,picture')?.getAttribute('longdesc');
        return !hasDesc;
      });
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} figure(s) avec image sans description détaillée`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${figs.length} figure(s) avec image et description` };
    }},
  AUTO_C('img-1.7-long-desc-relevant', '1.7', 1,
    "La description détaillée est-elle pertinente ?",
    "La description doit couvrir l'information véhiculée par l'image complexe.",
    () => {
      const caps = [...document.querySelectorAll('figure figcaption')];
      if (!caps.length) return { status: 'NA', count: 0, measure: 'Aucune légende de figure' };
      const bad = caps.filter(c => (c.textContent || '').trim().length < 10);
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} légende(s) trop courte(s) pour être descriptive(s)`, samples: sampleElements(bad) }
        : null;
    }),
  AUTO_C('img-1.8-image-text', '1.8', 1,
    "Chaque image-texte porteuse d'information doit si possible être remplacée par du texte stylé.",
    "Aucune image ne doit véhiculer du texte qui pourrait être affiché en HTML/CSS.",
    () => {
      // Heuristique : image visible dont l'alt fait >30 caractères avec au moins 2 mots ⇒ probable image-texte.
      // Exclusions : noscript, images cachées, images décoratives dans des liens/boutons déjà textuels.
      const suspects = [...document.querySelectorAll('img[alt]')].filter(i => {
        if (inNoscript(i) || !isVisible(i)) return false;
        const a = i.getAttribute('alt').trim();
        // L'alt doit ressembler à du texte lisible (≥2 mots de 4+ chars), pas juste un nom de fichier
        return a.length > 79 && /\w{4,}\s+\w{4,}/.test(a) && !/\.(jpg|jpeg|png|gif|webp|svg|avif)/i.test(a);
      });
      return suspects.length
        ? { status: 'NC', count: suspects.length, measure: `${suspects.length} image(s) avec un alt > 79 caractères — probable image-texte`, samples: sampleElements(suspects) }
        : null;
    }),
  { id: 'img-1.9-figure-legend', num: '1.9', theme: 1, level: 'A',
    title: "Chaque légende d'image est-elle, si nécessaire, correctement liée à l'image correspondante ?",
    advice: "Utilisez <figure> + <figcaption> pour associer une légende à une image.",
    run: () => {
      const figs = [...document.querySelectorAll('figure')];
      if (!figs.length) return { status: 'NA', count: 0 };
      const bad = figs.filter(f => f.querySelector('img, svg, picture') && !f.querySelector('figcaption'));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} figure(s) sans <figcaption>`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${figs.length} figure(s) conforme(s)` };
    }},
];

const RULES_CADRES = [
  { id: 'frame-2.1-title', num: '2.1', theme: 2, level: 'A',
    title: "Chaque cadre en ligne a-t-il un titre ?",
    advice: "Ajoutez un attribut title explicite à chaque <iframe>.",
    run: () => {
      const frames = [...document.querySelectorAll('iframe')].filter(f => !inNoscript(f));
      if (!frames.length) return { status: 'NA', count: 0, measure: 'Aucun iframe' };
      const bad = frames.filter(f => !f.getAttribute('title')?.trim() && !f.getAttribute('aria-label')?.trim() && !f.getAttribute('aria-labelledby')?.trim());
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} iframe(s) sans titre`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${frames.length} iframe(s) titré(s)` };
    }},
  { id: 'frame-2.2-title-relevant', num: '2.2', theme: 2, level: 'A',
    title: "Pour chaque cadre en ligne ayant un titre, ce titre est-il pertinent ?",
    advice: "Le title d'un iframe doit décrire son contenu (ex: « Carte interactive »).",
    run: () => {
      const frames = [...document.querySelectorAll('iframe[title]')].filter(f => !inNoscript(f));
      if (!frames.length) return { status: 'NA', count: 0 };
      const generic = /^(iframe|frame|content|contenu|embed|sans titre|untitled|no title|unnamed|blank|vide|widget|module|composant|component|publicité|pub|ad|ads|advertisement|section|bandeau|banner|placeholder|insertion|include)$/i;
      const bad = frames.filter(f => generic.test(f.getAttribute('title').trim()));
      if (bad.length) return { status: 'NC', count: bad.length, measure: `${bad.length} iframe(s) avec title générique`, samples: sampleElements(bad) };
      return { status: 'C', count: 0, measure: `${frames.length} iframe(s) avec title non générique` };
    }},
];

const RULES_COULEURS = [
  NT('col-3.1-info-color', '3.1', 3,
    "Dans chaque page web, l'information ne doit pas être donnée uniquement par la couleur.",
    "Vérifiez qu'aucune information (champ obligatoire, état, graphique) n'est véhiculée uniquement par la couleur."),
  { id: 'col-3.2-contrast-text', num: '3.2', theme: 3, level: 'AA',
    title: "Dans chaque page web, le contraste entre la couleur du texte et la couleur de son arrière-plan est-il suffisant ?",
    advice: "Ratio >= 4.5:1 (texte normal) ou >= 3:1 (texte >= 18.66px gras ou >= 24px).",
    run: () => {
      const els = [...document.querySelectorAll('p,span,a,li,td,th,label,button,h1,h2,h3,h4,h5,h6,dt,dd,figcaption,blockquote,cite,em,strong,small,code')]
        .filter(el => isVisible(el) && el.textContent.trim() !== '' &&
          !el.querySelector('p,span,a,li,td,th,label,button,h1,h2,h3,h4,h5,h6'))
        .slice(0, 400);
      if (!els.length) return { status: 'NA', count: 0 };
      let checked = 0, nt = 0;
      const badWithInfo = [];
      for (const el of els) {
        const s = getComputedStyle(el);
        const fg = parseColor(s.color); if (!fg) continue;
        const bg = bgChain(el);
        if (!bg) { nt++; continue; }
        checked++;
        const ratio = contrastRatio(fg, bg);
        const fs = parseFloat(s.fontSize); const fw = parseInt(s.fontWeight) || 400;
        const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
        if (ratio < (large ? 3 : 4.5)) badWithInfo.push({ el, ratio, fg });
      }
      const measure = `${badWithInfo.length} texte(s) en échec sur ${checked} testé(s)` + (nt ? ` · ${nt} avec image de fond (à tester manuellement)` : '');
      if (!checked && nt) return { status: 'C', count: 0, measure };
      if (!badWithInfo.length) return { status: 'C', count: 0, measure };
      // Samples enrichis : selector inclut ratio et couleur pour rester lisible même après slimIssues
      const badEls = badWithInfo.map(b => b.el);
      const decorated = badEls.map((el, i) => ({ el, desc: describe(el), ratio: badWithInfo[i].ratio, fg: badWithInfo[i].fg }));
      decorated.sort((a, b) => a.desc.selector.localeCompare(b.desc.selector));
      const samples = decorated.slice(0, 5).map(({ desc, ratio, fg }) => {
        const hex = '#' + fg.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
        desc.selector += ` [ratio=${ratio.toFixed(2)}:1, fg=${hex}]`;
        return desc;
      });
      return { status: 'NC', count: badWithInfo.length, measure, samples };
    }},
  NT('col-3.3-contrast-ui', '3.3', 3,
    "Dans chaque page web, les couleurs utilisées dans les composants d'interface ou les éléments graphiques porteurs d'informations sont-elles suffisamment contrastées (hors cas particuliers) ?",
    "Vérifiez manuellement le contraste des bordures d'inputs focalisés, icônes informatives, graphiques.",
    'AA'),
];

// 13 critères Multimédia — la plupart manuels
const RULES_MULTIMEDIA = [
  NT('mul-4.1-transcript', '4.1', 4,
    "Chaque média temporel pré-enregistré a-t-il une transcription ou audiodescription ?",
    "Vérifiez qu'un texte de transcription ou une audiodescription est accessible à proximité de chaque audio/vidéo.",
    "Présence d'une transcription ou audiodescription pour chaque média temporel"),
  NT('mul-4.2-transcript-relevant', '4.2', 4,
    "La transcription ou l'audiodescription est-elle pertinente ?",
    "Vérifiez que la transcription couvre fidèlement l'ensemble du contenu audio/vidéo.",
    "La transcription/audiodescription est complète et fidèle au média"),
  NT('mul-4.3-subtitles', '4.3', 4,
    "Chaque média temporel synchronisé a-t-il des sous-titres ?",
    "Vérifiez qu'une piste de sous-titres est disponible (via <track>, YouTube CC, ou player tiers).",
    "Présence de sous-titres synchronisés pour chaque vidéo"),
  NT('mul-4.4-subtitles-relevant', '4.4', 4,
    "Les sous-titres sont-ils pertinents ?",
    "Vérifiez que les sous-titres retranscrivent fidèlement les dialogues et sons importants.",
    "Les sous-titres sont complets et synchronisés"),
  NT('mul-4.5-audiodescription', '4.5', 4,
    "Chaque média temporel a-t-il une audiodescription ?",
    "Vérifiez qu'une audiodescription est disponible pour les vidéos contenant des informations visuelles essentielles.",
    "Présence d'une audiodescription pour chaque vidéo porteuse d'information visuelle"),
  NT('mul-4.6-audiodescription-relevant', '4.6', 4,
    "L'audiodescription est-elle pertinente ?",
    "Vérifiez que l'audiodescription couvre toutes les informations visuelles importantes.",
    "L'audiodescription est complète et fidèle"),
  AUTO_C('mul-4.7-alt-relevant', '4.7', 4,
    "Chaque média temporel est-il clairement identifiable ?",
    "Chaque <audio>/<video> doit avoir un nom accessible (aria-label, title, ou titre adjacent).",
    () => {
      const media = [...document.querySelectorAll('audio, video')];
      if (!media.length) return { status: 'NA', count: 0, measure: 'Aucun média' };
      const bad = media.filter(m => !accessibleName(m));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} média(s) sans nom accessible`, samples: sampleElements(bad) }
        : null;
    }),
  { id: 'mul-4.8-alt', num: '4.8', theme: 4, level: 'A',
    title: "Chaque média non temporel a-t-il, si nécessaire, une alternative ?",
    advice: "Cartes interactives, SVG dynamiques : prévoir un équivalent textuel.",
    run: () => {
      const svgs = [...document.querySelectorAll('svg')].filter(isVisible);
      if (!svgs.length) return { status: 'NA', count: 0 };
      const bad = svgs.filter(s => !accessibleName(s) && !s.getAttribute('role')?.includes('img'));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} SVG sans nom accessible`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${svgs.length} SVG avec nom accessible` };
    }},
  NT('mul-4.9-alt-relevant', '4.9', 4, "Alternative non temporelle pertinente ?", "Vérifiez la fidélité de l'alternative."),
  { id: 'mul-4.10-sound-control', num: '4.10', theme: 4, level: 'A',
    title: "Chaque son déclenché automatiquement est-il contrôlable par l'utilisateur ?",
    advice: "<audio autoplay> ou <video autoplay> doivent être muted ou disposer de controls.",
    run: () => {
      const autos = [...document.querySelectorAll('audio[autoplay], video[autoplay]')];
      if (!autos.length) return { status: 'NA', count: 0 };
      const bad = autos.filter(m => !m.muted && !m.controls);
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} média(s) autoplay sans contrôle ni muted`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${autos.length} autoplay contrôlable(s)` };
    }},
  { id: 'mul-4.11-controls', num: '4.11', theme: 4, level: 'A',
    title: "La consultation des médias temporels est-elle contrôlable par le clavier et tout dispositif de pointage ?",
    advice: "Ajoutez l'attribut controls sur <audio> et <video>, ou fournissez des contrôles personnalisés.",
    run: () => {
      const media = [...document.querySelectorAll('audio, video')];
      if (!media.length) return { status: 'NA', count: 0 };
      const bad = media.filter(m => !m.controls && !m.hasAttribute('controls'));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} média(s) sans controls visibles`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${media.length} média(s) avec controls` };
    }},
  NT('mul-4.12-trap-keyboard', '4.12', 4, "Chaque média temporel ne doit pas provoquer de piège au clavier.", "Vérifiez qu'on peut quitter un lecteur vidéo au clavier (Tab)."),
  NT('mul-4.13-tech', '4.13', 4, "Chaque média temporel et non temporel est-il compatible avec les technologies d'assistance ?", "Vérifiez la compatibilité lecteur d'écran/clavier."),
];

const RULES_TABLEAUX = [
  { id: 'tab-5.1-complex-summary', num: '5.1', theme: 5, level: 'A',
    title: "Pour chaque tableau de données complexe a-t-on un résumé ?",
    advice: "Tableaux complexes (rowspan/colspan, multi-en-têtes) : fournir un résumé via caption ou aria-describedby.",
    run: () => {
      const complex = [...document.querySelectorAll('table')].filter(t => {
        if (/presentation|none/.test(t.getAttribute('role') || '')) return false;
        return t.querySelector('[rowspan],[colspan]') || t.querySelectorAll('thead tr').length > 1;
      });
      if (!complex.length) return { status: 'NA', count: 0, measure: 'Aucun tableau complexe' };
      const bad = complex.filter(t => !t.querySelector('caption') && !t.getAttribute('aria-describedby'));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} tableau(x) complexe(s) sans résumé`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${complex.length} tableau(x) complexe(s) avec résumé` };
    }},
  NT('tab-5.2-summary-relevant', '5.2', 5, "Résumé de tableau complexe pertinent ?", "Vérifiez que chaque résumé décrit bien la structure du tableau."),
  NT('tab-5.3-linearize', '5.3', 5, "Pour chaque tableau de mise en forme, le contenu linéarisé reste-t-il compréhensible ?", "Vérifiez la lecture linéarisée des tableaux de mise en forme."),
  { id: 'tab-5.4-data-identified', num: '5.4', theme: 5, level: 'A',
    title: "Pour chaque tableau de données, le titre est-il correctement associé ?",
    advice: "Utilisez <caption> (ou aria-labelledby) pour titrer un tableau de données.",
    run: () => {
      const tables = [...document.querySelectorAll('table')].filter(t => !/presentation|none/.test(t.getAttribute('role') || ''));
      if (!tables.length) return { status: 'NA', count: 0 };
      const bad = tables.filter(t => !t.querySelector('caption') && !t.getAttribute('aria-label') && !t.getAttribute('aria-labelledby'));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} tableau(x) sans titre`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${tables.length} tableau(x) titré(s)` };
    }},
  NT('tab-5.5-title-relevant', '5.5', 5, "Titre de tableau de données pertinent ?", "Vérifiez la pertinence du caption."),
  { id: 'tab-5.6-headers', num: '5.6', theme: 5, level: 'A',
    title: "Pour chaque tableau de données, chaque en-tête est-il correctement déclaré ?",
    advice: "Utilisez <th>, avec scope=\"col\" ou scope=\"row\".",
    run: () => {
      const tables = [...document.querySelectorAll('table')].filter(t => !/presentation|none/.test(t.getAttribute('role') || ''));
      if (!tables.length) return { status: 'NA', count: 0 };
      const bad = tables.filter(t => t.querySelectorAll('th').length === 0);
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} tableau(x) sans <th>`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${tables.length} tableau(x) avec en-têtes` };
    }},
  { id: 'tab-5.7-assoc', num: '5.7', theme: 5, level: 'A',
    title: "Pour chaque tableau de données, la technique appropriée pour associer les cellules est-elle utilisée ?",
    advice: "Utilisez scope sur <th>, ou headers sur <td>, pour les tableaux complexes.",
    run: () => {
      const tables = [...document.querySelectorAll('table')].filter(t => !/presentation|none/.test(t.getAttribute('role') || ''));
      if (!tables.length) return { status: 'NA', count: 0 };
      // Un tableau simple (1 seule ligne d'en-têtes dans thead, pas de rowspan/colspan) n'a pas besoin
      // de scope explicite — c'est implicite pour les <th> dans <thead>. Seuls les tableaux complexes
      // doivent être signalés.
      const isComplex = (t) =>
        t.querySelector('[rowspan],[colspan]') ||
        t.querySelectorAll('thead tr').length > 1 ||
        (t.querySelectorAll('th').length > 0 && t.querySelectorAll('thead').length === 0);
      const bad = tables.filter(t => {
        if (!isComplex(t)) return false; // tableau simple → C implicite
        const ths = [...t.querySelectorAll('th')];
        if (!ths.length) return false; // couvert par 5.6
        const scoped = ths.filter(th => th.getAttribute('scope')).length;
        const tdsHeaders = [...t.querySelectorAll('td[headers]')].length;
        return scoped === 0 && tdsHeaders === 0;
      });
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} tableau(x) complexe(s) sans scope ni headers`, samples: sampleElements(bad) }
        : { status: 'C', count: 0 };
    }},
  { id: 'tab-5.8-layout', num: '5.8', theme: 5, level: 'A',
    title: "Chaque tableau de mise en forme ne doit pas utiliser d'éléments propres aux tableaux de données.",
    advice: "Les <table role=\"presentation\"> ne doivent pas contenir <th>, <caption>, scope, headers, summary.",
    run: () => {
      const layout = [...document.querySelectorAll('table[role=presentation], table[role=none]')];
      if (!layout.length) return { status: 'NA', count: 0 };
      const bad = layout.filter(t => t.querySelector('th, caption, [scope], [headers], [summary]'));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} tableau(x) de mise en forme avec éléments de données`, samples: sampleElements(bad) }
        : { status: 'C', count: 0 };
    }},
];

const RULES_LIENS = [
  { id: 'lnk-6.1-name', num: '6.1', theme: 6, level: 'A',
    title: "Chaque lien est-il explicite ?",
    advice: "Chaque <a href> doit avoir un texte ou un aria-label explicite (hors contexte).",
    run: () => {
      const links = [...document.querySelectorAll('a[href]')].filter(a => !inNoscript(a) && isVisible(a));
      if (!links.length) return { status: 'NA', count: 0 };
      const empty = links.filter(a => !accessibleName(a));
      const generic = links.filter(a => {
        const name = accessibleName(a).toLowerCase();
        return name && GENERIC_LINK_TEXTS.has(name);
      });
      const bad = [...empty, ...generic];
      if (bad.length) {
        const measure = `${empty.length} lien(s) sans intitulé, ${generic.length} lien(s) peu explicite(s) sur ${links.length}`;
        return { status: 'NC', count: bad.length, measure, samples: sampleElements(bad) };
      }
      return { status: 'C', count: 0, measure: `${links.length} lien(s) avec intitulé non générique` };
    }},
  AUTO_C('lnk-6.2-relevance', '6.2', 6,
    "Chaque lien a-t-il un intitulé pertinent ?",
    "L'intitulé d'un lien doit être compréhensible hors contexte.",
    () => {
      const links = [...document.querySelectorAll('a[href]')].filter(a => {
        if (inNoscript(a) || !isVisible(a)) return false;
        const href = a.getAttribute('href') || '';
        return !href.startsWith('#');
      });
      if (!links.length) return { status: 'NA', count: 0, measure: 'Aucun lien testable' };
      const bad = links.filter(a => {
        const name = accessibleName(a).toLowerCase();
        return !name || name.length < 3 || GENERIC_LINK_TEXTS.has(name);
      });
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} lien(s) avec intitulé non pertinent`, samples: sampleElements(bad) }
        : null;
    }),
  NT('lnk-6.3-image-link', '6.3', 6,
    "Chaque lien composé uniquement d'une image a-t-il une alternative textuelle ?",
    "Un <a> contenant seulement une <img> doit avoir un alt non vide.",
    "Vérifiez que chaque lien contenant uniquement une image a un alt pertinent sur l'image (qui décrit la destination du lien, pas l'image elle-même)."),
  NT('lnk-6.4-image-link-relevant', '6.4', 6,
    "Pour chaque lien image, l'alternative est-elle pertinente ?",
    "L'alternative d'un lien image doit décrire la destination du lien.",
    "Vérifiez que l'attribut alt d'une image utilisée dans un lien décrit la destination du lien, pas le contenu visuel de l'image."),
  NT('lnk-6.5-title', '6.5', 6,
    "Chaque lien dont l'intitulé visible n'est pas suffisant a-t-il un attribut title explicite ?",
    "Un <a title> doit reprendre ou compléter l'intitulé visible du lien.",
    "Vérifiez que les attributs title sur les liens sont explicites et complémentaires au texte visible. Un title identique au texte visible est inutile."),
  NT('lnk-6.6-consistent', '6.6', 6,
    "Dans chaque page web, chaque lien identique renvoie-t-il à la même destination ?",
    "Deux liens avec le même intitulé doivent pointer vers la même URL.",
    "Vérifiez manuellement que des liens avec un intitulé identique (ex. 'En savoir plus') pointent bien vers des destinations identiques ou que leurs contextes les différencient."),
];

const RULES_SCRIPTS = [
  NT('scr-7.1-compatible', '7.1', 7, "Chaque script est-il, si nécessaire, compatible avec les technologies d'assistance ?", "Vérifiez que les composants JS (tabs, modals) utilisent ARIA correctement."),
  NT('scr-7.2-alt', '7.2', 7, "Pour chaque script ayant une alternative, celle-ci est-elle pertinente ?", "Vérifiez la cohérence des alternatives script."),
  { id: 'scr-7.3-keyboard', num: '7.3', theme: 7, level: 'A',
    title: "Chaque script est-il contrôlable par le clavier et par tout dispositif de pointage ?",
    advice: "Évitez onclick sur <div>/<span> sans tabindex+role. Préférez <button>/<a>.",
    run: () => {
      const bad = [...document.querySelectorAll('[onclick]')].filter(el => {
        const tag = el.tagName.toLowerCase();
        if (['a', 'button', 'input', 'textarea', 'select', 'label', 'summary'].includes(tag)) return false;
        if (el.hasAttribute('tabindex') && el.hasAttribute('role')) return false;
        return true;
      });
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} élément(s) cliquables non-natifs sans tabindex+role`, samples: sampleElements(bad) }
        : { status: 'C', count: 0 };
    }},
  NT('scr-7.4-alt-keyboard', '7.4', 7, "Pour chaque script initiant un changement de contexte, l'utilisateur est-il averti ou en a-t-il le contrôle ?", "Vérifiez que les changements de contexte sont prévisibles."),
  { id: 'scr-7.5-aria-live', num: '7.5', theme: 7, level: 'A',
    title: "Dans chaque page web, les messages de statut sont-ils correctement restitués par les technologies d'assistance ?",
    advice: "Utilisez role=\"status\", role=\"alert\" ou aria-live pour les messages dynamiques.",
    run: () => {
      const live = [...document.querySelectorAll('[aria-live], [role=alert], [role=status], [role=log]')];
      if (!live.length) return { status: 'NA', count: 0, measure: 'Aucune zone aria-live détectée' };
      return { status: 'C', count: 0, measure: `${live.length} zone(s) aria-live déclarée(s)` };
    }},
];

const RULES_OBLIGATOIRES = [
  { id: 'obl-8.1-doctype', num: '8.1', theme: 8, level: 'A',
    title: "Chaque page web est-elle définie par un type de document ?",
    advice: "Ajoutez <!DOCTYPE html> en première ligne.",
    run: () => {
      const dt = document.doctype;
      return dt ? { status: 'C', count: 0, measure: `DOCTYPE: ${dt.name}` }
                : { status: 'NC', count: 1, measure: 'DOCTYPE absent', samples: sampleElements([document.documentElement]) };
    }},
  { id: 'obl-8.2-valid', num: '8.2', theme: 8, level: 'A',
    title: "Pour chaque page web, le code source généré est-il valide ?",
    advice: "Éliminez les id dupliqués et attributs invalides. Test complet via validator.w3.org.",
    run: () => {
      const ids = new Map();
      document.querySelectorAll('[id]').forEach(el => {
        const k = el.id;
        ids.set(k, (ids.get(k) || []).concat(el));
      });
      const dup = [];
      for (const [, list] of ids) if (list.length > 1) dup.push(...list);
      if (dup.length) return { status: 'NC', count: dup.length, measure: `${dup.length} élément(s) avec id dupliqué`, samples: sampleElements(dup) };
      return { status: 'NT', count: 0, measure: `${ids.size} id(s) uniques — validation W3C profonde non automatisable`, manualPrompt: 'Validez le code source via validator.w3.org pour une conformité complète.' };
    }},
  { id: 'obl-8.3-lang', num: '8.3', theme: 8, level: 'A',
    title: "Dans chaque page web, la langue par défaut est-elle présente ?",
    advice: "Ajoutez lang=\"fr\" (ou autre code BCP 47) sur <html>.",
    run: () => {
      const lang = document.documentElement.getAttribute('lang');
      return (lang?.trim())
        ? { status: 'C', count: 0, measure: `lang="${lang}"` }
        : { status: 'NC', count: 1, measure: 'Attribut lang absent sur <html>', samples: sampleElements([document.documentElement]) };
    }},
  { id: 'obl-8.4-lang-valid', num: '8.4', theme: 8, level: 'A',
    title: "Pour chaque page web ayant une langue par défaut, le code de langue est-il pertinent ?",
    advice: "Utilisez un code BCP 47 valide (ex: \"fr\", \"fr-FR\", \"en\").",
    run: () => {
      const lang = document.documentElement.getAttribute('lang');
      if (!lang) return { status: 'NA', count: 0 };
      const valid = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(lang.trim());
      return valid
        ? { status: 'C', count: 0, measure: `lang="${lang}" valide` }
        : { status: 'NC', count: 1, measure: `lang="${lang}" n'est pas un BCP 47 valide`, samples: sampleElements([document.documentElement]) };
    }},
  { id: 'obl-8.5-title', num: '8.5', theme: 8, level: 'A',
    title: "Chaque page web a-t-elle un titre de page ?",
    advice: "Ajoutez un <title> non vide dans le <head>.",
    run: () => {
      const t = document.title?.trim();
      return t
        ? { status: 'C', count: 0, measure: `title: « ${t.slice(0, 80)} »` }
        : { status: 'NC', count: 1, measure: '<title> vide ou manquant' };
    }},
  { id: 'obl-8.6-title-relevant', num: '8.6', theme: 8, level: 'A',
    title: "Pour chaque page web ayant un titre, ce titre est-il pertinent ?",
    advice: "Le <title> doit décrire la page (et non être \"Document\", \"Untitled\", le nom du CMS…).",
    run: () => {
      const t = document.title?.trim();
      if (!t) return { status: 'NA', count: 0 };
      const generic = /^(untitled|document|home|index|page|sans titre|accueil|new tab|nouvel onglet)\.?$/i;
      if (generic.test(t)) return { status: 'NC', count: 1, measure: `title peu explicite : « ${t} »` };
      return { status: 'C', count: 0, measure: `title explicite : « ${t.slice(0, 80)} »` };
    }},
  { id: 'obl-8.7-lang-sub', num: '8.7', theme: 8, level: 'A',
    title: "Dans chaque page web, chaque changement de langue est-il indiqué dans le code source ?",
    advice: "Ajoutez lang=\"en\" sur toute portion en anglais dans une page française.",
    run: () => {
      // La détection automatique des passages multilingues non balisés est non fiable (faux positifs).
      // On vérifie uniquement la validité des attributs lang déjà présents.
      const els = [...document.querySelectorAll('[lang]')].filter(el => el !== document.documentElement);
      if (!els.length) {
        // Pas de passage balisé — impossible de savoir si des passages existent sans analyse textuelle
        return { status: 'NT', count: 0, measure: 'Aucun attribut lang sur des passages (hors <html>)', manualPrompt: "Vérifiez que chaque passage dans une langue différente de la langue principale de la page est balisé avec l'attribut lang approprié (ex: lang=\"en\")." };
      }
      const bad = els.filter(el => !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test((el.getAttribute('lang') || '').trim()));
      if (bad.length) return { status: 'NC', count: bad.length, measure: `${bad.length} attribut(s) lang invalide(s) sur passages`, samples: sampleElements(bad) };
      return { status: 'NT', count: 0, measure: `${els.length} passage(s) avec attribut lang valide — vérifiez que tous les passages multilingues sont couverts`, manualPrompt: "Vérifiez que chaque passage dans une langue différente de la langue principale est balisé avec l'attribut lang approprié." };
    }},
  NT('obl-8.8-dir', '8.8', 8, "Dans chaque page web, le code de langue de chaque changement de langue est-il valide et pertinent ?", "Vérifiez les codes de langue sur les passages multilingues."),
  { id: 'obl-8.9-strict', num: '8.9', theme: 8, level: 'A',
    title: "Dans chaque page web, les balises ne doivent pas être utilisées uniquement à des fins de présentation.",
    advice: "Remplacez <center>, <font>, <marquee> et <blink> par des équivalents CSS. Ces éléments HTML4 n'ont aucun sens sémantique.",
    run: () => {
      const deprecated = [...document.querySelectorAll('center, font, marquee, blink')].filter(isVisible);
      if (!deprecated.length) return { status: 'C', count: 0, measure: 'Aucun élément purement présentationnel détecté' };
      return { status: 'NC', count: deprecated.length,
        measure: `${deprecated.length} élément(s) HTML4 purement présentationnel(s) (<center>, <font>, <marquee>, <blink>)`,
        samples: sampleElements(deprecated) };
    }},
  NT('obl-8.10-dir', '8.10', 8, "Dans chaque page web, les changements du sens de lecture sont-ils signalés ?", "Vérifiez les attributs dir sur les passages RTL/LTR."),
];

const RULES_STRUCTURATION = [
  { id: 'str-9.1-headings', num: '9.1', theme: 9, level: 'A',
    title: "Dans chaque page web, l'information est-elle structurée par l'utilisation appropriée de titres ?",
    advice: "Utilisez h1…h6 pour hiérarchiser le contenu. Une page doit avoir un h1.",
    run: () => {
      const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')];
      if (!hs.length) return { status: 'NC', count: 1, measure: 'Aucun titre (h1-h6) détecté' };
      const h1s = document.querySelectorAll('h1').length;
      if (h1s === 0) return { status: 'NC', count: 1, measure: 'Aucun titre <h1>' };
      const levels = hs.map(h => h.getAttribute('role') === 'heading'
        ? +(h.getAttribute('aria-level') || 2)
        : +h.tagName[1]);
      const errs = []; let prev = 0;
      for (let i = 0; i < hs.length; i++) {
        const lvl = levels[i];
        if (prev !== 0 && lvl > prev + 1) errs.push(hs[i]);
        prev = lvl;
      }
      return errs.length
        ? { status: 'NC', count: errs.length, measure: `${errs.length} saut(s) de niveau détecté(s) · ${h1s} h1`, samples: sampleElements(errs) }
        : { status: 'C', count: 0, measure: `${hs.length} titre(s) · ${h1s} h1` };
    }},
  AUTO_C('str-9.2-outline', '9.2', 9,
    "La structure du document est-elle cohérente ?",
    "Les <section>/<article> doivent contenir un titre de niveau approprié.",
    () => {
      const sections = [...document.querySelectorAll('section, article')];
      if (!sections.length) return { status: 'NA', count: 0, measure: 'Aucune section/article' };
      const bad = sections.filter(s => !s.querySelector('h1,h2,h3,h4,h5,h6,[role=heading]') && !s.getAttribute('aria-label') && !s.getAttribute('aria-labelledby'));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} section(s)/article(s) sans titre ni aria-label`, samples: sampleElements(bad) }
        : null;
    }),
  { id: 'str-9.3-lists', num: '9.3', theme: 9, level: 'A',
    title: "Dans chaque page web, chaque liste est-elle correctement structurée ?",
    advice: "Utilisez <ul>/<ol>/<dl> pour les listes ; évitez les pseudo-listes en « • ».",
    run: () => {
      const suspicious = [...document.querySelectorAll('p, div')].filter(el => {
        const t = el.textContent.trim();
        return /^[•·●‣▪\-\*]\s/.test(t) && !el.closest('ul,ol,dl');
      });
      if (suspicious.length) return { status: 'NC', count: suspicious.length, measure: `${suspicious.length} pseudo-liste(s) détectée(s)`, samples: sampleElements(suspicious.slice(0, 20)) };
      return { status: 'C', count: 0, measure: 'Aucune pseudo-liste suspecte détectée' };
    }},
  AUTO_C('str-9.4-citation', '9.4', 9,
    "Chaque citation est-elle correctement indiquée ?",
    "Les citations doivent utiliser <blockquote> ou <q>, avec éventuellement un cite=\"url\".",
    () => {
      const quotes = [...document.querySelectorAll('blockquote, q')];
      if (!quotes.length) return { status: 'NA', count: 0, measure: 'Aucune citation balisée' };
      const bad = quotes.filter(q => (q.textContent || '').trim().length < 3);
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} citation(s) vide(s) ou trop courte(s)`, samples: sampleElements(bad) }
        : null;
    }),
  AUTO_C('str-9.5-sections', '9.5', 9,
    "L'utilisation d'éléments structurants est-elle cohérente ?",
    "Une page doit combiner <header>, <nav>, <main>, <footer> de manière cohérente.",
    () => {
      const landmarks = ['header', 'nav', 'main', 'footer'].filter(t => document.querySelector(t));
      if (landmarks.length < 2) {
        return { status: 'NC', count: 1, measure: `Seulement ${landmarks.length} landmark(s) structurant(s) : ${landmarks.join(', ') || 'aucun'}` };
      }
      return null;
    }),
  NT('str-9.6-text-sense', '9.6', 9,
    "Dans chaque page web, chaque suite de texte non explicite est-elle suivie d'une explication ?",
    "Les passages de texte sans signification propre (ex. lettres isolées, codes) doivent être accompagnés d'une explication.",
    "Vérifiez que tout contenu textuel non évident (acronymes sans développé, codes, sigles) est explicité en contexte ou via <abbr title>."),
];

const RULES_PRESENTATION = [
  NT('pre-10.1-css-info', '10.1', 10, "Dans le site web, des feuilles de styles sont-elles utilisées pour contrôler la présentation de l'information ?", "Vérifiez que la mise en forme est faite en CSS et non en HTML."),
  NT('pre-10.2-css-off', '10.2', 10, "Dans chaque page web, le contenu visible porteur d'information reste-t-il présent lorsque les feuilles de styles sont désactivées ?", "Désactivez CSS et vérifiez que le contenu reste lisible."),
  NT('pre-10.3-css-off-sense', '10.3', 10, "Dans chaque page web, l'information reste-t-elle compréhensible lorsque les feuilles de styles sont désactivées ?", "Vérifiez la compréhension avec CSS désactivé."),
  { id: 'pre-10.4-zoom', num: '10.4', theme: 10, level: 'AA',
    title: "Dans chaque page web, le texte reste-t-il lisible lorsque la taille des caractères est augmentée jusqu'à 200% ?",
    advice: "Évitez user-scalable=no et maximum-scale=1 dans le meta viewport.",
    run: () => {
      const v = document.querySelector('meta[name=viewport]');
      if (!v) return { status: 'C', count: 0, measure: 'Aucune balise viewport — zoom natif préservé' };
      const c = v.getAttribute('content') || '';
      if (/user-scalable=\s*no/.test(c) || /maximum-scale=\s*1(?!\d)/.test(c))
        return { status: 'NC', count: 1, measure: `viewport bloque le zoom : ${c}`, samples: sampleElements([v]) };
      return { status: 'C', count: 0, measure: `viewport autorise le zoom` };
    }},
  NT('pre-10.5-contrast-not-unique', '10.5', 10, "Dans chaque page web, les déclarations CSS de couleurs de fond d'élément et de police sont-elles correctement utilisées ?", "Vérifiez la cohérence fond/texte dans toutes les déclarations CSS."),
  NT('pre-10.6-link-distinct', '10.6', 10, "Dans chaque page web, chaque lien dont la nature n'est pas évidente est-il visible par rapport au texte environnant ?", "Vérifiez que les liens sont reconnaissables (soulignement, couleur…) sans ambiguïté."),
  { id: 'pre-10.7-focus-visible', num: '10.7', theme: 10, level: 'AA',
    title: "Dans chaque page web, pour chaque élément recevant le focus, la prise de focus est-elle visible ?",
    advice: "Ne supprimez pas outline sans alternative (:focus-visible avec un style équivalent).",
    run: () => {
      // Heuristique : détecter les règles globales qui suppriment l'outline
      let killers = 0;
      try {
        for (const sh of document.styleSheets) {
          try {
            for (const r of sh.cssRules || []) {
              if (r.style && r.selectorText && /:focus\b/.test(r.selectorText)) {
                const o = r.style.outline || r.style.outlineStyle;
                if (o && /none|0/.test(o) && !/:focus-visible/.test(r.selectorText)) killers++;
              }
            }
          } catch {} // CORS stylesheet
        }
      } catch {}
      if (killers > 0) return { status: 'NC', count: killers, measure: `${killers} règle(s) CSS suppriment :focus outline sans :focus-visible` };
      // Si on n'a pas pu lire les feuilles de style (toutes CORS), résultat non fiable
      let total = 0, readable = 0;
      try { for (const sh of document.styleSheets) { total++; try { void sh.cssRules; readable++; } catch {} } } catch {}
      if (total > 0 && readable / total < 0.3) {
        return { status: 'NT', count: 0, measure: `Feuilles de style inaccessibles (CORS) — ${readable}/${total} lues`, manualPrompt: 'Vérifiez manuellement que :focus n\'est pas masqué sans :focus-visible.' };
      }
      return { status: 'C', count: 0, measure: 'Aucune règle CSS ne supprime le focus visible' };
    }},
  NT('pre-10.8-hidden-content', '10.8', 10, "Dans chaque page web, le contenu caché doit-il être ignoré par les technologies d'assistance ?", "Vérifiez l'usage correct d'aria-hidden et display:none."),
  NT('pre-10.9-info-not-by-shape', '10.9', 10, "Dans chaque page web, l'information ne doit pas être donnée uniquement par la forme, taille ou position.", "Vérifiez qu'aucune information ne dépend uniquement de forme/position/taille."),
  NT('pre-10.10-info-not-by-shape-2', '10.10', 10, "Dans chaque page web, l'information ne doit pas être donnée uniquement par la forme, taille ou position (impl.).", "Vérifiez manuellement."),
  NT('pre-10.11-text-resize', '10.11', 10, "Pour chaque page web, les contenus textuels peuvent-ils être agrandis sans perte d'information ni de fonctionnalité ?", "Testez l'agrandissement via zoom navigateur."),
  NT('pre-10.12-spacing', '10.12', 10, "Dans chaque page web, les propriétés d'espacement du texte peuvent-elles être redéfinies par l'utilisateur sans perte de contenu ou de fonctionnalité ?", "Appliquez les valeurs WCAG 1.4.12 et vérifiez."),
  NT('pre-10.13-tooltip', '10.13', 10, "Dans chaque page web, les contenus cachés visibles au survol ou au focus sont-ils contrôlables ?", "Vérifiez les tooltips (fermeture, persistance, survol)."),
  NT('pre-10.14-reflow', '10.14', 10,
    "Dans chaque page web, les contenus peuvent-ils être présentés sans perte d'information pour un affichage en 320 px de large (WCAG 1.4.10) ?",
    "Testez l'affichage à 320 px de large (zoom 400% sur écran 1280 px) : aucun défilement horizontal ne doit être nécessaire pour lire le contenu.",
    "Affichez la page à 320 px de largeur ou zoomez à 400% sur un écran 1280 px. Vérifiez qu'aucun contenu n'est tronqué et qu'aucun défilement horizontal n'est nécessaire."),
];

const RULES_FORMULAIRES = [
  { id: 'frm-11.1-label', num: '11.1', theme: 11, level: 'A',
    title: "Chaque champ de formulaire a-t-il une étiquette ?",
    advice: "Associez un <label for=\"id\"> à chaque champ, ou utilisez aria-label/aria-labelledby.",
    run: () => {
      const fields = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea')].filter(el => !inNoscript(el));
      if (!fields.length) return { status: 'NA', count: 0 };
      const bad = fields.filter(el => !accessibleName(el));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} champ(s) sans label`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${fields.length} champ(s) labellisé(s)` };
    }},
  NT('frm-11.2-label-relevant', '11.2', 11, "Chaque étiquette associée à un champ de formulaire est-elle pertinente ?", "Vérifiez que chaque label décrit clairement le champ."),
  NT('frm-11.3-label-consistent', '11.3', 11, "Dans chaque formulaire, chaque étiquette associée à un champ ayant la même fonction est-elle cohérente ?", "Vérifiez la cohérence des étiquettes pour les champs récurrents."),
  NT('frm-11.4-label-contigue', '11.4', 11, "Dans chaque formulaire, chaque étiquette et son champ associé sont-ils accolés ?", "Vérifiez la proximité visuelle label/champ."),
  { id: 'frm-11.5-fieldset', num: '11.5', theme: 11, level: 'A',
    title: "Dans chaque formulaire, les champs de même nature sont-ils regroupés ?",
    advice: "Groupez les radios/checkboxes de même thématique par <fieldset> + <legend>.",
    run: () => {
      const groups = new Map();
      [...document.querySelectorAll('input[type=radio][name], input[type=checkbox][name]')].filter(el => !inNoscript(el)).forEach(el => {
        if (!groups.has(el.name)) groups.set(el.name, []);
        groups.get(el.name).push(el);
      });
      const bad = [];
      for (const [, list] of groups) {
        if (list.length >= 2 && !list[0].closest('fieldset')) bad.push(...list);
      }
      if (!groups.size) return { status: 'NA', count: 0 };
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} champ(s) groupables sans <fieldset>`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${groups.size} groupe(s) correctement structuré(s)` };
    }},
  { id: 'frm-11.6-legend', num: '11.6', theme: 11, level: 'A',
    title: "Chaque regroupement de champs de formulaire a-t-il une légende ?",
    advice: "Chaque <fieldset> doit contenir un <legend>.",
    run: () => {
      const fs = [...document.querySelectorAll('fieldset')];
      if (!fs.length) return { status: 'NA', count: 0 };
      const bad = fs.filter(f => !f.querySelector(':scope > legend'));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} fieldset(s) sans legend`, samples: sampleElements(bad) }
        : { status: 'C', count: 0 };
    }},
  NT('frm-11.7-legend-relevant', '11.7', 11, "La légende de chaque regroupement est-elle pertinente ?", "Vérifiez que chaque legend décrit le groupe."),
  NT('frm-11.8-order', '11.8', 11, "Dans chaque formulaire, les items d'une liste de choix sont-ils correctement structurés ?", "Vérifiez la structure des <select> / <optgroup>."),
  { id: 'frm-11.9-button-name', num: '11.9', theme: 11, level: 'A',
    title: "Dans chaque formulaire, l'intitulé de chaque bouton est-il pertinent ?",
    advice: "Ajoutez un texte visible, un aria-label ou un aria-labelledby à chaque bouton.",
    run: () => {
      const btns = [...document.querySelectorAll('button, [role=button], input[type=submit], input[type=button], input[type=reset], input[type=image]')].filter(b => !inNoscript(b));
      if (!btns.length) return { status: 'NA', count: 0 };
      const bad = btns.filter(b => !accessibleName(b));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} bouton(s) sans nom accessible`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${btns.length} bouton(s) nommé(s)` };
    }},
  NT('frm-11.10-check', '11.10', 11,
    "Dans chaque formulaire, le contrôle de saisie est-il utilisé de manière pertinente ?",
    "Utilisez aria-invalid, aria-describedby pour signaler/décrire une erreur.",
    "Soumettez le formulaire avec des données invalides et vérifiez que les erreurs sont signalées via aria-invalid=\"true\" et décrites par aria-describedby.",
    'A'),
  NT('frm-11.11-help', '11.11', 11, "Dans chaque formulaire, le contrôle de saisie est-il accompagné, si nécessaire, de suggestions ?", "Vérifiez la présence d'aide à la correction des erreurs."),
  NT('frm-11.12-validation', '11.12', 11, "Pour chaque formulaire entraînant une obligation légale ou financière, les données saisies peuvent-elles être modifiées, mises à jour ou récupérées ?", "Vérifiez la possibilité de relire/modifier avant soumission."),
  { id: 'frm-11.13-autofill', num: '11.13', theme: 11, level: 'AA',
    title: "La finalité d'un champ de saisie peut-elle être déduite ?",
    advice: "Ajoutez autocomplete=\"email\", autocomplete=\"name\", etc. sur les champs personnels.",
    run: () => {
      // Valeurs autocomplete HTML valides (sous-ensemble des 53 critiques pour les coordonnées personnelles)
      const VALID_AUTOCOMPLETE = new Set([
        'name','honorific-prefix','given-name','additional-name','family-name','honorific-suffix',
        'nickname','username','new-password','current-password','one-time-code',
        'organization-title','organization',
        'street-address','address-line1','address-line2','address-line3',
        'address-level1','address-level2','address-level3','address-level4',
        'country','country-name','postal-code',
        'cc-name','cc-given-name','cc-additional-name','cc-family-name',
        'cc-number','cc-exp','cc-exp-month','cc-exp-year','cc-csc','cc-type',
        'transaction-currency','transaction-amount',
        'language','bday','bday-day','bday-month','bday-year',
        'sex','url','photo',
        'tel','tel-country-code','tel-national','tel-area-code','tel-local','tel-extension',
        'email','impp',
        'off','on'
      ]);
      // Champs à fort enjeu : type email, tel, url + champs texte dont le nom/label suggère une donnée personnelle
      const personalTypeFields = [...document.querySelectorAll('input[type=email], input[type=tel], input[type=url]')]
        .filter(el => !inNoscript(el));
      const personalNamePattern = /^(name|prénom|nom|email|courriel|phone|téléphone|mobile|address|adresse|city|ville|zip|postal|country|pays|birthday|naissance|password|mot.?de.?passe|login|username|utilisateur)$/i;
      const personalTextFields = [...document.querySelectorAll('input[type=text], input:not([type])')]
        .filter(el => {
          if (inNoscript(el)) return false;
          const nm = (el.name || el.id || accessibleName(el) || '').toLowerCase();
          return personalNamePattern.test(nm);
        });
      const allPersonal = [...new Set([...personalTypeFields, ...personalTextFields])];
      if (!allPersonal.length) return { status: 'C', count: 0, measure: 'Aucun champ personnel détecté' };
      const bad = allPersonal.filter(el => {
        const ac = (el.getAttribute('autocomplete') || '').trim().toLowerCase();
        if (!ac || ac === '') return true; // pas d'autocomplete
        // vérifier que la valeur est valide (ignorer les préfixes "shipping " / "billing ")
        const normalized = ac.replace(/^(shipping|billing|home|work|mobile|fax|pager)\s+/, '');
        return !VALID_AUTOCOMPLETE.has(normalized) && !VALID_AUTOCOMPLETE.has(ac);
      });
      if (!bad.length) return { status: 'C', count: 0, measure: `${allPersonal.length} champ(s) personnel(s) avec autocomplete valide` };
      return { status: 'NC', count: bad.length, measure: `${bad.length} champ(s) personnel(s) sans autocomplete valide sur ${allPersonal.length}`, samples: sampleElements(bad) };
    }},
  NT('frm-11.14-auth', '11.14', 11,
    "Pour chaque formulaire d'authentification, une aide à la connexion est-elle proposée (WCAG 3.3.8) ?",
    "L'authentification ne doit pas reposer sur un test cognitif (puzzle, calcul) sans alternative. WebAuthn, copy-paste et gestionnaire de mots de passe doivent fonctionner.",
    "Vérifiez que le formulaire de connexion autorise le copier-coller dans les champs, accepte les gestionnaires de mots de passe (pas d'autocomplete=\"off\" sur le champ password), et ne bloque pas d'assistant cognitif."),
  NT('frm-11.15-help', '11.15', 11,
    "Pour chaque page contenant un formulaire, une aide contextuelle est-elle disponible ?",
    "Un formulaire complexe doit proposer de l'aide : info-bulles, exemples de saisie, lien vers une aide en ligne.",
    "Vérifiez que les champs complexes proposent des exemples de saisie (placeholder, texte adjacent) ou un lien d'aide, et que les erreurs de validation sont clairement expliquées avec des instructions de correction."),
];

const RULES_NAVIGATION = [
  AUTO_C('nav-12.1-plan', '12.1', 12,
    "La page dispose-t-elle d'au moins deux systèmes de navigation ?",
    "Une page doit combiner au moins 2 moyens parmi : menu de navigation, moteur de recherche, plan du site, footer avec liens multiples.",
    () => {
      const hasNav = !!document.querySelector('nav, [role=navigation]');
      const hasSearch = !!document.querySelector('input[type=search], [role=search], form[role=search]');
      const hasPlan = [...document.querySelectorAll('a[href]')].some(a => /plan du site|sitemap/i.test(accessibleName(a) || ''));
      // Un footer avec ≥5 liens internes est équivalent à un plan du site / second système
      const footer = document.querySelector('footer, [role=contentinfo]');
      const footerInternalLinks = footer
        ? [...footer.querySelectorAll('a[href]')].filter(a => {
            const href = a.getAttribute('href') || '';
            return href.startsWith('/') || href.startsWith(location.origin) || (!href.startsWith('http') && !href.startsWith('mailto') && !href.startsWith('#'));
          })
        : [];
      const hasFooterNav = footerInternalLinks.length >= 5;
      const systems = [hasNav && 'nav', hasSearch && 'moteur de recherche', hasPlan && 'plan du site', hasFooterNav && `footer (${footerInternalLinks.length} liens)`].filter(Boolean);
      if (systems.length < 2) {
        return { status: 'NC', count: 1, measure: `Seulement ${systems.length} système(s) de navigation : ${systems.join(', ') || 'aucun'}` };
      }
      return null;
    }),
  NT('nav-12.2-menu-consistency', '12.2', 12, "Dans chaque ensemble de pages, le menu et les barres de navigation sont-ils toujours à la même place ?", "Vérifiez la constance du menu entre pages."),
  NT('nav-12.3-plan-relevant', '12.3', 12, "La page « plan du site » est-elle pertinente ?", "Vérifiez que le plan du site liste bien toutes les pages."),
  { id: 'nav-12.4-landmarks', num: '12.4', theme: 12, level: 'AA',
    title: "Dans chaque page web, la page « plan du site » est-elle atteignable de manière identique ?",
    advice: "Usage cohérent des landmarks (main, nav, header, footer, aside).",
    run: () => {
      const kinds = {
        main: document.querySelectorAll('main, [role=main]').length,
        nav: document.querySelectorAll('nav, [role=navigation]').length,
        header: document.querySelectorAll('header, [role=banner]').length,
        footer: document.querySelectorAll('footer, [role=contentinfo]').length
      };
      if (kinds.main === 0) return { status: 'NC', count: 1, measure: 'Aucun landmark <main>', samples: sampleElements([document.body]) };
      if (kinds.main > 1) return { status: 'NC', count: kinds.main, measure: `${kinds.main} <main> (1 seul autorisé)`, samples: sampleElements([...document.querySelectorAll('main')]) };
      return { status: 'C', count: 0, measure: `main:${kinds.main} · nav:${kinds.nav} · header:${kinds.header} · footer:${kinds.footer}` };
    }},
  NT('nav-12.5-plan-presence', '12.5', 12, "Dans chaque ensemble de pages, la page « aide » est-elle atteignable de manière identique ?", "Vérifiez accès uniforme à l'aide."),
  { id: 'nav-12.6-main', num: '12.6', theme: 12, level: 'A',
    title: "Les zones de regroupement de contenus présentes dans plusieurs pages peuvent-elles être atteintes ou évitées ?",
    advice: "Définissez clairement <main>, <header>, <footer>, <nav>, <aside>.",
    run: () => {
      const main = document.querySelector('main, [role=main]');
      return main
        ? { status: 'C', count: 0, measure: 'Landmark <main> présent' }
        : { status: 'NC', count: 1, measure: 'Pas de landmark <main>', samples: sampleElements([document.body]) };
    }},
  { id: 'nav-12.7-skip-link', num: '12.7', theme: 12, level: 'A',
    title: "Dans chaque page web, un lien d'évitement ou d'accès rapide au contenu est-il présent ?",
    advice: "Ajoutez un lien « Aller au contenu » en première position pointant vers #main.",
    run: () => {
      // Chercher un lien pointant vers des IDs typiques de contenu principal
      const SKIP_IDS = new Set(['main-content','main','content','maincontent','contenu','skip','main-nav','nav','wrapper','page-content','page']);
      // D'abord : y a-t-il un lien ancre vers un ID de contenu connu parmi tous les liens ?
      const allAnchors = [...document.querySelectorAll('a[href^="#"]')];
      const byId = allAnchors.find(a => {
        const hash = a.getAttribute('href').slice(1);
        return SKIP_IDS.has(hash.toLowerCase());
      });
      if (byId) return { status: 'C', count: 0, measure: `Lien d'évitement détecté vers #${byId.getAttribute('href').slice(1)}` };
      // Puis chercher dans les 20 premiers liens ancres par texte ou aria-label
      const anchors = allAnchors.slice(0, 20);
      if (!anchors.length) return { status: 'NC', count: 1, measure: "Aucun lien d'évitement en début de page" };
      const hasSkip = anchors.some(a => {
        const target = document.getElementById(a.getAttribute('href').slice(1));
        return target && /(skip|aller|contenu|main|content|accès rapide|évitement)/i.test(
          a.textContent + ' ' + (a.getAttribute('aria-label') || '')
        );
      });
      return hasSkip
        ? { status: 'C', count: 0, measure: "Lien d'évitement détecté" }
        : { status: 'NC', count: 1, measure: "Aucun lien d'évitement identifié dans les 20 premiers liens ancres", samples: sampleElements(anchors.slice(0, 5)) };
    }},
  { id: 'nav-12.8-tab-order', num: '12.8', theme: 12, level: 'A',
    title: "Dans chaque page web, l'ordre de tabulation est-il cohérent ?",
    advice: "N'utilisez que tabindex=\"0\" ou tabindex=\"-1\". Un tabindex positif casse l'ordre naturel.",
    run: () => {
      const pos = [...document.querySelectorAll('[tabindex]')].filter(el => parseInt(el.getAttribute('tabindex')) > 0);
      return pos.length
        ? { status: 'NC', count: pos.length, measure: `${pos.length} élément(s) avec tabindex positif`, samples: sampleElements(pos) }
        : { status: 'C', count: 0, measure: 'Aucun tabindex positif — ordre naturel préservé' };
    }},
  NT('nav-12.9-no-trap', '12.9', 12, "Dans chaque page web, la navigation ne doit pas contenir de piège au clavier.", "Naviguez au clavier et vérifiez qu'il n'y a pas de piège."),
  NT('nav-12.10-shortcuts', '12.10', 12, "Dans chaque page web, les raccourcis clavier n'utilisant qu'une seule touche sont-ils contrôlables ?", "Vérifiez que les accesskeys/raccourcis peuvent être désactivés ou reconfigurés."),
  NT('nav-12.11-hide', '12.11', 12, "Dans chaque page web, les contenus additionnels apparaissant au survol, à la prise de focus ou à l'activation sont-ils contrôlables ?", "Vérifiez les menus déroulants, tooltips, modales."),
];

const RULES_CONSULTATION = [
  AUTO_C('con-13.1-timeouts', '13.1', 13,
    "L'utilisateur a-t-il le contrôle des limites de temps ?",
    "Évitez <meta http-equiv=\"refresh\"> automatique avec un délai court.",
    () => {
      const refresh = document.querySelector('meta[http-equiv="refresh" i]');
      if (!refresh) return null;
      const content = refresh.getAttribute('content') || '';
      const delay = parseInt(content);
      if (Number.isFinite(delay) && delay > 0 && delay < 60) {
        return { status: 'NC', count: 1, measure: `meta refresh automatique à ${delay}s`, samples: sampleElements([refresh]) };
      }
      return null;
    }),
  { id: 'con-13.2-new-window', num: '13.2', theme: 13, level: 'A',
    title: "Dans chaque page web, pour chaque ouverture de nouvelle fenêtre, l'utilisateur est-il averti ?",
    advice: "Pour target=\"_blank\", ajoutez une mention dans le texte du lien (ex: « (nouvelle fenêtre) »).",
    run: () => {
      const links = [...document.querySelectorAll('a[target=_blank]')];
      if (!links.length) return { status: 'NA', count: 0 };
      const bad = links.filter(a => {
        const name = accessibleName(a).toLowerCase();
        return !/nouvelle fenêtre|new window|external|externe|nouvel onglet|new tab/.test(name);
      });
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} lien(s) target=_blank sans avertissement`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${links.length} lien(s) target=_blank avertissant` };
    }},
  AUTO_C('con-13.3-office', '13.3', 13,
    "Chaque document bureautique a-t-il une version accessible ?",
    "Liens vers PDF/DOC/XLS : indiquer le format et proposer une version HTML accessible.",
    () => {
      const links = [...document.querySelectorAll('a[href]')].filter(a =>
        /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp)(\?|$)/i.test(a.getAttribute('href') || ''));
      if (!links.length) return { status: 'NA', count: 0, measure: 'Aucun lien vers document bureautique' };
      const bad = links.filter(a => !/pdf|word|excel|powerpoint|odt|ods|document|bureautique/i.test(accessibleName(a) || ''));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} lien(s) bureautique(s) sans mention du format`, samples: sampleElements(bad) }
        : null;
    }),
  AUTO_C('con-13.4-office-relevant', '13.4', 13,
    "Version accessible du document bureautique pertinente ?",
    "La version accessible doit être fidèle au document d'origine.",
    () => {
      const links = [...document.querySelectorAll('a[href]')].filter(a =>
        /\.(pdf|docx?|xlsx?)(\?|$)/i.test(a.getAttribute('href') || ''));
      if (!links.length) return { status: 'NA', count: 0, measure: 'Aucun document bureautique' };
      return null;
    }),
  { id: 'con-13.5-abbr', num: '13.5', theme: 13, level: 'AAA',
    title: "Dans chaque page web, chaque abréviation est-elle explicitée ?",
    advice: "Utilisez <abbr title=\"forme développée\">.",
    run: () => {
      const abbrs = [...document.querySelectorAll('abbr')];
      if (!abbrs.length) return { status: 'NT', count: 0, measure: 'Aucune balise <abbr> — abréviations en texte brut non détectables automatiquement', manualPrompt: 'Repérez les abréviations dans le texte et vérifiez que chacune est explicitée via <abbr title="..."> ou en clair dans le texte.' };
      const bad = abbrs.filter(a => !a.getAttribute('title')?.trim());
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} <abbr> sans title`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${abbrs.length} <abbr> explicitée(s)` };
    }},
  NT('con-13.6-simpler', '13.6', 13, "Dans chaque page web, pour chaque texte pouvant faire l'objet d'une version clarifiée, celle-ci est-elle disponible ?", "Vérifiez présence d'une version FALC si nécessaire."),
  { id: 'con-13.7-animation', num: '13.7', theme: 13, level: 'A',
    title: "Dans chaque page web, les changements brusques de luminosité ou les effets de flash sont-ils correctement utilisés ?",
    advice: "Évitez <marquee>/<blink>. Pour les animations CSS, respectez prefers-reduced-motion.",
    run: () => {
      const legacy = [...document.querySelectorAll('marquee, blink')];
      if (legacy.length) return { status: 'NC', count: legacy.length, measure: `${legacy.length} élément(s) <marquee>/<blink> détecté(s)`, samples: sampleElements(legacy) };
      return { status: 'C', count: 0, measure: 'Aucun élément <marquee>/<blink> détecté' };
    }},
  AUTO_C('con-13.8-animation-control', '13.8', 13,
    "Chaque contenu en mouvement est-il contrôlable par l'utilisateur ?",
    "Toute animation/vidéo autoplay doit offrir un contrôle pause/stop.",
    () => {
      const autoplay = [...document.querySelectorAll('video[autoplay], audio[autoplay]')].filter(m => !m.controls);
      if (autoplay.length) return { status: 'NC', count: autoplay.length, measure: `${autoplay.length} média(s) autoplay sans controls`, samples: sampleElements(autoplay) };
      return null;
    }),
  { id: 'con-13.9-orientation', num: '13.9', theme: 13, level: 'AA',
    title: "Dans chaque page web, le contenu proposé est-il consultable quelle que soit l'orientation de l'écran ?",
    advice: "Évitez @media (orientation: portrait/landscape) qui forcent un affichage.",
    run: () => {
      let blocking = 0;
      try {
        for (const sh of document.styleSheets) {
          try {
            for (const r of sh.cssRules || []) {
              if (r.type === CSSRule.MEDIA_RULE && /orientation\s*:/.test(r.conditionText || r.media?.mediaText || '')) {
                // Heuristique : si un @media orientation:portrait/landscape masque du contenu → risque
                for (const inner of r.cssRules || []) {
                  if (/display\s*:\s*none/i.test(inner.cssText)) blocking++;
                }
              }
            }
          } catch {}
        }
      } catch {}
      if (blocking > 0) return { status: 'NC', count: blocking, measure: `${blocking} règle(s) CSS masquant du contenu selon orientation` };
      return { status: 'C', count: 0 };
    }},
  NT('con-13.10-gestures', '13.10', 13, "Dans chaque page web, les fonctionnalités utilisables ou disponibles par un geste complexe peuvent-elles être également disponibles par un geste simple ?", "Vérifiez gestes multi-points / personnalisés."),
  NT('con-13.11-pointer-cancel', '13.11', 13, "Dans chaque page web, les actions déclenchées via un dispositif de pointage sur un point unique de l'écran peuvent-elles faire l'objet d'une annulation ?", "Vérifiez l'annulation (mouseup hors cible)."),
  NT('con-13.12-shake', '13.12', 13, "Dans chaque page web, les fonctionnalités qui impliquent un mouvement de l'appareil peuvent-elles être satisfaites de manière alternative ?", "Vérifiez les secousses/rotations."),
];

const ALL_A11Y = [
  ...RULES_IMAGES, ...RULES_CADRES, ...RULES_COULEURS, ...RULES_MULTIMEDIA,
  ...RULES_TABLEAUX, ...RULES_LIENS, ...RULES_SCRIPTS, ...RULES_OBLIGATOIRES,
  ...RULES_STRUCTURATION, ...RULES_PRESENTATION, ...RULES_FORMULAIRES,
  ...RULES_NAVIGATION, ...RULES_CONSULTATION
];

// ═══════════════════════════════════════════════════════════════
// §5  Règles Eco — RGESN 2024 (9 thèmes)
// ═══════════════════════════════════════════════════════════════
const resourceEntries = () => nrResourceSnapshot;
const navEntry = () => nrNavSnapshot;

// Convention : status 'C' | 'NC' | 'NA' | 'NT', severity garde 'mineur'|'majeur'|'critique' pour NC.
const asRuleResult = ({ severity, count = 0, measure, elements = [], details }) => {
  if (severity === 'ok') return { status: 'C', count: 0, measure, details };
  return { status: 'NC', severity, count: elements.length || count, measure, samples: sampleElements(elements), details };
};

const RULES_ECO = [

  // ════════════════════════════════════════════════════════════
  // Thématique 1 — Stratégie
  // ════════════════════════════════════════════════════════════
  NT('eco-strat-1.1', '1.1', 'Stratégie',
    "Utilité du service évaluée",
    "Évaluez et documentez si le service numérique est réellement utile face à ses impacts environnementaux."),
  NT('eco-strat-1.2', '1.2', 'Stratégie',
    "Démarche d'écoconception formalisée",
    "Mettez en place une politique d'écoconception documentée et partagée avec les équipes projet."),
  NT('eco-strat-1.3', '1.3', 'Stratégie',
    "Référent écoconception désigné",
    "Désignez au moins un référent écoconception numérique dans l'équipe."),
  NT('eco-strat-1.4', '1.4', 'Stratégie',
    "Critères environnementaux dans la sélection des prestataires",
    "Incluez des critères environnementaux (écoconception, hébergement vert, etc.) dans vos appels d'offres."),
  NT('eco-strat-1.5', '1.5', 'Stratégie',
    "Terminaux cibles identifiés",
    "Identifiez les terminaux (mobile, tablette, desktop) utilisés par vos utilisateurs pour adapter la conception."),
  { id: 'eco-strat-local-storage', num: '1.6', theme: 'Stratégie',
    title: "Collecte de données responsable (cookies et stockage client)",
    advice: "Limitez le nombre de cookies et la taille du localStorage. Stockez uniquement les données strictement nécessaires côté client.",
    run: () => {
      let lsTotal = 0;
      try { for (const k of Object.keys(localStorage)) lsTotal += (localStorage.getItem(k) || '').length * 2; } catch {}
      const cookies = document.cookie ? document.cookie.split(';').filter(c => c.trim()) : [];
      const details = [
        { label: 'localStorage', value: `${(lsTotal/1024).toFixed(0)} Ko (${Object.keys(localStorage).length} clés)` },
        { label: 'Cookies', value: `${cookies.length} cookie(s)` },
      ];
      const severity = lsTotal > 512000 || cookies.length > 15 ? 'critique'
        : lsTotal > 102400 || cookies.length > 8 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${cookies.length} cookie(s) · ${(lsTotal/1024).toFixed(0)} Ko localStorage`, details });
    }},
  NT('eco-strat-1.7', '1.7', 'Stratégie',
    "Système de mesure des impacts environnementaux",
    "Mettez en place un outil de mesure de l'empreinte carbone du service (GreenIT Analysis, Ecoindex, etc.)."),
  NT('eco-strat-1.8', '1.8', 'Stratégie',
    "Objectifs environnementaux communiqués aux équipes",
    "Partagez les objectifs d'écoconception et formez les équipes (dev, design, PO) à ces enjeux."),
  NT('eco-strat-1.9', '1.9', 'Stratégie',
    "Démarche révisée régulièrement",
    "Planifiez des revues périodiques de la démarche d'écoconception pour l'améliorer."),
  NT('eco-strat-1.10', '1.10', 'Stratégie',
    "Déclaration d'écoconception publiée",
    "Publiez une déclaration d'écoconception accessible depuis le service (ex : lien en pied de page)."),

  // ════════════════════════════════════════════════════════════
  // Thématique 2 — Spécifications
  // ════════════════════════════════════════════════════════════
  NT('eco-spec-2.1', '2.1', 'Spécifications',
    "Fonctionnalités du service définies et documentées",
    "Listez et documentez les fonctionnalités du service pour identifier les potentielles redondances ou superfluités."),
  NT('eco-spec-2.2', '2.2', 'Spécifications',
    "Fonctionnalités peu utilisées identifiées",
    "Analysez les analytics pour identifier et supprimer ou réduire les fonctionnalités peu ou pas utilisées."),
  NT('eco-spec-2.3', '2.3', 'Spécifications',
    "Nombre de fonctionnalités limité au nécessaire",
    "Appliquez le principe de sobriété fonctionnelle : ne développez que ce qui répond à un besoin réel avéré."),
  { id: 'eco-spec-service-worker', num: '2.4', theme: 'Spécifications',
    title: "Fonctionnement en connexion dégradée",
    advice: "Enregistrez un Service Worker pour permettre un mode hors-ligne ou bas débit. Proposez un contenu minimal en cas de réseau lent.",
    run: () => {
      if (!('serviceWorker' in navigator)) return { status: 'NT', count: 0, measure: 'API Service Worker non disponible', manualPrompt: 'Vérifiez si une alternative bas débit est proposée.' };
      try {
        const regs = navigator.serviceWorker.controller;
        const severity = regs ? 'ok' : 'majeur';
        return asRuleResult({ severity, measure: regs ? 'Service Worker actif' : 'Aucun Service Worker enregistré' });
      } catch { return { status: 'NT', count: 0, measure: 'Inaccessible', manualPrompt: 'Vérifiez manuellement.' }; }
    }},
  { id: 'eco-spec-viewport', num: '2.5', theme: 'Spécifications',
    title: "Adaptation aux différents types de terminaux",
    advice: "Configurez <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> sans bloquer le zoom.",
    run: () => {
      const v = document.querySelector('meta[name="viewport"]');
      if (!v) return asRuleResult({ severity: 'critique', measure: 'Meta viewport absent' });
      const c = v.getAttribute('content') || '';
      if (/user-scalable=\s*no/.test(c) || /maximum-scale=\s*1(?!\d)/.test(c))
        return asRuleResult({ severity: 'majeur', measure: 'Zoom utilisateur bloqué', elements: [v] });
      if (!c.includes('width=device-width'))
        return asRuleResult({ severity: 'majeur', measure: 'width=device-width manquant', elements: [v] });
      return asRuleResult({ severity: 'ok', measure: 'Viewport correct' });
    }},
  NT('eco-spec-2.6', '2.6', 'Spécifications',
    "Tests de compatibilité avec terminaux anciens",
    "Testez le service sur des terminaux d'entrée de gamme et des modèles de 3-5 ans pour garantir la compatibilité."),
  NT('eco-spec-2.7', '2.7', 'Spécifications',
    "Politique de support des anciens navigateurs",
    "Définissez et documentez les versions minimales de navigateurs supportées pour étendre la durée de vie des terminaux."),
  NT('eco-spec-2.8', '2.8', 'Spécifications',
    "Alternative textuelle ou basse résolution proposée",
    "Proposez une version allégée ou textuelle du service pour les connexions lentes ou terminaux limités."),
  NT('eco-spec-2.9', '2.9', 'Spécifications',
    "Tests en conditions de connectivité dégradée",
    "Testez le service avec des profils réseau limités (3G, 2G) via les DevTools ou des outils de simulation."),

  // ════════════════════════════════════════════════════════════
  // Thématique 3 — Architecture
  // ════════════════════════════════════════════════════════════
  NT('eco-arch-3.1', '3.1', 'Architecture',
    "Formats de données adaptés aux échanges",
    "Utilisez des formats légers (JSON plutôt que XML, protobuf pour les APIs haute fréquence) et évitez la sur-livraison de données."),
  { id: 'eco-arch-third-party', num: '3.2', theme: 'Architecture',
    title: "Nombre de domaines tiers sollicités",
    advice: "Réduisez les dépendances externes. Auto-hébergez les ressources critiques (polices, analytics). Chaque domaine tiers ajoute une résolution DNS.",
    run: () => {
      const host = location.hostname;
      const tp = resourceEntries().filter(e => { try { return new URL(e.name).hostname !== host; } catch { return false; } });
      const hosts = new Set(tp.map(e => { try { return new URL(e.name).hostname; } catch { return ''; } }));
      const domainCounts = {};
      tp.forEach(e => { try { const h = new URL(e.name).hostname; domainCounts[h] = (domainCounts[h] || 0) + 1; } catch {} });
      const details = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)
        .map(([domain, count]) => ({ label: domain, value: `${count} req.` }));
      const severity = hosts.size > 10 ? 'critique' : hosts.size > 5 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${hosts.size} domaine(s) tiers, ${tp.length} requête(s)`, count: hosts.size, details });
    }},
  { id: 'eco-arch-http2', num: '3.3', theme: 'Architecture',
    title: "Protocoles efficaces (HTTP/2 ou HTTP/3)",
    advice: "Activez HTTP/2 ou HTTP/3 sur votre serveur. Ces protocoles multiplex les requêtes et réduisent la latence.",
    run: () => {
      const entries = resourceEntries().filter(e => e.nextHopProtocol);
      if (!entries.length) return { status: 'NT', count: 0, measure: 'Protocole non détectable (cross-origin)', manualPrompt: 'Vérifiez la configuration HTTP/2 de votre serveur.' };
      const old = entries.filter(e => e.nextHopProtocol === 'http/1.1' || e.nextHopProtocol === 'http/1.0');
      const details = [...new Set(entries.map(e => e.nextHopProtocol))].map(p => ({
        label: p, value: `${entries.filter(e => e.nextHopProtocol === p).length} ressource(s)`
      }));
      const severity = old.length > entries.length * 0.5 ? 'majeur' : old.length > 0 ? 'mineur' : 'ok';
      return asRuleResult({ severity, measure: `${old.length} ressource(s) sur HTTP/1.x sur ${entries.length}`, details });
    }},
  { id: 'eco-arch-same-domain', num: '3.4', theme: 'Architecture',
    title: "Ressources statiques hébergées en propre",
    advice: "Hébergez vos fichiers JS, CSS et polices sur votre propre domaine ou un CDN maîtrisé. Réduisez les résolutions DNS tierces.",
    run: () => {
      const host = location.hostname;
      const statics = resourceEntries().filter(e => {
        if (!/\.(js|mjs|css|woff2?|ttf|otf)(\?|$)/i.test(e.name)) return false;
        try { return new URL(e.name).hostname !== host; } catch { return false; }
      });
      const externalDomains = new Set(statics.map(e => { try { return new URL(e.name).hostname; } catch { return ''; } }));
      const details = statics.slice(0, 10).map(e => ({
        label: new URL(e.name).pathname.split('/').pop() || e.name,
        value: new URL(e.name).hostname
      }));
      const severity = statics.length > 5 ? 'majeur' : statics.length > 0 ? 'mineur' : 'ok';
      return asRuleResult({ severity, measure: `${statics.length} ressource(s) statique(s) hébergée(s) sur ${externalDomains.size} domaine(s) tiers`, details });
    }},
  { id: 'eco-arch-cache', num: '3.6', theme: 'Architecture',
    title: "Stratégie de cache des ressources",
    advice: "Configurez Cache-Control avec des durées longues (1 an) sur vos assets versionnés (JS/CSS/images).",
    run: () => {
      const entries = resourceEntries().filter(e => e.encodedBodySize > 0);
      if (!entries.length) return asRuleResult({ severity: 'ok', measure: 'Aucune ressource analysable' });
      const fromCache = entries.filter(e => e.transferSize === 0);
      const ratio = fromCache.length / entries.length;
      if (fromCache.length === 0) {
        return { status: 'NT', count: 0, measure: `Session fraîche — cache non évaluable (${entries.length} ressource(s)). Relancez l'audit après une première visite de la page.`, manualPrompt: 'Vérifiez que vos assets versionnés ont un Cache-Control avec max-age long (ex : 1 an).' };
      }
      const severity = ratio < 0.3 ? 'majeur' : ratio < 0.6 ? 'mineur' : 'ok';
      return asRuleResult({ severity, measure: `${fromCache.length}/${entries.length} ressource(s) servies depuis le cache (${Math.round(ratio * 100)}%)` });
    }},
  // ════════════════════════════════════════════════════════════
  // Thématique 4 — Expérience et interface utilisateur
  // ════════════════════════════════════════════════════════════
  NT('eco-ux-4.1', '4.1', 'Expérience et interface utilisateur',
    "Parcours utilisateurs adaptés aux besoins",
    "Concevez les parcours en vous basant sur les vrais besoins utilisateurs pour éviter les étapes superflues."),
  NT('eco-ux-4.2', '4.2', 'Expérience et interface utilisateur',
    "Parcours utilisateurs optimisés",
    "Réduisez le nombre de clics pour atteindre les fonctionnalités principales. Analysez les abandons de parcours."),
  { id: 'eco-ux-video-autoplay', num: '4.3', theme: 'Expérience et interface utilisateur',
    title: "Lecture automatique de sons et vidéos désactivée",
    advice: "Désactivez l'autoplay ou conditionnez-le à une interaction utilisateur. L'autoplay consomme de la bande passante inutilement.",
    run: () => {
      const autos = [...document.querySelectorAll('video,audio')].filter(v => v.autoplay || v.hasAttribute('autoplay'));
      const severity = autos.some(v => !v.muted) ? 'critique' : autos.length ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${autos.length} média(s) en autoplay`, elements: autos });
    }},
  { id: 'eco-ux-infinite-scroll', num: '4.4', theme: 'Expérience et interface utilisateur',
    title: "Absence de défilement infini",
    advice: "Remplacez le défilement infini par une pagination classique ou un bouton \"Charger plus\". Le scroll infini charge des contenus non demandés.",
    run: () => {
      const hasPagination = !!document.querySelector('[class*="paginat"],[aria-label*="pagination" i],[role="navigation"] a[href*="page"]');
      const bodyHeight = document.body.scrollHeight;
      const viewportH = NR_REFERENCE_VIEWPORT.height;
      const veryLong = bodyHeight > viewportH * 8;
      if (hasPagination) return asRuleResult({ severity: 'ok', measure: 'Pagination détectée' });
      if (veryLong) {
        const severity = bodyHeight > viewportH * 20 ? 'critique' : 'majeur';
        return asRuleResult({ severity, measure: `Page très longue (${Math.round(bodyHeight/viewportH)}x la hauteur viewport) sans pagination visible — défilement infini probable` });
      }
      return asRuleResult({ severity: 'ok', measure: 'Pas de défilement infini détecté' });
    }},
  NT('eco-ux-4.5', '4.5', 'Expérience et interface utilisateur',
    "Alternatives à la carte et à la géolocalisation",
    "Proposez une alternative textuelle (adresse, zone, formulaire) aux composants de carte ou de géolocalisation."),
  NT('eco-ux-4.6', '4.6', 'Expérience et interface utilisateur',
    "Contenus affichés limités au nécessaire",
    "Affichez uniquement les contenus pertinents à la page. Évitez le contenu décoratif lourd (carousels auto, vidéos de fond)."),
  NT('eco-ux-4.7', '4.7', 'Expérience et interface utilisateur',
    "Système de design utilisé",
    "Utilisez un système de design (composants réutilisables, tokens) pour limiter les duplications de code et d'assets."),
  NT('eco-ux-4.8', '4.8', 'Expérience et interface utilisateur',
    "Fonctionnalités orientées sobriété",
    "Questionnez la pertinence de chaque fonctionnalité. Supprimez celles qui ne répondent pas à un besoin avéré."),
  { id: 'eco-ux-animations', num: '4.9', theme: 'Expérience et interface utilisateur',
    title: "Animations et effets CSS non essentiels",
    advice: "Limitez les animations. Respectez prefers-reduced-motion. Les transitions lourdes sollicitent le GPU.",
    run: () => {
      const sheets = [...document.styleSheets];
      let hasKeyframes = false, hasReducedMotion = false;
      for (const sheet of sheets) {
        try {
          const rules = [...sheet.cssRules || []];
          for (const r of rules) {
            if (r.type === CSSRule.KEYFRAMES_RULE) hasKeyframes = true;
            if (r.type === CSSRule.MEDIA_RULE && r.conditionText?.includes('prefers-reduced-motion')) hasReducedMotion = true;
          }
        } catch {}
      }
      if (!hasKeyframes) return asRuleResult({ severity: 'ok', measure: 'Aucune animation @keyframes détectée' });
      if (hasReducedMotion) return asRuleResult({ severity: 'ok', measure: 'Animations présentes mais prefers-reduced-motion respecté' });
      return asRuleResult({ severity: 'mineur', measure: 'Animations @keyframes sans media prefers-reduced-motion' });
    }},
  NT('eco-ux-4.10', '4.10', 'Expérience et interface utilisateur',
    "Visuels dans les e-mails optimisés",
    "Optimisez les images des e-mails transactionnels (dimensions adaptées, format léger, alternatives textuelles)."),
  { id: 'eco-ux-prefers-motion', num: '4.11', theme: 'Expérience et interface utilisateur',
    title: "Adaptation aux préférences système (mode réduit, thème)",
    advice: "Implémentez prefers-reduced-motion et prefers-color-scheme pour adapter l'interface aux préférences OS.",
    run: () => {
      const sheets = [...document.styleSheets];
      let hasReducedMotion = false, hasDarkMode = false;
      for (const sheet of sheets) {
        try {
          const rules = [...sheet.cssRules || []];
          for (const r of rules) {
            if (r.type === CSSRule.MEDIA_RULE) {
              if (r.conditionText?.includes('prefers-reduced-motion')) hasReducedMotion = true;
              if (r.conditionText?.includes('prefers-color-scheme')) hasDarkMode = true;
            }
          }
        } catch {}
      }
      const count = (hasReducedMotion ? 1 : 0) + (hasDarkMode ? 1 : 0);
      if (count === 2) return asRuleResult({ severity: 'ok', measure: 'prefers-reduced-motion et prefers-color-scheme présents' });
      if (count === 1) return asRuleResult({ severity: 'mineur', measure: `Seulement ${hasReducedMotion ? 'prefers-reduced-motion' : 'prefers-color-scheme'} implémenté` });
      return asRuleResult({ severity: 'majeur', measure: 'Aucune media query de préférence système (prefers-reduced-motion, prefers-color-scheme)' });
    }},
  { id: 'eco-ux-notifications', num: '4.12', theme: 'Expérience et interface utilisateur',
    title: "Popups et notifications non sollicitées",
    advice: "Ne demandez les permissions de notification qu'après une interaction utilisateur. Évitez les modales automatiques au chargement.",
    run: () => {
      const dialogs = [...document.querySelectorAll('dialog[open],[role="dialog"],[role="alertdialog"]')].filter(d => {
        const s = getComputedStyle(d);
        return s.display !== 'none' && s.visibility !== 'hidden';
      });
      const severity = dialogs.length > 1 ? 'majeur' : dialogs.length > 0 ? 'mineur' : 'ok';
      return asRuleResult({ severity, measure: `${dialogs.length} popup/dialog visible(s) au chargement`, elements: dialogs });
    }},
  { id: 'eco-ux-dark-mode', num: '4.13', theme: 'Expérience et interface utilisateur',
    title: "Mode sombre ou économiseur d'énergie",
    advice: "Proposez un mode sombre via prefers-color-scheme ou un toggle dans l'interface. Les écrans OLED consomment moins avec des fonds sombres.",
    run: () => {
      const sheets = [...document.styleSheets];
      let hasDark = false;
      for (const sheet of sheets) {
        try {
          for (const r of [...sheet.cssRules || []]) {
            if (r.type === CSSRule.MEDIA_RULE && r.conditionText?.includes('prefers-color-scheme')) { hasDark = true; break; }
          }
        } catch {}
        if (hasDark) break;
      }
      const toggleBtn = document.querySelector('[data-theme],[class*="dark-mode"],[class*="theme-toggle"],[aria-label*="thème" i],[aria-label*="dark" i]');
      if (hasDark || toggleBtn) return asRuleResult({ severity: 'ok', measure: hasDark ? 'Mode sombre via prefers-color-scheme' : 'Toggle de thème présent dans le DOM' });
      return asRuleResult({ severity: 'mineur', measure: 'Aucun mode sombre détecté (prefers-color-scheme ou toggle)' });
    }},
  // ════════════════════════════════════════════════════════════
  // Thématique 5 — Contenus
  // ════════════════════════════════════════════════════════════
  NT('eco-cont-5.1', '5.1', 'Contenus',
    "Stratégie de contenu sobre définie",
    "Définissez une politique éditoriale sobre : supprimez les contenus obsolètes, évitez la duplication, limitez les médias lourds non essentiels."),
  { id: 'eco-cont-images-format', num: '5.2', theme: 'Contenus',
    title: "Images au format non optimisé",
    advice: "Utilisez WebP ou AVIF (30-50% plus léger que JPEG/PNG). Servez via <picture>/srcset.",
    run: () => {
      const all = [...document.querySelectorAll('img')].filter(i => !inNoscript(i) && i.complete);
      const imgs = all.filter(i => /\.(jpe?g|png)(\?|$)/i.test(i.currentSrc || i.src || ''));
      const denom = all.length || 1;
      const severity = imgs.length / denom > 0.3 ? 'critique' : imgs.length > 0 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${imgs.length} image(s) en JPEG/PNG sur ${denom}`, elements: imgs });
    }},
  { id: 'eco-cont-images-oversized', num: '5.3', theme: 'Contenus',
    title: "Images surdimensionnées",
    advice: "Servez des images aux dimensions proches de leur affichage réel via srcset/sizes.",
    run: () => {
      const dpr = NR_REFERENCE_VIEWPORT.dpr;
      const imgs = [...document.querySelectorAll('img')].filter(i => !inNoscript(i) && i.complete && i.naturalWidth > 0 && i.clientWidth > 0);
      const big = imgs.filter(i => i.naturalWidth > i.clientWidth * dpr * 1.5);
      const severity = big.length > 5 ? 'critique' : big.length > 0 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${big.length} image(s) nettement plus grande(s) que leur affichage`, elements: big });
    }},
  { id: 'eco-cont-video-format', num: '5.4', theme: 'Contenus',
    title: "Vidéos : format et préchargement",
    advice: "Ajoutez une source WebM/AV1 (30-40% plus léger que MP4) et preload=\"none\" avec un poster sur les vidéos non essentielles.",
    run: () => {
      const videos = [...document.querySelectorAll('video')];
      if (!videos.length) return asRuleResult({ severity: 'ok', measure: 'Aucune vidéo détectée' });
      const noWebm = videos.filter(v => {
        const sources = [...v.querySelectorAll('source')];
        return !sources.some(s => /webm|av1/i.test(s.type || s.src || '')) && !/\.webm$/i.test(v.src || '');
      });
      const noPreload = videos.filter(v => v.getAttribute('preload') !== 'none' && !v.autoplay);
      const issues = [...new Set([...noWebm, ...noPreload])];
      const details = [
        { label: 'Sans source WebM/AV1', value: `${noWebm.length}/${videos.length}` },
        { label: 'Sans preload="none"', value: `${noPreload.length}/${videos.length}` },
      ];
      const severity = (noWebm.length === videos.length || noPreload.length > 2) ? 'majeur'
        : issues.length > 0 ? 'mineur' : 'ok';
      return asRuleResult({ severity, measure: `${issues.length} vidéo(s) à optimiser sur ${videos.length}`, elements: issues, details });
    }},
  NT('eco-cont-5.5', '5.5', 'Contenus',
    "Stratégie de compression vidéo",
    "Encodez vos vidéos avec des paramètres optimisés (codec H.265/AV1, CRF adapté, résolution appropriée à l'usage)."),
  NT('eco-cont-5.6', '5.6', 'Contenus',
    "Vidéos limitées aux contenus qui le nécessitent",
    "Questionnez la pertinence de chaque vidéo. Préférez le texte illustré quand c'est suffisant."),
  NT('eco-cont-5.7', '5.7', 'Contenus',
    "Stratégie de cache des contenus",
    "Définissez des durées de cache adaptées pour chaque type de contenu (images, vidéos, docs)."),
  NT('eco-cont-5.8', '5.8', 'Contenus',
    "Documents bureautiques optimisés",
    "Compressez les PDF et documents téléchargeables. Supprimez les métadonnées inutiles. Proposez des versions légères."),
  NT('eco-cont-5.9', '5.9', 'Contenus',
    "Stratégie de durée de vie et archivage des contenus",
    "Définissez une politique d'archivage et de suppression des contenus obsolètes pour limiter l'empreinte du stockage."),
  NT('eco-cont-5.10', '5.10', 'Contenus',
    "Contenus créés dans les formats recommandés",
    "Formez les contributeurs aux bonnes pratiques : WebP pour les images, PDF/A pour les docs, MP4/WebM pour les vidéos."),
  { id: 'eco-cont-font-format', num: '5.11', theme: 'Contenus',
    title: "Polices web : format et nombre",
    advice: "Utilisez exclusivement le format WOFF2. Limitez à 2 familles max. Préférez les polices système. Utilisez font-display: swap.",
    run: () => {
      const fonts = resourceEntries().filter(e => /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(e.name));
      const nonWoff2 = fonts.filter(e => !/\.woff2(\?|$)/i.test(e.name));
      const details = fonts.sort((a, b) => b.transferSize - a.transferSize).map(e => ({
        label: new URL(e.name, location.href).pathname.split('/').pop() || 'font',
        value: e.transferSize > 0 ? `${Math.round(e.transferSize / 1024)} Ko` : 'caché'
      }));
      const severity = fonts.length > 6 ? 'critique' : nonWoff2.length > 0 ? 'majeur' : fonts.length > 4 ? 'majeur' : 'ok';
      const measure = nonWoff2.length
        ? `${nonWoff2.length} police(s) en format non-WOFF2 sur ${fonts.length}`
        : `${fonts.length} fichier(s) de police (tous WOFF2)`;
      return asRuleResult({ severity, measure, details });
    }},

  // ════════════════════════════════════════════════════════════
  // Thématique 6 — Frontend
  // ════════════════════════════════════════════════════════════
  { id: 'eco-front-css-weight', num: '6.1', theme: 'Frontend',
    title: "Volume et minification des fichiers CSS",
    advice: "Minifiez vos CSS (supprime commentaires et espaces). Purgez le CSS inutilisé (PurgeCSS). Évitez les frameworks CSS complets.",
    run: () => {
      const css = resourceEntries().filter(e => e.initiatorType === 'link' && /\.css/i.test(e.name));
      const bytes = css.reduce((a, e) => a + (e.transferSize || 0), 0);
      const nonMin = css.filter(e => !/\.min\.css/i.test(e.name) && (e.transferSize || 0) > 5000);
      const details = css.sort((a, b) => b.transferSize - a.transferSize).map(e => ({
        label: new URL(e.name, location.href).pathname.split('/').pop() || 'style.css',
        value: `${Math.round(e.transferSize / 1024)} Ko`
      }));
      const severity = bytes > 204800 ? 'critique' : nonMin.length > 0 ? 'majeur' : bytes > 102400 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${(bytes/1024).toFixed(0)} Ko de CSS (${nonMin.length} fichier(s) probablement non minifié(s))`, details });
    }},
  { id: 'eco-front-js-weight', num: '6.2', theme: 'Frontend',
    title: "Volume et minification des fichiers JavaScript",
    advice: "Minifiez vos JS. Activez le tree-shaking et le code splitting. Supprimez les dépendances inutilisées.",
    run: () => {
      const js = resourceEntries().filter(e => e.initiatorType === 'script');
      const bytes = js.reduce((a, e) => a + (e.transferSize || 0), 0);
      const nonMin = js.filter(e => !/\.min\.js/i.test(e.name) && (e.transferSize || 0) > 10000);
      const details = js.sort((a, b) => b.transferSize - a.transferSize).slice(0, 8).map(e => ({
        label: new URL(e.name, location.href).pathname.split('/').pop() || 'script',
        value: `${Math.round(e.transferSize / 1024)} Ko`
      }));
      const severity = bytes > 512000 ? 'critique' : nonMin.length > 0 ? 'majeur' : bytes > 307200 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${(bytes/1024).toFixed(0)} Ko de JS (${nonMin.length} fichier(s) probablement non minifié(s))`, details });
    }},
  { id: 'eco-front-frameworks', num: '6.3', theme: 'Frontend',
    title: "Frameworks JavaScript détectés",
    advice: "Vérifiez que chaque framework est justifié. Préférez des solutions légères ou du JS natif pour des besoins simples. React/Vue/Angular ajoutent ≥30 Ko de runtime.",
    run: () => {
      const detected = [];
      if (window.React) detected.push('React');
      if (window.Vue || window.__vue_app__) detected.push('Vue');
      if (window.angular || window.ng) detected.push('Angular');
      if (window.jQuery || window.$?.fn?.jquery) detected.push('jQuery');
      if (window.Ember) detected.push('Ember');
      if (window.Backbone) detected.push('Backbone');
      if (window.Svelte || document.querySelector('[class^="svelte-"]')) detected.push('Svelte');
      const details = detected.map(f => ({ label: f, value: 'détecté' }));
      const severity = detected.length > 2 ? 'majeur' : detected.length > 0 ? 'mineur' : 'ok';
      return asRuleResult({ severity, measure: `${detected.length} framework(s) JS : ${detected.join(', ') || 'aucun'}`, details });
    }},
  NT('eco-front-6.4', '6.4', 'Frontend',
    "Feuilles de style inutilisées supprimées",
    "Analysez la couverture CSS avec les DevTools Chrome (Coverage) ou PurgeCSS pour identifier et supprimer le CSS non utilisé."),
  { id: 'eco-front-local-cache', num: '6.5', theme: 'Frontend',
    title: "Mise en cache locale des données",
    advice: "Utilisez un Service Worker avec la Cache API pour mettre en cache les assets statiques et réduire les requêtes réseau.",
    run: () => {
      const hasSW = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
      const hasCache = 'caches' in window;
      if (!hasSW && !hasCache) return asRuleResult({ severity: 'mineur', measure: 'Aucun Service Worker ni Cache API utilisé' });
      if (hasSW) return asRuleResult({ severity: 'ok', measure: 'Service Worker actif avec Cache API disponible' });
      return asRuleResult({ severity: 'mineur', measure: 'Cache API disponible mais aucun Service Worker actif' });
    }},
  { id: 'eco-front-lazy', num: '6.6', theme: 'Frontend',
    title: "Images sans chargement différé (lazy loading)",
    advice: "Ajoutez loading=\"lazy\" sur les images hors de la zone visible initiale.",
    run: () => {
      const fold = NR_REFERENCE_VIEWPORT.height;
      const docTop = (img) => { let y = 0, el = img; while (el) { y += el.offsetTop || 0; el = el.offsetParent; } return y; };
      const below = [...document.querySelectorAll('img')].filter(img => !inNoscript(img) && docTop(img) > fold && img.loading !== 'lazy' && !img.dataset.src);
      const severity = below.length > 3 ? 'critique' : below.length > 0 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${below.length} image(s) hors viewport sans lazy-load`, elements: below });
    }},
  NT('eco-front-6.7', '6.7', 'Frontend',
    "Appels aux API externes limités",
    "Auditez les appels vers des APIs tierces. Mettez en cache les réponses. Regroupez les requêtes (batching). Évitez les appels redondants."),
  { id: 'eco-front-render-blocking', num: '6.8', theme: 'Frontend',
    title: "Ressources bloquant le rendu",
    advice: "Ajoutez defer/async sur les scripts. Chargez le CSS non critique en asynchrone. Utilisez rel=preload pour les ressources critiques.",
    run: () => {
      const scr = [...document.querySelectorAll('head script[src]')].filter(s => !s.async && !s.defer && !s.type?.includes('module'));
      const severity = scr.length > 2 ? 'critique' : scr.length > 0 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${scr.length} script(s) synchrone(s) en <head>`, elements: scr });
    }},
  { id: 'eco-front-duplicates', num: '6.9', theme: 'Frontend',
    title: "Ressources chargées en double",
    advice: "Supprimez les imports redondants de scripts et CSS. Vérifiez votre bundler (webpack, Vite) pour éviter les chunks dupliqués.",
    run: () => {
      const urls = resourceEntries().map(e => e.name);
      const seen = new Set(), dups = new Set();
      urls.forEach(u => { if (seen.has(u)) dups.add(u); else seen.add(u); });
      const details = [...dups].slice(0, 10).map(u => ({
        label: new URL(u, location.href).pathname.split('/').pop() || u,
        value: `${urls.filter(x => x === u).length}x`
      }));
      const severity = dups.size > 3 ? 'majeur' : dups.size > 0 ? 'mineur' : 'ok';
      return asRuleResult({ severity, measure: `${dups.size} ressource(s) chargée(s) plusieurs fois`, details });
    }},

  // ════════════════════════════════════════════════════════════
  // Thématique 7 — Backend
  // ════════════════════════════════════════════════════════════
  NT('eco-back-7.2', '7.2', 'Backend',
    "Serveur web optimisé",
    "Configurez votre serveur web (Nginx, Apache, Caddy) pour activer la compression, le cache et HTTP/2."),
  NT('eco-back-7.3', '7.3', 'Backend',
    "Requêtes base de données optimisées",
    "Évitez les requêtes N+1. Utilisez des index adaptés. Analysez les requêtes lentes avec EXPLAIN."),
  NT('eco-back-7.4', '7.4', 'Backend',
    "Traitements côté serveur limités au nécessaire",
    "Ne calculez côté serveur que ce qui est nécessaire à la réponse. Différez les traitements lourds hors du chemin critique."),
  NT('eco-back-7.5', '7.5', 'Backend',
    "Données calculées mises en cache côté serveur",
    "Mettez en cache les résultats de calculs coûteux (Redis, Memcached, cache HTTP). Définissez des TTL adaptés."),
  NT('eco-back-7.6', '7.6', 'Backend',
    "Mise en cache HTTP configurée",
    "Configurez les headers Cache-Control, ETag et Last-Modified pour permettre au navigateur et aux proxies de mettre en cache les réponses."),
  NT('eco-back-7.7', '7.7', 'Backend',
    "Architecture serverless ou mutualisée si pertinente",
    "Évaluez si une architecture serverless ou mutualisée réduit les ressources allouées par rapport à un serveur dédié sous-utilisé."),
  { id: 'eco-back-ttfb', num: '7.1', theme: 'Backend',
    title: "Temps de réponse serveur (TTFB)",
    advice: "Un TTFB élevé signale un backend lent. Activez le cache serveur, optimisez les requêtes SQL, utilisez un CDN.",
    run: () => {
      const nav = navEntry();
      if (!nav) return { status: 'NT', count: 0, measure: 'Mesure TTFB indisponible', manualPrompt: 'Mesurez le TTFB via les outils de développement (onglet Réseau).' };
      try {
        const navPath = new URL(nav.name).pathname;
        if (navPath !== location.pathname) {
          return { status: 'NT', count: 0, measure: `SPA détectée — TTFB de la navigation initiale (${navPath}) ne reflète pas la page actuelle`, manualPrompt: 'Mesurez le TTFB côté serveur via les outils du navigateur.' };
        }
      } catch {}
      const ttfb = nav.responseStart - nav.requestStart;
      const severity = ttfb > 1500 ? 'critique' : ttfb > 600 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `TTFB : ${Math.round(ttfb)} ms` });
    }},
  // ════════════════════════════════════════════════════════════
  // Thématique 8 — Hébergement
  // ════════════════════════════════════════════════════════════
  NT('eco-host-8.1', '8.1', 'Hébergement',
    "Hébergeur avec politique environnementale",
    "Choisissez un hébergeur qui publie ses engagements environnementaux (énergie renouvelable, PUE, bilan carbone)."),
  NT('eco-host-8.2', '8.2', 'Hébergement',
    "PUE (Power Usage Effectiveness) du datacenter",
    "Préférez un hébergeur dont le PUE est inférieur à 1,5 (idéalement < 1,2). Demandez ce KPI à votre hébergeur."),
  NT('eco-host-8.3', '8.3', 'Hébergement',
    "Alimentation électrique renouvelable",
    "Vérifiez que votre hébergeur utilise majoritairement des énergies renouvelables et publie des certificats (EAC/GO)."),
  NT('eco-host-8.4', '8.4', 'Hébergement',
    "Localisation géographique adaptée",
    "Hébergez vos serveurs au plus proche de vos utilisateurs pour réduire la latence et les transferts longue distance."),
  NT('eco-host-8.5', '8.5', 'Hébergement',
    "Certification environnementale de l'hébergeur",
    "Privilégiez un hébergeur certifié ISO 50001 (énergie) ou équivalent. Vérifiez les labels (HDS, ISO 14001, etc.)."),
  NT('eco-host-8.6', '8.6', 'Hébergement',
    "Hébergement mutualisé si pertinent",
    "Évaluez si l'hébergement mutualisé est suffisant. Un serveur dédié sous-utilisé consomme inutilement."),
  NT('eco-host-8.7', '8.7', 'Hébergement',
    "Consommation énergétique des serveurs optimisée",
    "Activez le dimensionnement automatique des ressources (auto-scaling). Éteignez les environnements non-prod hors des heures ouvrées."),
  NT('eco-host-8.8', '8.8', 'Hébergement',
    "Ressources serveur adaptées à la charge réelle",
    "Analysez la consommation CPU/RAM réelle et ajustez les instances. Évitez le sur-provisionnement chronique."),
  // ════════════════════════════════════════════════════════════
  // Thématique 9 — Algorithmie
  // ════════════════════════════════════════════════════════════
  NT('eco-algo-complexity', '9.1', 'Algorithmie',
    "Complexité algorithmique maîtrisée",
    "Vérifiez que les algorithmes côté client n'ont pas de complexité superflue (O(n²) sur de grands ensembles). Utilisez des structures de données adaptées."),
  NT('eco-algo-9.2', '9.2', 'Algorithmie',
    "Algorithmes adaptés aux besoins",
    "Choisissez l'algorithme le plus sobre pour chaque traitement (ex : recherche binaire vs linéaire, hash vs comparaison)."),
  NT('eco-algo-9.3', '9.3', 'Algorithmie',
    "Recours à l'intelligence artificielle limité",
    "Utilisez l'IA uniquement là où elle apporte une valeur significative. Préférez des règles métier simples quand elles suffisent."),
  NT('eco-algo-9.4', '9.4', 'Algorithmie',
    "Impact environnemental des modèles IA évalué",
    "Mesurez l'empreinte carbone de l'entraînement et de l'inférence de vos modèles (CodeCarbon, ML CO2 Impact)."),
  NT('eco-algo-9.5', '9.5', 'Algorithmie',
    "Modèles d'apprentissage optimisés",
    "Appliquez pruning, quantization et distillation pour réduire la taille et la consommation de vos modèles ML."),
  NT('eco-algo-9.6', '9.6', 'Algorithmie',
    "Modèles pré-entraînés réutilisés si disponibles",
    "Réutilisez des modèles pré-entraînés (fine-tuning) plutôt que d'entraîner from scratch pour économiser les ressources."),
];

// ═══════════════════════════════════════════════════════════════
// §6  Runner
// ═══════════════════════════════════════════════════════════════
const results = {
  a11y: [],       // toutes les règles avec leur RuleResult (nouveau format, inclut C/NA/NT)
  eco: [],
  meta: {
    url: location.href,
    title: document.title,
    rgaaTotal: 106,
    rgaaThemes: RGAA_THEMES,
    ecoTotal: RULES_ECO.length,
    ecoThemes: RGESN_THEMES,
    version: 2
  }
};

const runRules = async (list, kind) => {
  const out = [];
  let i = 0;
  for (const rule of list) {
    let res;
    try { res = rule.run(); } catch (e) {
      console.warn('[NR] rule failed:', rule.id, e);
      res = {
        status: 'NT',
        count: 0,
        measure: `Erreur d'exécution : ${e?.message || String(e)}`,
        manualPrompt: "Cette règle n'a pas pu s'exécuter automatiquement. Vérifiez manuellement."
      };
    }
    const entry = {
      id: rule.id,
      title: rule.title,
      advice: rule.advice,
      status: res.status,
      count: res.count || 0,
      measure: res.measure || '',
      samples: res.samples || [],
      details: res.details || [],
      manualPrompt: res.manualPrompt || null
    };
    if (kind === 'a11y') {
      entry.rgaa = rule.num;
      entry.themeLabel = RGAA_THEMES[rule.theme];
      entry.level = rule.level || 'A';
    } else {
      entry.critere = rule.num;
      entry.thematique = rule.theme;
      entry.severity = res.severity || (res.status === 'NC' ? 'majeur' : null);
    }
    out.push(entry);
    if (++i % 20 === 0) await new Promise(r => setTimeout(r, 0));
  }
  return out;
};

if (mode === 'a11y' || mode === 'both') {
  results.a11y = await runRules(ALL_A11Y, 'a11y');
}
if (mode === 'eco' || mode === 'both') {
  results.eco = await runRules(RULES_ECO, 'eco');
}

globalThis.__nrAuditIdCounter = __nrCounter;
return results;
};
