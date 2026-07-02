import { type Download, type Locator, type Page, expect } from '@playwright/test';
import { waitForLoadingToFinish, waitForSuccessToast } from '../helpers/waiters';
import { goToReports } from '../helpers/navigation';
import { EMPTY_STATE_TEXT, SELECTORS } from '../helpers/selectors';

const REPORT_NON_DATA_ROW_TEXT = new RegExp(`${EMPTY_STATE_TEXT.source}|total`, 'i');
type ReportType = 'Member' | 'Session' | 'Payment' | 'Inventory';

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
    await expect(this.page.getByRole('heading', { name: 'Laporan', exact: true })).toBeVisible({ timeout: 10000 });
    await waitForLoadingToFinish(this.page);
  }

  async generateMemberReport(filters?: ReportFilters) {
    await this.generateReport('Member', filters);
  }

  async generateSessionReport(filters?: ReportFilters) {
    await this.generateReport('Session', filters);
  }

  async generatePaymentReport(filters?: ReportFilters) {
    await this.generateReport('Payment', filters);
  }

  async generateInventoryReport(filters?: ReportFilters) {
    await this.generateReport('Inventory', filters);
  }

  private async generateReport(reportType: ReportType, filters?: ReportFilters) {
    await this.selectReportType(reportType);

    if (filters) {
      await this.applyFilters(filters);
    }

    await this.clickGenerate();
    await waitForLoadingToFinish(this.page);
    await this.expectReportGenerated();
  }

  async selectReportType(reportType: string) {
    await this.selectDropdownOption(/tipe.*laporan|report.*type|jenis/i, reportType);
  }

  async applyFilters(filters: ReportFilters) {
    if (filters.startDate) {
      await this.page.getByLabel(/tanggal.*mulai|start.*date|dari/i).fill(filters.startDate);
    }

    if (filters.endDate) {
      await this.page.getByLabel(/tanggal.*akhir|end.*date|sampai/i).fill(filters.endDate);
    }

    if (filters.branch) {
      await this.selectDropdownOption(/cabang|branch/i, filters.branch);
    }

    if (filters.status) {
      await this.selectDropdownOption(/status/i, filters.status);
    }

    if (filters.member) {
      await this.fillOptionalInput(/member|pasien/i, filters.member);
    }

    if (filters.doctor) {
      await this.fillOptionalInput(/dokter|doctor/i, filters.doctor);
    }
  }

  async clickGenerate() {
    await this.page.getByRole('button', { name: /generate|buat.*laporan|tampilkan/i }).click();
  }

  async filterByDateRange(startDate: string, endDate: string) {
    await this.page.getByLabel(/tanggal.*mulai|start.*date|dari/i).fill(startDate);
    await this.page.getByLabel(/tanggal.*akhir|end.*date|sampai/i).fill(endDate);

    const applyButton = this.page.getByRole('button', { name: /terapkan|apply|filter/i });
    if (await applyButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await applyButton.click();
      await waitForLoadingToFinish(this.page);
    }
  }

  async filterByBranch(branchName: string) {
    await this.selectDropdownOption(/cabang|branch/i, branchName);
    await waitForLoadingToFinish(this.page);
  }

  async exportToPDF(): Promise<Download> {
    return this.expectDownloadFrom(
      this.page.getByRole('button', { name: /export.*pdf|pdf|cetak/i }),
      /\.pdf$/i,
    );
  }

  async exportToExcel(): Promise<Download> {
    await this.openExportMenu();
    return this.expectDownloadFrom(
      this.page.getByRole('menuitem', { name: /excel|xlsx/i }),
      /\.xlsx$/i,
    );
  }

  async exportToCSV(): Promise<Download> {
    await this.openExportMenu();
    return this.expectDownloadFrom(
      this.page.getByRole('menuitem', { name: /csv/i }),
      /\.csv$/i,
    );
  }

  async scheduleReport(schedule: {
    frequency: string;
    time?: string;
    recipients?: string[];
  }) {
    await this.page.getByRole('button', { name: /jadwal|schedule/i }).click();

    const dialog = this.page.getByRole('dialog', { name: /jadwal laporan/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await this.selectDropdownOption(/frekuensi|frequency/i, schedule.frequency, dialog);

    if (schedule.time) {
      await dialog.getByLabel(/waktu|time/i).fill(schedule.time);
    }

    if (schedule.recipients && schedule.recipients.length > 0) {
      await dialog.getByLabel(/penerima|recipients|email/i).fill(schedule.recipients.join(', '));
    }

    await dialog.getByRole('button', { name: /simpan|save/i }).click();
    await waitForSuccessToast(this.page, /berhasil|success/i);
  }

  async emailReport(recipients: string[], subject?: string, message?: string) {
    await this.page.getByRole('button', { name: /email|kirim/i }).click();

    const dialog = this.page.getByRole('dialog', { name: /email laporan/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.locator('#email-recipients').fill(recipients.join(', '));

    if (subject) {
      await dialog.locator('#email-subject').fill(subject);
    }

    if (message) {
      await dialog.locator('#email-message').fill(message);
    }

    await dialog.getByRole('button', { name: /kirim|send/i }).click();
    await waitForSuccessToast(this.page, /berhasil|success|terkirim/i);
  }

  async expectReportGenerated() {
    await expect(this.page.locator('[data-report-content], .report-content, table, canvas').first()).toBeVisible({ timeout: 10000 });
  }

  async expectReportHasData() {
    const hasData = (await this.page.locator(`${SELECTORS.tableRow}, [data-chart], canvas`).count()) > 0;
    expect(hasData).toBeTruthy();
  }

  async expectReportEmpty() {
    await expect(this.page.locator('text=/tidak.*ada.*data|no.*data|empty|kosong/i')).toBeVisible({ timeout: 5000 });
  }

  async expectReportTotal(label: string, value: string) {
    await expect(this.page.locator('text=' + label).locator('..').getByText(value)).toBeVisible({ timeout: 5000 });
  }

  async getReportRowCount(): Promise<number> {
    const rows = this.page.locator(`${SELECTORS.tableRow}, [data-row]`).filter({ hasNotText: REPORT_NON_DATA_ROW_TEXT });
    return rows.count();
  }

  async expectMinimumRows(minimumCount: number) {
    expect(await this.getReportRowCount()).toBeGreaterThanOrEqual(minimumCount);
  }

  async printReport() {
    await this.page.getByRole('button', { name: /print|cetak/i }).click();
    await expect(this.page.getByRole('status')).toContainText(/print/i);
  }

  async expectChartVisible() {
    await expect(this.page.locator('canvas, [data-chart], svg[class*="chart"]').first()).toBeVisible({ timeout: 5000 });
  }

  async switchToChartView() {
    const chartViewButton = this.page.getByRole('button', { name: /chart|grafik|diagram/i });
    if (await chartViewButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chartViewButton.click();
      await this.expectChartVisible();
    }
  }

  async switchToTableView() {
    const tableViewButton = this.page.getByRole('button', { name: /table|tabel|list/i });
    if (await tableViewButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tableViewButton.click();
      await this.expectReportGenerated();
    }
  }

  async refreshReport() {
    const refreshButton = this.page.getByRole('button', { name: /refresh|reload|muat.*ulang/i });
    if (await refreshButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await refreshButton.click();
      await waitForLoadingToFinish(this.page);
    }
  }

  async clearFilters() {
    const clearButton = this.page.getByRole('button', { name: /clear|hapus.*filter|reset/i });
    if (await clearButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clearButton.click();
      await waitForLoadingToFinish(this.page);
    }
  }

  private async selectDropdownOption(label: RegExp, optionName: string, scope: Page | Locator = this.page) {
    const dropdown = scope.getByLabel(label);
    if (!(await dropdown.isVisible({ timeout: 1000 }).catch(() => false))) return;

    await dropdown.click();
    await this.page.getByRole('option', { name: new RegExp(optionName, 'i') }).click();
  }

  private async fillOptionalInput(label: RegExp, value: string) {
    const input = this.page.getByLabel(label);
    if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
      await input.fill(value);
    }
  }

  private async openExportMenu() {
    await this.page.getByRole('button', { name: /export/i }).click();
    await expect(this.page.getByRole('menu')).toBeVisible({ timeout: 5000 });
  }

  private async expectDownloadFrom(trigger: Locator, extension: RegExp): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download');
    await trigger.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/laporan|report/i);
    expect(download.suggestedFilename()).toMatch(extension);

    return download;
  }
}
