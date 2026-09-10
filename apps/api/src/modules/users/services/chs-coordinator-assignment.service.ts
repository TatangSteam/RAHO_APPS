import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { getJakartaMonthRange, resolveBranchScope } from './staff-incentive.service';

const MANAGER_ROLES = new Set<Role>([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG]);

type Caller = {
  role: Role;
  userId: string;
  branchId: string | null;
};

type AssignmentInput = {
  scope: 'TEAM' | 'BRANCH';
  coordinatorUserId: string;
  branchId: string;
  homecareTeamId?: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  notes?: string;
};

type BranchAssignmentsInput = {
  coordinatorUserId: string;
  branchIds: string[];
  effectiveFrom: string;
  effectiveUntil?: string;
  notes?: string;
};

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function assertManageAccess(caller: Caller, branchId: string) {
  if (!MANAGER_ROLES.has(caller.role)) {
    throw errors.forbidden('Hanya administrator yang dapat mengatur Koordinator CHS.');
  }
  const branchIds = await resolveBranchScope(caller.role, caller.userId, caller.branchId, branchId);
  if (!branchIds?.includes(branchId)) throw errors.forbidden('Anda tidak memiliki akses ke cabang ini.');
}

const assignmentSelect = {
  id: true,
  scope: true,
  coordinatorUserId: true,
  branchId: true,
  homecareTeamId: true,
  effectiveFrom: true,
  effectiveUntil: true,
  isActive: true,
  notes: true,
  createdAt: true,
  coordinator: {
    select: { email: true, staffCode: true, role: true, profile: { select: { fullName: true } } },
  },
  branch: { select: { branchCode: true, name: true } },
  homecareTeam: { select: { teamCode: true, name: true, incentiveType: true } },
} as const;

export async function listChsCoordinatorAssignmentsService(
  query: { month?: string; branchId?: string },
  caller: Caller,
) {
  const period = getJakartaMonthRange(query.month);
  const branchIds = await resolveBranchScope(caller.role, caller.userId, caller.branchId, query.branchId);
  const selfOnly = caller.role === Role.NURSE || caller.role === Role.DOCTOR || caller.role === Role.ADMIN_LAYANAN;
  return prisma.chsCoordinatorAssignment.findMany({
    where: {
      effectiveFrom: { lt: period.end },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: period.start } }],
      ...(branchIds ? { branchId: { in: branchIds } } : {}),
      ...(selfOnly ? { coordinatorUserId: caller.userId } : {}),
    },
    select: assignmentSelect,
    orderBy: [{ branch: { name: 'asc' } }, { effectiveFrom: 'desc' }],
  });
}

