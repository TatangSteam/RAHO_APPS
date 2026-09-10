import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import {
  createChsCoordinatorBranchAssignmentsService,
  updateChsCoordinatorAssignmentService,
} from '../chs-coordinator-assignment.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    chsCoordinatorAssignment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: { findFirst: jest.fn() },
    branch: { findUnique: jest.fn(), findMany: jest.fn() },
    homecareTeam: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@modules/iam/authorization.service', () => ({
  getAccessibleBranchIds: jest.fn(),
}));

const mockPrisma = prisma as any;
const caller = { role: Role.SUPER_ADMIN, userId: 'super-admin', branchId: null };

describe('CHS coordinator assignment update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.chsCoordinatorAssignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      branchId: 'branch-1',
      isActive: true,
    });
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'coordinator-1' });
    mockPrisma.branch.findUnique.mockResolvedValue({ id: 'branch-1', isActive: true });
    mockPrisma.homecareTeam.findUnique.mockResolvedValue({
      id: 'team-1',
      branchId: 'branch-1',
      isActive: true,
    });
    mockPrisma.chsCoordinatorAssignment.findFirst.mockResolvedValue(null);
    mockPrisma.chsCoordinatorAssignment.findMany.mockResolvedValue([]);
    mockPrisma.chsCoordinatorAssignment.create.mockImplementation(({ data }: { data: { branchId: string } }) => (
      Promise.resolve({ id: `assignment-${data.branchId}`, ...data })
    ));
    mockPrisma.chsCoordinatorAssignment.update.mockResolvedValue({ id: 'assignment-1' });
    mockPrisma.branch.findMany.mockResolvedValue([{ id: 'branch-1' }, { id: 'branch-2' }]);
    mockPrisma.$transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations));
  });

  it('atomically assigns one coordinator to multiple branches', async () => {
    const result = await createChsCoordinatorBranchAssignmentsService({
      coordinatorUserId: 'coordinator-1',
      branchIds: ['branch-1', 'branch-2'],
      effectiveFrom: '2026-09-01',
      notes: 'Koordinator dua cabang',
    }, caller);

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'coordinator-1', isActive: true }),
    }));
    expect(mockPrisma.chsCoordinatorAssignment.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
  });

  it('rejects all selected branches when one branch has an overlapping coordinator', async () => {
    mockPrisma.chsCoordinatorAssignment.findMany.mockResolvedValue([
      { branchId: 'branch-2', branch: { name: 'Cabang Bandung' } },
    ]);

    await expect(createChsCoordinatorBranchAssignmentsService({
      coordinatorUserId: 'coordinator-1',
      branchIds: ['branch-1', 'branch-2'],
      effectiveFrom: '2026-09-01',
    }, caller)).rejects.toMatchObject({ code: 'CHS_ASSIGNMENT_OVERLAP' });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates coordinator, scope, dates, and notes while excluding itself from overlap checks', async () => {
    await updateChsCoordinatorAssignmentService('assignment-1', {
      scope: 'TEAM',
      coordinatorUserId: 'coordinator-1',
      branchId: 'branch-1',
      homecareTeamId: 'team-1',
      effectiveFrom: '2026-09-01',
      effectiveUntil: '2026-09-30',
      notes: 'Koordinator September',
    }, caller);

    expect(mockPrisma.chsCoordinatorAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: 'assignment-1' } }),
      }),
    );
    expect(mockPrisma.chsCoordinatorAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'assignment-1' },
        data: expect.objectContaining({
          coordinatorUserId: 'coordinator-1',
          branchId: 'branch-1',
          homecareTeamId: 'team-1',
          notes: 'Koordinator September',
        }),
      }),
    );
  });

  it('rejects edits to an inactive historical assignment', async () => {
    mockPrisma.chsCoordinatorAssignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      branchId: 'branch-1',
      isActive: false,
    });

    await expect(updateChsCoordinatorAssignmentService('assignment-1', {
      scope: 'BRANCH',
      coordinatorUserId: 'coordinator-1',
      branchId: 'branch-1',
      effectiveFrom: '2026-09-01',
    }, caller)).rejects.toMatchObject({ code: 'INACTIVE_CHS_ASSIGNMENT' });
  });
});
