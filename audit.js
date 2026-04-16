// Exposes globalThis.__nrAudit(mode) — appelé depuis le side panel via chrome.scripting.
globalThis.__nrAudit = async function (mode) {
  // Viewport de référence figé : garantit que les règles géométriques (lazy-load,
  // surdimension) donnent le même résultat quel que soit l'état de l'onglet
  // (actif ou en arrière-plan) ou la taille du panneau latéral.
  const NR_REFERENCE_VIEWPORT = { width: 1280, height: 900, dpr: 1 };

  const results = {
    a11y: [],
    eco: [],
    meta: { url: location.href, title: document.title }
  };

  // Snapshot unique des entrées performance : toutes les règles eco partagent la
  // même liste, sinon les beacons analytics arrivant pendant l'audit font varier
  // le nombre de ressources entre deux lectures successives.
  let nrResourceSnapshot = [];
  try { nrResourceSnapshot = performance.getEntriesByType('resource').slice(); } catch {}
  let nrNavSnapshot = null;
  try { nrNavSnapshot = performance.getEntriesByType('navigation')[0] || null; } catch {}

  // Attend que les images aient fini de charger (ou timeout 3 s). Sans ça,
  // img.naturalWidth vaut 0 sur les images lazy non décodées et les règles
  // images-format / images-oversized donnent des comptages variables.
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

  // ---------- Utils ----------
  const isVisible = (el) => {
    if (!el) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  };

  const isAnchorable = (el) => {
    return el && el.nodeType === 1 &&
      el !== document.documentElement && el !== document.body && el !== document.head;
  };

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

  // Tri déterministe : même DOM → mêmes samples, quel que soit l'ordre de filtrage
  // en amont (certaines règles filtrent sur naturalWidth, dont l'ordre dépend du
  // moment de lecture).
  const sampleElements = (els, n = 5) => {
    const decorated = els.map(el => ({ el, desc: describe(el) }));
    decorated.sort((a, b) => a.desc.selector.localeCompare(b.desc.selector) || (a.desc.outer || '').localeCompare(b.desc.outer || ''));
    return decorated.slice(0, n).map(d => d.desc);
  };

  // ---------- A11Y RULES ----------
  const a11yRules = [
    {
      id: 'img-alt-missing', rgaa: '1.1', level: 'A', severity: 'critique',
      famille: 'Images',
      title: 'Images sans attribut alt',
      advice: "Ajoutez un attribut alt à chaque <img>. Vide (alt=\"\") si l'image est décorative, descriptif sinon.",
      run: () => [...document.querySelectorAll('img:not([alt])')]
    },
    {
      id: 'form-label-missing', rgaa: '11.1', level: 'A', severity: 'critique',
      famille: 'Formulaires',
      title: 'Champs de formulaire sans label',
      advice: "Associez un <label for=\"id\"> à chaque champ, ou utilisez aria-label / aria-labelledby.",
      run: () => [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea')]
        .filter(el => {
          if (el.getAttribute('aria-label')?.trim()) return false;
          const lb = el.getAttribute('aria-labelledby');
          if (lb && document.getElementById(lb)?.textContent.trim()) return false;
          if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
          if (el.closest('label')) return false;
          if (el.title?.trim()) return false;
          return true;
        })
    },
    {
      id: 'button-no-name', rgaa: '11.9', level: 'A', severity: 'critique',
      famille: 'Formulaires',
      title: 'Boutons sans nom accessible',
      advice: "Ajoutez un texte visible, un aria-label ou un aria-labelledby à chaque bouton.",
      run: () => [...document.querySelectorAll('button, [role="button"], input[type=submit], input[type=button], input[type=reset]')]
        .filter(btn => {
          if (btn.getAttribute('aria-label')?.trim()) return false;
          const lb = btn.getAttribute('aria-labelledby');
          if (lb && document.getElementById(lb)?.textContent.trim()) return false;
          if (btn.title?.trim()) return false;
          if (btn.tagName === 'INPUT') return !btn.value?.trim();
          const hasImgAlt = [...btn.querySelectorAll('img')].some(img => img.alt?.trim());
          return !hasImgAlt && btn.textContent.trim() === '';
        })
    },
    {
      id: 'link-no-name', rgaa: '6.1', level: 'A', severity: 'critique',
      famille: 'Navigation',
      title: 'Liens sans nom accessible',
      advice: "Donnez un texte ou un aria-label explicite à chaque lien.",
      run: () => [...document.querySelectorAll('a[href]')].filter(link => {
        if (link.getAttribute('aria-label')?.trim()) return false;
        const lb = link.getAttribute('aria-labelledby');
        if (lb && document.getElementById(lb)?.textContent.trim()) return false;
        if (link.title?.trim()) return false;
        if ([...link.querySelectorAll('img')].some(img => img.alt?.trim())) return false;
        return link.textContent.trim() === '';
      })
    },
    {
      id: 'link-generic-text', rgaa: '6.1', level: 'A', severity: 'majeur',
      famille: 'Navigation',
      title: 'Liens au texte peu explicite',
      advice: "Évitez \"cliquez ici\", \"lire la suite\". Décrivez la cible du lien hors contexte.",
      run: () => {
        const generic = ['cliquez ici','click here','lire la suite','read more','en savoir plus','learn more','ici','here','suite','voir plus'];
        return [...document.querySelectorAll('a[href]')].filter(l => generic.includes(l.textContent.trim().toLowerCase()));
      }
    },
    {
      id: 'html-lang-missing', rgaa: '8.3', level: 'A', severity: 'critique',
      famille: 'Structure',
      title: 'Attribut lang manquant sur <html>',
      advice: "Ajoutez lang=\"fr\" (ou autre code BCP 47) sur la balise <html>.",
      run: () => {
        const lang = document.documentElement.getAttribute('lang');
        return (!lang || !lang.trim()) ? [document.documentElement] : [];
      }
    },
    {
      id: 'html-lang-invalid', rgaa: '8.4', level: 'A', severity: 'majeur',
      famille: 'Structure',
      title: 'Attribut lang invalide',
      advice: "Utilisez un code BCP 47 valide (ex: \"fr\", \"fr-FR\", \"en\").",
      run: () => {
        const lang = document.documentElement.getAttribute('lang');
        return (lang && !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(lang.trim())) ? [document.documentElement] : [];
      }
    },
    {
      id: 'heading-broken', rgaa: '9.1', level: 'A', severity: 'majeur',
      famille: 'Structure',
      title: 'Saut de niveau dans la hiérarchie des titres',
      advice: "Ne sautez pas de niveau (h1 → h3). Respectez une hiérarchie linéaire.",
      run: () => {
        const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
        const errs = []; let prev = 0;
        for (const h of hs) {
          const lvl = +h.tagName[1];
          if (prev !== 0 && lvl > prev + 1) errs.push(h);
          prev = lvl;
        }
        return errs;
      }
    },
    {
      id: 'heading-no-h1', rgaa: '9.1', level: 'A', severity: 'majeur',
      famille: 'Structure',
      title: 'Aucun titre <h1>',
      advice: "Chaque page doit comporter un titre principal <h1> décrivant son contenu.",
      run: () => document.querySelectorAll('h1').length === 0 ? [document.body] : []
    },
    {
      id: 'color-contrast', rgaa: '3.2', level: 'AA', severity: 'critique',
      famille: 'Couleurs',
      title: 'Contraste de texte insuffisant',
      advice: "Le ratio de contraste doit être ≥ 4.5:1 (texte normal) ou ≥ 3:1 (texte large / gras).",
      run: () => {
        const luminance = (r, g, b) => {
          const [rs, gs, bs] = [r,g,b].map(c => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); });
          return 0.2126*rs + 0.7152*gs + 0.0722*bs;
        };
        const parseColor = (c) => { const m = c.match(/\d+(\.\d+)?/g); return m ? [+m[0], +m[1], +m[2], m[3] !== undefined ? +m[3] : 1] : null; };
        const bgOf = (el) => {
          let cur = el;
          while (cur && cur !== document.documentElement) {
            const c = parseColor(getComputedStyle(cur).backgroundColor);
            if (c && c[3] > 0) return c;
            cur = cur.parentElement;
          }
          return [255,255,255,1];
        };
        const els = [...document.querySelectorAll('p,span,a,li,td,th,label,button,h1,h2,h3,h4,h5,h6')]
          .filter(el => isVisible(el) && el.textContent.trim() !== '' && !el.querySelector('p,span,a,li,td,th,label,button,h1,h2,h3,h4,h5,h6'))
          .slice(0, 250);
        return els.filter(el => {
          const s = getComputedStyle(el);
          const fg = parseColor(s.color); const bg = bgOf(el);
          if (!fg || !bg) return false;
          const l1 = luminance(fg[0],fg[1],fg[2]); const l2 = luminance(bg[0],bg[1],bg[2]);
          const ratio = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
          const fs = parseFloat(s.fontSize); const fw = parseInt(s.fontWeight)||400;
          const large = fs >= 24 || (fs >= 18.67 && fw >= 700);
          return ratio < (large ? 3 : 4.5);
        });
      }
    },
    {
      id: 'table-no-headers', rgaa: '5.7', level: 'A', severity: 'majeur',
      famille: 'Structure',
      title: 'Tableaux de données sans en-têtes <th>',
      advice: "Utilisez <th scope=\"col\"> ou scope=\"row\", ou role=\"presentation\" pour les tableaux de mise en forme.",
      run: () => [...document.querySelectorAll('table')].filter(t => {
        const role = t.getAttribute('role');
        if (role === 'presentation' || role === 'none') return false;
        return t.querySelectorAll('th').length === 0;
      })
    },
    {
      id: 'tabindex-positive', rgaa: '12.8', level: 'A', severity: 'majeur',
      famille: 'Navigation',
      title: 'tabindex positif détecté',
      advice: "N'utilisez que tabindex=\"0\" ou tabindex=\"-1\". Un tabindex positif casse l'ordre naturel.",
      run: () => [...document.querySelectorAll('[tabindex]')].filter(el => parseInt(el.getAttribute('tabindex')) > 0)
    },
    {
      id: 'landmark-main-missing', rgaa: '12.6', level: 'AA', severity: 'majeur',
      famille: 'Navigation',
      title: 'Landmark <main> absent',
      advice: "Ajoutez un <main> (ou role=\"main\") pour délimiter le contenu principal.",
      run: () => document.querySelector('main, [role=main]') ? [] : [document.body]
    },
    {
      id: 'aria-invalid-role', rgaa: '8.9', level: 'A', severity: 'majeur',
      famille: 'Structure',
      title: "Valeurs de role ARIA invalides",
      advice: "N'utilisez que des roles ARIA valides définis par la spécification WAI-ARIA.",
      run: () => {
        const valid = new Set(['alert','alertdialog','application','article','banner','button','cell','checkbox','columnheader','combobox','complementary','contentinfo','definition','dialog','directory','document','feed','figure','form','grid','gridcell','group','heading','img','link','list','listbox','listitem','log','main','marquee','math','menu','menubar','menuitem','menuitemcheckbox','menuitemradio','navigation','none','note','option','presentation','progressbar','radio','radiogroup','region','row','rowgroup','rowheader','scrollbar','search','searchbox','separator','slider','spinbutton','status','switch','tab','table','tablist','tabpanel','term','textbox','timer','toolbar','tooltip','tree','treegrid','treeitem']);
        return [...document.querySelectorAll('[role]')].filter(el => {
          const roles = el.getAttribute('role').trim().split(/\s+/);
          return roles.some(r => !valid.has(r));
        });
      }
    },
    {
      id: 'skip-link-missing', rgaa: '12.7', level: 'A', severity: 'majeur',
      famille: 'Navigation',
      title: "Lien d'évitement absent",
      advice: "Ajoutez un premier lien \"Aller au contenu\" pointant vers le #main.",
      run: () => {
        const first = document.querySelector('a[href^="#"]');
        if (!first) return [document.body];
        const target = document.getElementById(first.getAttribute('href').slice(1));
        return target ? [] : [first];
      }
    }
  ];

  // ---------- ECO RULES ----------
  // Utilise les snapshots figés au début de l'audit (stabilité des résultats).
  const resourceEntries = () => nrResourceSnapshot;
  const navEntry = () => nrNavSnapshot;

  const ecoRules = [
    // ========== STRATÉGIE ==========
    {
      id: 'local-storage-abuse', critere: '1.6', thematique: 'Stratégie',
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
        } catch { return { status: 'ok', measure: 'localStorage inaccessible', elements: [] }; }
        const status = total > 512000 ? 'critique' : total > 102400 ? 'majeur' : 'ok';
        return { status, measure: `${(total/1024).toFixed(0)} Ko dans localStorage (${Object.keys(localStorage).length} clés)`, elements: [] };
      }
    },
    {
      id: 'third-party', critere: '1.6', thematique: 'Stratégie',
      title: 'Dépendances tierces',
      advice: "Auto-hébergez les ressources critiques (polices, analytics). Auditez régulièrement vos dépendances externes.",
      run: () => {
        const host = location.hostname;
        const tp = resourceEntries().filter(e => { try { return new URL(e.name).hostname !== host; } catch { return false; } });
        const hosts = new Set(tp.map(e => { try { return new URL(e.name).hostname; } catch { return ''; } }));
        const status = hosts.size > 10 ? 'critique' : hosts.size > 5 ? 'majeur' : 'ok';
        return { status, measure: `${hosts.size} domaine(s) tiers, ${tp.length} requête(s)`, elements: [] };
      }
    },

    // ========== SPÉCIFICATIONS ==========
    {
      id: 'meta-viewport', critere: '2.2', thematique: 'Spécifications',
      title: 'Meta viewport',
      advice: "Configurez <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> sans bloquer le zoom.",
      run: () => {
        const v = document.querySelector('meta[name="viewport"]');
        if (!v) return { status: 'critique', measure: 'Meta viewport absent', elements: [] };
        const c = v.getAttribute('content') || '';
        if (c.includes('user-scalable=no') || /maximum-scale=1(?!\d)/.test(c))
          return { status: 'majeur', measure: 'Zoom utilisateur bloqué', elements: [v] };
        if (!c.includes('width=device-width'))
          return { status: 'majeur', measure: 'width=device-width manquant', elements: [v] };
        return { status: 'ok', measure: 'Viewport correct', elements: [] };
      }
    },

    // ========== ARCHITECTURE ==========
    {
      id: 'http-requests', critere: '6.1', thematique: 'Architecture',
      title: 'Nombre de requêtes HTTP',
      advice: "Mutualisez les fichiers JS/CSS, utilisez des sprites SVG, activez HTTP/2, groupez les appels API.",
      run: () => {
        const count = resourceEntries().length + 1;
        const status = count > 80 ? 'critique' : count > 40 ? 'majeur' : 'ok';
        return { status, measure: `${count} requêtes`, elements: [] };
      }
    },

    // ========== EXPÉRIENCE ET INTERFACE UTILISATEUR ==========
    {
      id: 'video-autoplay', critere: '4.7', thematique: 'Expérience et interface utilisateur',
      title: 'Vidéos en lecture automatique',
      advice: "Désactivez l'autoplay ou conditionnez-le à une interaction utilisateur.",
      run: () => {
        const autos = [...document.querySelectorAll('video')].filter(v => v.autoplay || v.hasAttribute('autoplay'));
        const status = autos.some(v => !v.muted) ? 'critique' : autos.length ? 'majeur' : 'ok';
        return { status, measure: `${autos.length} vidéo(s) en autoplay`, elements: autos };
      }
    },

    // ========== CONTENUS ==========
    {
      id: 'page-weight', critere: '5.1', thematique: 'Contenus',
      title: 'Poids total de la page',
      advice: "Compressez les images (WebP/AVIF), minifiez JS/CSS, supprimez les ressources inutilisées.",
      run: () => {
        const entries = resourceEntries();
        const total = entries.reduce((a, e) => a + (e.transferSize || 0), 0) + (navEntry()?.transferSize || 0);
        const status = total > 2097152 ? 'critique' : total > 1048576 ? 'majeur' : 'ok';
        return { status, measure: `${(total/1024).toFixed(0)} Ko transférés (${entries.length+1} requêtes)`, elements: [] };
      }
    },
    {
      id: 'images-format', critere: '5.2', thematique: 'Contenus',
      title: 'Images au format non optimisé',
      advice: "Utilisez WebP ou AVIF (30-50% plus léger que JPEG/PNG). Servez via <picture>/srcset.",
      run: () => {
        const all = [...document.querySelectorAll('img')].filter(i => i.complete);
        const imgs = all.filter(i => /\.(jpe?g|png)(\?|$)/i.test(i.currentSrc || i.src || ''));
        const denom = all.length || 1;
        const ratio = imgs.length / denom;
        const status = ratio > 0.3 ? 'critique' : imgs.length > 0 ? 'majeur' : 'ok';
        return { status, measure: `${imgs.length} image(s) en JPEG/PNG sur ${denom}`, elements: imgs };
      }
    },
    {
      id: 'images-oversized', critere: '5.2', thematique: 'Contenus',
      title: 'Images surdimensionnées',
      advice: "Servez des images dimensionnées au plus près de leur affichage réel via srcset/sizes.",
      run: () => {
        const dpr = NR_REFERENCE_VIEWPORT.dpr;
        const imgs = [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth > 0 && i.clientWidth > 0);
        const big = imgs.filter(i => i.naturalWidth > i.clientWidth * dpr * 1.5);
        const status = big.length > 5 ? 'critique' : big.length > 0 ? 'majeur' : 'ok';
        return { status, measure: `${big.length} image(s) nettement plus grande(s) que leur affichage`, elements: big };
      }
    },
    {
      id: 'video-preload', critere: '5.5', thematique: 'Contenus',
      title: 'Vidéos sans preload="none"',
      advice: "Ajoutez preload=\"none\" et une affiche (poster) pour différer le téléchargement.",
      run: () => {
        const bad = [...document.querySelectorAll('video')].filter(v => v.getAttribute('preload') !== 'none' && !v.autoplay);
        const status = bad.length > 0 ? 'majeur' : 'ok';
        return { status, measure: `${bad.length} vidéo(s) sans preload="none"`, elements: bad };
      }
    },

    // ========== FRONTEND ==========
    {
      id: 'images-lazy-missing', critere: '6.4', thematique: 'Frontend',
      title: 'Images sans lazy-loading',
      advice: "Ajoutez loading=\"lazy\" sur les images hors de la zone visible initiale.",
      run: () => {
        // Viewport de référence figé pour classer "above / below the fold" :
        // window.innerHeight varie selon la taille du panneau et l'état actif
        // de l'onglet, ce qui rend ce test non déterministe.
        const fold = NR_REFERENCE_VIEWPORT.height;
        // offsetTop absolu plutôt que getBoundingClientRect : indépendant du scroll.
        const docTop = (img) => {
          let y = 0, el = img;
          while (el) { y += el.offsetTop || 0; el = el.offsetParent; }
          return y;
        };
        const below = [...document.querySelectorAll('img')].filter(img => {
          return docTop(img) > fold && img.loading !== 'lazy' && !img.dataset.src;
        });
        const status = below.length > 3 ? 'critique' : below.length > 0 ? 'majeur' : 'ok';
        return { status, measure: `${below.length} image(s) hors viewport sans lazy-load`, elements: below };
      }
    },
    {
      id: 'js-weight', critere: '6.2', thematique: 'Frontend',
      title: 'Volume de JavaScript',
      advice: "Activez le tree-shaking, le code splitting, supprimez les dépendances inutilisées.",
      run: () => {
        const js = resourceEntries().filter(e => e.initiatorType === 'script');
        const bytes = js.reduce((a,e)=>a+(e.transferSize||0),0);
        const status = bytes > 512000 ? 'critique' : bytes > 307200 ? 'majeur' : 'ok';
        return { status, measure: `${(bytes/1024).toFixed(0)} Ko de JS (${js.length} fichier(s))`, elements: [] };
      }
    },
    {
      id: 'css-weight', critere: '6.1', thematique: 'Frontend',
      title: 'Volume de CSS',
      advice: "Purgez le CSS inutilisé (PurgeCSS), évitez les frameworks complets si peu utilisés.",
      run: () => {
        const css = resourceEntries().filter(e => e.initiatorType === 'link' && /\.css/i.test(e.name));
        const bytes = css.reduce((a,e)=>a+(e.transferSize||0),0);
        const status = bytes > 204800 ? 'critique' : bytes > 102400 ? 'majeur' : 'ok';
        return { status, measure: `${(bytes/1024).toFixed(0)} Ko de CSS (${css.length} fichier(s))`, elements: [] };
      }
    },
    {
      id: 'web-fonts', critere: '6.6', thematique: 'Frontend',
      title: 'Polices web excessives',
      advice: "Limitez à 2 familles maximum, utilisez font-display: swap, préférez les polices système.",
      run: () => {
        const fonts = resourceEntries().filter(e => /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(e.name));
        const status = fonts.length > 6 ? 'critique' : fonts.length > 4 ? 'majeur' : 'ok';
        return { status, measure: `${fonts.length} fichier(s) de police`, elements: [] };
      }
    },
    {
      id: 'dom-size', critere: '6.3', thematique: 'Frontend',
      title: 'Taille du DOM',
      advice: "Utilisez la virtualisation pour les listes longues, simplifiez la structure HTML.",
      run: () => {
        const n = document.querySelectorAll('*').length;
        const status = n > 1500 ? 'critique' : n > 800 ? 'majeur' : 'ok';
        return { status, measure: `${n} nœuds DOM`, elements: [] };
      }
    },
    {
      id: 'images-dimensions', critere: '5.2', thematique: 'Frontend',
      title: 'Images sans width/height',
      advice: "Spécifiez width et height (ou aspect-ratio CSS) pour éviter les reflows (CLS).",
      run: () => {
        const miss = [...document.querySelectorAll('img')].filter(img => (!img.hasAttribute('width') || !img.hasAttribute('height')) && !img.style.aspectRatio);
        const status = miss.length > 3 ? 'majeur' : miss.length > 0 ? 'mineur' : 'ok';
        return { status, measure: `${miss.length} image(s) sans dimensions`, elements: miss };
      }
    },
    {
      id: 'render-blocking', critere: '6.1', thematique: 'Frontend',
      title: 'Ressources bloquant le rendu',
      advice: "Ajoutez defer/async sur les scripts, chargez le CSS non critique de manière asynchrone.",
      run: () => {
        const scr = [...document.querySelectorAll('head script[src]')].filter(s => !s.async && !s.defer && !s.type?.includes('module'));
        const status = scr.length > 2 ? 'critique' : scr.length > 0 ? 'majeur' : 'ok';
        return { status, measure: `${scr.length} script(s) synchrone(s) en <head>`, elements: scr };
      }
    },

    // ========== BACKEND (signal indirect) ==========
    {
      id: 'ttfb-slow', critere: '7.1', thematique: 'Backend',
      title: 'Temps de réponse serveur élevé (TTFB)',
      advice: "Un TTFB élevé indique un backend lent : mise en cache serveur, optimisation des requêtes SQL, CDN.",
      run: () => {
        const nav = navEntry();
        if (!nav) return { status: 'ok', measure: 'Mesure TTFB indisponible', elements: [] };
        const ttfb = nav.responseStart - nav.requestStart;
        const status = ttfb > 1500 ? 'critique' : ttfb > 600 ? 'majeur' : 'ok';
        return { status, measure: `TTFB : ${Math.round(ttfb)} ms`, elements: [] };
      }
    },

    // ========== HÉBERGEMENT (signal indirect) ==========
    {
      id: 'no-cache-resources', critere: '8.3', thematique: 'Hébergement',
      title: 'Ressources probablement non mises en cache',
      advice: "Configurez Cache-Control avec des durées longues sur vos assets versionnés (JS/CSS/images).",
      run: () => {
        const entries = resourceEntries();
        if (entries.length === 0) return { status: 'ok', measure: 'Aucune ressource analysable', elements: [] };
        const notCached = entries.filter(e => e.transferSize > 0 && e.encodedBodySize > 0 && e.transferSize >= e.encodedBodySize);
        const ratio = notCached.length / entries.length;
        const status = ratio > 0.8 ? 'critique' : ratio > 0.5 ? 'majeur' : 'ok';
        return { status, measure: `${notCached.length}/${entries.length} ressource(s) servie(s) sans cache apparent`, elements: [] };
      }
    },
    {
      id: 'compression-missing', critere: '8.2', thematique: 'Hébergement',
      title: 'Ressources textuelles probablement non compressées',
      advice: "Activez gzip ou brotli sur votre serveur pour le HTML, CSS, JS et SVG.",
      run: () => {
        const textual = resourceEntries().filter(e =>
          /\.(js|mjs|css|svg|json|html?|xml)(\?|$)/i.test(e.name) && e.encodedBodySize > 1024
        );
        const uncompressed = textual.filter(e => e.encodedBodySize > 0 && e.decodedBodySize > 0 && e.encodedBodySize === e.decodedBodySize);
        const ratio = textual.length ? uncompressed.length / textual.length : 0;
        const status = ratio > 0.5 ? 'critique' : uncompressed.length > 0 ? 'majeur' : 'ok';
        return { status, measure: `${uncompressed.length} ressource(s) textuelle(s) non compressée(s) sur ${textual.length}`, elements: [] };
      }
    }
  ];

  // ---------- Run A11Y ----------
  if (mode === 'a11y' || mode === 'both') {
    for (const rule of a11yRules) {
      try {
        const els = rule.run();
        if (els.length > 0) {
          results.a11y.push({
            id: rule.id, title: rule.title, rgaa: rule.rgaa, level: rule.level,
            severity: rule.severity, famille: rule.famille, advice: rule.advice,
            count: els.length, samples: sampleElements(els, 5)
          });
        }
      } catch (e) { console.warn('A11y rule failed:', rule.id, e); }
    }
    results.meta.a11yTotal = a11yRules.length;
  }

  // ---------- Run ECO ----------
  if (mode === 'eco' || mode === 'both') {
    for (const rule of ecoRules) {
      try {
        const r = rule.run();
        if (r.status !== 'ok') {
          results.eco.push({
            id: rule.id, title: rule.title, critere: rule.critere, thematique: rule.thematique,
            severity: r.status, advice: rule.advice, measure: r.measure,
            count: r.elements.length, samples: sampleElements(r.elements, 5)
          });
        }
      } catch (e) { console.warn('Eco rule failed:', rule.id, e); }
    }
    results.meta.ecoTotal = ecoRules.length;
    results.meta.ecoThemes = ['Stratégie','Spécifications','Architecture','Expérience et interface utilisateur','Contenus','Frontend','Backend','Hébergement','Algorithmie'];
  }

  globalThis.__nrAuditIdCounter = __nrCounter;
  return results;
};
