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

// Snapshots performance figés au début de l'audit (stabilité des résultats).
let nrResourceSnapshot = [];
try { nrResourceSnapshot = performance.getEntriesByType('resource').slice(); } catch {}
let nrNavSnapshot = null;
try { nrNavSnapshot = performance.getEntriesByType('navigation')[0] || null; } catch {}

// Attend que les images soient chargées (ou timeout 3 s) pour stabiliser naturalWidth.
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
    const outer = (el.outerHTML || '').slice(0, 200).replace(/\s+/g, ' ');
    return { auditId: tagElement(el), selector: `${tag}${id}${cls}`, outer };
  } catch { return { auditId: null, selector: '?', outer: '' }; }
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
  // 1. aria-labelledby
  const lb = el.getAttribute('aria-labelledby');
  if (lb) {
    const txt = lb.trim().split(/\s+/).map(id => document.getElementById(id)?.textContent?.trim() || '').filter(Boolean).join(' ');
    if (txt) return txt;
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
  // 4. alt (<img>, <area>)
  const alt = el.getAttribute?.('alt');
  if (alt?.trim()) return alt.trim();
  // 5. value (boutons input)
  if (el.tagName === 'INPUT' && /^(submit|button|reset)$/i.test(el.type)) {
    if (el.value?.trim()) return el.value.trim();
  }
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
const parseColor = (c) => {
  if (!c || c === 'transparent') return [0, 0, 0, 0];
  const m = c.match(/\d+(\.\d+)?/g);
  if (!m) return null;
  return [+m[0], +m[1], +m[2], m[3] !== undefined ? +m[3] : 1];
};

// Compose le fond effectif d'un élément en remontant dans la hiérarchie et
// en alpha-blendant les fonds semi-transparents. Retourne null si une image
// de fond (gradient, url) est rencontrée → contraste non testable auto.
const bgChain = (el) => {
  let cur = el; const stack = [];
  while (cur && cur !== document.documentElement) {
    const cs = getComputedStyle(cur);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
    const c = parseColor(cs.backgroundColor);
    if (c && c[3] > 0) {
      stack.push(c);
      if (c[3] === 1) break;
    }
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

const NT = (id, num, theme, title, manualPrompt, level = 'A') => ({
  id, num, theme, level, title,
  advice: manualPrompt,
  run: () => ({ status: 'NT', manualPrompt })
});

const RULES_IMAGES = [
  { id: 'img-1.1-alt-missing', num: '1.1', theme: 1, level: 'A',
    title: "Chaque image porteuse d'information a-t-elle une alternative textuelle ?",
    advice: "Ajoutez un attribut alt à chaque <img>. Vide (alt=\"\") si décorative, descriptif sinon.",
    run: () => {
      const all = [...document.querySelectorAll('img, input[type=image], area')];
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
      const decor = [...document.querySelectorAll('img[alt=""], img[role=presentation], img[role=none], img[aria-hidden=true]')];
      if (!decor.length) return { status: 'NA', count: 0, measure: 'Aucune image décorative détectée' };
      const bad = decor.filter(i => i.getAttribute('title')?.trim() || i.getAttribute('aria-label')?.trim());
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} image(s) décorative(s) avec texte accessible parasite`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${decor.length} image(s) décorative(s) correctement ignorée(s)` };
    }},
  NT('img-1.3-alt-relevant', '1.3', 1,
    "Pour chaque image porteuse d'information, l'alternative textuelle est-elle pertinente ?",
    "Vérifiez manuellement que chaque alt décrit correctement le contenu de l'image (hors contexte)."),
  NT('img-1.4-captcha', '1.4', 1,
    "Chaque image-CAPTCHA a-t-elle une alternative ?",
    "Vérifiez que chaque CAPTCHA image propose une alternative accessible (audio, question textuelle)."),
  NT('img-1.5-captcha-relevant', '1.5', 1,
    "Chaque image-CAPTCHA a-t-elle une alternative pertinente ?",
    "Vérifiez que l'alternative du CAPTCHA permet réellement de valider le formulaire."),
  { id: 'img-1.6-long-desc', num: '1.6', theme: 1, level: 'A',
    title: "Chaque image porteuse d'information complexe a-t-elle une description détaillée ?",
    advice: "Pour les graphiques, cartes, infographies : fournissez une description longue via longdesc, aria-describedby ou texte adjacent.",
    run: () => {
      const figs = [...document.querySelectorAll('figure')];
      if (!figs.length) return { status: 'NA', count: 0, measure: 'Aucune figure détectée' };
      return { status: 'NT', count: figs.length, manualPrompt: "Les figures nécessitant une description détaillée en ont-elles une (figcaption, aria-describedby) ?", samples: sampleElements(figs) };
    }},
  NT('img-1.7-long-desc-relevant', '1.7', 1,
    "La description détaillée est-elle pertinente ?",
    "Vérifiez que la description couvre l'intégralité de l'information véhiculée par l'image complexe."),
  NT('img-1.8-image-text', '1.8', 1,
    "Chaque image-texte porteuse d'information, en l'absence de mécanisme de remplacement, doit si possible être remplacée par du texte stylé.",
    "Vérifiez qu'aucune image ne véhicule du texte qui pourrait être affiché en HTML/CSS."),
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
      const frames = [...document.querySelectorAll('iframe')];
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
      const frames = [...document.querySelectorAll('iframe[title]')];
      if (!frames.length) return { status: 'NA', count: 0 };
      const generic = /^(iframe|frame|content|embed|sans titre|untitled)$/i;
      const bad = frames.filter(f => generic.test(f.getAttribute('title').trim()));
      if (bad.length) return { status: 'NC', count: bad.length, measure: `${bad.length} iframe(s) avec title générique`, samples: sampleElements(bad) };
      return { status: 'NT', manualPrompt: "Les titres d'iframe décrivent-ils bien leur contenu ?" };
    }},
];

