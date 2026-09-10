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

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function todayInJakarta() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return dateOnly(`${part('year')}-${part('month')}-${part('day')}`);
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
  homecareTeam: { select: { teamCode: true, name: true } },
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

export async function getChsCoordinatorAssignmentOptionsService(branchId: string, caller: Caller) {
  await assertManageAccess(caller, branchId);
  const [staff, teams] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [Role.ADMIN_CABANG, Role.ADMIN_LAYANAN, Role.DOCTOR, Role.NURSE] },
        OR: [{ branchId }, { staffBranches: { some: { branchId } } }],
      },
      select: { id: true, email: true, staffCode: true, role: true, profile: { select: { fullName: true } } },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    }),
    prisma.homecareTeam.findMany({
      where: { branchId, isActive: true },
      select: { id: true, teamCode: true, name: true },
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
  };
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
        OR: [{ branchId: input.branchId }, { staffBranches: { some: { branchId: input.branchId } } }],
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
      scope: input.scope,
      branchId: input.branchId,
      homecareTeamId: input.scope === 'TEAM' ? input.homecareTeamId : null,
      effectiveFrom: effectiveUntil ? { lte: effectiveUntil } : undefined,
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: effectiveFrom } }],
    },
    select: { id: true },
  });
  if (overlap) {
    throw errors.conflict('CHS_ASSIGNMENT_OVERLAP', 'Scope ini sudah memiliki Koordinator CHS pada periode yang beririsan.');
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
        OR: [{ branchId: input.branchId }, { staffBranches: { some: { branchId: input.branchId } } }],
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
  if (!coordinator) throw errors.badRequest('INVALID_CHS_COORDINATOR', 'Koordinator harus merupakan akun internal aktif pada cabang yang dipilih.');
  if (!branch?.isActive) throw errors.badRequest('INVALID_CHS_BRANCH', 'Cabang tidak ditemukan atau tidak aktif.');
  if (input.scope === 'TEAM' && (!team?.isActive || team.branchId !== input.branchId)) {
    throw errors.badRequest('INVALID_HOMECARE_TEAM', 'Tim Homecare harus aktif dan berada di cabang yang dipilih.');
  }

  const overlap = await prisma.chsCoordinatorAssignment.findFirst({
    where: {
      id: { not: assignmentId },
      scope: input.scope,
      branchId: input.branchId,
      homecareTeamId: input.scope === 'TEAM' ? input.homecareTeamId : null,
      effectiveFrom: effectiveUntil ? { lte: effectiveUntil } : undefined,
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: effectiveFrom } }],
    },
    select: { id: true },
  });
  if (overlap) {
    throw errors.conflict('CHS_ASSIGNMENT_OVERLAP', 'Scope ini sudah memiliki Koordinator CHS pada periode yang beririsan.');
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

export async function deactivateChsCoordinatorAssignmentService(assignmentId: string, caller: Caller) {
  const assignment = await prisma.chsCoordinatorAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, branchId: true, effectiveFrom: true, effectiveUntil: true },
  });
  if (!assignment) throw errors.notFound('Assignment Koordinator CHS tidak ditemukan.');
  await assertManageAccess(caller, assignment.branchId);

  const today = todayInJakarta();
  if (assignment.effectiveFrom > today) {
    await prisma.chsCoordinatorAssignment.delete({ where: { id: assignment.id } });
    return { id: assignment.id, deleted: true };
  }
  return prisma.chsCoordinatorAssignment.update({
    where: { id: assignment.id },
    data: {
      isActive: false,
      effectiveUntil: assignment.effectiveUntil && assignment.effectiveUntil < today
        ? assignment.effectiveUntil
        : today,
    },
    select: assignmentSelect,
  });
}
