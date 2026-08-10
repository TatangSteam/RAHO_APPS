import ExcelJS from 'exceljs';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { getStaffSessionHistoryService } from './staff-performance.service';

interface StaffPerformanceDetailExportQuery {
  branchId?: string;
  position?: 'doctor' | 'nurse' | 'adminLayanan' | 'all';
  startDate?: string;
  endDate?: string;
}

const detailExportInclude = {
  branch: true,
  encounter: {
    include: {
      member: { include: { user: { include: { profile: true } } } },
      memberPackage: true,
      diagnoses: true,
    },
  },
  adminLayanan: { include: { profile: true } },
  doctor: { include: { profile: true } },
  nurse: { include: { profile: true } },
  sessionDoctors: {
    include: { doctor: { include: { profile: true } } },
    orderBy: { isPrimary: 'desc' as const },
  },
  sessionNurses: {
    include: { nurse: { include: { profile: true } } },
    orderBy: { isPrimary: 'desc' as const },
  },
  boosterPackage: true,
  therapyPlan: true,
  vitalSigns: true,
  infusion: true,
  materials: { include: { inventoryItem: { include: { masterProduct: true } } } },
  photo: true,
  supportingPhotos: true,
  emrNotes: true,
  evaluation: true,
} satisfies Prisma.TreatmentSessionInclude;

type DetailSession = Prisma.TreatmentSessionGetPayload<{
  include: typeof detailExportInclude;
}>;

type CellValue = ExcelJS.CellValue;

const ROLE_LABELS: Partial<Record<Role, string>> = {
  [Role.DOCTOR]: 'Dokter',
  [Role.NURSE]: 'Nakes',
  [Role.ADMIN_CABANG]: 'Admin Cabang',
  [Role.ADMIN_LAYANAN]: 'Admin Layanan',
  [Role.ADMIN_MANAGER]: 'Admin Manager',
  [Role.SUPER_ADMIN]: 'Super Admin',
};

const POSITION_LABELS: Record<string, string> = {
  doctor: 'Dokter',
  nurse: 'Nakes',
  adminLayanan: 'Admin Layanan',
  all: 'Semua posisi',
};

const DOSE_FIELDS = [
  { key: 'ifa250', label: 'IFA + NO 2,5 ml (250 ml)', unit: 'Botol' },
  { key: 'ifa500', label: 'IFA + NO 2,5 ml (500 ml)', unit: 'Botol' },
  { key: 'hho', label: 'HHO', unit: 'ml' },
  { key: 'hhoKonsentrat', label: 'HHO Konsentrat', unit: 'ml' },
  { key: 'h2', label: 'H2', unit: 'ml' },
  { key: 'no', label: 'NO', unit: 'ml' },
  { key: 'gaso', label: 'GASO', unit: 'ml' },
  { key: 'o2', label: 'O2', unit: 'ml' },
  { key: 'o3', label: 'O3', unit: 'ml' },
  { key: 'edta', label: 'EDTA', unit: 'ml' },
  { key: 'mb', label: 'MB', unit: 'ml' },
  { key: 'h2s', label: 'H2S', unit: 'ml' },
  { key: 'kcl', label: 'KCl', unit: 'ml' },
  { key: 'jmlNb', label: 'Jml. NB', unit: 'ml' },
] as const;

const COLORS = {
  amber: 'FFF59E0B',
  dark: 'FF374151',
  white: 'FFFFFFFF',
  border: 'FFE5E7EB',
  alternate: 'FFF9FAFB',
  metadataLabel: 'FFFFF7ED',
  metadataValue: 'FFFFFBEB',
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object' && value && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: Date | string | null | undefined, withTime = false): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    ...(withTime ? { timeStyle: 'short' as const } : {}),
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
}

function formatFilterDate(value?: string): string | null {
  if (!value) return null;
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function buildPeriodLabel(startDate?: string, endDate?: string): string {
  const start = formatFilterDate(startDate);
  const end = formatFilterDate(endDate);
  if (start && end) return `${start} - ${end}`;
  if (start) return `Mulai ${start}`;
  if (end) return `Sampai ${end}`;
  return 'Semua tanggal';
}

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: COLORS.border } },
    left: { style: 'thin', color: { argb: COLORS.border } },
    bottom: { style: 'thin', color: { argb: COLORS.border } },
    right: { style: 'thin', color: { argb: COLORS.border } },
  };
}

function createTableSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  metadata: Array<[string, string | number]>,
  columns: Array<{ header: string; width: number }>,
  rows: CellValue[][],
) {
  const worksheet = workbook.addWorksheet(name, {
    properties: { tabColor: { argb: COLORS.amber } },
    views: [{ state: 'frozen', ySplit: 7 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      printTitlesRow: '7:7',
    },
  });

  worksheet.columns = columns.map((column) => ({ width: column.width }));
  worksheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Calibri', size: 17, bold: true, color: { argb: 'FF111827' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amber } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 31;

  metadata.slice(0, 4).forEach(([label, value], index) => {
    const rowNumber = index + 2;
    const labelEnd = Math.min(2, columns.length);
    const valueStart = Math.min(3, columns.length);
    if (labelEnd > 1) worksheet.mergeCells(rowNumber, 1, rowNumber, labelEnd);
    if (columns.length > valueStart) worksheet.mergeCells(rowNumber, valueStart, rowNumber, columns.length);
    const labelCell = worksheet.getCell(rowNumber, 1);
    labelCell.value = label;
    labelCell.font = { bold: true, color: { argb: COLORS.dark } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.metadataLabel } };
    const valueCell = worksheet.getCell(rowNumber, valueStart);
    valueCell.value = value;
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.metadataValue } };
    worksheet.getRow(rowNumber).height = 21;
  });

  const headerRow = worksheet.getRow(7);
  headerRow.values = columns.map((column) => column.header);
  headerRow.height = 31;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.dark } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(cell);
  });

  rows.forEach((values, index) => {
    const row = worksheet.addRow(values);
    row.height = 22;
    row.eachCell((cell) => {
      applyBorder(cell);
      cell.alignment = { vertical: 'top', wrapText: true };
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.alternate } };
      }
    });
  });

  if (rows.length === 0) {
    worksheet.mergeCells(8, 1, 8, columns.length);
    worksheet.getCell(8, 1).value = 'Tidak ada data untuk filter yang dipilih';
    worksheet.getCell(8, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell(8, 1).font = { italic: true, color: { argb: 'FF6B7280' } };
  }

  worksheet.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: Math.max(7, 7 + rows.length), column: columns.length },
  };
  worksheet.headerFooter.oddFooter = '&LRAHO ERP&C&P / &N&R&D &T';
  return worksheet;
}

function allStaffNames(
  primary: { profile: { fullName: string | null } | null },
  additional: Array<{ profile: { fullName: string | null } | null }>,
): string {
  const names = [primary, ...additional]
    .map((item) => item.profile?.fullName)
    .filter((name): name is string => Boolean(name));
  return [...new Set(names)].join(', ') || '-';
}

function categoryList(value: Prisma.JsonValue | null): string {
  if (!value) return '-';
  if (Array.isArray(value)) return value.map(String).join(', ');
  return typeof value === 'string' ? value : JSON.stringify(value);
}

async function getAllScopedHistory(
  staffId: string,
  query: StaffPerformanceDetailExportQuery,
  callerRole: Role,
  callerBranchId: string | null,
  callerUserId?: string,
) {
  const batchSize = 1000;
  const firstPage = await getStaffSessionHistoryService(
    staffId,
    { ...query, page: 1, limit: batchSize },
    callerRole,
    callerBranchId,
    callerUserId,
  );
  const sessions = [...firstPage.sessions];

  for (let page = 2; sessions.length < firstPage.total; page += 1) {
    const nextPage = await getStaffSessionHistoryService(
      staffId,
      { ...query, page, limit: batchSize },
      callerRole,
      callerBranchId,
      callerUserId,
    );
    if (nextPage.sessions.length === 0) break;
    sessions.push(...nextPage.sessions);
  }

  return { ...firstPage, sessions };
}

