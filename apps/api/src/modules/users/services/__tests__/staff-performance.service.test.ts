import { Role } from '@prisma/client';
import ExcelJS from 'exceljs';
import { prisma } from '../../../../lib/prisma';
import {
  getStaffPerformanceSummaryService,
  getStaffSessionHistoryService,
} from '../staff-performance.service';
import { exportStaffPerformanceService } from '../staff-performance-export.service';
import { exportStaffPerformanceDetailService } from '../staff-performance-detail-export.service';
import { getAccessibleBranchIds } from '../../../iam/authorization.service';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    branch: {
      findUnique: jest.fn(),
    },
    managerBranch: {
      findMany: jest.fn(),
    },
    treatmentSession: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../iam/authorization.service', () => ({
  getAccessibleBranchIds: jest.fn(),
}));

const mockPrisma = prisma as any;

function staff(id: string, fullName: string) {
  return {
    id,
    email: `${id}@example.com`,
    role: Role.DOCTOR,
    staffCode: id.toUpperCase(),
    branchId: 'branch-1',
    profile: {
      fullName,
      phone: null,
      avatarUrl: null,
    },
  };
}

function sessionForDoctor(doctorId: string, isCompleted = true) {
  return {
    doctorId,
    nurseId: 'nurse-1',
    adminLayananId: 'admin-1',
    sessionDoctors: [],
    sessionNurses: [],
    isCompleted,
  };
}

