import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { listUsersService } from '../users.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    treatmentSession: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@utils/codeGenerator', () => ({
  generateStaffCode: jest.fn(),
}));

jest.mock('@modules/iam/authorization.service', () => ({
  assertBranchAccess: jest.fn(),
  assertCanAssignBaseRole: jest.fn(),
  assertNotSelf: jest.fn(),
  assertTargetInActorScope: jest.fn(),
  getAccessibleBranchIds: jest.fn(),
}));

const prismaMock = prisma as any;
const getAccessibleBranchIdsMock = getAccessibleBranchIds as jest.MockedFunction<typeof getAccessibleBranchIds>;

function user(id: string, role: Role) {
  return {
    id,
    email: `${id}@example.test`,
    role,
    staffCode: id,
    branchId: 'branch-1',
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: { fullName: id, phone: null, avatarUrl: null },
    branch: { id: 'branch-1', branchCode: 'BR1', name: 'Branch 1' },
  };
}

describe('branch staff therapy performance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAccessibleBranchIdsMock.mockResolvedValue(null);
    prismaMock.user.count.mockResolvedValue(4);
    prismaMock.user.findMany.mockResolvedValue([
      user('doctor-primary', Role.DOCTOR),
      user('doctor-additional', Role.DOCTOR),
      user('nurse-1', Role.NURSE),
      user('admin-1', Role.ADMIN_LAYANAN),
    ]);
    prismaMock.treatmentSession.findMany.mockResolvedValue([{
      doctorId: 'doctor-primary',
      nurseId: 'nurse-1',
      adminLayananId: 'admin-1',
      // Primary staff are also present in junction rows. They must still count once.
      sessionDoctors: [
        { doctorId: 'doctor-primary' },
        { doctorId: 'doctor-additional' },
      ],
      sessionNurses: [{ nurseId: 'nurse-1' }],
    }]);
  });

  it('counts completed sessions in the selected branch including additional staff', async () => {
    const result = await listUsersService(
      { page: 1, limit: 100, branchId: 'branch-1' },
      Role.SUPER_ADMIN,
      null,
      'actor-1',
    );

    expect(prismaMock.treatmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 'branch-1',
          isCompleted: true,
          OR: expect.arrayContaining([
            { sessionDoctors: { some: { doctorId: { in: expect.any(Array) } } } },
            { sessionNurses: { some: { nurseId: { in: expect.any(Array) } } } },
          ]),
        }),
      }),
    );

    expect(result.users).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'doctor-primary', therapyCountAsDoctor: 1, therapyCount: 1 }),
      expect.objectContaining({ id: 'doctor-additional', therapyCountAsDoctor: 1, therapyCount: 1 }),
      expect.objectContaining({ id: 'nurse-1', therapyCountAsNurse: 1, therapyCount: 1 }),
      expect.objectContaining({ id: 'admin-1', therapyCountAsAdminLayanan: 1, therapyCount: 1 }),
    ]));
  });
});
