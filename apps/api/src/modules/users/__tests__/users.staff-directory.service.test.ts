import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { getStaffByRoleService } from '../users.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    user: {
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

describe('getStaffByRoleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns doctors and acting branch admins only from the requested accessible branch', async () => {
    getAccessibleBranchIdsMock.mockResolvedValue(['branch-1', 'branch-2']);
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'doctor-1',
        staffCode: 'DOC-001',
        role: Role.DOCTOR,
        profile: { fullName: 'Dokter Satu' },
      },
      {
        id: 'admin-1',
        staffCode: 'ADM-001',
        role: Role.ADMIN_CABANG,
        profile: { fullName: 'Admin Satu' },
      },
    ]);

    const result = await getStaffByRoleService(Role.DOCTOR, 'branch-2', 'actor-1');

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        role: { in: [Role.DOCTOR, Role.ADMIN_CABANG] },
        isActive: true,
        OR: [
          { branchId: { in: ['branch-2'] } },
          { staffBranches: { some: { branchId: { in: ['branch-2'] } } } },
        ],
      },
    }));
    expect(result).toEqual([
      {
        userId: 'doctor-1',
        staffCode: 'DOC-001',
        fullName: 'Dokter Satu',
        role: Role.DOCTOR,
      },
      {
        userId: 'admin-1',
        staffCode: 'ADM-001',
        fullName: 'Admin Satu (Admin Cabang)',
        role: Role.ADMIN_CABANG,
      },
    ]);
  });

  it('rejects a requested branch outside the actor branch scope', async () => {
    getAccessibleBranchIdsMock.mockResolvedValue(['branch-1']);

    await expect(
      getStaffByRoleService(Role.DOCTOR, 'branch-2', 'actor-1'),
    ).rejects.toMatchObject({ status: 403 });

    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('uses all accessible branches when no branch is requested', async () => {
    getAccessibleBranchIdsMock.mockResolvedValue(['branch-1', 'branch-2']);
    prismaMock.user.findMany.mockResolvedValue([]);

    await getStaffByRoleService(Role.NURSE, undefined, 'actor-1');

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { branchId: { in: ['branch-1', 'branch-2'] } },
          { staffBranches: { some: { branchId: { in: ['branch-1', 'branch-2'] } } } },
        ],
      }),
    }));
  });
});