export async function getChsCoordinatorAssignmentOptionsService(branchId: string | undefined, caller: Caller) {
  const branchIds = await resolveBranchScope(caller.role, caller.userId, caller.branchId, branchId);
  const [staff, teams, branches] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [Role.ADMIN_CABANG, Role.ADMIN_LAYANAN, Role.DOCTOR, Role.NURSE] },
        ...(branchIds ? {
          OR: [
            { branchId: { in: branchIds } },
            { staffBranches: { some: { branchId: { in: branchIds } } } },
          ],
        } : {}),
      },
      select: { id: true, email: true, staffCode: true, role: true, profile: { select: { fullName: true } } },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    }),
    prisma.homecareTeam.findMany({
      where: { isActive: true, ...(branchIds ? { branchId: { in: branchIds } } : {}) },
      select: { id: true, teamCode: true, name: true, branchId: true, incentiveType: true },
      orderBy: { name: 'asc' },
    }),
    prisma.branch.findMany({
      where: { isActive: true, ...(branchIds ? { id: { in: branchIds } } : {}) },
      select: { id: true, branchCode: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return {
    staff: staff.map((user) => ({
      id: user.id,
      fullName: user.profile?.fullName || user.email,
      email: user.email,
      staffCode: user.staffCode,
      role: user.role,
    })),
    teams,
    branches,
  };
}

export async function createChsCoordinatorBranchAssignmentsService(
  input: BranchAssignmentsInput,
  caller: Caller,
) {
  const branchIds = [...new Set(input.branchIds)];
  if (branchIds.length === 0) {
    throw errors.badRequest('BRANCH_REQUIRED', 'Minimal satu cabang wajib dipilih.');
  }
  await Promise.all(branchIds.map((branchId) => assertManageAccess(caller, branchId)));

  const effectiveFrom = dateOnly(input.effectiveFrom);
  const effectiveUntil = input.effectiveUntil ? dateOnly(input.effectiveUntil) : null;
  if (effectiveUntil && effectiveUntil < effectiveFrom) {
    throw errors.badRequest('INVALID_ASSIGNMENT_PERIOD', 'Tanggal selesai tidak boleh sebelum tanggal mulai.');
  }

  const [coordinator, branches, overlaps] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: input.coordinatorUserId,
        isActive: true,
        role: { in: [Role.ADMIN_CABANG, Role.ADMIN_LAYANAN, Role.DOCTOR, Role.NURSE] },
      },
      select: { id: true },
    }),
    prisma.branch.findMany({
      where: { id: { in: branchIds }, isActive: true },
      select: { id: true },
    }),
    prisma.chsCoordinatorAssignment.findMany({
      where: {
        coordinatorUserId: input.coordinatorUserId,
        scope: 'BRANCH',
        branchId: { in: branchIds },
        homecareTeamId: null,
        effectiveFrom: effectiveUntil ? { lte: effectiveUntil } : undefined,
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: effectiveFrom } }],
      },
      select: { branchId: true, branch: { select: { name: true } } },
    }),
  ]);

  if (!coordinator) throw errors.badRequest('INVALID_CHS_COORDINATOR', 'Koordinator harus merupakan akun internal aktif.');
  if (branches.length !== branchIds.length) {
    throw errors.badRequest('INVALID_CHS_BRANCH', 'Satu atau beberapa cabang tidak ditemukan atau tidak aktif.');
  }
  if (overlaps.length > 0) {
    const names = overlaps.map((overlap) => overlap.branch.name).join(', ');
    throw errors.conflict(
      'CHS_ASSIGNMENT_OVERLAP',
      `Koordinator tersebut sudah menangani cabang berikut pada periode yang beririsan: ${names}.`,
    );
  }

  return prisma.$transaction(branchIds.map((branchId) => prisma.chsCoordinatorAssignment.create({
    data: {
      scope: 'BRANCH',
      coordinatorUserId: input.coordinatorUserId,
      branchId,
      homecareTeamId: null,
      effectiveFrom,
      effectiveUntil,
      notes: input.notes?.trim() || null,
      createdBy: caller.userId,
    },
    select: assignmentSelect,
  })));
}

export async function createChsCoordinatorAssignmentService(input: AssignmentInput, caller: Caller) {
  await assertManageAccess(caller, input.branchId);
  const effectiveFrom = dateOnly(input.effectiveFrom);
  const effectiveUntil = input.effectiveUntil ? dateOnly(input.effectiveUntil) : null;
  if (effectiveUntil && effectiveUntil < effectiveFrom) {
    throw errors.badRequest('INVALID_ASSIGNMENT_PERIOD', 'Tanggal selesai tidak boleh sebelum tanggal mulai.');
  }

  const [coordinator, branch, team] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: input.coordinatorUserId,
        isActive: true,
        role: { in: [Role.ADMIN_CABANG, Role.ADMIN_LAYANAN, Role.DOCTOR, Role.NURSE] },
      },
      select: { id: true },
    }),
    prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true, isActive: true } }),
    input.scope === 'TEAM' && input.homecareTeamId
      ? prisma.homecareTeam.findUnique({
          where: { id: input.homecareTeamId },
          select: { id: true, branchId: true, isActive: true },
        })
      : Promise.resolve(null),
  ]);
  if (!coordinator) throw errors.badRequest('INVALID_CHS_COORDINATOR', 'Koordinator harus merupakan akun internal aktif.');
  if (!branch?.isActive) throw errors.badRequest('INVALID_CHS_BRANCH', 'Cabang tidak ditemukan atau tidak aktif.');
  if (input.scope === 'TEAM' && (!team?.isActive || team.branchId !== input.branchId)) {
    throw errors.badRequest('INVALID_HOMECARE_TEAM', 'Tim Homecare harus aktif dan berada di cabang yang dipilih.');
  }

  const overlap = await prisma.chsCoordinatorAssignment.findFirst({
    where: {
      coordinatorUserId: input.coordinatorUserId,
      scope: input.scope,
      branchId: input.branchId,
      homecareTeamId: input.scope === 'TEAM' ? input.homecareTeamId : null,
      effectiveFrom: effectiveUntil ? { lte: effectiveUntil } : undefined,
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: effectiveFrom } }],
    },
    select: { id: true },
  });
  if (overlap) {
    throw errors.conflict('CHS_ASSIGNMENT_OVERLAP', 'Koordinator tersebut sudah memiliki scope ini pada periode yang beririsan.');
  }

  return prisma.chsCoordinatorAssignment.create({
    data: {
      scope: input.scope,
      coordinatorUserId: input.coordinatorUserId,
      branchId: input.branchId,
      homecareTeamId: input.scope === 'TEAM' ? input.homecareTeamId : null,
      effectiveFrom,
      effectiveUntil,
      notes: input.notes?.trim() || null,
      createdBy: caller.userId,
    },
    select: assignmentSelect,
  });
}

