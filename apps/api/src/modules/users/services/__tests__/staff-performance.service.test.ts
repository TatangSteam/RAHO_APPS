import { Role } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import {
  getStaffPerformanceSummaryService,
  getStaffSessionHistoryService,
} from '../staff-performance.service';

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
});
