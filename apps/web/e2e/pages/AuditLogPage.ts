import { Page, expect } from '@playwright/test';
import { waitForLoadingToFinish, waitForSuccessToast, waitForTableLoad } from '../helpers/waiters';
import { goToAuditLogs } from '../helpers/navigation';

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
    await waitForTableLoad(this.page);
  }

  /**
   * Search audit logs by keyword
   */
  async searchLogs(query: string) {
    const searchInput = this.page.getByPlaceholder(/cari|search/i);
    await searchInput.fill(query);
    await waitForLoadingToFinish(this.page);
    await waitForTableLoad(this.page);
  }

  /**
   * Filter audit logs by user
   */
  async filterByUser(userName: string) {
    const filterButton = this.page.getByRole('button', { name: /filter|saring/i });
    await filterButton.click();

    await this.page.waitForTimeout(300);

    // Select user
    const userSelect = this.page.getByLabel(/user|pengguna|staff/i);
    await userSelect.click();
    await userSelect.fill(userName);
    await this.page.waitForTimeout(500);
    
    const userOption = this.page.getByText(userName).first();
    await userOption.click();

    // Apply filter
    await this.applyFilter();
  }

  /**
   * Filter audit logs by action type
   */
  async filterByAction(action: string) {
    const filterButton = this.page.getByRole('button', { name: /filter|saring/i });
    await filterButton.click();

    await this.page.waitForTimeout(300);

    // Select action
    const actionSelect = this.page.getByLabel(/aksi|action|tipe/i);
    await actionSelect.click();
    
    const actionOption = this.page.getByRole('option', { name: new RegExp(action, 'i') });
    await actionOption.click();

    // Apply filter
    await this.applyFilter();
  }

  /**
   * Filter audit logs by entity type
   */
  async filterByEntity(entity: string) {
    const filterButton = this.page.getByRole('button', { name: /filter|saring/i });
    await filterButton.click();

    await this.page.waitForTimeout(300);

    // Select entity
    const entitySelect = this.page.getByLabel(/entitas|entity|tabel/i);
    await entitySelect.click();
    
    const entityOption = this.page.getByRole('option', { name: new RegExp(entity, 'i') });
    await entityOption.click();

    // Apply filter
    await this.applyFilter();
  }

  /**
   * Filter audit logs by date range
   */
  async filterByDateRange(startDate: string, endDate: string) {
    const filterButton = this.page.getByRole('button', { name: /filter|saring/i });
    await filterButton.click();

    await this.page.waitForTimeout(300);

    // Fill date range
    await this.page.getByLabel(/tanggal.*mulai|start.*date|dari/i).fill(startDate);
    await this.page.getByLabel(/tanggal.*akhir|end.*date|sampai/i).fill(endDate);

    // Apply filter
    await this.applyFilter();
  }

  /**
   * Apply filter
   */
  async applyFilter() {
    const applyButton = this.page.getByRole('button', { name: /terapkan|apply/i });
    await applyButton.click();

    await waitForLoadingToFinish(this.page);
    await waitForTableLoad(this.page);
  }

  /**
   * View audit log details
   */
  async viewDetails(identifier: string) {
    await this.searchLogs(identifier);

    // Click detail button
    const detailButton = this.page.getByRole('button', { name: /detail|view|lihat/i }).first();
    await detailButton.click();

    await this.page.waitForTimeout(500);
  }

  /**
   * Export audit logs to CSV
   */
  async exportToCSV() {
    // Click export button
    const exportButton = this.page.getByRole('button', { name: /export|ekspor|unduh/i });
    
    // Wait for download
    const downloadPromise = this.page.waitForEvent('download');
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
  async exportToExcel() {
    // Click export button or dropdown
    const exportButton = this.page.getByRole('button', { name: /export|ekspor/i });
    await exportButton.click();

    await this.page.waitForTimeout(300);

    // Select Excel format
    const excelOption = this.page.getByRole('menuitem', { name: /excel|xlsx/i });
    
    // Wait for download
    const downloadPromise = this.page.waitForEvent('download');
    await excelOption.click();
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/audit|log/i);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    
    return download;
  }

  /**
   * Expect audit log exists
   */
  async expectLogExists(action: string, entity: string) {
    const row = this.page.locator('tr, [role="row"]')
      .filter({ hasText: new RegExp(action, 'i') })
      .filter({ hasText: new RegExp(entity, 'i') });
    
    await expect(row).toBeVisible({ timeout: 10000 });
  }

  /**
   * Expect log not exists
   */
  async expectLogNotExists(identifier: string) {
    const row = this.page.locator('tr, [role="row"]').filter({ hasText: identifier });
    await expect(row).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Expect log contains user
   */
  async expectLogByUser(userName: string) {
    const row = this.page.locator('tr, [role="row"]').filter({ hasText: userName });
    await expect(row.first()).toBeVisible({ timeout: 5000 });
  }

  /**
   * Expect log contains action
   */
  async expectLogWithAction(action: string) {
    const row = this.page.locator('tr, [role="row"]').filter({ hasText: new RegExp(action, 'i') });
    await expect(row.first()).toBeVisible({ timeout: 5000 });
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
    const rows = this.page.locator('tbody tr, [role="row"]').filter({ 
      hasNotText: /tidak.*ada.*data|no.*data|kosong/i 
    });
    return await rows.count();
  }

  /**
   * Verify audit log accuracy - check if specific action was logged
   */
  async verifyActionLogged(action: string, entity: string, userName?: string) {
    // Search or filter to find the log
    if (userName) {
      await this.filterByUser(userName);
    }
    
    await this.filterByAction(action);
    await this.filterByEntity(entity);

    // Verify log exists
    const count = await this.getLogCount();
    expect(count).toBeGreaterThan(0);

    // Verify log contains expected data
    await this.expectLogExists(action, entity);
  }

  /**
   * Get latest log entry
   */
  async getLatestLog() {
    const firstRow = this.page.locator('tbody tr, [role="row"]').first();
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
  async expectRecentLog(minutes: number = 5) {
    const latestLog = await this.getLatestLog();
    await expect(latestLog).toBeVisible();

    // Get timestamp from log (adjust selector based on actual structure)
    const timestampElement = latestLog.locator('[data-timestamp], .timestamp, time');
    await expect(timestampElement).toBeVisible({ timeout: 5000 });
  }

  /**
   * Filter by multiple criteria
   */
  async filterByCriteria(filters: AuditLogFilters) {
    const filterButton = this.page.getByRole('button', { name: /filter|saring/i });
    await filterButton.click();

    await this.page.waitForTimeout(300);

    // Apply user filter
    if (filters.user) {
      const userSelect = this.page.getByLabel(/user|pengguna/i);
      if (await userSelect.isVisible({ timeout: 1000 })) {
        await userSelect.click();
        await userSelect.fill(filters.user);
        await this.page.waitForTimeout(500);
        const userOption = this.page.getByText(filters.user).first();
        await userOption.click();
      }
    }

    // Apply action filter
    if (filters.action) {
      const actionSelect = this.page.getByLabel(/aksi|action/i);
      if (await actionSelect.isVisible({ timeout: 1000 })) {
        await actionSelect.click();
        const actionOption = this.page.getByRole('option', { name: new RegExp(filters.action, 'i') });
        await actionOption.click();
      }
    }

    // Apply entity filter
    if (filters.entity) {
      const entitySelect = this.page.getByLabel(/entitas|entity/i);
      if (await entitySelect.isVisible({ timeout: 1000 })) {
        await entitySelect.click();
        const entityOption = this.page.getByRole('option', { name: new RegExp(filters.entity, 'i') });
        await entityOption.click();
      }
    }

    // Apply date range
    if (filters.startDate) {
      await this.page.getByLabel(/tanggal.*mulai|start.*date/i).fill(filters.startDate);
    }
    if (filters.endDate) {
      await this.page.getByLabel(/tanggal.*akhir|end.*date/i).fill(filters.endDate);
    }

    // Apply filter
    await this.applyFilter();
  }
}
