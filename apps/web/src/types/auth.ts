// ============================================================
// Shared TypeScript types for Authentication
// ============================================================

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN_MANAGER'
  | 'ADMIN_CABANG'
  | 'ADMIN_LAYANAN'
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
  'DOCTOR',
  'NURSE',
];

export const ADMIN_ABOVE_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'];
export const MANAGER_ABOVE_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN_MANAGER'];
export const SUPER_ADMIN_ONLY: Role[] = ['SUPER_ADMIN'];

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
  return '/dashboard';
}