const RULES_COULEURS = [
  NT('col-3.1-info-color', '3.1', 3,
    "Dans chaque page web, l'information ne doit pas être donnée uniquement par la couleur.",
    "Vérifiez qu'aucune information (champ obligatoire, état, graphique) n'est véhiculée uniquement par la couleur."),
  { id: 'col-3.2-contrast-text', num: '3.2', theme: 3, level: 'AA',
    title: "Dans chaque page web, le contraste entre la couleur du texte et la couleur de son arrière-plan est-il suffisant ?",
    advice: "Ratio ≥ 4.5:1 (texte normal) ou ≥ 3:1 (texte ≥18.66px gras ou ≥24px).",
    run: () => {
      const els = [...document.querySelectorAll('p,span,a,li,td,th,label,button,h1,h2,h3,h4,h5,h6,dt,dd,figcaption,blockquote,cite,em,strong,small,code')]
        .filter(el => isVisible(el) && el.textContent.trim() !== '' &&
          !el.querySelector('p,span,a,li,td,th,label,button,h1,h2,h3,h4,h5,h6'))
        .slice(0, 400);
      if (!els.length) return { status: 'NA', count: 0 };
      let checked = 0, nt = 0;
      const bad = [];
      for (const el of els) {
        const s = getComputedStyle(el);
        const fg = parseColor(s.color); if (!fg) continue;
        const bg = bgChain(el);
        if (!bg) { nt++; continue; }
        checked++;
        const ratio = contrastRatio(fg, bg);
        const fs = parseFloat(s.fontSize); const fw = parseInt(s.fontWeight) || 400;
        const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
        if (ratio < (large ? 3 : 4.5)) bad.push(el);
      }
      const measure = `${bad.length} texte(s) en échec sur ${checked} testé(s)` + (nt ? ` · ${nt} avec image de fond (à vérifier manuellement)` : '');
      if (!checked && nt) return { status: 'NT', manualPrompt: "Les textes sur image de fond respectent-ils le contraste ?", count: nt, measure };
      return bad.length
        ? { status: 'NC', count: bad.length, measure, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure };
    }},
  NT('col-3.3-contrast-ui', '3.3', 3,
    "Dans chaque page web, les couleurs utilisées dans les composants d'interface ou les éléments graphiques porteurs d'informations sont-elles suffisamment contrastées (hors cas particuliers) ?",
    "Vérifiez manuellement le contraste des bordures d'inputs focalisés, icônes informatives, graphiques.",
    'AA'),
];

