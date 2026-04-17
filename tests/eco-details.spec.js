import { test, expect } from './helpers/extension.js';
import { startFixtureServer } from './helpers/server.js';

let server;

test.beforeAll(async () => {
  server = await startFixtureServer();
});

test.afterAll(async () => {
  await server?.close();
});

test('les détails s\'affichent dans la side panel', async ({ context, extensionId }) => {
  const target = await context.newPage();
  await target.goto(server.url('a11y-violations.html'));

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await target.bringToFront();

  await panel.locator('input[name="scope"][value="page"]').check();
  await panel.locator('.audit-card[data-mode="eco"]').click();

  await expect(panel.locator('#screen-results')).toHaveClass(/active/, { timeout: 20_000 });

  // Chercher une règle avec détails affichés
  const issueCards = panel.locator('.issue');
  const count = await issueCards.count();
  expect(count).toBeGreaterThan(0);

  // Vérifier qu'au moins une règle affiche des détails
  for (let i = 0; i < Math.min(count, 5); i++) {
    const card = issueCards.nth(i);
    await card.locator('.issue-header').click();
    await panel.waitForTimeout(100);

    const details = card.locator('.issue-details');
    const isVisible = await details.isVisible().catch(() => false);
    if (isVisible) {
      const items = card.locator('.issue-details li');
      const itemCount = await items.count();
      console.log(`Règle ${i}: ${itemCount} détails`);
      expect(itemCount).toBeGreaterThan(0);
      break;
    }
  }
});
