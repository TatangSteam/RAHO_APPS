import type { Role } from '@/types/auth';

export const HOMECARE_SETUP_MANAGER_ROLES: Role[] = [
  'SUPER_ADMIN',
  'ADMIN_MANAGER',
  'ADMIN_LOGISTIK',
  'FINANCE_LOGISTICS_CONTROLLER',
];

export const HOMECARE_BAG_REQUEST_ROLES: Role[] = [
  ...HOMECARE_SETUP_MANAGER_ROLES,
  'ADMIN_LAYANAN',
];

export const HOMECARE_BAG_REVIEW_ROLES: Role[] = [
  'SUPER_ADMIN',
  'ADMIN_MANAGER',
];

function hasRole(roles: Role[], role?: Role | null): boolean {
  return Boolean(role && roles.includes(role));
}

export function canManageHomecareSetup(role?: Role | null): boolean {
  return hasRole(HOMECARE_SETUP_MANAGER_ROLES, role);
}

export function canRequestHomecareBagStock(role?: Role | null): boolean {
  return hasRole(HOMECARE_BAG_REQUEST_ROLES, role);
}

export function canReviewHomecareBagStockRequests(role?: Role | null): boolean {
  return hasRole(HOMECARE_BAG_REVIEW_ROLES, role);
}

export function canShipHomecareBagStock(role?: Role | null): boolean {
  return hasRole(HOMECARE_SETUP_MANAGER_ROLES, role);
}