// 13 critères Multimédia — la plupart manuels
const RULES_MULTIMEDIA = [
  NT('mul-4.1-transcript', '4.1', 4, "Chaque média temporel pré-enregistré a-t-il, si nécessaire, une transcription textuelle ou une audiodescription ?", "Vérifiez qu'audio/vidéo disposent d'une transcription ou audiodescription."),
  NT('mul-4.2-transcript-relevant', '4.2', 4, "Transcription ou audiodescription pertinente ?", "Vérifiez la fidélité de la transcription."),
  NT('mul-4.3-subtitles', '4.3', 4, "Chaque média temporel synchronisé a-t-il, si nécessaire, des sous-titres synchronisés ?", "Vérifiez que les vidéos ont des sous-titres synchronisés."),
  NT('mul-4.4-subtitles-relevant', '4.4', 4, "Sous-titres pertinents ?", "Vérifiez la fidélité des sous-titres."),
  NT('mul-4.5-audiodescription', '4.5', 4, "Chaque média temporel a-t-il, si nécessaire, une audiodescription synchronisée ?", "Vérifiez la présence d'une audiodescription."),
  NT('mul-4.6-audiodescription-relevant', '4.6', 4, "Audiodescription pertinente ?", "Vérifiez la pertinence de l'audiodescription."),
  NT('mul-4.7-alt-relevant', '4.7', 4, "Chaque média temporel est-il clairement identifiable (hors cas particuliers) ?", "Vérifiez que chaque média est clairement identifiable."),
  { id: 'mul-4.8-alt', num: '4.8', theme: 4, level: 'A',
    title: "Chaque média non temporel a-t-il, si nécessaire, une alternative ?",
    advice: "Cartes interactives, SVG dynamiques : prévoir un équivalent textuel.",
    run: () => {
      const svgs = [...document.querySelectorAll('svg')].filter(isVisible);
      if (!svgs.length) return { status: 'NA', count: 0 };
      const bad = svgs.filter(s => !accessibleName(s) && !s.getAttribute('role')?.includes('img'));
      return { status: 'NT', manualPrompt: "Les médias non temporels disposent-ils d'une alternative pertinente ?", count: svgs.length, samples: sampleElements(bad.length ? bad : svgs) };
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
        : { status: 'NT', manualPrompt: "Les contrôles personnalisés sont-ils utilisables au clavier ?" };
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
        : { status: 'NT', manualPrompt: "Les résumés des tableaux complexes sont-ils pertinents ?" };
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
      const bad = tables.filter(t => {
        const ths = [...t.querySelectorAll('th')];
        if (!ths.length) return false; // couvert par 5.6
        const scoped = ths.filter(th => th.getAttribute('scope')).length;
        const tdsHeaders = [...t.querySelectorAll('td[headers]')].length;
        return scoped === 0 && tdsHeaders === 0;
      });
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} tableau(x) sans scope ni headers`, samples: sampleElements(bad) }
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
      const links = [...document.querySelectorAll('a[href]')].filter(isVisible);
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
      return { status: 'NT', manualPrompt: "Les intitulés des liens sont-ils pertinents hors contexte ?", measure: `${links.length} lien(s) testés — tous ont un intitulé non générique` };
    }},
  NT('lnk-6.2-relevance', '6.2', 6, "Dans chaque page web, chaque lien, à l'exception des ancres et des liens d'évitement, a-t-il un intitulé pertinent ?",
    "Vérifiez manuellement la pertinence des intitulés hors contexte."),
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
      if (!live.length) return { status: 'NT', manualPrompt: "Y a-t-il des messages de statut ? Si oui, utilisent-ils aria-live ?" };
      return { status: 'NT', count: live.length, manualPrompt: "Les messages aria-live sont-ils correctement émis au bon moment ?" };
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
      return { status: 'NT', manualPrompt: "Le code HTML est-il valide (W3C validator) ?" };
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
      return { status: 'NT', manualPrompt: "Le titre de la page est-il pertinent et distinctif ?" };
    }},
  { id: 'obl-8.7-lang-sub', num: '8.7', theme: 8, level: 'A',
    title: "Dans chaque page web, chaque changement de langue est-il indiqué dans le code source ?",
    advice: "Ajoutez lang=\"en\" sur toute portion en anglais dans une page française.",
    run: () => {
      const els = [...document.querySelectorAll('[lang]')].filter(el => el !== document.documentElement);
      if (!els.length) return { status: 'NT', manualPrompt: "La page contient-elle des passages dans d'autres langues qui devraient être marqués ?" };
      const bad = els.filter(el => !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test((el.getAttribute('lang') || '').trim()));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} lang invalide sur passages`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${els.length} passage(s) avec lang valide` };
    }},
  NT('obl-8.8-dir', '8.8', 8, "Dans chaque page web, le code de langue de chaque changement de langue est-il valide et pertinent ?", "Vérifiez les codes de langue sur les passages multilingues."),
  NT('obl-8.9-strict', '8.9', 8, "Dans chaque page web, les balises ne doivent pas être utilisées uniquement à des fins de présentation.", "Vérifiez qu'aucun <table>, <h1>, <blockquote> n'est utilisé pour la mise en forme."),
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
  NT('str-9.2-outline', '9.2', 9, "Dans chaque page web, la structure du document est-elle cohérente ?", "Vérifiez que les sections, articles et hiérarchie des titres reflètent la structure logique."),
  { id: 'str-9.3-lists', num: '9.3', theme: 9, level: 'A',
    title: "Dans chaque page web, chaque liste est-elle correctement structurée ?",
    advice: "Utilisez <ul>/<ol>/<dl> pour les listes ; évitez les pseudo-listes en « • ».",
    run: () => {
      const suspicious = [...document.querySelectorAll('p, div')].filter(el => {
        const t = el.textContent.trim();
        return /^[•·●‣▪\-\*]\s/.test(t) && !el.closest('ul,ol,dl');
      });
      if (suspicious.length) return { status: 'NC', count: suspicious.length, measure: `${suspicious.length} pseudo-liste(s) détectée(s)`, samples: sampleElements(suspicious.slice(0, 20)) };
      return { status: 'NT', manualPrompt: "Toutes les énumérations sont-elles bien balisées en <ul>/<ol>/<dl> ?" };
    }},
  NT('str-9.4-citation', '9.4', 9, "Dans chaque page web, chaque citation est-elle correctement indiquée ?", "Vérifiez l'usage de <blockquote> et <q> pour les citations."),
  NT('str-9.5-sections', '9.5', 9, "Dans chaque page web, l'utilisation d'éléments structurants est-elle cohérente ?", "Vérifiez l'usage cohérent des <section>, <article>, <nav>."),
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
      if (!v) return { status: 'NT', manualPrompt: "Le zoom 200% préserve-t-il la lisibilité ?" };
      const c = v.getAttribute('content') || '';
      if (/user-scalable=\s*no/.test(c) || /maximum-scale=\s*1(?!\d)/.test(c))
        return { status: 'NC', count: 1, measure: `viewport bloque le zoom : ${c}`, samples: sampleElements([v]) };
      return { status: 'NT', manualPrompt: "Le zoom 200% préserve-t-il la lisibilité sans perte de contenu ?" };
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
      return { status: 'NT', manualPrompt: "La prise de focus est-elle visible sur chaque élément focusable ?" };
    }},
  NT('pre-10.8-hidden-content', '10.8', 10, "Dans chaque page web, le contenu caché doit-il être ignoré par les technologies d'assistance ?", "Vérifiez l'usage correct d'aria-hidden et display:none."),
  NT('pre-10.9-info-not-by-shape', '10.9', 10, "Dans chaque page web, l'information ne doit pas être donnée uniquement par la forme, taille ou position.", "Vérifiez qu'aucune information ne dépend uniquement de forme/position/taille."),
  NT('pre-10.10-info-not-by-shape-2', '10.10', 10, "Dans chaque page web, l'information ne doit pas être donnée uniquement par la forme, taille ou position (impl.).", "Vérifiez manuellement."),
  NT('pre-10.11-text-resize', '10.11', 10, "Pour chaque page web, les contenus textuels peuvent-ils être agrandis sans perte d'information ni de fonctionnalité ?", "Testez l'agrandissement via zoom navigateur."),
  NT('pre-10.12-spacing', '10.12', 10, "Dans chaque page web, les propriétés d'espacement du texte peuvent-elles être redéfinies par l'utilisateur sans perte de contenu ou de fonctionnalité ?", "Appliquez les valeurs WCAG 1.4.12 et vérifiez."),
  NT('pre-10.13-tooltip', '10.13', 10, "Dans chaque page web, les contenus cachés visibles au survol ou au focus sont-ils contrôlables ?", "Vérifiez les tooltips (fermeture, persistance, survol)."),
];

const RULES_FORMULAIRES = [
  { id: 'frm-11.1-label', num: '11.1', theme: 11, level: 'A',
    title: "Chaque champ de formulaire a-t-il une étiquette ?",
    advice: "Associez un <label for=\"id\"> à chaque champ, ou utilisez aria-label/aria-labelledby.",
    run: () => {
      const fields = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea')];
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
      [...document.querySelectorAll('input[type=radio][name], input[type=checkbox][name]')].forEach(el => {
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
      const btns = [...document.querySelectorAll('button, [role=button], input[type=submit], input[type=button], input[type=reset], input[type=image]')];
      if (!btns.length) return { status: 'NA', count: 0 };
      const bad = btns.filter(b => !accessibleName(b));
      return bad.length
        ? { status: 'NC', count: bad.length, measure: `${bad.length} bouton(s) sans nom accessible`, samples: sampleElements(bad) }
        : { status: 'C', count: 0, measure: `${btns.length} bouton(s) nommé(s)` };
    }},
  { id: 'frm-11.10-check', num: '11.10', theme: 11, level: 'A',
    title: "Dans chaque formulaire, le contrôle de saisie est-il utilisé de manière pertinente ?",
    advice: "Utilisez aria-invalid, aria-describedby pour signaler/décrire une erreur.",
    run: () => {
      const invalid = [...document.querySelectorAll('[aria-invalid]')];
      const required = [...document.querySelectorAll('input[required], select[required], textarea[required], [aria-required]')];
      if (!required.length) return { status: 'NA', count: 0 };
      return { status: 'NT', count: invalid.length, measure: `${required.length} champ(s) requis, ${invalid.length} aria-invalid`, manualPrompt: "Les erreurs sont-elles clairement indiquées et décrites ?" };
    }},
  NT('frm-11.11-help', '11.11', 11, "Dans chaque formulaire, le contrôle de saisie est-il accompagné, si nécessaire, de suggestions ?", "Vérifiez la présence d'aide à la correction des erreurs."),
  NT('frm-11.12-validation', '11.12', 11, "Pour chaque formulaire entraînant une obligation légale ou financière, les données saisies peuvent-elles être modifiées, mises à jour ou récupérées ?", "Vérifiez la possibilité de relire/modifier avant soumission."),
  { id: 'frm-11.13-autofill', num: '11.13', theme: 11, level: 'AA',
    title: "La finalité d'un champ de saisie peut-elle être déduite ?",
    advice: "Ajoutez autocomplete=\"email\", autocomplete=\"name\", etc. sur les champs personnels.",
    run: () => {
      const personalTypes = { email: 'email', tel: 'tel', url: 'url' };
      const suspect = [...document.querySelectorAll('input[type=email], input[type=tel], input[type=url]')].filter(el => !el.autocomplete);
      if (!suspect.length) return { status: 'NT', manualPrompt: "Les champs à finalité déductible ont-ils autocomplete ?" };
      return { status: 'NC', count: suspect.length, measure: `${suspect.length} champ(s) personnel(s) sans autocomplete`, samples: sampleElements(suspect) };
    }},
];

const RULES_NAVIGATION = [
  NT('nav-12.1-plan', '12.1', 12, "Chaque ensemble de pages dispose-t-il de deux systèmes de navigation différents au moins ?", "Vérifiez présence d'au moins 2 systèmes (menu + moteur recherche + plan du site)."),
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
      const anchors = [...document.querySelectorAll('a[href^="#"]')].slice(0, 5);
      if (!anchors.length) return { status: 'NC', count: 1, measure: 'Aucun lien d\'évitement en début de page' };
      const hasSkip = anchors.some(a => {
        const target = document.getElementById(a.getAttribute('href').slice(1));
        return target && /(skip|aller|contenu|main|content)/i.test(a.textContent + ' ' + (a.getAttribute('aria-label') || ''));
      });
      return hasSkip
        ? { status: 'C', count: 0, measure: 'Lien d\'évitement détecté' }
        : { status: 'NC', count: 1, measure: 'Aucun lien d\'évitement identifié dans les 5 premiers liens', samples: sampleElements(anchors) };
    }},
  { id: 'nav-12.8-tab-order', num: '12.8', theme: 12, level: 'A',
    title: "Dans chaque page web, l'ordre de tabulation est-il cohérent ?",
    advice: "N'utilisez que tabindex=\"0\" ou tabindex=\"-1\". Un tabindex positif casse l'ordre naturel.",
    run: () => {
      const pos = [...document.querySelectorAll('[tabindex]')].filter(el => parseInt(el.getAttribute('tabindex')) > 0);
      return pos.length
        ? { status: 'NC', count: pos.length, measure: `${pos.length} élément(s) avec tabindex positif`, samples: sampleElements(pos) }
        : { status: 'NT', manualPrompt: "L'ordre de tabulation est-il logique visuellement ?" };
    }},
  NT('nav-12.9-no-trap', '12.9', 12, "Dans chaque page web, la navigation ne doit pas contenir de piège au clavier.", "Naviguez au clavier et vérifiez qu'il n'y a pas de piège."),
  NT('nav-12.10-shortcuts', '12.10', 12, "Dans chaque page web, les raccourcis clavier n'utilisant qu'une seule touche sont-ils contrôlables ?", "Vérifiez que les accesskeys/raccourcis peuvent être désactivés ou reconfigurés."),
  NT('nav-12.11-hide', '12.11', 12, "Dans chaque page web, les contenus additionnels apparaissant au survol, à la prise de focus ou à l'activation sont-ils contrôlables ?", "Vérifiez les menus déroulants, tooltips, modales."),
];

const RULES_CONSULTATION = [
  NT('con-13.1-timeouts', '13.1', 13, "Pour chaque page web, l'utilisateur a-t-il le contrôle de chaque limite de temps modifiant le contenu ?", "Vérifiez les sessions/timeouts."),
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
  NT('con-13.3-office', '13.3', 13, "Dans chaque page web, chaque document bureautique a-t-il, si nécessaire, une version accessible ?", "Vérifiez l'accessibilité des PDF/DOC."),
  NT('con-13.4-office-relevant', '13.4', 13, "Version accessible du document bureautique pertinente ?", "Vérifiez la fidélité de la version accessible."),
  { id: 'con-13.5-abbr', num: '13.5', theme: 13, level: 'AAA',
    title: "Dans chaque page web, chaque abréviation est-elle explicitée ?",
    advice: "Utilisez <abbr title=\"forme développée\">.",
    run: () => {
      const abbrs = [...document.querySelectorAll('abbr')];
      if (!abbrs.length) return { status: 'NT', manualPrompt: "La page contient-elle des abréviations explicitées ?" };
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
      return { status: 'NT', manualPrompt: "Y a-t-il des effets de flash plus de 3 fois par seconde ?" };
    }},
  NT('con-13.8-animation-control', '13.8', 13, "Dans chaque page web, chaque contenu en mouvement ou clignotant est-il contrôlable par l'utilisateur ?", "Vérifiez les carousels, animations : boutons pause/stop ?"),
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
const asRuleResult = ({ severity, count = 0, measure, elements = [] }) => {
  if (severity === 'ok') return { status: 'C', count: 0, measure };
  return { status: 'NC', severity, count: elements.length || count, measure, samples: sampleElements(elements) };
};

const RULES_ECO = [
  // ---- Stratégie
  { id: 'eco-strat-local-storage', num: '1.6', theme: 'Stratégie',
    title: "Usage excessif du localStorage",
    advice: "Stocker beaucoup de données côté client peut trahir une logique mal placée. Préférez un cache serveur ou IndexedDB pour les volumes importants.",
    run: () => {
      let total = 0; const large = [];
      try {
        for (const k of Object.keys(localStorage)) {
          const v = localStorage.getItem(k) || '';
          const size = v.length * 2;
          total += size;
          if (size > 50000) large.push(k);
        }
      } catch { return { status: 'NT', manualPrompt: 'localStorage inaccessible' }; }
      const severity = total > 512000 ? 'critique' : total > 102400 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${(total/1024).toFixed(0)} Ko dans localStorage (${Object.keys(localStorage).length} clés)` });
    }},
  { id: 'eco-strat-third-party', num: '1.6', theme: 'Stratégie',
    title: 'Dépendances tierces',
    advice: "Auto-hébergez les ressources critiques (polices, analytics). Auditez régulièrement vos dépendances externes.",
    run: () => {
      const host = location.hostname;
      const tp = resourceEntries().filter(e => { try { return new URL(e.name).hostname !== host; } catch { return false; } });
      const hosts = new Set(tp.map(e => { try { return new URL(e.name).hostname; } catch { return ''; } }));
      const severity = hosts.size > 10 ? 'critique' : hosts.size > 5 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${hosts.size} domaine(s) tiers, ${tp.length} requête(s)`, count: hosts.size });
    }},
  // ---- Spécifications
  { id: 'eco-spec-viewport', num: '2.2', theme: 'Spécifications',
    title: 'Meta viewport',
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
  // ---- Architecture
  { id: 'eco-arch-http-requests', num: '6.1', theme: 'Architecture',
    title: 'Nombre de requêtes HTTP',
    advice: "Mutualisez les fichiers JS/CSS, utilisez des sprites SVG, activez HTTP/2, groupez les appels API.",
    run: () => {
      const count = resourceEntries().length + 1;
      const severity = count > 80 ? 'critique' : count > 40 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${count} requêtes` });
    }},
  // ---- UX
  { id: 'eco-ux-video-autoplay', num: '4.7', theme: 'Expérience et interface utilisateur',
    title: 'Vidéos en lecture automatique',
    advice: "Désactivez l'autoplay ou conditionnez-le à une interaction utilisateur.",
    run: () => {
      const autos = [...document.querySelectorAll('video')].filter(v => v.autoplay || v.hasAttribute('autoplay'));
      const severity = autos.some(v => !v.muted) ? 'critique' : autos.length ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${autos.length} vidéo(s) en autoplay`, elements: autos });
    }},
  // ---- Contenus
  { id: 'eco-cont-page-weight', num: '5.1', theme: 'Contenus',
    title: 'Poids total de la page',
    advice: "Compressez les images (WebP/AVIF), minifiez JS/CSS, supprimez les ressources inutilisées.",
    run: () => {
      const entries = resourceEntries();
      const total = entries.reduce((a, e) => a + (e.transferSize || 0), 0) + (navEntry()?.transferSize || 0);
      const severity = total > 2097152 ? 'critique' : total > 1048576 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${(total/1024).toFixed(0)} Ko transférés (${entries.length+1} requêtes)` });
    }},
  { id: 'eco-cont-images-format', num: '5.2', theme: 'Contenus',
    title: 'Images au format non optimisé',
    advice: "Utilisez WebP ou AVIF (30-50% plus léger que JPEG/PNG). Servez via <picture>/srcset.",
    run: () => {
      const all = [...document.querySelectorAll('img')].filter(i => i.complete);
      const imgs = all.filter(i => /\.(jpe?g|png)(\?|$)/i.test(i.currentSrc || i.src || ''));
      const denom = all.length || 1;
      const ratio = imgs.length / denom;
      const severity = ratio > 0.3 ? 'critique' : imgs.length > 0 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${imgs.length} image(s) en JPEG/PNG sur ${denom}`, elements: imgs });
    }},
  { id: 'eco-cont-images-oversized', num: '5.2', theme: 'Contenus',
    title: 'Images surdimensionnées',
    advice: "Servez des images dimensionnées au plus près de leur affichage réel via srcset/sizes.",
    run: () => {
      const dpr = NR_REFERENCE_VIEWPORT.dpr;
      const imgs = [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth > 0 && i.clientWidth > 0);
      const big = imgs.filter(i => i.naturalWidth > i.clientWidth * dpr * 1.5);
      const severity = big.length > 5 ? 'critique' : big.length > 0 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${big.length} image(s) nettement plus grande(s) que leur affichage`, elements: big });
    }},
  { id: 'eco-cont-video-preload', num: '5.5', theme: 'Contenus',
    title: 'Vidéos sans preload="none"',
    advice: "Ajoutez preload=\"none\" et une affiche (poster) pour différer le téléchargement.",
    run: () => {
      const bad = [...document.querySelectorAll('video')].filter(v => v.getAttribute('preload') !== 'none' && !v.autoplay);
      const severity = bad.length > 0 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${bad.length} vidéo(s) sans preload="none"`, elements: bad });
    }},
  // ---- Frontend
  { id: 'eco-front-lazy', num: '6.4', theme: 'Frontend',
    title: 'Images sans lazy-loading',
    advice: "Ajoutez loading=\"lazy\" sur les images hors de la zone visible initiale.",
    run: () => {
      const fold = NR_REFERENCE_VIEWPORT.height;
      const docTop = (img) => { let y = 0, el = img; while (el) { y += el.offsetTop || 0; el = el.offsetParent; } return y; };
      const below = [...document.querySelectorAll('img')].filter(img => docTop(img) > fold && img.loading !== 'lazy' && !img.dataset.src);
      const severity = below.length > 3 ? 'critique' : below.length > 0 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${below.length} image(s) hors viewport sans lazy-load`, elements: below });
    }},
  { id: 'eco-front-js-weight', num: '6.2', theme: 'Frontend',
    title: 'Volume de JavaScript',
    advice: "Activez le tree-shaking, le code splitting, supprimez les dépendances inutilisées.",
    run: () => {
      const js = resourceEntries().filter(e => e.initiatorType === 'script');
      const bytes = js.reduce((a,e)=>a+(e.transferSize||0),0);
      const severity = bytes > 512000 ? 'critique' : bytes > 307200 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${(bytes/1024).toFixed(0)} Ko de JS (${js.length} fichier(s))` });
    }},
  { id: 'eco-front-css-weight', num: '6.1', theme: 'Frontend',
    title: 'Volume de CSS',
    advice: "Purgez le CSS inutilisé (PurgeCSS), évitez les frameworks complets si peu utilisés.",
    run: () => {
      const css = resourceEntries().filter(e => e.initiatorType === 'link' && /\.css/i.test(e.name));
      const bytes = css.reduce((a,e)=>a+(e.transferSize||0),0);
      const severity = bytes > 204800 ? 'critique' : bytes > 102400 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${(bytes/1024).toFixed(0)} Ko de CSS (${css.length} fichier(s))` });
    }},
  { id: 'eco-front-fonts', num: '6.6', theme: 'Frontend',
    title: 'Polices web excessives',
    advice: "Limitez à 2 familles maximum, utilisez font-display: swap, préférez les polices système.",
    run: () => {
      const fonts = resourceEntries().filter(e => /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(e.name));
      const severity = fonts.length > 6 ? 'critique' : fonts.length > 4 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${fonts.length} fichier(s) de police` });
    }},
  { id: 'eco-front-dom', num: '6.3', theme: 'Frontend',
    title: 'Taille du DOM',
    advice: "Utilisez la virtualisation pour les listes longues, simplifiez la structure HTML.",
    run: () => {
      const n = document.querySelectorAll('*').length;
      const severity = n > 1500 ? 'critique' : n > 800 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${n} nœuds DOM` });
    }},
  { id: 'eco-front-img-dim', num: '5.2', theme: 'Frontend',
    title: 'Images sans width/height',
    advice: "Spécifiez width et height (ou aspect-ratio CSS) pour éviter les reflows (CLS).",
    run: () => {
      const miss = [...document.querySelectorAll('img')].filter(img => (!img.hasAttribute('width') || !img.hasAttribute('height')) && !img.style.aspectRatio);
      const severity = miss.length > 3 ? 'majeur' : miss.length > 0 ? 'mineur' : 'ok';
      return asRuleResult({ severity, measure: `${miss.length} image(s) sans dimensions`, elements: miss });
    }},
  { id: 'eco-front-render-blocking', num: '6.1', theme: 'Frontend',
    title: 'Ressources bloquant le rendu',
    advice: "Ajoutez defer/async sur les scripts, chargez le CSS non critique de manière asynchrone.",
    run: () => {
      const scr = [...document.querySelectorAll('head script[src]')].filter(s => !s.async && !s.defer && !s.type?.includes('module'));
      const severity = scr.length > 2 ? 'critique' : scr.length > 0 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${scr.length} script(s) synchrone(s) en <head>`, elements: scr });
    }},
  // ---- Backend
  { id: 'eco-back-ttfb', num: '7.1', theme: 'Backend',
    title: 'Temps de réponse serveur élevé (TTFB)',
    advice: "Un TTFB élevé indique un backend lent : mise en cache serveur, optimisation des requêtes SQL, CDN.",
    run: () => {
      const nav = navEntry();
      if (!nav) return { status: 'NT', manualPrompt: 'Mesure TTFB indisponible' };
      const ttfb = nav.responseStart - nav.requestStart;
      const severity = ttfb > 1500 ? 'critique' : ttfb > 600 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `TTFB : ${Math.round(ttfb)} ms` });
    }},
  // ---- Hébergement
  { id: 'eco-host-cache', num: '8.3', theme: 'Hébergement',
    title: 'Ressources probablement non mises en cache',
    advice: "Configurez Cache-Control avec des durées longues sur vos assets versionnés (JS/CSS/images).",
    run: () => {
      const entries = resourceEntries();
      if (entries.length === 0) return asRuleResult({ severity: 'ok', measure: 'Aucune ressource analysable' });
      const notCached = entries.filter(e => e.transferSize > 0 && e.encodedBodySize > 0 && e.transferSize >= e.encodedBodySize);
      const ratio = notCached.length / entries.length;
      const severity = ratio > 0.8 ? 'critique' : ratio > 0.5 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${notCached.length}/${entries.length} ressource(s) servie(s) sans cache apparent` });
    }},
  { id: 'eco-host-compression', num: '8.2', theme: 'Hébergement',
    title: 'Ressources textuelles probablement non compressées',
    advice: "Activez gzip ou brotli sur votre serveur pour le HTML, CSS, JS et SVG.",
    run: () => {
      const textual = resourceEntries().filter(e =>
        /\.(js|mjs|css|svg|json|html?|xml)(\?|$)/i.test(e.name) && e.encodedBodySize > 1024
      );
      const uncompressed = textual.filter(e => e.encodedBodySize > 0 && e.decodedBodySize > 0 && e.encodedBodySize === e.decodedBodySize);
      const ratio = textual.length ? uncompressed.length / textual.length : 0;
      const severity = ratio > 0.5 ? 'critique' : uncompressed.length > 0 ? 'majeur' : 'ok';
      return asRuleResult({ severity, measure: `${uncompressed.length} ressource(s) textuelle(s) non compressée(s) sur ${textual.length}` });
    }},
  // ---- Algorithmie
  NT('eco-algo-complexity', '9.1', 'Algorithmie',
    "Complexité algorithmique des traitements côté client",
    "Vérifiez que les boucles, tris et traitements lourds ne sont pas effectués en temps réel sur de gros volumes côté client."),
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
    rgaaTotal: ALL_A11Y.length,
    rgaaThemes: RGAA_THEMES,
    ecoTotal: RULES_ECO.length,
    ecoThemes: RGESN_THEMES,
    version: 2
  }
};

