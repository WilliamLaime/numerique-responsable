import { test, expect } from './helpers/extension.js';
import { startFixtureServer } from './helpers/server.js';

let server;

test.beforeAll(async () => {
  server = await startFixtureServer();
});

test.afterAll(async () => {
  await server?.close();
});

test('la side panel se charge et affiche des NC après audit', async ({ context, extensionId }) => {
  // 1. Ouvrir la page à auditer
  const target = await context.newPage();
  await target.goto(server.url('a11y-violations.html'));

  // 2. Ouvrir la side panel comme onglet régulier
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(panel.locator('#screen-select')).toHaveClass(/active/);

  // 3. Ramener l'onglet cible au premier plan (sinon chrome.tabs.query({active:true})
  //    renvoie la side panel au lieu de la page à auditer)
  await target.bringToFront();

  // 4. Choisir le périmètre "Page courante"
  await panel.locator('input[name="scope"][value="page"]').check();

  // 5. Déclencher l'audit accessibilité
  await panel.locator('.audit-card[data-mode="a11y"]').click();

  // 6. Attendre l'écran de résultats
  await expect(panel.locator('#screen-results')).toHaveClass(/active/, { timeout: 20_000 });

  // 7. Les filtres de statut doivent montrer au moins un NC non nul
  const ncChip = panel.locator('.status-chip.NC');
  await expect(ncChip).toBeVisible();
  const ncCount = await ncChip.locator('.chip-count').innerText();
  expect(parseInt(ncCount, 10)).toBeGreaterThan(0);

  // 8. La zone #issues doit contenir au moins un item
  await expect(panel.locator('#issues')).not.toBeEmpty();
});

test('la side panel affiche 0 NC sur une page conforme', async ({ context, extensionId }) => {
  const target = await context.newPage();
  await target.goto(server.url('a11y-clean.html'));

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await target.bringToFront();

  await panel.locator('input[name="scope"][value="page"]').check();
  await panel.locator('.audit-card[data-mode="a11y"]').click();

  await expect(panel.locator('#screen-results')).toHaveClass(/active/, { timeout: 20_000 });

  const ncCount = await panel.locator('.status-chip.NC .chip-count').innerText();
  expect(parseInt(ncCount, 10)).toBe(0);
});