describe('staff performance service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'branch-1',
      branchCode: 'BR1',
      name: 'Branch 1',
    } as any);
  });

  it('sorts all matching staff by performance before applying pagination', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      staff('alpha', 'Alpha Low'),
      staff('zulu', 'Zulu High'),
      staff('middle', 'Middle'),
    ] as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([
      sessionForDoctor('zulu'),
      sessionForDoctor('zulu'),
      sessionForDoctor('middle'),
    ] as any);

    const result = await getStaffPerformanceSummaryService(
      { branchId: 'branch-1', page: 1, limit: 2 },
      Role.SUPER_ADMIN,
      null,
    );

    expect(result.total).toBe(3);
    expect(result.staff.map((item) => item.id)).toEqual(['zulu', 'middle']);
    expect(result.summary).toEqual(expect.objectContaining({
      uniqueSessions: 3,
      participations: 3,
      asDoctor: 3,
    }));
    expect(mockPrisma.treatmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          isCompleted: true,
        }),
      }),
    );
  });

  it('applies staff search before aggregation and pagination', async () => {
    mockPrisma.user.findMany.mockResolvedValue([staff('doctor-1', 'Doctor One')] as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([sessionForDoctor('doctor-1')] as any);

    const result = await getStaffPerformanceSummaryService(
      { branchId: 'branch-1', search: 'doctor one', page: 1, limit: 1 },
      Role.SUPER_ADMIN,
      null,
    );

    expect(result.total).toBe(1);
    expect(result.summary.uniqueSessions).toBe(1);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: [{
          OR: [
            { email: { contains: 'doctor one', mode: 'insensitive' } },
            { staffCode: { contains: 'doctor one', mode: 'insensitive' } },
            { profile: { fullName: { contains: 'doctor one', mode: 'insensitive' } } },
          ],
        }],
      }),
    }));
  });

  it('filters performance using the treatment session date in Jakarta time', async () => {
    mockPrisma.user.findMany.mockResolvedValue([staff('doctor-1', 'Doctor One')] as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([] as any);

    await getStaffPerformanceSummaryService(
      { branchId: 'branch-1', startDate: '2026-08-01', endDate: '2026-08-07' },
      Role.SUPER_ADMIN,
      null,
    );

    expect(mockPrisma.treatmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          treatmentDate: {
            gte: new Date('2026-08-01T00:00:00.000+07:00'),
            lte: new Date('2026-08-07T23:59:59.999+07:00'),
          },
        }),
      }),
    );
  });

  it('limits Admin Manager staff history to the selected managed branch', async () => {
    mockPrisma.managerBranch.findMany.mockResolvedValue([{ branchId: 'branch-1' }] as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...staff('doctor-1', 'Doctor One'),
      branch: {
        id: 'branch-1',
        branchCode: 'BR1',
        name: 'Branch 1',
      },
      staffBranches: [],
    } as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([] as any);
    mockPrisma.treatmentSession.count.mockResolvedValue(0 as any);

    await getStaffSessionHistoryService(
      'doctor-1',
      { branchId: 'branch-1' },
      Role.ADMIN_MANAGER,
      null,
      'manager-1',
    );

    expect(mockPrisma.treatmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 'branch-1',
        }),
      }),
    );
  });

  it('allows a doctor to view staff performance in an assigned branch', async () => {
    (getAccessibleBranchIds as jest.Mock).mockResolvedValue(['branch-1']);
    mockPrisma.user.findMany.mockResolvedValue([staff('doctor-1', 'Doctor One')] as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([] as any);

    await getStaffPerformanceSummaryService(
      { branchId: 'branch-1' },
      Role.DOCTOR,
      'branch-1',
      'viewer-doctor',
    );

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { branchId: 'branch-1' },
            { staffBranches: { some: { branchId: 'branch-1' } } },
          ]),
        }),
      }),
    );
    expect(mockPrisma.treatmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: 'branch-1' }),
      }),
    );
  });

  it('rejects a doctor performance request outside assigned branches', async () => {
    (getAccessibleBranchIds as jest.Mock).mockResolvedValue(['branch-1']);

    await expect(getStaffPerformanceSummaryService(
      { branchId: 'branch-2' },
      Role.DOCTOR,
      'branch-1',
      'viewer-doctor',
    )).rejects.toMatchObject({ status: 403 });
  });

  it('limits doctor staff history to an assigned branch', async () => {
    (getAccessibleBranchIds as jest.Mock).mockResolvedValue(['branch-1']);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...staff('doctor-1', 'Doctor One'),
      branch: {
        id: 'branch-1',
        branchCode: 'BR1',
        name: 'Branch 1',
      },
      staffBranches: [],
    } as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([] as any);
    mockPrisma.treatmentSession.count.mockResolvedValue(0 as any);

    await getStaffSessionHistoryService(
      'doctor-1',
      { branchId: 'branch-1' },
      Role.DOCTOR,
      'branch-1',
      'viewer-doctor',
    );

    expect(mockPrisma.treatmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: 'branch-1' }),
      }),
    );
  });

  it('includes unfinished sessions in staff history queries', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...staff('doctor-1', 'Doctor One'),
      branch: {
        id: 'branch-1',
        branchCode: 'BR1',
        name: 'Branch 1',
      },
      staffBranches: [],
    } as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([] as any);
    mockPrisma.treatmentSession.count.mockResolvedValue(0 as any);

    await getStaffSessionHistoryService(
      'doctor-1',
      { branchId: 'branch-1' },
      Role.SUPER_ADMIN,
      null,
    );

    expect(mockPrisma.treatmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          isCompleted: true,
        }),
      }),
    );
    expect(mockPrisma.treatmentSession.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          isCompleted: true,
        }),
      }),
    );
  });

  it('counts each incomplete session once per participating staff and supports detail filtering', async () => {
    mockPrisma.user.findMany.mockResolvedValue([staff('doctor-1', 'Doctor One')] as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([
      {
        ...sessionForDoctor('doctor-1', false),
        sessionDoctors: [{ doctorId: 'doctor-1' }],
      },
    ] as any);

    const summary = await getStaffPerformanceSummaryService(
      { branchId: 'branch-1' },
      Role.SUPER_ADMIN,
      null,
    );
    expect(summary.staff[0].performance.incomplete).toBe(1);

    mockPrisma.user.findUnique.mockResolvedValue({
      ...staff('doctor-1', 'Doctor One'),
      branch: { id: 'branch-1', branchCode: 'BR1', name: 'Branch 1' },
      staffBranches: [],
    } as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([] as any);
    mockPrisma.treatmentSession.count.mockResolvedValue(0 as any);

    await getStaffSessionHistoryService(
      'doctor-1',
      { branchId: 'branch-1', completion: 'incomplete' },
      Role.SUPER_ADMIN,
      null,
    );
    expect(mockPrisma.treatmentSession.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isCompleted: false }),
      }),
    );
  });

  it('combines MSO and Nakes as one operational participation and keeps totals unique', async () => {
    mockPrisma.user.findMany.mockResolvedValue([staff('operator-1', 'Operator One')] as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([{
      doctorId: 'doctor-1',
      nurseId: 'operator-1',
      adminLayananId: 'operator-1',
      sessionDoctors: [],
      sessionNurses: [{ nurseId: 'operator-1' }],
      isCompleted: false,
    }] as any);

    const result = await getStaffPerformanceSummaryService(
      { branchId: 'branch-1' },
      Role.SUPER_ADMIN,
      null,
    );

    expect(result.staff[0].performance).toEqual(expect.objectContaining({
      asNurse: 1,
      asAdminLayanan: 1,
      asOperational: 1,
      total: 1,
      incomplete: 1,
    }));
    expect(result.summary).toEqual(expect.objectContaining({
      uniqueSessions: 1,
      participations: 1,
      asOperational: 1,
    }));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        role: { in: [Role.ADMIN_LAYANAN, Role.DOCTOR, Role.NURSE] },
      }),
    }));
  });

  it('attributes performance to assigned roles instead of the staff member who fills the workflow', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      staff('doctor-1', 'Doctor One'),
      { ...staff('nurse-1', 'Nurse One'), role: Role.NURSE },
      { ...staff('mso-1', 'MSO One'), role: Role.ADMIN_LAYANAN },
    ] as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([{
      doctorId: 'doctor-1',
      nurseId: 'nurse-1',
      adminLayananId: 'mso-1',
      sessionDoctors: [],
      sessionNurses: [],
      isCompleted: true,
    }] as any);

    const result = await getStaffPerformanceSummaryService(
      { branchId: 'branch-1' },
      Role.SUPER_ADMIN,
      null,
    );
    const byId = new Map(result.staff.map((item) => [item.id, item.performance]));

    expect(byId.get('doctor-1')).toEqual(expect.objectContaining({
      asDoctor: 1,
      asOperational: 0,
      total: 1,
    }));
    expect(byId.get('nurse-1')).toEqual(expect.objectContaining({
      asDoctor: 0,
      asOperational: 1,
      total: 1,
    }));
    expect(byId.get('mso-1')).toEqual(expect.objectContaining({
      asDoctor: 0,
      asOperational: 1,
      total: 1,
    }));
    expect(result.summary).toEqual(expect.objectContaining({
      uniqueSessions: 1,
      participations: 3,
      asDoctor: 1,
      asOperational: 2,
    }));
  });

  it('filters staff history by the combined MSO and Nakes operational role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...staff('operator-1', 'Operator One'),
      branch: { id: 'branch-1', branchCode: 'BR1', name: 'Branch 1' },
      staffBranches: [],
    } as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([] as any);
    mockPrisma.treatmentSession.count.mockResolvedValue(0 as any);

    await getStaffSessionHistoryService(
      'operator-1',
      { branchId: 'branch-1', position: 'operational' },
      Role.SUPER_ADMIN,
      null,
    );

    expect(mockPrisma.treatmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { nurseId: 'operator-1' },
            { adminLayananId: 'operator-1' },
            { sessionNurses: { some: { nurseId: 'operator-1' } } },
          ],
        }),
      }),
    );
  });

  it('exports a formatted workbook with active filters and totals', async () => {
    mockPrisma.user.findMany.mockResolvedValue([staff('doctor-1', 'Doctor One')] as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([sessionForDoctor('doctor-1')] as any);

    const result = await exportStaffPerformanceService(
      { branchId: 'branch-1', startDate: '2026-08-01', endDate: '2026-08-07' },
      Role.SUPER_ADMIN,
      null,
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as any);
    const worksheet = workbook.getWorksheet('Kinerja Staff');

    expect(result.filename).toMatch(/^kinerja-staff-\d{8}T\d{4}\.xlsx$/);
    expect(worksheet).toBeDefined();
    expect(worksheet?.getCell('A1').value).toBe('LAPORAN KINERJA STAFF');
    expect(worksheet?.getCell('C3').value).toBe('01/08/2026 - 07/08/2026');
    expect(worksheet?.getCell('A7').value).toBe('Peringkat');
    expect(worksheet?.getCell('C8').value).toBe('Doctor One');
    expect(worksheet?.getCell('H7').value).toBe('Sebagai MSO & Nakes');
    expect(worksheet?.getCell('I8').value).toBe(1);
    expect(worksheet?.getCell('J8').value).toBe(0);
    expect(worksheet?.getCell('I9').value).toEqual(expect.objectContaining({ result: 1 }));
    expect(worksheet?.views[0]).toEqual(expect.objectContaining({ state: 'frozen', ySplit: 7 }));
    expect(worksheet?.autoFilter).toBeDefined();
  });

  it('allows Admin Manager export only for a managed branch', async () => {
    mockPrisma.managerBranch.findMany.mockResolvedValue([{ branchId: 'branch-1' }] as any);
    mockPrisma.user.findMany.mockResolvedValue([staff('doctor-1', 'Doctor One')] as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([] as any);

    const result = await exportStaffPerformanceService(
      { branchId: 'branch-1', startDate: '2026-08-01', endDate: '2026-08-07' },
      Role.ADMIN_MANAGER,
      null,
      'manager-1',
    );

    expect(result.buffer.length).toBeGreaterThan(0);
    expect(mockPrisma.managerBranch.findMany).toHaveBeenCalledWith({
      where: { userId: 'manager-1' },
      select: { branchId: true },
    });
    expect(mockPrisma.treatmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: 'branch-1' }),
      }),
    );
  });

  it('exports complete staff session details including actual fluids and materials', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...staff('doctor-1', 'Doctor One'),
      branch: { id: 'branch-1', branchCode: 'BR1', name: 'Branch 1' },
      staffBranches: [],
    } as any);
    mockPrisma.treatmentSession.count.mockResolvedValue(1 as any);
    mockPrisma.treatmentSession.findMany
      .mockResolvedValueOnce([{
        id: 'session-1',
        sessionCode: 'SES-001',
        infusKe: 2,
        pelaksanaan: 'ON_SITE',
        treatmentDate: new Date('2026-08-08T03:00:00.000Z'),
        isCompleted: true,
        doctorId: 'doctor-1',
        nurseId: 'nurse-1',
        adminLayananId: 'admin-1',
        sessionDoctors: [],
        sessionNurses: [],
        branch: { id: 'branch-1', branchCode: 'BR1', name: 'Branch 1' },
        encounter: {
          member: { memberNo: 'MEM-001', user: { profile: { fullName: 'Member One' } } },
          memberPackage: { packageType: 'BASIC', boosterType: null },
        },
      }] as any)
      .mockResolvedValueOnce([{
        id: 'session-1',
        sessionCode: 'SES-001',
        treatmentDate: new Date('2026-08-08T03:00:00.000Z'),
        isCompleted: true,
        completionStatus: 'COMPLETED',
        completedAt: new Date('2026-08-08T05:00:00.000Z'),
        pelaksanaan: 'ON_SITE',
        infusKe: 2,
        branchInfusKe: 2,
        branch: { id: 'branch-1', branchCode: 'BR1', name: 'Branch 1' },
        encounter: {
          encounterCode: 'ENC-001',
          member: {
            memberNo: 'MEM-001',
            user: { profile: { fullName: 'Member One' } },
          },
          memberPackage: { packageCode: 'PKG-001', packageType: 'BASIC' },
          diagnoses: [{
            diagnosisCode: 'DX-001',
            diagnosa: 'Hipertensi',
            kategoriDiagnosa: 'CARDIOVASCULAR',
            kategoriDiagnosaList: ['CARDIOVASCULAR'],
            icdPrimer: 'I10',
            icdSekunder: null,
            icdTersier: null,
            keluhanRiwayatSekarang: 'Pusing',
            pemeriksaanFisik: 'Keadaan umum baik',
          }],
        },
        adminLayanan: { profile: { fullName: 'Admin One' } },
        doctor: { profile: { fullName: 'Doctor One' } },
        nurse: { profile: { fullName: 'Nurse One' } },
        sessionDoctors: [],
        sessionNurses: [],
        boosterPackage: null,
        boosterType: null,
        therapyPlan: { planCode: 'PLAN-001', keterangan: 'Rencana awal', ifa250: 1, hho: 4 },
        infusion: {
          ifa250: 1,
          hho: 5,
          jenisCairan: 'NaCl 0,9%',
          volumeCarrier: 100,
          bottleType: 'BOTTLE_250',
          jumlahJarum: 1,
          tanggalProduksi: new Date('2026-08-07T00:00:00.000Z'),
          deviationNotes: 'HHO dinaikkan 1 ml',
        },
        vitalSigns: [{
          waktuCatat: 'SEBELUM',
          pencatatan: 'SISTOL',
          value: 125,
          unit: 'mmHg',
          recordedBy: 'nurse-1',
          createdAt: new Date('2026-08-08T02:55:00.000Z'),
        }],
        materials: [{
          inventoryItem: {
            masterProduct: {
              sku: 'MAT-001',
              name: 'Infus Set',
              category: 'MEDICAL_SUPPLY',
              baseUnit: 'Piece',
            },
          },
          quantity: 1,
          unit: 'Piece',
          baseQuantity: 1,
          recommendedQuantity: 1,
          status: 'POSTED',
          deviationReason: null,
          deviationNotes: null,
          recordedBy: 'nurse-1',
          consumedAt: new Date('2026-08-08T05:00:00.000Z'),
        }],
        photo: { fileUrl: 'https://example.com/main.jpg' },
        supportingPhotos: [{ fileUrl: 'https://example.com/support.jpg' }],
        emrNotes: [{ noteType: 'PROGRESS', content: 'Kondisi stabil' }],
        evaluation: {
          keluhan: 'Tidak ada',
          rekomendasi: 'Cukup istirahat',
          subjective: 'Baik',
          objective: 'Stabil',
          assessment: 'Membaik',
          plan: 'Kontrol berikutnya',
          generalNotes: 'Selesai tanpa kendala',
        },
      }] as any);

    const result = await exportStaffPerformanceDetailService(
      'doctor-1',
      { branchId: 'branch-1', position: 'all', startDate: '2026-08-01', endDate: '2026-08-10' },
      Role.SUPER_ADMIN,
      null,
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as any);

    expect(result.filename).toMatch(/^detail-kinerja-DOCTOR-1-\d{8}T\d{4}\.xlsx$/);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Ringkasan',
      'Detail Sesi',
      'Cairan & Dosis',
      'Vital Sign',
      'Material',
      'Klinis & Evaluasi',
    ]);
    expect(workbook.getWorksheet('Detail Sesi')?.getCell('X8').value).toBe('NaCl 0,9%');
    expect(workbook.getWorksheet('Cairan & Dosis')?.getCell('F8').value).toBe('IFA + NO 2,5 ml (250 ml)');
    expect(workbook.getWorksheet('Cairan & Dosis')?.getCell('H9').value).toBe(5);
    expect(workbook.getWorksheet('Material')?.getCell('G8').value).toBe('Infus Set');
    expect(workbook.getWorksheet('Klinis & Evaluasi')?.getCell('F8').value).toBe('Hipertensi');
    expect(workbook.getWorksheet('Cairan & Dosis')?.views[0]).toEqual(
      expect.objectContaining({ state: 'frozen', ySplit: 7 }),
    );
    expect(workbook.getWorksheet('Cairan & Dosis')?.autoFilter).toBeDefined();
  });
});
