import { type Locator, type Page, expect } from '@playwright/test';
import { waitForLoadingToFinish, waitForTableToLoad } from '../helpers/waiters';

export type ReferralType = 'SALES' | 'DOKTER' | 'MEMBER';

export class ReferralPage {
  constructor(public page: Page) {}

  async goto() {
    await this.page.goto('/referrals', { waitUntil: 'domcontentloaded' });
    await this.expectLoaded();
  }

  async expectLoaded() {
    await expect(this.page.getByRole('heading', { name: /kode referral/i })).toBeVisible({ timeout: 10000 });
    await waitForTableToLoad(this.page);
    await expect(this.page.getByRole('button', { name: /tambah referral/i })).toBeVisible();
  }

  async filterByType(type: ReferralType) {
    await this.page.locator('select').last().selectOption(type);
    await waitForLoadingToFinish(this.page);
  }

  async openCreateModal(): Promise<Locator> {
    await this.page.getByRole('button', { name: /tambah referral/i }).click();

    const dialog = this.page.getByRole('dialog', { name: /tambah kode referral/i });
    await expect(dialog).toBeVisible({ timeout: 10000 });
    return dialog;
  }

  async submitCreateModal(dialog: Locator) {
    await dialog.getByRole('button', { name: /^simpan$/i }).click();
  }

  async closeCreateModal(dialog: Locator) {
    await dialog.getByRole('button', { name: /batal/i }).click();
    await expect(dialog).toBeHidden();
  }
}
