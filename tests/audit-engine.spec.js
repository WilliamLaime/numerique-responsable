import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const AUDIT_SRC = fs.readFileSync(path.join(ROOT, 'public', 'audit.js'), 'utf8');

/**
 * Charge audit.js dans la page puis exécute __nrAudit(mode).
 * On retourne { a11y: Map<id, entry>, eco: Map<id, entry>, raw }.
 */
async function runAudit(page, fixtureFile, mode = 'both') {
  const fixturePath = path.join(__dirname, 'fixtures', fixtureFile);
  await page.goto('file://' + fixturePath);
  const raw = await page.evaluate(async ({ src, mode }) => {
    // eslint-disable-next-line no-eval
    eval(src);
    return await globalThis.__nrAudit(mode);
  }, { src: AUDIT_SRC, mode });
  const byId = (arr) => Object.fromEntries(arr.map(r => [r.id, r]));
  return { a11y: byId(raw.a11y), eco: byId(raw.eco), raw };
}

test.describe('Moteur audit.js — page avec violations', () => {
  test('détecte les violations RGAA ciblées', async ({ page }) => {
    const { a11y } = await runAudit(page, 'a11y-violations.html', 'a11y');

    // Images sans alt (count = 3 : 2 <img> directs + 1 dans figure sans alt ? non, celle-là a alt="chat")
    expect(a11y['img-1.1-alt-missing'].status).toBe('NC');
    expect(a11y['img-1.1-alt-missing'].count).toBeGreaterThanOrEqual(2);

    // Figure sans figcaption
    expect(a11y['img-1.9-figure-legend'].status).toBe('NC');

    // iframe sans title
    expect(a11y['frame-2.1-title'].status).toBe('NC');

    // DOCTYPE présent (c'est le html qui a pas de lang, pas l'absence de doctype)
    expect(a11y['obl-8.1-doctype'].status).toBe('C');

    // id dupliqué
    expect(a11y['obl-8.2-valid'].status).toBe('NC');

    // lang absent sur <html>
    expect(a11y['obl-8.3-lang'].status).toBe('NC');

    // title générique "Document"
    expect(a11y['obl-8.6-title-relevant'].status).toBe('NC');

    // Structure de titres cassée (pas de h1)
    expect(a11y['str-9.1-headings'].status).toBe('NC');

    // viewport bloque le zoom
    expect(a11y['pre-10.4-zoom'].status).toBe('NC');

    // input sans label
    expect(a11y['frm-11.1-label'].status).toBe('NC');

    // radios hors fieldset
    expect(a11y['frm-11.5-fieldset'].status).toBe('NC');

    // fieldset sans legend
    expect(a11y['frm-11.6-legend'].status).toBe('NC');

    // bouton sans nom accessible
    expect(a11y['frm-11.9-button-name'].status).toBe('NC');

    // email sans autocomplete
    expect(a11y['frm-11.13-autofill'].status).toBe('NC');

    // pas de <main>
    expect(a11y['nav-12.6-main'].status).toBe('NC');
    expect(a11y['nav-12.4-landmarks'].status).toBe('NC');

    // lien vide
    expect(a11y['lnk-6.1-name'].status).toBe('NC');
  });
});

test.describe('Moteur audit.js — page conforme', () => {
  test('aucune règle automatisée ne retourne NC', async ({ page }) => {
    const { a11y, raw } = await runAudit(page, 'a11y-clean.html', 'a11y');

    const failures = Object.values(a11y).filter(r => r.status === 'NC');
    if (failures.length) {
      console.log('Échecs inattendus sur la page clean :\n' +
        failures.map(f => `  - ${f.id} : ${f.measure}`).join('\n'));
    }
    expect(failures).toHaveLength(0);

    // Quelques garanties ponctuelles sur les règles clé
    expect(a11y['img-1.1-alt-missing'].status).toBe('C');
    expect(a11y['obl-8.1-doctype'].status).toBe('C');
    expect(a11y['obl-8.3-lang'].status).toBe('C');
    expect(a11y['obl-8.4-lang-valid'].status).toBe('C');
    expect(a11y['obl-8.5-title'].status).toBe('C');
    expect(a11y['str-9.1-headings'].status).toBe('C');
    expect(a11y['nav-12.6-main'].status).toBe('C');
    expect(a11y['frm-11.1-label'].status).toBe('C');

    // Méta attendues
    expect(raw.meta.url).toContain('a11y-clean.html');
    expect(raw.meta.rgaaTotal).toBeGreaterThan(0);
  });
});

