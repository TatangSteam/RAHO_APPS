import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { getJakartaMonthRange, resolveBranchScope } from './staff-incentive.service';

type Caller = {
  role: Role;
  userId: string;
  branchId: string | null;
};

type AssignmentInput = {
  doctorHeadUserId: string;
  branchId: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  notes?: string;
};

type BranchAssignmentsInput = Omit<AssignmentInput, 'branchId'> & { branchIds: string[] };

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function assignmentTerminationDate(effectiveFrom: Date, effectiveUntil: Date | null) {
  const jakartaToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const today = dateOnly(jakartaToday);
  const cutoff = effectiveFrom > today
    ? new Date(effectiveFrom.getTime() - 24 * 60 * 60 * 1000)
    : today;
  return effectiveUntil && effectiveUntil < cutoff ? effectiveUntil : cutoff;
}

function assertSuperAdmin(caller: Caller) {
  if (caller.role !== Role.SUPER_ADMIN) {
    throw errors.forbidden('Hanya Super Admin yang dapat mengatur Dokter Head.');
  }
}

const assignmentSelect = {
  id: true,
  doctorHeadUserId: true,
  branchId: true,
  effectiveFrom: true,
  effectiveUntil: true,
  isActive: true,
  notes: true,
  createdAt: true,
  doctorHead: {
    select: { email: true, staffCode: true, role: true, profile: { select: { fullName: true } } },
  },
  branch: { select: { branchCode: true, name: true, type: true } },
} as const;

function validatePeriod(input: Pick<AssignmentInput, 'effectiveFrom' | 'effectiveUntil'>) {
  const effectiveFrom = dateOnly(input.effectiveFrom);
  const effectiveUntil = input.effectiveUntil ? dateOnly(input.effectiveUntil) : null;
  if (effectiveUntil && effectiveUntil < effectiveFrom) {
    throw errors.badRequest('INVALID_ASSIGNMENT_PERIOD', 'Tanggal selesai tidak boleh sebelum tanggal mulai.');
  }
  return { effectiveFrom, effectiveUntil };
}

async function validateDoctorAndBranches(doctorHeadUserId: string, branchIds: string[]) {
  const [doctor, branches] = await Promise.all([
    prisma.user.findFirst({
      where: { id: doctorHeadUserId, isActive: true, role: Role.DOCTOR },
      select: { id: true },
    }),
    prisma.branch.findMany({
      where: { id: { in: branchIds }, isActive: true },
      select: { id: true },
    }),
  ]);
  if (!doctor) throw errors.badRequest('INVALID_DOCTOR_HEAD', 'Dokter Head harus merupakan akun Dokter aktif.');
  if (branches.length !== branchIds.length) {
    throw errors.badRequest('INVALID_DOCTOR_HEAD_BRANCH', 'Satu atau beberapa cabang tidak ditemukan atau tidak aktif.');
  }
}

export async function listDoctorHeadAssignmentsService(
  query: { month?: string; branchId?: string },
  caller: Caller,
) {
  const period = getJakartaMonthRange(query.month);
  const branchIds = await resolveBranchScope(caller.role, caller.userId, caller.branchId, query.branchId);
  return prisma.doctorHeadAssignment.findMany({
    where: {
      effectiveFrom: { lt: period.end },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: period.start } }],
      ...(branchIds ? { branchId: { in: branchIds } } : {}),
      ...(caller.role === Role.DOCTOR ? { doctorHeadUserId: caller.userId } : {}),
    },
    select: assignmentSelect,
    orderBy: [{ doctorHead: { email: 'asc' } }, { branch: { name: 'asc' } }, { effectiveFrom: 'desc' }],
  });
}

export async function getDoctorHeadAssignmentOptionsService(caller: Caller) {
  assertSuperAdmin(caller);
  const [doctors, branches] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: Role.DOCTOR },
      select: { id: true, email: true, staffCode: true, role: true, profile: { select: { fullName: true } } },
      orderBy: { email: 'asc' },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, branchCode: true, name: true, type: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return {
    doctors: doctors.map((doctor) => ({
      id: doctor.id,
      fullName: doctor.profile?.fullName || doctor.email,
      email: doctor.email,
      staffCode: doctor.staffCode,
      role: doctor.role,
    })),
    branches,
  };
}

