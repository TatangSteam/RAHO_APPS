import { Page, expect } from '@playwright/test';

/**
 * Navigation helpers for common app navigation patterns
 */

export class Navigation {
  constructor(private page: Page) {}

  /**
   * Navigate to a specific route and wait for it to load
   */
  async goto(path: string, options?: { waitForSelector?: string }) {
    await this.page.goto(path);
    
    if (options?.waitForSelector) {
      await this.page.waitForSelector(options.waitForSelector);
    } else {
      // Wait for general page load
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Navigate to dashboard
   */
  async gotoDashboard() {
    await this.goto('/dashboard');
    await expect(this.page.locator('h1')).toContainText(/dashboard/i);
  }

  /**
   * Navigate to members page
   */
  async gotoMembers() {
    await this.goto('/members');
    await expect(this.page.locator('h1')).toContainText(/member/i);
  }

  /**
   * Navigate to sessions page
   */
  async gotoSessions() {
    await this.goto('/sessions');
    await expect(this.page.locator('h1')).toContainText(/sesi/i);
  }

  /**
   * Navigate to inventory page
   */
  async gotoInventory() {
    await this.goto('/inventory');
    await expect(this.page.locator('h1')).toContainText(/inventori|stok/i);
  }

  /**
   * Navigate to stock requests page
   */
  async gotoStockRequests() {
    await this.goto('/inventory/stock-requests');
    await expect(this.page.locator('h1')).toContainText(/request|permintaan/i);
  }

  /**
   * Navigate to shipments page
   */
  async gotoShipments() {
    await this.goto('/inventory/shipments');
    await expect(this.page.locator('h1')).toContainText(/pengiriman|shipment/i);
  }

  /**
   * Navigate to audit logs page
   */
  async gotoAuditLogs() {
    await this.goto('/admin/audit-logs');
    await expect(this.page.locator('h1')).toContainText(/audit/i);
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click on sidebar menu item
   */
  async clickSidebarItem(label: string) {
    const menuItem = this.page.locator('nav').getByRole('link', { name: new RegExp(label, 'i') });
    await menuItem.click();
    await this.waitForNavigation();
  }

  /**
   * Verify current URL
   */
  async expectUrl(pattern: string | RegExp) {
    await expect(this.page).toHaveURL(pattern);
  }

  /**
   * Verify page title
   */
  async expectTitle(title: string | RegExp) {
    await expect(this.page.locator('h1').first()).toContainText(title);
  }
}

/**
 * Create navigation helper instance
 */
export function createNavigation(page: Page) {
  return new Navigation(page);
}

// Standalone helper functions for direct use
import { waitForPageLoad } from './waiters';

export async function goToDashboard(page: Page) {
  await page.goto('/dashboard');
  await waitForPageLoad(page);
}

export async function goToMembers(page: Page) {
  await page.goto('/members');
  await waitForPageLoad(page);
}

export async function goToSessions(page: Page) {
  await page.goto('/sessions');
  await waitForPageLoad(page);
}

export async function goToInventory(page: Page) {
  await page.goto('/inventory');
  await waitForPageLoad(page);
}

export async function goToStockRequests(page: Page) {
  await page.goto('/inventory/stock-requests');
  await waitForPageLoad(page);
}

export async function goToShipments(page: Page) {
  await page.goto('/inventory/shipments');
  await waitForPageLoad(page);
}

export async function goToPayments(page: Page) {
  await page.goto('/payments');
  await waitForPageLoad(page);
}

export async function goToAuditLogs(page: Page) {
  await page.goto('/admin/audit-logs');
  await waitForPageLoad(page);
}

export async function goToReports(page: Page) {
  await page.goto('/reports');
  await waitForPageLoad(page);
}

export async function goToProfile(page: Page) {
  await page.goto('/profile');
  await waitForPageLoad(page);
}
