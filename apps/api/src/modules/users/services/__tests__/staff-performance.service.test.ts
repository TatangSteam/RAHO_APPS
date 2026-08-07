import { Role } from '@prisma/client';
import ExcelJS from 'exceljs';
import { prisma } from '../../../../lib/prisma';
import {
  getStaffPerformanceSummaryService,
  getStaffSessionHistoryService,
} from '../staff-performance.service';
import { exportStaffPerformanceService } from '../staff-performance-export.service';

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

function sessionForDoctor(doctorId: string) {
  return {
    doctorId,
    nurseId: 'nurse-1',
    adminLayananId: 'admin-1',
    sessionDoctors: [],
    sessionNurses: [],
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
    expect(mockPrisma.treatmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          isCompleted: true,
        }),
      }),
    );
  });

  it('filters performance counts by infusion number', async () => {
    mockPrisma.user.findMany.mockResolvedValue([staff('doctor-1', 'Doctor One')] as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([] as any);

    await getStaffPerformanceSummaryService(
      { branchId: 'branch-1', infusKe: 4 },
      Role.SUPER_ADMIN,
      null,
    );

    expect(mockPrisma.treatmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 'branch-1',
          infusKe: 4,
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

  it('applies the infusion number filter to history and summary counts', async () => {
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
      { branchId: 'branch-1', infusKe: 2 },
      Role.SUPER_ADMIN,
      null,
    );

    expect(mockPrisma.treatmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ infusKe: 2 }),
      }),
    );
    mockPrisma.treatmentSession.count.mock.calls.forEach(([input]: [{ where: Record<string, unknown> }]) => {
      expect(input.where).toEqual(expect.objectContaining({ infusKe: 2 }));
    });
  });

  it('exports a formatted workbook with active filters and totals', async () => {
    mockPrisma.user.findMany.mockResolvedValue([staff('doctor-1', 'Doctor One')] as any);
    mockPrisma.treatmentSession.findMany.mockResolvedValue([sessionForDoctor('doctor-1')] as any);

    const result = await exportStaffPerformanceService(
      { branchId: 'branch-1', startDate: '2026-08-01', endDate: '2026-08-07', infusKe: 3 },
      Role.SUPER_ADMIN,
      null,
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as any);
    const worksheet = workbook.getWorksheet('Kinerja Staff');

    expect(result.filename).toMatch(/^kinerja-staff-\d{8}T\d{4}\.xlsx$/);
    expect(worksheet).toBeDefined();
    expect(worksheet?.getCell('A1').value).toBe('LAPORAN KINERJA STAFF');
    expect(worksheet?.getCell('C4').value).toBe('Infus ke-3');
    expect(worksheet?.getCell('A8').value).toBe('Peringkat');
    expect(worksheet?.getCell('C9').value).toBe('Doctor One');
    expect(worksheet?.getCell('J9').value).toBe(1);
    expect(worksheet?.getCell('J10').value).toEqual(expect.objectContaining({ result: 1 }));
    expect(worksheet?.views[0]).toEqual(expect.objectContaining({ state: 'frozen', ySplit: 8 }));
    expect(worksheet?.autoFilter).toBeDefined();
  });
});
