const PACKAGE_PAYMENT_ROLES = new Set([
  'ADMIN_LAYANAN',
  'ADMIN_CABANG',
  'SUPER_ADMIN',
  'NURSE',
]);

export function canHandlePackagePayment(role?: string | null): boolean {
  return Boolean(role && PACKAGE_PAYMENT_ROLES.has(role));
}
