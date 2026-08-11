import type { MemberPackage } from '@/types/package';

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
