import type {
  GroupedPackage,
  MemberPackage,
  PackageDisplay,
  PackageStatus,
  PackageType,
} from '@/types/package';

export interface MemberVoucherTotals {
  basic: number;
  booster: number;
}

const AGGREGATE_STATUS_PRIORITY: PackageStatus[] = [
  'ACTIVE',
  'WAITING_VERIFICATION',
  'PENDING_PAYMENT',
  'EXPIRED',
  'CANCELLED',
];

export function getAggregatePackageStatus(
  items: ReadonlyArray<{ status?: PackageStatus }>,
): PackageStatus | undefined {
  const statuses = new Set(items.map((item) => item.status).filter(Boolean));
  return AGGREGATE_STATUS_PRIORITY.find((status) => statuses.has(status));
}

function getActiveRemainingSessions(memberPackage: MemberPackage | undefined): number {
  return memberPackage?.status === 'ACTIVE' ? memberPackage.remainingSessions : 0;
}

function getGroupedVoucherTotal(group: GroupedPackage, packageType: PackageType): number {
  const packages = packageType === 'BASIC' ? group.basics : group.boosters;

  if (packages?.length) {
    return packages.reduce(
      (total, memberPackage) => total + getActiveRemainingSessions(memberPackage),
      0,
    );
  }

  const fallbackPackage = packageType === 'BASIC' ? group.basic : group.booster;
  return getActiveRemainingSessions(fallbackPackage);
}

export function getMemberVoucherTotals(packages: PackageDisplay[]): MemberVoucherTotals {
  return packages.reduce<MemberVoucherTotals>(
    (totals, item) => {
      if ('isGroup' in item && item.isGroup) {
        totals.basic += getGroupedVoucherTotal(item, 'BASIC');
        totals.booster += getGroupedVoucherTotal(item, 'BOOSTER');
      } else if ('packageType' in item && item.status === 'ACTIVE') {
        totals[item.packageType.toLowerCase() as Lowercase<PackageType>] += item.remainingSessions;
      }

      return totals;
    },
    { basic: 0, booster: 0 },
  );
}