test.describe('Thème 3 — Couleurs', () => {
  test('col-3.2-contrast-text NC si texte à contraste insuffisant', async ({ page }) => {
    const { a11y } = await runAudit(page, 'couleurs-violations.html', 'a11y');
    expect(a11y['col-3.2-contrast-text'].status).toBe('NC');
    expect(a11y['col-3.2-contrast-text'].count).toBeGreaterThanOrEqual(2);
  });

  test('col-3.2-contrast-text C sur page propre', async ({ page }) => {
    const { a11y } = await runAudit(page, 'a11y-clean.html', 'a11y');
    expect(['C', 'NA', 'NT']).toContain(a11y['col-3.2-contrast-text'].status);
  });
});

test.describe('Thème 5 — Tableaux', () => {
  test('tab-5.6-headers NC si tableau sans <th>', async ({ page }) => {
    const { a11y } = await runAudit(page, 'tableaux-violations.html', 'a11y');
    expect(a11y['tab-5.6-headers'].status).toBe('NC');
  });

  test('tab-5.4-data-identified NC si tableau sans caption ni aria-label', async ({ page }) => {
    const { a11y } = await runAudit(page, 'tableaux-violations.html', 'a11y');
    expect(a11y['tab-5.4-data-identified'].status).toBe('NC');
  });

  test('tab-5.8-layout NC si table role=presentation avec <th>', async ({ page }) => {
    const { a11y } = await runAudit(page, 'tableaux-violations.html', 'a11y');
    expect(a11y['tab-5.8-layout'].status).toBe('NC');
  });

  test('tab-5.6-headers C sur page propre (pas de tableau)', async ({ page }) => {
    const { a11y } = await runAudit(page, 'a11y-clean.html', 'a11y');
    expect(['C', 'NA']).toContain(a11y['tab-5.6-headers'].status);
  });
});

test.describe('Thème 10 — Présentation (focus)', () => {
  test('pre-10.7-focus-visible NC si :focus outline supprimé sans :focus-visible', async ({ page }) => {
    const { a11y } = await runAudit(page, 'a11y-violations.html', 'a11y');
    expect(a11y['pre-10.7-focus-visible'].status).toBe('NC');
  });

  test('pre-10.7-focus-visible C si :focus-visible correctement défini', async ({ page }) => {
    const { a11y } = await runAudit(page, 'a11y-clean.html', 'a11y');
    expect(['C', 'NT']).toContain(a11y['pre-10.7-focus-visible'].status);
  });
});

test.describe('Thème 12 — Navigation (skip link, tab order)', () => {
  test('nav-12.7-skip-link NC si aucun lien d\'évitement', async ({ page }) => {
    const { a11y } = await runAudit(page, 'a11y-violations.html', 'a11y');
    expect(a11y['nav-12.7-skip-link'].status).toBe('NC');
  });

  test('nav-12.7-skip-link C si lien d\'évitement présent', async ({ page }) => {
    const { a11y } = await runAudit(page, 'a11y-clean.html', 'a11y');
    expect(a11y['nav-12.7-skip-link'].status).toBe('C');
  });

  test('nav-12.8-tab-order C si aucun tabindex positif', async ({ page }) => {
    const { a11y } = await runAudit(page, 'a11y-clean.html', 'a11y');
    expect(a11y['nav-12.8-tab-order'].status).toBe('C');
  });
});

