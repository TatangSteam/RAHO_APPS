export const REPORT_TYPES = ['Member', 'Session', 'Payment', 'Inventory'] as const;
export const REPORT_BRANCHES = ['Semua Cabang', 'RAHO Premier Jakarta', 'RAHO Bandung', 'RAHO Surabaya'] as const;
export const REPORT_STATUSES = ['Semua Status', 'Paid', 'Completed', 'Pending', 'Cancelled'] as const;
export const REPORT_FREQUENCIES = ['Daily', 'Weekly', 'Monthly'] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportBranch = (typeof REPORT_BRANCHES)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type ReportFrequency = (typeof REPORT_FREQUENCIES)[number];
export type ReportViewMode = 'table' | 'chart';
export type ReportPanel = 'schedule' | 'email' | null;
export type ReportExportFormat = 'pdf' | 'xlsx' | 'csv';

export interface ReportRow {
  name: string;
  branch: string;
  status: string;
  total: string;
}

export function buildReportRows(
  reportType: ReportType,
  branch: string,
  status: string,
): ReportRow[] {
  const branchName = branch === 'Semua Cabang' ? 'RAHO Premier Jakarta' : branch;
  const statusText = status === 'Semua Status' ? 'Completed' : status;

  return [
    {
      name: reportType === 'Payment' ? 'INV-RAHO-260630-001' : `${reportType} Utama`,
      branch: branchName,
      status: statusText,
      total: reportType === 'Payment' ? 'Rp 27.000.000' : '128',
    },
    {
      name: reportType === 'Inventory' ? 'IFA 250' : `${reportType} Reguler`,
      branch: 'RAHO Bandung',
      status: reportType === 'Payment' ? 'Paid' : 'Completed',
      total: reportType === 'Payment' ? 'Rp 9.500.000' : '64',
    },
    {
      name: reportType === 'Session' ? 'Terapi O3' : `${reportType} Follow Up`,
      branch: 'RAHO Surabaya',
      status: 'Pending',
      total: reportType === 'Payment' ? 'Rp 4.250.000' : '32',
    },
  ];
}

export function isFutureStartDate(startDate: string): boolean {
  if (!startDate) return false;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return new Date(`${startDate}T00:00:00`) > today;
}

function downloadFile(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportReportFile(
  reportType: ReportType,
  rows: ReportRow[],
  format: ReportExportFormat,
): void {
  const filename = `laporan-${reportType.toLowerCase()}-${Date.now()}.${format}`;
  const content = rows.map((row) => `${row.name},${row.branch},${row.status},${row.total}`).join('\n');

  if (format === 'pdf') {
    downloadFile(filename, 'application/pdf', `Laporan ${reportType}\n${content}`);
    return;
  }

  if (format === 'xlsx') {
    downloadFile(
      filename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      `Laporan ${reportType}\n${content}`,
    );
    return;
  }

  downloadFile(filename, 'text/csv;charset=utf-8', `Nama,Cabang,Status,Total\n${content}`);
}
