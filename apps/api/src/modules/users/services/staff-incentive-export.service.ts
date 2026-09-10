import ExcelJS from 'exceljs';
import { Role } from '@prisma/client';
import { getMonthlyStaffIncentivesService } from './staff-incentive.service';

type MonthlyIncentiveReport = Awaited<ReturnType<typeof getMonthlyStaffIncentivesService>>;

const rupiahFormat = '[$Rp-421] #,##0';

function styleSheet(worksheet: ExcelJS.Worksheet) {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = { from: 'A1', to: worksheet.getRow(1).getCell(worksheet.columnCount).address };
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB7791F' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  worksheet.getRow(1).height = 24;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });
}

export async function buildStaffIncentiveWorkbook(report: MonthlyIncentiveReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RAHO ERP';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Ringkasan');
  summary.columns = [
    { header: 'Periode', key: 'period', width: 18 },
    { header: 'Kategori', key: 'category', width: 24 },
    { header: 'Jumlah Penerima', key: 'recipients', width: 20 },
    { header: 'Total Insentif', key: 'amount', width: 22, style: { numFmt: rupiahFormat } },
  ];
  summary.addRows([
    { period: report.period.month, category: 'NAKES', recipients: report.summary.nakesRecipients, amount: report.summary.nakesTotalAmount },
    { period: report.period.month, category: 'MSO', recipients: report.summary.msoRecipients, amount: report.summary.msoTotalAmount },
    { period: report.period.month, category: 'KOORDINATOR CHS', recipients: report.summary.coordinatorRecipients, amount: report.summary.coordinatorTotalAmount },
    { period: report.period.month, category: 'DOKTER HEAD', recipients: report.summary.doctorHeadRecipients, amount: report.summary.doctorHeadTotalAmount },
    { period: report.period.month, category: 'TOTAL', recipients: report.summary.nakesRecipients + report.summary.msoRecipients + report.summary.coordinatorRecipients + report.summary.doctorHeadRecipients, amount: report.summary.grandTotalAmount },
  ]);
  summary.getRow(6).font = { bold: true };
  styleSheet(summary);

  const nakes = workbook.addWorksheet('NAKES');
  nakes.columns = [
    { header: 'Kode Staff', key: 'staffCode', width: 16 },
    { header: 'Nama Lengkap', key: 'fullName', width: 30 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Jumlah Infus', key: 'infusionCount', width: 16 },
    { header: 'Tarif/Infus', key: 'ratePerInfusion', width: 18, style: { numFmt: rupiahFormat } },
    { header: 'Insentif Infus', key: 'baseAmount', width: 20, style: { numFmt: rupiahFormat } },
    { header: 'Target Tercapai', key: 'targetReached', width: 18 },
    { header: 'Bonus Target', key: 'targetBonus', width: 20, style: { numFmt: rupiahFormat } },
    { header: 'Total Insentif', key: 'totalAmount', width: 22, style: { numFmt: rupiahFormat } },
  ];
  nakes.addRows(report.nakes.map((row) => ({ ...row, staffCode: row.staffCode || '-', targetReached: row.targetReached ? 'YA' : 'TIDAK' })));
  styleSheet(nakes);

  const mso = workbook.addWorksheet('MSO');
  mso.columns = [
    { header: 'Kode Staff', key: 'staffCode', width: 16 },
    { header: 'Nama Lengkap', key: 'fullName', width: 30 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Jumlah Visit', key: 'visitCount', width: 16 },
    { header: 'Dus Air Nano Lunas', key: 'paidAirNanoBoxes', width: 22 },
    { header: 'Insentif Air Nano', key: 'airNanoAmount', width: 22, style: { numFmt: rupiahFormat } },
    { header: 'Bonus Visit Cair', key: 'visitBonusEligible', width: 20 },
    { header: 'Bonus Visit', key: 'visitBonus', width: 20, style: { numFmt: rupiahFormat } },
    { header: 'Total Insentif', key: 'totalAmount', width: 22, style: { numFmt: rupiahFormat } },
  ];
  mso.addRows(report.mso.map((row) => ({ ...row, staffCode: row.staffCode || '-', visitBonusEligible: row.visitBonusEligible ? 'YA' : 'TIDAK' })));
  styleSheet(mso);

  const coordinators = workbook.addWorksheet('KOORDINATOR CHS');
  coordinators.columns = [
    { header: 'Kode Staff', key: 'staffCode', width: 16 },
    { header: 'Nama Lengkap', key: 'fullName', width: 30 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Infus Eligible', key: 'eligiblePaidInfusions', width: 18 },
    { header: 'Insentif Rp1.000', key: 'paidInfusionAmount', width: 22, style: { numFmt: rupiahFormat } },
    { header: 'Tim HC Lolos Target', key: 'qualifiedHomecareTeams', width: 21 },
    { header: 'Bonus Tim HC', key: 'homecareTeamTargetBonus', width: 20, style: { numFmt: rupiahFormat } },
    { header: 'Cabang Lolos Target', key: 'qualifiedBranches', width: 21 },
    { header: 'Bonus Cabang', key: 'branchTargetBonus', width: 20, style: { numFmt: rupiahFormat } },
    { header: 'Infus Team HO Lunas', key: 'hoPaidInfusions', width: 21 },
    { header: 'Insentif Team HO', key: 'hoInfusionAmount', width: 21, style: { numFmt: rupiahFormat } },
    { header: 'Tusukan Pribadi', key: 'personalInfusions', width: 18 },
    { header: 'Insentif Pribadi', key: 'personalInfusionAmount', width: 22, style: { numFmt: rupiahFormat } },
    { header: 'Bonus Pribadi >=100', key: 'personalTargetBonus', width: 23, style: { numFmt: rupiahFormat } },
    { header: 'Total Insentif', key: 'totalAmount', width: 22, style: { numFmt: rupiahFormat } },
  ];
  coordinators.addRows(report.coordinators.map((row) => ({ ...row, staffCode: row.staffCode || '-' })));
  styleSheet(coordinators);

  const scopes = workbook.addWorksheet('DETAIL QUALIFIER CHS');
  scopes.columns = [
    { header: 'Koordinator', key: 'coordinator', width: 30 },
    { header: 'Jenis Scope', key: 'scope', width: 16 },
    { header: 'Nama Tim/Cabang', key: 'scopeName', width: 30 },
    { header: 'Cabang', key: 'branchName', width: 26 },
    { header: 'Target', key: 'qualifierTarget', width: 12 },
    { header: 'Total Infus', key: 'totalInfusions', width: 16 },
    { header: 'Qualifier', key: 'qualifierPassed', width: 16 },
    { header: 'Infus Berbayar Eligible', key: 'eligiblePaidInfusions', width: 24 },
  ];
  scopes.addRows(report.coordinators.flatMap((row) => row.scopes.map((scope) => ({
    ...scope,
    coordinator: row.fullName,
    qualifierPassed: scope.qualifierPassed ? 'PASS' : 'BELUM',
  }))));
  styleSheet(scopes);

  const doctorHeads = workbook.addWorksheet('DOKTER HEAD');
  doctorHeads.columns = [
    { header: 'Kode Staff', key: 'staffCode', width: 16 },
    { header: 'Nama Lengkap', key: 'fullName', width: 30 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Tim HC Lolos Target', key: 'qualifiedHomecareTeams', width: 21 },
    { header: 'Bonus Tim HC', key: 'homecareTeamTargetBonus', width: 20, style: { numFmt: rupiahFormat } },
    { header: 'Cabang Lolos Target', key: 'qualifiedBranches', width: 21 },
    { header: 'Bonus Cabang', key: 'branchTargetBonus', width: 20, style: { numFmt: rupiahFormat } },
    { header: 'Infus HC Sebagai Dokter', key: 'homecareDoctorPaidInfusions', width: 23 },
    { header: 'Insentif Dokter HC', key: 'homecareDoctorAmount', width: 22, style: { numFmt: rupiahFormat } },
    { header: 'Total Partnership', key: 'partnershipTotalInfusions', width: 20 },
    { header: 'Partnership Lunas', key: 'partnershipPaidInfusions', width: 20 },
    { header: 'Target Partnership', key: 'partnershipTargetReached', width: 20 },
    { header: 'Insentif Partnership', key: 'partnershipAmount', width: 23, style: { numFmt: rupiahFormat } },
    { header: 'Treatment Review', key: 'treatmentReviewAmount', width: 20, style: { numFmt: rupiahFormat } },
    { header: 'Status Treatment Review', key: 'treatmentReviewStatus', width: 28 },
    { header: 'Total Insentif', key: 'totalAmount', width: 22, style: { numFmt: rupiahFormat } },
  ];
  doctorHeads.addRows(report.doctorHeads.map((row) => ({
    ...row,
    staffCode: row.staffCode || '-',
    partnershipTargetReached: row.partnershipTargetReached ? 'PASS' : 'BELUM',
    treatmentReviewStatus: 'BELUM DIKONFIGURASI',
  })));
  styleSheet(doctorHeads);

  const doctorHeadScopes = workbook.addWorksheet('DETAIL DOKTER HEAD');
  doctorHeadScopes.columns = [
    { header: 'Dokter Head', key: 'doctorHead', width: 30 },
    { header: 'Cabang', key: 'branchName', width: 28 },
    { header: 'Jenis Cabang', key: 'branchType', width: 18 },
    { header: 'Target Cabang', key: 'qualifierTarget', width: 16 },
    { header: 'Total Infus', key: 'totalInfusions', width: 16 },
    { header: 'Target Tercapai', key: 'qualifierPassed', width: 18 },
    { header: 'Bonus Cabang', key: 'targetBonus', width: 20, style: { numFmt: rupiahFormat } },
    { header: 'Tim HC Lolos Target', key: 'qualifiedHomecareTeams', width: 22 },
  ];
  doctorHeadScopes.addRows(report.doctorHeads.flatMap((row) => row.scopes.map((scope) => ({
    ...scope,
    doctorHead: row.fullName,
    qualifierPassed: scope.qualifierPassed ? 'PASS' : 'BELUM',
  }))));
  styleSheet(doctorHeadScopes);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportMonthlyStaffIncentivesService(
  query: { month?: string; branchId?: string },
  callerRole: Role,
  callerUserId: string,
  callerBranchId: string | null,
) {
  const report = await getMonthlyStaffIncentivesService(query, callerRole, callerUserId, callerBranchId);
  return {
    buffer: await buildStaffIncentiveWorkbook(report),
    filename: `insentif-nakes-mso-koordinator-chs-dokter-head-${report.period.month}.xlsx`,
  };
}