export async function updateChsCoordinatorAssignmentService(
  assignmentId: string,
  input: AssignmentInput,
  caller: Caller,
) {
  const existingAssignment = await prisma.chsCoordinatorAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, branchId: true, isActive: true },
  });
  if (!existingAssignment) throw errors.notFound('Assignment Koordinator CHS tidak ditemukan.');
  if (!existingAssignment.isActive) {
    throw errors.badRequest('INACTIVE_CHS_ASSIGNMENT', 'Assignment yang sudah dinonaktifkan tidak dapat diedit.');
  }

  await assertManageAccess(caller, existingAssignment.branchId);
  if (input.branchId !== existingAssignment.branchId) {
    await assertManageAccess(caller, input.branchId);
  }

  const effectiveFrom = dateOnly(input.effectiveFrom);
  const effectiveUntil = input.effectiveUntil ? dateOnly(input.effectiveUntil) : null;
  if (effectiveUntil && effectiveUntil < effectiveFrom) {
    throw errors.badRequest('INVALID_ASSIGNMENT_PERIOD', 'Tanggal selesai tidak boleh sebelum tanggal mulai.');
  }

  const [coordinator, branch, team] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: input.coordinatorUserId,
        isActive: true,
        role: { in: [Role.ADMIN_CABANG, Role.ADMIN_LAYANAN, Role.DOCTOR, Role.NURSE] },
      },
      select: { id: true },
    }),
    prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true, isActive: true } }),
    input.scope === 'TEAM' && input.homecareTeamId
      ? prisma.homecareTeam.findUnique({
          where: { id: input.homecareTeamId },
          select: { id: true, branchId: true, isActive: true },
        })
      : Promise.resolve(null),
  ]);
  if (!coordinator) throw errors.badRequest('INVALID_CHS_COORDINATOR', 'Koordinator harus merupakan akun internal aktif.');
  if (!branch?.isActive) throw errors.badRequest('INVALID_CHS_BRANCH', 'Cabang tidak ditemukan atau tidak aktif.');
  if (input.scope === 'TEAM' && (!team?.isActive || team.branchId !== input.branchId)) {
    throw errors.badRequest('INVALID_HOMECARE_TEAM', 'Tim Homecare harus aktif dan berada di cabang yang dipilih.');
  }

  const overlap = await prisma.chsCoordinatorAssignment.findFirst({
    where: {
      id: { not: assignmentId },
      coordinatorUserId: input.coordinatorUserId,
      scope: input.scope,
      branchId: input.branchId,
      homecareTeamId: input.scope === 'TEAM' ? input.homecareTeamId : null,
      effectiveFrom: effectiveUntil ? { lte: effectiveUntil } : undefined,
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: effectiveFrom } }],
    },
    select: { id: true },
  });
  if (overlap) {
    throw errors.conflict('CHS_ASSIGNMENT_OVERLAP', 'Koordinator tersebut sudah memiliki scope ini pada periode yang beririsan.');
  }

  return prisma.chsCoordinatorAssignment.update({
    where: { id: assignmentId },
    data: {
      scope: input.scope,
      coordinatorUserId: input.coordinatorUserId,
      branchId: input.branchId,
      homecareTeamId: input.scope === 'TEAM' ? input.homecareTeamId : null,
      effectiveFrom,
      effectiveUntil,
      notes: input.notes?.trim() || null,
    },
    select: assignmentSelect,
  });
}

export async function deleteChsCoordinatorAssignmentService(assignmentId: string, caller: Caller) {
  const assignment = await prisma.chsCoordinatorAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, branchId: true },
  });
  if (!assignment) throw errors.notFound('Assignment Koordinator CHS tidak ditemukan.');
  await assertManageAccess(caller, assignment.branchId);
  await prisma.chsCoordinatorAssignment.delete({ where: { id: assignment.id } });
  return { id: assignment.id, deleted: true };
}
