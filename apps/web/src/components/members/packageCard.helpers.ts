import type { MemberPackage, StandaloneAddOn } from '@/types/package';

export type PaymentVerificationTarget = MemberPackage | StandaloneAddOn;

export interface MemberPackageDisplayGroup {
  key: string;
  items: MemberPackage[];
  representative: MemberPackage;
  quantity: number;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  originalPrice: number;
  finalPrice: number;
  packageCodes: string[];
}

function getPackageIdentity(pkg: MemberPackage): string {
  if (pkg.packagePricingId) return `pricing:${pkg.packagePricingId}`;
  if (pkg.productCode) return `product:${pkg.packageType}:${pkg.productCode}`;
  if (pkg.packageName) return `name:${pkg.packageType}:${pkg.packageName}`;
  return `package:${pkg.packageId}`;
}

/**
 * Groups only identical package catalog selections. Different BASIC products
 * (for example FREE 1X and Nano Bubble 15X) must remain separate display rows.
 */
export function groupMemberPackagesForDisplay(
  packages: readonly MemberPackage[],
): MemberPackageDisplayGroup[] {
  const groups = new Map<string, MemberPackage[]>();

  for (const pkg of packages) {
    const key = getPackageIdentity(pkg);
    groups.set(key, [...(groups.get(key) ?? []), pkg]);
  }

  return Array.from(groups.entries()).map(([key, items]) => ({
    key,
    items,
    representative: items[0],
    quantity: items.reduce(
      (total, item) => total + Math.max(1, item.purchaseQuantity || 1),
      0,
    ),
    totalSessions: items.reduce((total, item) => total + item.totalSessions, 0),
    usedSessions: items.reduce((total, item) => total + item.usedSessions, 0),
    remainingSessions: items.reduce((total, item) => total + item.remainingSessions, 0),
    originalPrice: items.reduce(
      (total, item) => total + item.finalPrice + (item.discountAmount || 0),
      0,
    ),
    finalPrice: items.reduce((total, item) => total + item.finalPrice, 0),
    packageCodes: items.map((item) => item.packageCode),
  }));
}

/**
 * The edit form needs historical consumed rows to reconstruct the aggregate
 * quantity shown on the package card. They remain read-only history in the
 * API, while editable rows continue to own the available balance.
 */
export function getPackageEditContext(
  packages: readonly MemberPackage[],
  canEditStatus: (status?: string) => boolean,
): MemberPackage[] {
  return packages.filter((item) =>
    canEditStatus(item.status) ||
    (item.status === 'EXPIRED' && item.usedSessions > 0),
  );
}

/**
 * A bundle can contain rows whose payment state is temporarily different.
 * Always submit the row that actually owns the action instead of assuming the
 * first BASIC row represents the whole bundle.
 */
export function findPendingPaymentTarget(
  items: readonly PaymentVerificationTarget[],
): PaymentVerificationTarget | undefined {
  const packages = items.filter((item): item is MemberPackage => 'packageId' in item);
  return packages.find((item) => item.status === 'WAITING_VERIFICATION')
    ?? packages.find((item) => item.status === 'PENDING_PAYMENT')
    ?? items.find((item) => item.status === 'WAITING_VERIFICATION')
    ?? items.find((item) => item.status === 'PENDING_PAYMENT');
}

export function findActiveInstallmentTarget(
  items: readonly PaymentVerificationTarget[],
): PaymentVerificationTarget | undefined {
  const candidates = items.filter((item) => (
    item.status === 'ACTIVE'
    && item.paymentPlanType === 'INSTALLMENT'
    && item.paymentPlanStatus === 'ACTIVE_INSTALLMENT'
  ));
  return candidates.find((item) => 'packageId' in item) ?? candidates[0];
}
