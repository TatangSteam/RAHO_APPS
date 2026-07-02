import { type Locator, type Page, expect } from '@playwright/test';
import { waitForLoadingToFinish } from '../helpers/waiters';

const NOTIFICATION_SHELL_TEXT =
  /request stok baru|bukti pembayaran|pengiriman bermasalah|tidak ada notifikasi inventori/i;

export class NotificationsPage {
  constructor(public page: Page) {}

  async goto() {
    await this.page.goto('/notifications', { waitUntil: 'domcontentloaded' });
    await waitForLoadingToFinish(this.page);
  }

  async expectShell() {
    await expect(this.page.getByRole('heading', { name: /notifikasi/i })).toBeVisible({ timeout: 10000 });
    await expect(this.page.getByText(NOTIFICATION_SHELL_TEXT).first()).toBeVisible({ timeout: 10000 });
  }

  async refresh() {
    await this.page.getByRole('button', { name: /refresh/i }).click();
    await this.expectShell();
  }

  notificationLink(): Locator {
    return this.page.getByRole('link', { name: /notifikasi/i }).first();
  }

  firstActionableNotification(): Locator {
    return this.page
      .locator('main a')
      .filter({ hasText: /review|pengiriman|request|pembayaran/i })
      .first();
  }

  async clickFirstActionableNotificationIfPresent(): Promise<boolean> {
    const firstNotification = this.firstActionableNotification();

    if (await firstNotification.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstNotification.click();
      return true;
    }

    return false;
  }
}
