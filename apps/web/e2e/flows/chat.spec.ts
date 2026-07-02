import { test, expect } from '../fixtures/base';
import { ChatPage } from '../pages/ChatPage';

test.describe('Chat placeholder', () => {
  test('should load chat placeholder page', async ({ loginAs, page }) => {
    await loginAs('ADMIN_CABANG');

    const chatPage = new ChatPage(page);
    await chatPage.goto();
    await chatPage.expectPlaceholderShell();
  });

  test('should open chat from staff sidebar', async ({ loginAs, page }) => {
    await loginAs('ADMIN_CABANG');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    await page.getByRole('link', { name: /chat/i }).click();
    await expect(page).toHaveURL(/\/chat$/);

    const chatPage = new ChatPage(page);
    await chatPage.expectPlaceholderShell();
  });
});
