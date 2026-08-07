import ExcelJS from 'exceljs';
import { Role } from '@prisma/client';
import { getStaffPerformanceSummaryService } from './staff-performance.service';

interface StaffPerformanceExportQuery {
  branchId?: string;
  startDate?: string;
  endDate?: string;
  infusKe?: number;
  search?: string;
}

const ROLE_LABELS: Partial<Record<Role, string>> = {
  [Role.DOCTOR]: 'Dokter',
  [Role.NURSE]: 'Nakes',
  [Role.ADMIN_CABANG]: 'Admin Cabang',
  [Role.ADMIN_LAYANAN]: 'Admin Layanan',
};

function formatFilterDate(value?: string) {
  if (!value) return null;
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function buildPeriodLabel(startDate?: string, endDate?: string) {
  const start = formatFilterDate(startDate);
  const end = formatFilterDate(endDate);
  if (start && end) return `${start} - ${end}`;
  if (start) return `Mulai ${start}`;
  if (end) return `Sampai ${end}`;
  return 'Semua tanggal';
}

function applyThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  };
}

export async function exportStaffPerformanceService(
  query: StaffPerformanceExportQuery,
  callerRole: Role,
  callerBranchId: string | null,
  callerUserId?: string,
) {
  const report = await getStaffPerformanceSummaryService(
    {
      branchId: query.branchId,
      startDate: query.startDate,
      endDate: query.endDate,
      infusKe: query.infusKe,
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
    },
    callerRole,
    callerBranchId,
    callerUserId,
  );

  const normalizedSearch = query.search?.trim().toLocaleLowerCase('id-ID');
  const staff = normalizedSearch
    ? report.staff.filter((item) => [item.fullName, item.staffCode, item.email]
      .some((value) => value.toLocaleLowerCase('id-ID').includes(normalizedSearch)))
    : report.staff;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RAHO ERP';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const worksheet = workbook.addWorksheet('Kinerja Staff', {
    properties: { tabColor: { argb: 'FFF59E0B' } },
    views: [{ state: 'frozen', xSplit: 3, ySplit: 8 }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      printTitlesRow: '8:8',
    },
  });

  worksheet.columns = [
    { key: 'rank', width: 8 },
    { key: 'staffCode', width: 17 },
    { key: 'fullName', width: 30 },
    { key: 'email', width: 32 },
    { key: 'role', width: 18 },
    { key: 'branch', width: 25 },
    { key: 'doctor', width: 14 },
    { key: 'nurse', width: 14 },
    { key: 'admin', width: 14 },
    { key: 'total', width: 14 },
  ];

  worksheet.mergeCells('A1:J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'LAPORAN KINERJA STAFF';
  titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF111827' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 32;

  const metadata = [
    ['Cabang', report.branch?.name || 'Semua Cabang'],
    ['Periode', buildPeriodLabel(query.startDate, query.endDate)],
    ['Infus ke', query.infusKe ? `Infus ke-${query.infusKe}` : 'Semua nomor infus'],
    ['Pencarian', query.search?.trim() || 'Semua staff'],
    ['Diekspor', new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date())],
  ];

  metadata.forEach(([label, value], index) => {
    const rowNumber = index + 2;
    worksheet.mergeCells(rowNumber, 1, rowNumber, 2);
    worksheet.mergeCells(rowNumber, 3, rowNumber, 10);

    const labelCell = worksheet.getCell(rowNumber, 1);
    labelCell.value = label;
    labelCell.font = { bold: true, color: { argb: 'FF374151' } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
    labelCell.alignment = { vertical: 'middle' };

    const valueCell = worksheet.getCell(rowNumber, 3);
    valueCell.value = value;
    valueCell.font = { color: { argb: 'FF4B5563' } };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
    valueCell.alignment = { vertical: 'middle' };
    worksheet.getRow(rowNumber).height = 22;
  });

  const headerRowNumber = 8;
  const headers = ['Peringkat', 'Kode Staff', 'Nama Staff', 'Email', 'Role', 'Cabang', 'Sebagai Dokter', 'Sebagai Nakes', 'Sebagai Admin', 'Total'];
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.values = headers;
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyThinBorder(cell);
  });

  staff.forEach((item, index) => {
    const row = worksheet.addRow([
      index + 1,
      item.staffCode,
      item.fullName,
      item.email,
      ROLE_LABELS[item.role as Role] || item.role,
      item.branch?.name || report.branch?.name || '-',
      item.performance.asDoctor,
      item.performance.asNurse,
      item.performance.asAdminLayanan,
      item.performance.total,
    ]);

    row.height = 22;
    row.eachCell((cell, columnNumber) => {
      applyThinBorder(cell);
      cell.alignment = {
        vertical: 'middle',
        horizontal: columnNumber === 1 || columnNumber >= 7 ? 'center' : 'left',
      };
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });

    row.getCell(3).font = { bold: true, color: { argb: 'FF111827' } };
    row.getCell(10).font = { bold: true, color: { argb: 'FFB45309' } };
    row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
  });

  const firstDataRow = headerRowNumber + 1;
  const lastDataRow = headerRowNumber + staff.length;
  const totalsRow = worksheet.getRow(lastDataRow + 1);
  worksheet.mergeCells(lastDataRow + 1, 1, lastDataRow + 1, 6);
  totalsRow.getCell(1).value = `TOTAL (${staff.length} staff)`;
  totalsRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

  const totalValues = [
    staff.reduce((sum, item) => sum + item.performance.asDoctor, 0),
    staff.reduce((sum, item) => sum + item.performance.asNurse, 0),
    staff.reduce((sum, item) => sum + item.performance.asAdminLayanan, 0),
    staff.reduce((sum, item) => sum + item.performance.total, 0),
  ];
  totalValues.forEach((result, index) => {
    const column = index + 7;
    totalsRow.getCell(column).value = staff.length > 0
      ? { formula: `SUM(${worksheet.getColumn(column).letter}${firstDataRow}:${worksheet.getColumn(column).letter}${lastDataRow})`, result }
      : 0;
    totalsRow.getCell(column).alignment = { horizontal: 'center', vertical: 'middle' };
  });
  totalsRow.height = 25;
  totalsRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF111827' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
    applyThinBorder(cell);
  });

  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: Math.max(headerRowNumber, lastDataRow), column: 10 },
  };
  worksheet.getColumn(1).numFmt = '0';
  [7, 8, 9, 10].forEach((column) => {
    worksheet.getColumn(column).numFmt = '#,##0';
  });
  worksheet.headerFooter.oddFooter = '&LRAHO ERP&C&P / &N&R&D &T';

  const buffer = await workbook.xlsx.writeBuffer();
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  return {
    buffer: Buffer.from(buffer),
    filename: `kinerja-staff-${timestamp}.xlsx`,
  };
}
