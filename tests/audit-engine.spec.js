import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const AUDIT_SRC = fs.readFileSync(path.join(ROOT, 'audit.js'), 'utf8');

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
    const validStatuses = new Set(['C', 'NC', 'NA']);
    for (const entry of raw.a11y) {
      expect(validStatuses.has(entry.status)).toBe(true);
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.title).toBe('string');
      expect(typeof entry.theme).toBe('number');
    }
  });

  test('aucune règle ne retourne NT (tout est automatisé)', async ({ page }) => {
    for (const fixture of ['a11y-clean.html', 'a11y-violations.html']) {
      const { raw } = await runAudit(page, fixture, 'both');
      const nt = [...raw.a11y, ...raw.eco].filter(r => r.status === 'NT');
      if (nt.length) {
        console.log(`NT détectés sur ${fixture} :\n` +
          nt.map(r => `  - ${r.id} : ${r.title}`).join('\n'));
      }
      expect(nt, `Aucune règle ne doit retourner NT sur ${fixture}`).toHaveLength(0);
    }
  });
});
