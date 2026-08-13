import { HomecareTeamMemberRole, Role } from '@prisma/client';
import { getHomecareTeamReadiness, homecareRoleForStaffRole } from '../homecare-team.policy';

describe('homecare team policy', () => {
  it('requires one active Admin Layanan and one active clinical worker', () => {
    expect(getHomecareTeamReadiness([
      { role: HomecareTeamMemberRole.ADMIN_LAYANAN },
      { role: HomecareTeamMemberRole.NURSE },
    ])).toEqual({
      hasAdminLayanan: true,
      hasNakes: true,
      isOperational: true,
      missingRoles: [],
    });

    expect(getHomecareTeamReadiness([
      { role: HomecareTeamMemberRole.ADMIN_LAYANAN },
      { role: HomecareTeamMemberRole.DOCTOR, isActive: false },
    ])).toMatchObject({
      isOperational: false,
      missingRoles: ['NAKES'],
    });
  });

  it('maps only supported account roles to operational team roles', () => {
    expect(homecareRoleForStaffRole(Role.ADMIN_LAYANAN)).toBe(HomecareTeamMemberRole.ADMIN_LAYANAN);
    expect(homecareRoleForStaffRole(Role.DOCTOR)).toBe(HomecareTeamMemberRole.DOCTOR);
    expect(homecareRoleForStaffRole(Role.NURSE)).toBe(HomecareTeamMemberRole.NURSE);
    expect(homecareRoleForStaffRole(Role.ADMIN_MANAGER)).toBeNull();
  });
});
