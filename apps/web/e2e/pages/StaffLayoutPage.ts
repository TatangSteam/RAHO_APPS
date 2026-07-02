import { type Locator, type Page, expect } from '@playwright/test';
import { waitForPageLoad } from '../helpers/waiters';

export class StaffLayoutPage {
  constructor(private page: Page) {}

  desktopSidebar(): Locator {
    return this.page.locator('aside').first();
  }

  async goto(path: string) {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(this.page);
  }

  async expectRoleLabel(label: string) {
    await expect(this.page.getByText(label).first()).toBeVisible({ timeout: 10_000 });
  }

  async expectSidebarLinkVisible(label: string | RegExp) {
    await expect(this.desktopSidebar().getByRole('link', { name: label })).toBeVisible({ timeout: 10_000 });
  }

  async expectSidebarLinkHidden(label: string | RegExp) {
    await expect(this.desktopSidebar().getByRole('link', { name: label })).toHaveCount(0);
  }
}
