import { HomecareTeamMemberRole, Role } from '@prisma/client';

export type ActiveHomecareMember = {
  role: HomecareTeamMemberRole;
  isActive?: boolean;
};

export function homecareRoleForStaffRole(role: Role): HomecareTeamMemberRole | null {
  if (role === Role.ADMIN_LAYANAN) return HomecareTeamMemberRole.ADMIN_LAYANAN;
  if (role === Role.DOCTOR) return HomecareTeamMemberRole.DOCTOR;
  if (role === Role.NURSE) return HomecareTeamMemberRole.NURSE;
  return null;
}

export function getHomecareTeamReadiness(members: ActiveHomecareMember[]) {
  const activeMembers = members.filter((member) => member.isActive !== false);
  const hasAdminLayanan = activeMembers.some(
    (member) => member.role === HomecareTeamMemberRole.ADMIN_LAYANAN,
  );
  const hasNakes = activeMembers.some(
    (member) => member.role === HomecareTeamMemberRole.DOCTOR
      || member.role === HomecareTeamMemberRole.NURSE,
  );

  return {
    hasAdminLayanan,
    hasNakes,
    isOperational: hasAdminLayanan && hasNakes,
    missingRoles: [
      ...(!hasAdminLayanan ? ['ADMIN_LAYANAN' as const] : []),
      ...(!hasNakes ? ['NAKES' as const] : []),
    ],
  };
}