export async function exportStaffPerformanceDetailService(
  staffId: string,
  query: StaffPerformanceDetailExportQuery,
  callerRole: Role,
  callerBranchId: string | null,
  callerUserId?: string,
) {
  // Reuse the history service so the export can never exceed the branch and
  // staff scope that the caller is allowed to see on the detail screen.
  const history = await getAllScopedHistory(
    staffId,
    query,
    callerRole,
    callerBranchId,
    callerUserId,
  );
  const positionBySessionId = new Map(history.sessions.map((session) => [session.id, session.positions]));
  const sessionIds = history.sessions.map((session) => session.id);
  const sessions: DetailSession[] = sessionIds.length === 0
    ? []
    : await prisma.treatmentSession.findMany({
      where: { id: { in: sessionIds } },
      include: detailExportInclude,
      orderBy: { treatmentDate: 'desc' },
    });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RAHO ERP';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const exportedAt = formatDate(new Date(), true);
  const period = buildPeriodLabel(query.startDate, query.endDate);
  const positionLabel = POSITION_LABELS[query.position || 'all'] || query.position || 'Semua posisi';
  const baseMetadata: Array<[string, string | number]> = [
    ['Staff', `${history.staff.staffCode} - ${history.staff.fullName}`],
    ['Tanggal sesi terapi', period],
    ['Filter posisi', positionLabel],
    ['Diekspor', exportedAt],
  ];

  createTableSheet(
    workbook,
    'Ringkasan',
    'RINGKASAN DETAIL KINERJA STAFF',
    baseMetadata,
    [
      { header: 'Kode Staff', width: 18 },
      { header: 'Nama Staff', width: 30 },
      { header: 'Role', width: 18 },
      { header: 'Email', width: 32 },
      { header: 'Telepon', width: 18 },
      { header: 'Cabang Utama', width: 25 },
      { header: 'Sebagai Dokter', width: 16 },
      { header: 'Sebagai Nakes', width: 16 },
      { header: 'Sebagai Admin', width: 16 },
      { header: 'Total Peran', width: 14 },
      { header: 'Sesi Unik', width: 14 },
    ],
    [[
      history.staff.staffCode,
      history.staff.fullName,
      ROLE_LABELS[history.staff.role as Role] || history.staff.role,
      history.staff.email,
      history.staff.phone || '-',
      history.staff.branch?.name || '-',
      history.summary.asDoctor,
      history.summary.asNurse,
      history.summary.asAdminLayanan,
      history.summary.total,
      history.total,
    ]],
  );

  const sessionRows: CellValue[][] = sessions.map((session) => [
    session.sessionCode,
    formatDate(session.treatmentDate, true),
    session.isCompleted ? 'Selesai' : 'Belum selesai',
    session.completionStatus,
    session.completedAt ? formatDate(session.completedAt, true) : '-',
    session.pelaksanaan === 'ON_SITE' ? 'On Site' : 'Home Care',
    session.infusKe,
    session.branchInfusKe,
    session.branch.branchCode,
    session.branch.name,
    session.encounter.encounterCode,
    session.encounter.member.memberNo,
    session.encounter.member.user.profile?.fullName || '-',
    session.encounter.memberPackage.packageCode,
    session.encounter.memberPackage.packageType,
    session.boosterPackage?.packageCode || '-',
    session.boosterType || '-',
    (positionBySessionId.get(session.id) || []).map((item) => POSITION_LABELS[item] || item).join(', '),
    session.adminLayanan.profile?.fullName || '-',
    session.doctor.profile?.fullName || '-',
    allStaffNames(session.doctor, session.sessionDoctors.map((item) => item.doctor)),
    session.nurse.profile?.fullName || '-',
    allStaffNames(session.nurse, session.sessionNurses.map((item) => item.nurse)),
    session.infusion?.jenisCairan || '-',
    toNumber(session.infusion?.volumeCarrier),
    session.infusion?.bottleType || '-',
    session.infusion?.jumlahJarum ?? null,
    session.infusion?.tanggalProduksi ? formatDate(session.infusion.tanggalProduksi) : '-',
    session.photo?.fileUrl || '-',
    session.supportingPhotos.map((photo) => photo.fileUrl).join('\n') || '-',
  ]);
  createTableSheet(
    workbook,
    'Detail Sesi',
    'DETAIL SESI TERAPI',
    baseMetadata,
    [
      { header: 'Kode Sesi', width: 22 }, { header: 'Tanggal & Jam Terapi', width: 24 },
      { header: 'Status', width: 15 }, { header: 'Status Penyelesaian', width: 20 },
      { header: 'Diselesaikan Pada', width: 24 }, { header: 'Pelaksanaan', width: 15 },
      { header: 'Infus Global Ke', width: 14 }, { header: 'Infus Cabang Ke', width: 14 },
      { header: 'Kode Cabang', width: 15 }, { header: 'Cabang', width: 24 },
      { header: 'Kode Encounter', width: 22 }, { header: 'No. Member', width: 18 },
      { header: 'Nama Member', width: 28 }, { header: 'Kode Paket', width: 22 },
      { header: 'Jenis Paket', width: 16 }, { header: 'Kode Booster', width: 22 },
      { header: 'Jenis Booster', width: 18 }, { header: 'Peran Staff', width: 22 },
      { header: 'Admin Layanan', width: 26 }, { header: 'Dokter Utama', width: 26 },
      { header: 'Semua Dokter', width: 34 }, { header: 'Nakes Utama', width: 26 },
      { header: 'Semua Nakes', width: 34 }, { header: 'Cairan Pembawa', width: 22 },
      { header: 'Volume Cairan (ml)', width: 18 }, { header: 'Jenis Botol', width: 16 },
      { header: 'Jumlah Jarum', width: 15 }, { header: 'Tanggal Produksi', width: 20 },
      { header: 'Foto Utama', width: 42 }, { header: 'Foto Pendukung', width: 45 },
    ],
    sessionRows,
  );

  const doseRows: CellValue[][] = [];
  sessions.forEach((session) => {
    DOSE_FIELDS.forEach(({ key, label, unit }) => {
      const planned = toNumber(session.therapyPlan?.[key]);
      const actual = toNumber(session.infusion?.[key]);
      if (planned === null && actual === null) return;
      doseRows.push([
        session.sessionCode,
        formatDate(session.treatmentDate),
        session.encounter.member.memberNo,
        session.encounter.member.user.profile?.fullName || '-',
        session.branch.name,
        label,
        planned,
        actual,
        unit,
        session.infusion?.jenisCairan || '-',
        toNumber(session.infusion?.volumeCarrier),
        session.infusion?.bottleType || '-',
        session.infusion?.deviationNotes || '-',
      ]);
    });
  });
  const doseSheet = createTableSheet(
    workbook,
    'Cairan & Dosis',
    'CAIRAN DAN DOSIS INFUS',
    baseMetadata,
    [
      { header: 'Kode Sesi', width: 22 }, { header: 'Tanggal Terapi', width: 20 },
      { header: 'No. Member', width: 18 }, { header: 'Nama Member', width: 28 },
      { header: 'Cabang', width: 24 }, { header: 'Komponen Cairan/Zat', width: 30 },
      { header: 'Dosis Rencana', width: 16 }, { header: 'Dosis Aktual', width: 16 },
      { header: 'Satuan', width: 12 }, { header: 'Cairan Pembawa', width: 22 },
      { header: 'Volume Pembawa (ml)', width: 20 }, { header: 'Jenis Botol', width: 16 },
      { header: 'Catatan Deviasi', width: 40 },
    ],
    doseRows,
  );
  doseSheet.getColumn(7).numFmt = '0.00';
  doseSheet.getColumn(8).numFmt = '0.00';
  doseSheet.getColumn(11).numFmt = '0.00';

  const vitalRows: CellValue[][] = sessions.flatMap((session) => session.vitalSigns.map((vital) => [
    session.sessionCode,
    formatDate(session.treatmentDate),
    session.encounter.member.memberNo,
    session.encounter.member.user.profile?.fullName || '-',
    session.branch.name,
    vital.waktuCatat === 'SEBELUM' ? 'Sebelum' : 'Sesudah',
    vital.pencatatan,
    toNumber(vital.value),
    vital.unit || '-',
    vital.recordedBy,
    formatDate(vital.createdAt, true),
  ]));
  const vitalSheet = createTableSheet(
    workbook,
    'Vital Sign',
    'DETAIL VITAL SIGN',
    baseMetadata,
    [
      { header: 'Kode Sesi', width: 22 }, { header: 'Tanggal Terapi', width: 20 },
      { header: 'No. Member', width: 18 }, { header: 'Nama Member', width: 28 },
      { header: 'Cabang', width: 24 }, { header: 'Waktu Catat', width: 14 },
      { header: 'Jenis Vital', width: 18 }, { header: 'Nilai', width: 14 },
      { header: 'Satuan', width: 12 }, { header: 'Dicatat Oleh', width: 25 },
      { header: 'Waktu Input', width: 24 },
    ],
    vitalRows,
  );
  vitalSheet.getColumn(8).numFmt = '0.00';

  const materialRows: CellValue[][] = sessions.flatMap((session) => session.materials.map((material) => [
    session.sessionCode,
    formatDate(session.treatmentDate),
    session.encounter.member.memberNo,
    session.encounter.member.user.profile?.fullName || '-',
    session.branch.name,
    material.inventoryItem.masterProduct.sku || '-',
    material.inventoryItem.masterProduct.name,
    material.inventoryItem.masterProduct.category,
    toNumber(material.quantity),
    material.unit,
    toNumber(material.baseQuantity),
    material.inventoryItem.masterProduct.baseUnit,
    toNumber(material.recommendedQuantity),
    material.status,
    material.deviationReason || '-',
    material.deviationNotes || '-',
    material.recordedBy,
    material.consumedAt ? formatDate(material.consumedAt, true) : '-',
  ]));
  const materialSheet = createTableSheet(
    workbook,
    'Material',
    'DETAIL MATERIAL TERPAKAI',
    baseMetadata,
    [
      { header: 'Kode Sesi', width: 22 }, { header: 'Tanggal Terapi', width: 20 },
      { header: 'No. Member', width: 18 }, { header: 'Nama Member', width: 28 },
      { header: 'Cabang', width: 24 }, { header: 'SKU', width: 20 },
      { header: 'Nama Material', width: 32 }, { header: 'Kategori', width: 20 },
      { header: 'Jumlah Aktual', width: 16 }, { header: 'Satuan Pemakaian', width: 18 },
      { header: 'Jumlah Dasar', width: 16 }, { header: 'Satuan Dasar', width: 16 },
      { header: 'Jumlah Rekomendasi', width: 20 }, { header: 'Status', width: 16 },
      { header: 'Alasan Deviasi', width: 22 }, { header: 'Catatan Deviasi', width: 40 },
      { header: 'Dicatat Oleh', width: 25 }, { header: 'Waktu Konsumsi', width: 24 },
    ],
    materialRows,
  );
  [9, 11, 13].forEach((column) => { materialSheet.getColumn(column).numFmt = '0.0000'; });

  const clinicalRows: CellValue[][] = sessions.map((session) => {
    const diagnosis = session.encounter.diagnoses[0];
    const evaluation = session.evaluation;
    return [
      session.sessionCode,
      formatDate(session.treatmentDate),
      session.encounter.member.memberNo,
      session.encounter.member.user.profile?.fullName || '-',
      diagnosis?.diagnosisCode || '-',
      diagnosis?.diagnosa || '-',
      diagnosis?.kategoriDiagnosa || '-',
      categoryList(diagnosis?.kategoriDiagnosaList ?? null),
      [diagnosis?.icdPrimer, diagnosis?.icdSekunder, diagnosis?.icdTersier].filter(Boolean).join(', ') || '-',
      diagnosis?.keluhanRiwayatSekarang || '-',
      diagnosis?.pemeriksaanFisik || '-',
      session.therapyPlan?.planCode || '-',
      session.therapyPlan?.keterangan || '-',
      session.infusion?.deviationNotes || '-',
      evaluation?.keluhan || '-',
      evaluation?.rekomendasi || '-',
      evaluation?.subjective || '-',
      evaluation?.objective || '-',
      evaluation?.assessment || '-',
      evaluation?.plan || '-',
      evaluation?.generalNotes || '-',
      session.emrNotes.map((note) => `[${note.noteType}] ${note.content}`).join('\n') || '-',
    ];
  });
  createTableSheet(
    workbook,
    'Klinis & Evaluasi',
    'DIAGNOSIS, RENCANA, DAN EVALUASI',
    baseMetadata,
    [
      { header: 'Kode Sesi', width: 22 }, { header: 'Tanggal Terapi', width: 20 },
      { header: 'No. Member', width: 18 }, { header: 'Nama Member', width: 28 },
      { header: 'Kode Diagnosis', width: 22 }, { header: 'Diagnosis', width: 36 },
      { header: 'Kategori Utama', width: 24 }, { header: 'Semua Kategori', width: 34 },
      { header: 'Kode ICD', width: 22 }, { header: 'Keluhan/Riwayat Sekarang', width: 42 },
      { header: 'Pemeriksaan Fisik', width: 42 }, { header: 'Kode Rencana Terapi', width: 24 },
      { header: 'Keterangan Rencana', width: 42 }, { header: 'Deviasi Infus', width: 42 },
      { header: 'Keluhan Evaluasi', width: 42 }, { header: 'Rekomendasi', width: 42 },
      { header: 'Subjective', width: 42 }, { header: 'Objective', width: 42 },
      { header: 'Assessment', width: 42 }, { header: 'Plan', width: 42 },
      { header: 'Catatan Umum', width: 42 }, { header: 'Catatan EMR', width: 50 },
    ],
    clinicalRows,
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  const safeStaffCode = history.staff.staffCode.replace(/[^a-zA-Z0-9_-]/g, '-');
  return {
    buffer: Buffer.from(buffer),
    filename: `detail-kinerja-${safeStaffCode}-${timestamp}.xlsx`,
  };
}