export async function createDoctorHeadBranchAssignmentsService(input: BranchAssignmentsInput, caller: Caller) {
  assertSuperAdmin(caller);
  const branchIds = [...new Set(input.branchIds)];
  if (branchIds.length === 0) throw errors.badRequest('BRANCH_REQUIRED', 'Minimal satu cabang wajib dipilih.');
  const { effectiveFrom, effectiveUntil } = validatePeriod(input);
  await validateDoctorAndBranches(input.doctorHeadUserId, branchIds);

  const overlaps = await prisma.doctorHeadAssignment.findMany({
    where: {
      branchId: { in: branchIds },
      effectiveFrom: effectiveUntil ? { lte: effectiveUntil } : undefined,
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: effectiveFrom } }],
    },
    select: { branch: { select: { name: true } } },
  });
  if (overlaps.length > 0) {
    throw errors.conflict(
      'DOCTOR_HEAD_ASSIGNMENT_OVERLAP',
      `Cabang berikut sudah memiliki Dokter Head pada periode yang beririsan: ${overlaps.map((row) => row.branch.name).join(', ')}.`,
    );
  }

  return prisma.$transaction(branchIds.map((branchId) => prisma.doctorHeadAssignment.create({
    data: {
      doctorHeadUserId: input.doctorHeadUserId,
      branchId,
      effectiveFrom,
      effectiveUntil,
      notes: input.notes?.trim() || null,
      createdBy: caller.userId,
    },
    select: assignmentSelect,
  })));
}

export async function updateDoctorHeadAssignmentService(
  assignmentId: string,
  input: AssignmentInput,
  caller: Caller,
) {
  assertSuperAdmin(caller);
  const existing = await prisma.doctorHeadAssignment.findUnique({
    where: { id: assignmentId }, select: { id: true, isActive: true },
  });
  if (!existing) throw errors.notFound('Assignment Dokter Head tidak ditemukan.');
  if (!existing.isActive) {
    throw errors.badRequest('INACTIVE_DOCTOR_HEAD_ASSIGNMENT', 'Assignment yang sudah dinonaktifkan tidak dapat diedit.');
  }
  const { effectiveFrom, effectiveUntil } = validatePeriod(input);
  await validateDoctorAndBranches(input.doctorHeadUserId, [input.branchId]);
  const overlap = await prisma.doctorHeadAssignment.findFirst({
    where: {
      id: { not: assignmentId },
      branchId: input.branchId,
      effectiveFrom: effectiveUntil ? { lte: effectiveUntil } : undefined,
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: effectiveFrom } }],
    },
    select: { id: true },
  });
  if (overlap) {
    throw errors.conflict('DOCTOR_HEAD_ASSIGNMENT_OVERLAP', 'Cabang ini sudah memiliki Dokter Head pada periode yang beririsan.');
  }
  return prisma.doctorHeadAssignment.update({
    where: { id: assignmentId },
    data: {
      doctorHeadUserId: input.doctorHeadUserId,
      branchId: input.branchId,
      effectiveFrom,
      effectiveUntil,
      notes: input.notes?.trim() || null,
    },
    select: assignmentSelect,
  });
}

export async function deleteDoctorHeadAssignmentService(assignmentId: string, caller: Caller) {
  assertSuperAdmin(caller);
  const assignment = await prisma.doctorHeadAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, effectiveFrom: true, effectiveUntil: true, isActive: true },
  });
  if (!assignment) throw errors.notFound('Assignment Dokter Head tidak ditemukan.');
  if (!assignment.isActive) return { id: assignment.id, deactivated: true };

  await prisma.doctorHeadAssignment.update({
    where: { id: assignment.id },
    data: {
      isActive: false,
      effectiveUntil: assignmentTerminationDate(assignment.effectiveFrom, assignment.effectiveUntil),
    },
  });
  return { id: assignment.id, deactivated: true };
}
