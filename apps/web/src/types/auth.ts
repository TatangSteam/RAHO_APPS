// ============================================================
// Shared TypeScript types for Authentication
// ============================================================

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN_MANAGER'
  | 'ADMIN_CABANG'
  | 'ADMIN_LAYANAN'
  | 'ADMIN_LOGISTIK'
  | 'DOCTOR'
  | 'NURSE'
  | 'MEMBER';

export interface AuthUser {
  userId: string;
  email: string;
  role: Role;
  branchId: string | null;
  branchCode: string | null;
  fullName: string;
  staffCode: string | null;
  avatarUrl?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// Role hierarchy helpers
export const STAFF_ROLES: Role[] = [
  'SUPER_ADMIN',
  'ADMIN_MANAGER',
  'ADMIN_CABANG',
  'ADMIN_LAYANAN',
  'ADMIN_LOGISTIK',
  'DOCTOR',
  'NURSE',
];

export const ADMIN_ABOVE_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'ADMIN_CABANG'];
export const MANAGER_ABOVE_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK'];
export const SUPER_ADMIN_ONLY: Role[] = ['SUPER_ADMIN'];
export const PACKAGE_MANAGEMENT_ROLES: Role[] = [
  'SUPER_ADMIN',
  'ADMIN_MANAGER',
  'ADMIN_CABANG',
  'ADMIN_LAYANAN',
];
export const PACKAGE_WAITING_VERIFICATION_EDIT_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN_MANAGER'];
export const PACKAGE_VERIFIED_EDIT_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN_MANAGER'];

// Roles that can edit therapy plans and add rows to active therapy plan sets
export const THERAPY_PLAN_EDITORS: Role[] = [
  'SUPER_ADMIN',
  'ADMIN_MANAGER',
  'ADMIN_CABANG',
  'ADMIN_LAYANAN',
  'DOCTOR',
  'NURSE',
];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function isMember(role: Role): boolean {
  return role === 'MEMBER';
}

export function hasRole(userRole: Role, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(userRole);
}

/** First route to redirect to after login, based on role */
export function getDefaultRoute(role: Role): string {
  if (role === 'MEMBER') return '/me/dashboard';
  
  // All staff roles get main dashboard
  if (['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'ADMIN_LOGISTIK', 'DOCTOR', 'NURSE'].includes(role)) {
    return '/dashboard';
  }
  
  // Default fallback
  return '/dashboard';
}
