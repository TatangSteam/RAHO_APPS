import { Page, expect } from '@playwright/test';
import { waitForLoadingToFinish, waitForSuccessToast, waitForTableLoad } from '../helpers/waiters';
import { goToReports } from '../helpers/navigation';

export interface ReportFilters {
  reportType?: string;
  startDate?: string;
  endDate?: string;
  branch?: string;
  status?: string;
  member?: string;
  doctor?: string;
}

export class ReportPage {
  constructor(public page: Page) {}

  async goto() {
    await goToReports(this.page);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Generate member report
   */
  async generateMemberReport(filters?: ReportFilters) {
    // Select report type
    await this.selectReportType('Member');

    // Apply filters if provided
    if (filters) {
      await this.applyFilters(filters);
    }

    // Generate report
    await this.clickGenerate();
    
    // Wait for report to load
    await waitForLoadingToFinish(this.page);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Generate session report
   */
  async generateSessionReport(filters?: ReportFilters) {
    // Select report type
    await this.selectReportType('Session');

    // Apply filters if provided
    if (filters) {
      await this.applyFilters(filters);
    }

    // Generate report
    await this.clickGenerate();
    
    // Wait for report to load
    await waitForLoadingToFinish(this.page);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Generate payment report
   */
  async generatePaymentReport(filters?: ReportFilters) {
    // Select report type
    await this.selectReportType('Payment');

    // Apply filters if provided
    if (filters) {
      await this.applyFilters(filters);
    }

    // Generate report
    await this.clickGenerate();
    
    // Wait for report to load
    await waitForLoadingToFinish(this.page);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Generate inventory report
   */
  async generateInventoryReport(filters?: ReportFilters) {
    // Select report type
    await this.selectReportType('Inventory');

    // Apply filters if provided
    if (filters) {
      await this.applyFilters(filters);
    }

    // Generate report
    await this.clickGenerate();
    
    // Wait for report to load
    await waitForLoadingToFinish(this.page);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Select report type
   */
  async selectReportType(reportType: string) {
    const reportSelect = this.page.getByLabel(/tipe.*laporan|report.*type|jenis/i);
    await reportSelect.click();
    
    const option = this.page.getByRole('option', { name: new RegExp(reportType, 'i') });
    await option.click();

    await this.page.waitForTimeout(300);
  }

  /**
   * Apply filters to report
   */
  async applyFilters(filters: ReportFilters) {
    // Date range
    if (filters.startDate) {
      await this.page.getByLabel(/tanggal.*mulai|start.*date|dari/i).fill(filters.startDate);
    }
    
    if (filters.endDate) {
      await this.page.getByLabel(/tanggal.*akhir|end.*date|sampai/i).fill(filters.endDate);
    }

    // Branch
    if (filters.branch) {
      const branchSelect = this.page.getByLabel(/cabang|branch/i);
      if (await branchSelect.isVisible({ timeout: 1000 })) {
        await branchSelect.click();
        const branchOption = this.page.getByRole('option', { name: new RegExp(filters.branch, 'i') });
        await branchOption.click();
      }
    }

    // Status
    if (filters.status) {
      const statusSelect = this.page.getByLabel(/status/i);
      if (await statusSelect.isVisible({ timeout: 1000 })) {
        await statusSelect.click();
        const statusOption = this.page.getByRole('option', { name: new RegExp(filters.status, 'i') });
        await statusOption.click();
      }
    }

    // Member
    if (filters.member) {
      const memberInput = this.page.getByLabel(/member|pasien/i);
      if (await memberInput.isVisible({ timeout: 1000 })) {
        await memberInput.fill(filters.member);
        await this.page.waitForTimeout(500);
        const memberOption = this.page.getByText(filters.member).first();
        await memberOption.click();
      }
    }

    // Doctor
    if (filters.doctor) {
      const doctorInput = this.page.getByLabel(/dokter|doctor/i);
      if (await doctorInput.isVisible({ timeout: 1000 })) {
        await doctorInput.fill(filters.doctor);
        await this.page.waitForTimeout(500);
        const doctorOption = this.page.getByText(filters.doctor).first();
        await doctorOption.click();
      }
    }
  }

  /**
   * Click generate button
   */
  async clickGenerate() {
    const generateButton = this.page.getByRole('button', { name: /generate|buat.*laporan|tampilkan/i });
    await generateButton.click();
  }

  /**
   * Filter report by date range
   */
  async filterByDateRange(startDate: string, endDate: string) {
    await this.page.getByLabel(/tanggal.*mulai|start.*date|dari/i).fill(startDate);
    await this.page.getByLabel(/tanggal.*akhir|end.*date|sampai/i).fill(endDate);
    
    // Apply filter
    const applyButton = this.page.getByRole('button', { name: /terapkan|apply|filter/i });
    if (await applyButton.isVisible({ timeout: 1000 })) {
      await applyButton.click();
      await waitForLoadingToFinish(this.page);
    }
  }

  /**
   * Filter report by branch
   */
  async filterByBranch(branchName: string) {
    const branchSelect = this.page.getByLabel(/cabang|branch/i);
    await branchSelect.click();
    
    const branchOption = this.page.getByRole('option', { name: new RegExp(branchName, 'i') });
    await branchOption.click();

    await waitForLoadingToFinish(this.page);
  }

  /**
   * Export report to PDF
   */
  async exportToPDF() {
    // Click export or PDF button
    const exportButton = this.page.getByRole('button', { name: /export.*pdf|pdf|cetak/i });
    
    // Wait for download
    const downloadPromise = this.page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/laporan|report/i);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    
    return download;
  }

  /**
   * Export report to Excel
   */
  async exportToExcel() {
    // Click export button or dropdown
    const exportButton = this.page.getByRole('button', { name: /export/i });
    await exportButton.click();

    await this.page.waitForTimeout(300);

    // Select Excel format
    const excelOption = this.page.getByRole('menuitem', { name: /excel|xlsx/i });
    
    // Wait for download
    const downloadPromise = this.page.waitForEvent('download');
    await excelOption.click();
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/laporan|report/i);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    
    return download;
  }

  /**
   * Export report to CSV
   */
  async exportToCSV() {
    // Click export button or dropdown
    const exportButton = this.page.getByRole('button', { name: /export/i });
    await exportButton.click();

    await this.page.waitForTimeout(300);

    // Select CSV format
    const csvOption = this.page.getByRole('menuitem', { name: /csv/i });
    
    // Wait for download
    const downloadPromise = this.page.waitForEvent('download');
    await csvOption.click();
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    
    return download;
  }

  /**
   * Schedule report generation
   */
  async scheduleReport(schedule: {
    frequency: string; // Daily, Weekly, Monthly
    time?: string;
    recipients?: string[];
  }) {
    // Click schedule button
    const scheduleButton = this.page.getByRole('button', { name: /jadwal|schedule/i });
    await scheduleButton.click();

    await this.page.waitForTimeout(300);

    // Select frequency
    const frequencySelect = this.page.getByLabel(/frekuensi|frequency/i);
    await frequencySelect.click();
    
    const frequencyOption = this.page.getByRole('option', { name: new RegExp(schedule.frequency, 'i') });
    await frequencyOption.click();

    // Set time if provided
    if (schedule.time) {
      await this.page.getByLabel(/waktu|time/i).fill(schedule.time);
    }

    // Add recipients if provided
    if (schedule.recipients && schedule.recipients.length > 0) {
      const recipientsInput = this.page.getByLabel(/penerima|recipients|email/i);
      await recipientsInput.fill(schedule.recipients.join(', '));
    }

    // Save schedule
    const saveButton = this.page.getByRole('button', { name: /simpan|save/i });
    await saveButton.click();

    await waitForSuccessToast(this.page, /berhasil|success/i);
  }

  /**
   * Email report
   */
  async emailReport(recipients: string[], subject?: string, message?: string) {
    // Click email button
    const emailButton = this.page.getByRole('button', { name: /email|kirim/i });
    await emailButton.click();

    await this.page.waitForTimeout(300);

    // Fill recipients
    const recipientsInput = this.page.getByLabel(/penerima|recipients|to/i);
    await recipientsInput.fill(recipients.join(', '));

    // Fill subject if provided
    if (subject) {
      await this.page.getByLabel(/subject|judul/i).fill(subject);
    }

    // Fill message if provided
    if (message) {
      await this.page.getByLabel(/pesan|message|body/i).fill(message);
    }

    // Send email
    const sendButton = this.page.getByRole('button', { name: /kirim|send/i });
    await sendButton.click();

    await waitForSuccessToast(this.page, /berhasil|success|terkirim/i);
  }

  /**
   * Expect report generated
   */
  async expectReportGenerated() {
    // Report should show data or chart
    const reportContent = this.page.locator('[data-report-content], .report-content, table, canvas');
    await expect(reportContent.first()).toBeVisible({ timeout: 10000 });
  }

  /**
   * Expect report contains data
   */
  async expectReportHasData() {
    // Check if report has rows/data
    const hasData = await this.page.locator('tbody tr, [data-chart], canvas').count() > 0;
    expect(hasData).toBeTruthy();
  }

  /**
   * Expect report is empty
   */
  async expectReportEmpty() {
    const emptyMessage = this.page.locator('text=/tidak.*ada.*data|no.*data|empty|kosong/i');
    await expect(emptyMessage).toBeVisible({ timeout: 5000 });
  }

  /**
   * Expect report total/summary
   */
  async expectReportTotal(label: string, value: string) {
    const totalElement = this.page.locator('text=' + label).locator('..').getByText(value);
    await expect(totalElement).toBeVisible({ timeout: 5000 });
  }

  /**
   * Get report row count
   */
  async getReportRowCount(): Promise<number> {
    const rows = this.page.locator('tbody tr, [data-row]').filter({ 
      hasNotText: /tidak.*ada.*data|no.*data|total/i 
    });
    return await rows.count();
  }

  /**
   * Expect minimum row count
   */
  async expectMinimumRows(minimumCount: number) {
    const count = await this.getReportRowCount();
    expect(count).toBeGreaterThanOrEqual(minimumCount);
  }

  /**
   * Print report
   */
  async printReport() {
    // Click print button
    const printButton = this.page.getByRole('button', { name: /print|cetak/i });
    await printButton.click();

    // Print dialog should open (can't fully test in automation)
    await this.page.waitForTimeout(1000);
  }

  /**
   * View report chart
   */
  async expectChartVisible() {
    const chart = this.page.locator('canvas, [data-chart], svg[class*="chart"]');
    await expect(chart.first()).toBeVisible({ timeout: 5000 });
  }

  /**
   * Switch between table and chart view
   */
  async switchToChartView() {
    const chartViewButton = this.page.getByRole('button', { name: /chart|grafik|diagram/i });
    if (await chartViewButton.isVisible({ timeout: 2000 })) {
      await chartViewButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  async switchToTableView() {
    const tableViewButton = this.page.getByRole('button', { name: /table|tabel|list/i });
    if (await tableViewButton.isVisible({ timeout: 2000 })) {
      await tableViewButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Refresh report
   */
  async refreshReport() {
    const refreshButton = this.page.getByRole('button', { name: /refresh|reload|muat.*ulang/i });
    
    if (await refreshButton.isVisible({ timeout: 2000 })) {
      await refreshButton.click();
      await waitForLoadingToFinish(this.page);
    }
  }

  /**
   * Clear filters
   */
  async clearFilters() {
    const clearButton = this.page.getByRole('button', { name: /clear|hapus.*filter|reset/i });
    
    if (await clearButton.isVisible({ timeout: 2000 })) {
      await clearButton.click();
      await waitForLoadingToFinish(this.page);
    }
  }
}
