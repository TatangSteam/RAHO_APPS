import { AuditAction, PackageType, Role } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';

export const EMPLOYEE_MEMBER_ROLES: Role[] = [
  Role.NURSE,
  Role.DOCTOR,
  Role.ADMIN_LAYANAN,
  Role.ADMIN_MANAGER,
  Role.SUPER_ADMIN,
];

export async function getEmployeeMemberEnrollmentOptions() {
  const [staff, branches] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: EMPLOYEE_MEMBER_ROLES }, isActive: true, member: null },
      orderBy: [{ profile: { fullName: 'asc' } }, { email: 'asc' }],
      select: {
        id: true,
        email: true,
        role: true,
        staffCode: true,
        branchId: true,
        profile: { select: { fullName: true, phone: true } },
      },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, branchCode: true, name: true },
    }),
  ]);
  return { staff, branches };
}

export async function enrollEmployeeAsMember(
  staffUserId: string,
  registrationBranchId: string,
  actorUserId: string,
) {
  const [staff, branch] = await Promise.all([
    prisma.user.findUnique({
      where: { id: staffUserId },
      include: { member: true, profile: true },
    }),
    prisma.branch.findFirst({ where: { id: registrationBranchId, isActive: true } }),
  ]);
  if (!staff || !staff.isActive || !EMPLOYEE_MEMBER_ROLES.includes(staff.role)) {
    throw { status: 422, code: 'INVALID_EMPLOYEE_ROLE', message: 'Akun bukan karyawan yang dapat didaftarkan.' };
  }
  if (staff.member) {
    throw { status: 409, code: 'EMPLOYEE_MEMBER_EXISTS', message: 'Karyawan ini sudah terdaftar sebagai member.' };
  }
  if (!branch) throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang pendaftaran tidak ditemukan.' };

  const identifier = (staff.staffCode || staff.id.slice(-8)).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const memberNo = `EMP-${identifier}`;
  const member = await prisma.member.create({
    data: {
      userId: staff.id,
      memberNo,
      registrationBranchId,
      isEmployee: true,
      employeeTreatmentType: PackageType.BASIC,
      pekerjaan: 'Karyawan RAHO',
      isConsentToPhoto: false,
    },
    include: { user: { include: { profile: true } }, registrationBranch: true },
  });

  await logAudit({
    userId: actorUserId,
    branchId: registrationBranchId,
    action: AuditAction.CREATE,
    resource: 'EmployeeMember',
    resourceId: member.id,
    afterData: {
      staffUserId,
      memberNo,
      employeeRole: staff.role,
      treatmentType: PackageType.BASIC,
      paymentMode: 'FREE',
    },
  });
  return {
    memberId: member.id,
    memberNo,
    fullName: member.user.profile?.fullName || member.user.email,
    isEmployee: true,
    employeeTreatmentType: PackageType.BASIC,
    message: 'Karyawan berhasil diaktifkan sebagai member gratis. Buat Therapy Plan sebelum sesi pertama.',
  };
}
