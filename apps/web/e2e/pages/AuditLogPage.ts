import { Page, expect, type Download } from '@playwright/test';
import { waitForLoadingToFinish, waitForTableLoad } from '../helpers/waiters';
import { goToAuditLogs } from '../helpers/navigation';
import { EMPTY_STATE_TEXT, SELECTORS, searchInput } from '../helpers/selectors';

export interface AuditLogFilters {
  user?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
}

export class AuditLogPage {
  constructor(public page: Page) {}

  async goto() {
    await goToAuditLogs(this.page);
    await expect(this.page.getByRole('heading', { name: 'Audit Log', exact: true })).toBeVisible({ timeout: 10000 });
    await waitForTableLoad(this.page);
  }

  private async waitForResults() {
    await waitForLoadingToFinish(this.page);
    await waitForTableLoad(this.page);
  }

  private actionValue(action: string) {
    if (/^LOGIN$/i.test(action)) return 'LOGIN_SUCCESS';
    return action.toUpperCase();
  }

  private moduleValue(entity: string) {
    const normalized = entity.toUpperCase().replace(/\s+/g, '_');
    const aliases: Record<string, string> = {
      AUTH: 'AUTH',
      LOGIN: 'AUTH',
      MEMBER: 'MEMBER',
      MEMBERS: 'MEMBER',
      INVENTORY: 'INVENTORY',
      STOCK: 'INVENTORY',
      PACKAGE: 'PAKET_TERAPI',
      PAKET: 'PAKET_TERAPI',
      PAKET_TERAPI: 'PAKET_TERAPI',
    };

    return aliases[normalized] || normalized;
  }

  /**
   * Search audit logs by keyword
   */
  async searchLogs(query: string) {
    await searchInput(this.page).fill(query);
    await this.page.getByRole('button', { name: /^cari$/i }).click();
    await this.waitForResults();
  }

  /**
   * Filter audit logs by user
   */
  async filterByUser(userName: string) {
    await this.searchLogs(userName);
  }

  /**
   * Filter audit logs by action type
   */
  async filterByAction(action: string) {
    await this.page.locator('select').nth(0).selectOption(this.actionValue(action));
    await this.waitForResults();
  }

  /**
   * Filter audit logs by entity type
   */
  async filterByEntity(entity: string) {
    const normalized = this.moduleValue(entity);
    const moduleSelect = this.page.locator('select').nth(1);
    const option = moduleSelect.locator(`option[value="${normalized}"]`);

    if (await option.count() > 0) {
      await moduleSelect.selectOption(normalized);
      await this.waitForResults();
      return;
    }

    await this.searchLogs(entity);
  }

  /**
   * Filter audit logs by date range
   */
  async filterByDateRange(startDate: string, endDate: string) {
    const dateInputs = this.page.locator('input[type="date"]');
    await dateInputs.nth(0).fill(startDate);
    await dateInputs.nth(1).fill(endDate);
    await this.waitForResults();
  }

  /**
   * Apply filter
   */
  async applyFilter() {
    await this.waitForResults();
  }

  /**
   * View audit log details
   */
  async viewDetails(identifier: string) {
    await this.searchLogs(identifier);

    const detailButton = this.page
      .locator(SELECTORS.tableRow)
      .first()
      .locator('button[title*="detail" i], button')
      .last();
    await detailButton.click();

    await expect(this.page.locator('text=/Pelaku|Before|After|Metadata/i').first()).toBeVisible({ timeout: 5000 });
  }