test.describe('Thème 8 — Éléments obligatoires (obl-8.9)', () => {
  test('obl-8.9-strict NC si éléments HTML4 dépréciés présents', async ({ page }) => {
    const { a11y } = await runAudit(page, 'deprecated-elements.html', 'a11y');
    expect(a11y['obl-8.9-strict'].status).toBe('NC');
    expect(a11y['obl-8.9-strict'].count).toBeGreaterThanOrEqual(3);
  });

  test('obl-8.9-strict C sur page propre sans éléments dépréciés', async ({ page }) => {
    const { a11y } = await runAudit(page, 'a11y-clean.html', 'a11y');
    expect(a11y['obl-8.9-strict'].status).toBe('C');
  });
});

test.describe('Éco — règles automatisables', () => {
  test('eco-spec-viewport NC si user-scalable=no', async ({ page }) => {
    const { eco } = await runAudit(page, 'eco-violations.html', 'eco');
    expect(eco['eco-spec-viewport'].status).toBe('NC');
  });

  test('eco-spec-viewport C sur page propre', async ({ page }) => {
    const { eco } = await runAudit(page, 'a11y-clean.html', 'eco');
    expect(eco['eco-spec-viewport'].status).toBe('C');
  });

  test('eco-ux-video-autoplay NC si <video autoplay> sans muted', async ({ page }) => {
    const { eco } = await runAudit(page, 'eco-violations.html', 'eco');
    expect(eco['eco-ux-video-autoplay'].status).toBe('NC');
  });

  test('eco-front-render-blocking NC si script synchrone en <head>', async ({ page }) => {
    const { eco } = await runAudit(page, 'eco-violations.html', 'eco');
    expect(eco['eco-front-render-blocking'].status).toBe('NC');
  });

  test('eco-front-lazy NC si images hors viewport sans loading="lazy"', async ({ page }) => {
    const { eco } = await runAudit(page, 'eco-violations.html', 'eco');
    expect(eco['eco-front-lazy'].status).toBe('NC');
    expect(eco['eco-front-lazy'].count).toBeGreaterThanOrEqual(4);
  });

  test('eco-front-render-blocking C sur page propre sans scripts bloquants', async ({ page }) => {
    const { eco } = await runAudit(page, 'a11y-clean.html', 'eco');
    expect(eco['eco-front-render-blocking'].status).toBe('C');
  });
});

test.describe('Moteur audit.js — structure du résultat', () => {
  test('mode=both renvoie a11y et eco non vides', async ({ page }) => {
    const { raw } = await runAudit(page, 'a11y-clean.html', 'both');
    expect(raw.a11y.length).toBeGreaterThan(100);
    expect(raw.eco.length).toBeGreaterThan(10);
  });

  test('mode=a11y n\'exécute pas les règles éco', async ({ page }) => {
    const { raw } = await runAudit(page, 'a11y-clean.html', 'a11y');
    expect(raw.a11y.length).toBeGreaterThan(100);
    expect(raw.eco).toEqual([]);
  });

  test('chaque entrée a11y a un statut valide', async ({ page }) => {
    const { raw } = await runAudit(page, 'a11y-clean.html', 'a11y');
    const validStatuses = new Set(['C', 'NC', 'NA', 'NT']);
    for (const entry of raw.a11y) {
      expect(validStatuses.has(entry.status)).toBe(true);
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.title).toBe('string');
      expect(typeof entry.themeLabel).toBe('string');
    }
  });

  test('les règles manuelles retournent bien NT', async ({ page }) => {
    const { raw } = await runAudit(page, 'a11y-clean.html', 'both');
    const nt = [...raw.a11y, ...raw.eco].filter(r => r.status === 'NT');
    expect(nt.length).toBeGreaterThan(0);
  });
});
