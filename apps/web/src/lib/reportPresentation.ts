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
    adminLayanan?: { fullName: string } | null;
    nurse?: { fullName: string } | null;
    sessionDoctors?: Array<{ doctor: { fullName: string } }>;
    sessionNurses?: Array<{ nurse: { fullName: string } }>;
  };
}

export interface MemberReportSource {
  memberNo: string;
  fullName: string;
  registrationBranch: string;
  isActive: boolean;
  createdAt: string;
}

export interface PaymentReportSource {
  invoiceNumber: string;
  memberName: string;
  memberNo?: string;
  branchName: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

export interface InventoryReportSource {
  inventoryValue: string;
  quantityReconciled: boolean;
  branch: { name: string };
  masterProduct: { sku: string; name: string };
  stockLocation: { name: string };
}

function inDateRange(value: string, startDate: string, endDate: string): boolean {
  const date = value.slice(0, 10);
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

export function buildMemberReportRows(
  members: MemberReportSource[],
  filters: { status: string; member: string; startDate: string; endDate: string },
): ReportRow[] {
  const search = filters.member.trim().toLocaleLowerCase('id-ID');
  return members.filter((item) => {
    const status = item.isActive ? 'Completed' : 'Cancelled';
    const text = `${item.fullName} ${item.memberNo}`.toLocaleLowerCase('id-ID');
    return (filters.status === 'Semua Status' || filters.status === status)
      && (!search || text.includes(search))
      && inDateRange(item.createdAt, filters.startDate, filters.endDate);
  }).map((item) => ({
    name: `${item.fullName} · ${item.memberNo}`,
    branch: item.registrationBranch,
    status: item.isActive ? 'Completed' : 'Cancelled',
    total: '1',
  }));
}

export function buildPaymentReportRows(
  invoices: PaymentReportSource[],
  filters: { status: string; member: string; startDate: string; endDate: string },
): ReportRow[] {
  const search = filters.member.trim().toLocaleLowerCase('id-ID');
  return invoices.filter((item) => {
    const normalizedStatus = item.status === 'PAID'
      ? 'Paid'
      : item.status === 'CANCELLED' ? 'Cancelled' : 'Pending';
    const text = `${item.memberName} ${item.memberNo || ''} ${item.invoiceNumber}`.toLocaleLowerCase('id-ID');
    return (filters.status === 'Semua Status' || filters.status === normalizedStatus)
      && (!search || text.includes(search))
      && inDateRange(item.createdAt, filters.startDate, filters.endDate);
  }).map((item) => ({
    name: `${item.invoiceNumber} · ${item.memberName}`,
    branch: item.branchName,
    status: item.status === 'PAID' ? 'Paid' : item.status === 'CANCELLED' ? 'Cancelled' : 'Pending',
    total: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.totalAmount),
  }));
}

export function buildInventoryReportRows(
  items: InventoryReportSource[],
  filters: { status: string; member: string },
): ReportRow[] {
  const search = filters.member.trim().toLocaleLowerCase('id-ID');
  return items.filter((item) => {
    const status = item.quantityReconciled ? 'Completed' : 'Pending';
    const text = `${item.masterProduct.name} ${item.masterProduct.sku} ${item.stockLocation.name}`.toLocaleLowerCase('id-ID');
    return (filters.status === 'Semua Status' || filters.status === status)
      && (!search || text.includes(search));
  }).map((item) => ({
    name: `${item.masterProduct.name} · ${item.masterProduct.sku}`,
    branch: item.branch.name,
    status: item.quantityReconciled ? 'Completed' : 'Pending',
    total: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(item.inventoryValue)),
  }));
}

export function buildSessionReportRows(
  sessions: SessionReportSource[],
  filters: { status: string; member: string; doctor: string; staff?: string },
): ReportRow[] {
  const memberSearch = filters.member.trim().toLocaleLowerCase('id-ID');
  const doctorSearch = filters.doctor.trim().toLocaleLowerCase('id-ID');
  const staffSearch = (filters.staff || '').trim().toLocaleLowerCase('id-ID');

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
      const staffText = [
        session.adminLayanan?.fullName,
        session.nurse?.fullName,
        session.doctor?.fullName,
        ...(session.sessionDoctors || []).map((assignment) => assignment.doctor.fullName),
        ...(session.sessionNurses || []).map((assignment) => assignment.nurse.fullName),
      ].filter(Boolean).join(' ').toLocaleLowerCase('id-ID');

      return (filters.status === 'Semua Status' || filters.status === status)
        && (!memberSearch || memberText.includes(memberSearch))
        && (!doctorSearch || doctorText.includes(doctorSearch))
        && (!staffSearch || staffText.includes(staffSearch));
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
