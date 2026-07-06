import { PackageStatus, PackageType } from '@prisma/client';

export interface DashboardPackageRow {
  id: string;
  purchaseGroupId: string | null;
  packageType: PackageType;
  status: PackageStatus;
  createdAt: Date;
}

const PENDING_PACKAGE_STATUSES: PackageStatus[] = [
  PackageStatus.PENDING_PAYMENT,
  PackageStatus.WAITING_VERIFICATION,
];

function getPurchaseKey(memberPackage: DashboardPackageRow): string {
  return memberPackage.purchaseGroupId
    ? `group:${memberPackage.purchaseGroupId}`
    : `package:${memberPackage.id}`;
}

function countPurchases(packages: DashboardPackageRow[]): number {
  return new Set(packages.map(getPurchaseKey)).size;
}

export function summarizeDashboardPackages(
  packages: DashboardPackageRow[],
  startDate: Date,
  endDate: Date
) {
  const packagesInPeriod = packages.filter(
    (memberPackage) =>
      memberPackage.createdAt >= startDate && memberPackage.createdAt <= endDate
  );

  const activePackages = packages.filter(
    (memberPackage) => memberPackage.status === PackageStatus.ACTIVE
  );
  const pendingPackages = packages.filter((memberPackage) =>
    PENDING_PACKAGE_STATUSES.includes(memberPackage.status)
  );

  const typePurchaseKeys = new Map<PackageType, Set<string>>();
  for (const memberPackage of packagesInPeriod) {
    const keys = typePurchaseKeys.get(memberPackage.packageType) || new Set<string>();
    keys.add(getPurchaseKey(memberPackage));
    typePurchaseKeys.set(memberPackage.packageType, keys);
  }

  return {
    packagesSold: countPurchases(packagesInPeriod),
    activePackages: countPurchases(activePackages),
    pendingPayment: countPurchases(pendingPackages),
    byType: Array.from(typePurchaseKeys.entries()).map(([type, purchaseKeys]) => ({
      type,
      count: purchaseKeys.size,
    })),
  };
}