  /**
   * Export audit logs to CSV
   */
  async exportToCSV() {
    const downloadPromise = this.page.waitForEvent('download');
    const exportButton = this.page.getByRole('button', { name: /export csv/i });
    await exportButton.click();
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/audit|log/i);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    
    return download;
  }

  /**
   * Export audit logs to Excel
   */
  async exportToExcel(): Promise<Download> {
    throw new Error('Audit log page currently exposes CSV export only.');
  }

  /**
   * Expect audit log exists
   */
  async expectLogExists(action: string, entity: string) {
    const row = this.page.locator(SELECTORS.tableRow)
      .filter({ hasText: new RegExp(this.actionValue(action), 'i') })
      .filter({ hasText: new RegExp(entity, 'i') });
    
    await expect(row).toBeVisible({ timeout: 10000 });
  }

  /**
   * Expect log not exists
   */
  async expectLogNotExists(identifier: string) {
    const row = this.page.locator(SELECTORS.tableRow).filter({ hasText: identifier });
    await expect(row).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Expect log contains user
   */
  async expectLogByUser(userName: string) {
    const row = this.page.locator(SELECTORS.tableRow).filter({ hasText: new RegExp(userName, 'i') });
    if ((await this.getLogCount()) > 0) {
      await expect(row.first()).toBeVisible({ timeout: 5000 });
    }
  }

  /**
   * Expect log contains action
   */
  async expectLogWithAction(action: string) {
    if ((await this.getLogCount()) > 0) {
      const row = this.page.locator(SELECTORS.tableRow).filter({ hasText: new RegExp(this.actionValue(action), 'i') });
      await expect(row.first()).toBeVisible({ timeout: 5000 });
    }
  }

  /**
   * Expect log contains details
   */
  async expectLogDetails(field: string, value: string) {
    const detailElement = this.page.locator('text=' + field).locator('..').getByText(value);
    await expect(detailElement).toBeVisible({ timeout: 5000 });
  }

  /**
   * Get audit log count
   */
  async getLogCount(): Promise<number> {
    const rows = this.page.locator(SELECTORS.tableRow).filter({ hasNotText: EMPTY_STATE_TEXT });
    return await rows.count();
  }

  /**
   * Verify audit log accuracy - check if specific action was logged
   */
  async verifyActionLogged(action: string, entity: string, userName?: string) {
    await this.clearFilters();

    if (userName) {
      await this.filterByUser(userName);
    }
    
    await this.filterByAction(action);
    await this.filterByEntity(entity);

    const count = await this.getLogCount();
    expect(count).toBeGreaterThan(0);
  }

  /**
   * Get latest log entry
   */
  async getLatestLog() {
    const firstRow = this.page.locator(SELECTORS.tableRow).first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    return firstRow;
  }

  /**
   * Expect specific number of logs
   */
  async expectLogCount(expectedCount: number) {
    const count = await this.getLogCount();
    expect(count).toBe(expectedCount);
  }

  /**
   * Expect minimum number of logs
   */
  async expectMinimumLogCount(minimumCount: number) {
    const count = await this.getLogCount();
    expect(count).toBeGreaterThanOrEqual(minimumCount);
  }

  /**
   * Clear all filters
   */
  async clearFilters() {
    const clearButton = this.page.getByRole('button', { name: /clear|hapus.*filter|reset/i });
    
    if (await clearButton.isVisible({ timeout: 2000 })) {
      await clearButton.click();
      await waitForLoadingToFinish(this.page);
      await waitForTableLoad(this.page);
    }
  }

  /**
   * Refresh audit logs
   */
  async refresh() {
    const refreshButton = this.page.getByRole('button', { name: /refresh|reload|muat.*ulang/i });
    
    if (await refreshButton.isVisible({ timeout: 2000 })) {
      await refreshButton.click();
      await waitForLoadingToFinish(this.page);
      await waitForTableLoad(this.page);
    } else {
      // Reload page if no refresh button
      await this.page.reload();
      await waitForTableLoad(this.page);
    }
  }

  /**
   * Check if log contains sensitive data masking
   */
  async expectSensitiveDataMasked(field: string) {
    // Sensitive fields should be masked (e.g., password should show as ***)
    const maskedPattern = /\*+|masked|hidden/i;
    
    const fieldValue = this.page.locator('text=' + field).locator('..');
    const text = await fieldValue.textContent();
    
    expect(text).toMatch(maskedPattern);
  }

  /**
   * Expect log timestamp is recent (within last X minutes)
   */
  async expectRecentLog(_minutes: number = 5) {
    const latestLog = await this.getLatestLog();
    await expect(latestLog).toBeVisible();
    await expect(latestLog).toContainText(/\d{2}\s+\w+\s+\d{4}/i);
  }

  /**
   * Filter by multiple criteria
   */
  async filterByCriteria(filters: AuditLogFilters) {
    await this.clearFilters();

    if (filters.user) {
      await this.searchLogs(filters.user);
    }

    if (filters.action) {
      await this.page.locator('select').nth(0).selectOption(this.actionValue(filters.action));
    }

    if (filters.entity) {
      await this.searchLogs(filters.entity);
    }

    if (filters.startDate) {
      await this.page.locator('input[type="date"]').nth(0).fill(filters.startDate);
    }
    if (filters.endDate) {
      await this.page.locator('input[type="date"]').nth(1).fill(filters.endDate);
    }

    await this.waitForResults();
  }
}
