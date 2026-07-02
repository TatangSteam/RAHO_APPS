import { type Page, expect } from '@playwright/test';
import { waitForPageLoad } from '../helpers/waiters';

export class ChatPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/chat', { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(this.page);
  }

  async expectPlaceholderShell() {
    await expect(this.page.getByRole('heading', { name: 'Chat' })).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText('Belum Aktif')).toBeVisible();
    await expect(this.page.getByRole('link', { name: /buka notifikasi/i })).toBeVisible();
  }
}