const runRules = (list, kind) => {
  const out = [];
  for (const rule of list) {
    let res;
    try { res = rule.run(); } catch (e) {
      console.warn('[NR] rule failed:', rule.id, e);
      res = { status: 'NT', manualPrompt: 'Erreur d\'exécution de la règle' };
    }
    const entry = {
      id: rule.id,
      title: rule.title,
      advice: rule.advice,
      status: res.status,
      count: res.count || 0,
      measure: res.measure || '',
      samples: res.samples || [],
      manualPrompt: res.manualPrompt || null
    };
    if (kind === 'a11y') {
      entry.rgaa = rule.num;
      entry.theme = rule.theme;
      entry.themeLabel = RGAA_THEMES[rule.theme];
      entry.level = rule.level || 'A';
    } else {
      entry.critere = rule.num;
      entry.thematique = rule.theme;
      entry.severity = res.severity || (res.status === 'NC' ? 'majeur' : null);
    }
    out.push(entry);
  }
  return out;
};

if (mode === 'a11y' || mode === 'both') {
  results.a11y = runRules(ALL_A11Y, 'a11y');
}
if (mode === 'eco' || mode === 'both') {
  results.eco = runRules(RULES_ECO, 'eco');
}

globalThis.__nrAuditIdCounter = __nrCounter;
return results;
};
