import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { updateChsCoordinatorAssignmentService } from '../chs-coordinator-assignment.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    chsCoordinatorAssignment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: { findFirst: jest.fn() },
    branch: { findUnique: jest.fn() },
    homecareTeam: { findUnique: jest.fn() },
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
    mockPrisma.chsCoordinatorAssignment.update.mockResolvedValue({ id: 'assignment-1' });
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
