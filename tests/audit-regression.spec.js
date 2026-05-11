/**
 * Tests de non-régression et de cohérence du moteur d'audit.
 *
 * Objectif : garantir que les résultats sont stables entre deux exécutions,
 * que la page propre ne génère aucun faux positif NC, et que le catalogue
 * de règles ne change pas silencieusement.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const AUDIT_SRC = fs.readFileSync(path.join(ROOT, 'public', 'audit.js'), 'utf8');

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

// ── Zéro faux positif sur la page conforme ──────────────────────────────────

test.describe('Non-régression — page conforme sans faux positifs', () => {
  test('aucune règle a11y ne retourne NC sur la page propre', async ({ page }) => {
    const { raw } = await runAudit(page, 'a11y-clean.html', 'a11y');
    const nc = raw.a11y.filter(r => r.status === 'NC');
    if (nc.length) {
      console.error('Faux positifs NC inattendue sur a11y-clean.html:\n' +
        nc.map(r => `  ${r.id} — ${r.measure}`).join('\n'));
    }
    expect(nc).toHaveLength(0);
  });

  test('les règles a11y couvrent bien les 106 critères RGAA', async ({ page }) => {
    const { raw } = await runAudit(page, 'a11y-clean.html', 'a11y');
    expect(raw.a11y.length).toBeGreaterThanOrEqual(106);
  });

  test('chaque règle a11y a un id, title et statut valides', async ({ page }) => {
    const { raw } = await runAudit(page, 'a11y-clean.html', 'a11y');
    const valid = new Set(['C', 'NC', 'NA', 'NT']);
    for (const r of raw.a11y) {
      expect(r.id, `id manquant`).toBeTruthy();
      expect(typeof r.id).toBe('string');
      expect(r.title, `title manquant pour ${r.id}`).toBeTruthy();
      expect(valid.has(r.status), `statut invalide pour ${r.id}: ${r.status}`).toBe(true);
      expect(typeof r.count).toBe('number');
    }
  });

  test('chaque règle éco a un id, title et statut valides', async ({ page }) => {
    const { raw } = await runAudit(page, 'a11y-clean.html', 'eco');
    const valid = new Set(['C', 'NC', 'NA', 'NT']);
    for (const r of raw.eco) {
      expect(r.id, `id manquant`).toBeTruthy();
      expect(r.title, `title manquant pour ${r.id}`).toBeTruthy();
      expect(valid.has(r.status), `statut invalide pour ${r.id}: ${r.status}`).toBe(true);
    }
  });
});

// ── Cohérence multi-passage ──────────────────────────────────────────────────

test.describe('Cohérence — résultats identiques sur 3 passages', () => {
  test('même nombre de NC a11y sur 3 audits de la page violations', async ({ page }) => {
    const counts = [];
    for (let i = 0; i < 3; i++) {
      const { raw } = await runAudit(page, 'a11y-violations.html', 'a11y');
      counts.push(raw.a11y.filter(r => r.status === 'NC').length);
    }
    expect(new Set(counts).size, `Résultats instables entre passages : ${counts.join(', ')}`).toBe(1);
  });

  test('même nombre de NC éco sur 3 audits de la page éco', async ({ page }) => {
    const counts = [];
    for (let i = 0; i < 3; i++) {
      const { raw } = await runAudit(page, 'eco-violations.html', 'eco');
      counts.push(raw.eco.filter(r => r.status === 'NC').length);
    }
    expect(new Set(counts).size, `Résultats instables entre passages : ${counts.join(', ')}`).toBe(1);
  });

  test('les IDs de règles a11y sont stables entre 2 audits', async ({ page }) => {
    const run1 = await runAudit(page, 'a11y-clean.html', 'a11y');
    const run2 = await runAudit(page, 'a11y-clean.html', 'a11y');
    const ids1 = Object.keys(run1.a11y).sort().join(',');
    const ids2 = Object.keys(run2.a11y).sort().join(',');
    expect(ids1).toBe(ids2);
  });
});

// ── Intégrité des samples ────────────────────────────────────────────────────

test.describe('Intégrité des samples NC', () => {
  test('chaque sample a un selector non vide', async ({ page }) => {
    const { raw } = await runAudit(page, 'a11y-violations.html', 'a11y');
    for (const rule of raw.a11y.filter(r => r.status === 'NC' && r.samples?.length)) {
      for (const s of rule.samples) {
        expect(s.selector, `selector vide pour ${rule.id}`).toBeTruthy();
      }
    }
  });

  test('le count NC est cohérent avec le nombre de samples (count >= samples)', async ({ page }) => {
    const { raw } = await runAudit(page, 'a11y-violations.html', 'a11y');
    for (const rule of raw.a11y.filter(r => r.status === 'NC')) {
      if (rule.samples?.length) {
        expect(rule.count, `count < samples pour ${rule.id}`).toBeGreaterThanOrEqual(rule.samples.length);
      }
    }
  });
});
