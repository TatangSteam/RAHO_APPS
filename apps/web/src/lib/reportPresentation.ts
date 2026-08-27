export const REPORT_TYPES = ['Member', 'Session', 'Payment', 'Inventory'] as const;
export const REPORT_STATUSES = ['Semua Status', 'Paid', 'Completed', 'Pending', 'Cancelled'] as const;
export const REPORT_FREQUENCIES = ['Daily', 'Weekly', 'Monthly'] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportBranch = string;
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

export interface SessionReportSource {
  session: {
    sessionCode: string;
    branchName?: string;
    isCompleted: boolean;
    completionStatus?: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    member: { fullName: string; memberNo: string };
    doctor?: { fullName: string } | null;
    sessionDoctors?: Array<{ doctor: { fullName: string } }>;
  };
}

export function buildSessionReportRows(
  sessions: SessionReportSource[],
  filters: { status: string; member: string; doctor: string },
): ReportRow[] {
  const memberSearch = filters.member.trim().toLocaleLowerCase('id-ID');
  const doctorSearch = filters.doctor.trim().toLocaleLowerCase('id-ID');

  return sessions
    .filter(({ session }) => {
      const status = session.completionStatus === 'CANCELLED'
        ? 'Cancelled'
        : session.isCompleted ? 'Completed' : 'Pending';
      const memberText = `${session.member.fullName} ${session.member.memberNo}`.toLocaleLowerCase('id-ID');
      const doctorText = [
        session.doctor?.fullName,
        ...(session.sessionDoctors || []).map((assignment) => assignment.doctor.fullName),
      ].filter(Boolean).join(' ').toLocaleLowerCase('id-ID');

      return (filters.status === 'Semua Status' || filters.status === status)
        && (!memberSearch || memberText.includes(memberSearch))
        && (!doctorSearch || doctorText.includes(doctorSearch));
    })
    .map(({ session }) => ({
      name: `${session.member.fullName} · ${session.sessionCode}`,
      branch: session.branchName || 'Cabang tidak diketahui',
      status: session.completionStatus === 'CANCELLED'
        ? 'Cancelled'
        : session.isCompleted ? 'Completed' : 'Pending',
      total: '1',
    }));
}

export function buildReportRows(
  reportType: ReportType,
  branch: string,
  status: string,
  availableBranches: string[] = [],
): ReportRow[] {
  const fallbackBranch = branch === 'Semua Cabang' ? 'Semua Cabang' : branch;
  const reportBranches = branch === 'Semua Cabang' && availableBranches.length > 0
    ? availableBranches
    : [fallbackBranch];
  const branchAt = (index: number) => reportBranches[index % reportBranches.length];
  const statusText = status === 'Semua Status' ? 'Completed' : status;

  return [
    {
      name: reportType === 'Payment' ? 'INV-RAHO-260630-001' : `${reportType} Utama`,
      branch: branchAt(0),
      status: statusText,
      total: reportType === 'Payment' ? 'Rp 27.000.000' : '128',
    },
    {
      name: reportType === 'Inventory' ? 'IFA 250' : `${reportType} Reguler`,
      branch: branchAt(1),
      status: reportType === 'Payment' ? 'Paid' : 'Completed',
      total: reportType === 'Payment' ? 'Rp 9.500.000' : '64',
    },
    {
      name: reportType === 'Session' ? 'Terapi O3' : `${reportType} Follow Up`,
      branch: branchAt(2),
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

function downloadFile(filename: string, mimeType: string, content: BlobPart): void {
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

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function exportReportFile(
  reportType: ReportType,
  rows: ReportRow[],
  format: ReportExportFormat,
): Promise<void> {
  const filename = `laporan-${reportType.toLowerCase()}-${Date.now()}.${format}`;
  const content = rows
    .map((row) => [row.name, row.branch, row.status, row.total].map(csvCell).join(','))
    .join('\n');

  if (format === 'pdf') {
    const [jsPdfModule, autoTableModule] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const document = new jsPdfModule.default();
    document.setFontSize(16);
    document.text(`Laporan ${reportType}`, 14, 18);
    autoTableModule.default(document, {
      startY: 24,
      head: [['Nama', 'Cabang', 'Status', 'Total']],
      body: rows.map((row) => [row.name, row.branch, row.status, row.total]),
    });
    document.save(filename);
    return;
  }

  if (format === 'xlsx') {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Laporan ${reportType}`);
    worksheet.columns = [
      { header: 'Nama', key: 'name', width: 32 },
      { header: 'Cabang', key: 'branch', width: 28 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Total', key: 'total', width: 20 },
    ];
    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
    worksheet.autoFilter = 'A1:D1';
    const buffer = await workbook.xlsx.writeBuffer();
    downloadFile(
      filename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    );
    return;
  }

  downloadFile(filename, 'text/csv;charset=utf-8', `\uFEFFNama,Cabang,Status,Total\n${content}`);
}
