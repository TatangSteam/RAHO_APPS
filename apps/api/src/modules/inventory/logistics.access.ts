import { Role } from '@prisma/client';

export const canViewCentralStock: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_LOGISTIK,
];

export const canManageCentralStock: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_LOGISTIK,
];

export const canShipStock: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_LOGISTIK,
];

export const canRequestBranchStock: Role[] = [
  Role.ADMIN_CABANG,
];

export const canRequestBagStock: Role[] = [
  Role.ADMIN_LAYANAN,
];

export const canReceiveBranchStock: Role[] = [
  Role.ADMIN_CABANG,
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_LOGISTIK,
];

export const canReceiveBagStock: Role[] = [
  Role.ADMIN_LAYANAN,
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_LOGISTIK,
];

export const logisticStaffRoles: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_LOGISTIK,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.DOCTOR,
  Role.NURSE,
];

export const centralStockVisibleRoles = new Set<Role>(canViewCentralStock);
export const centralStockManagerRoles = new Set<Role>(canManageCentralStock);
export const stockShipmentRoles = new Set<Role>(canShipStock);
export const branchStockReceiverRoles = new Set<Role>(canReceiveBranchStock);
export const bagStockReceiverRoles = new Set<Role>(canReceiveBagStock);
