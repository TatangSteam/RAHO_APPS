import { PackageStatus } from '@prisma/client';

const AGGREGATE_STATUS_PRIORITY: PackageStatus[] = [
  PackageStatus.ACTIVE,
  PackageStatus.WAITING_VERIFICATION,
  PackageStatus.PENDING_PAYMENT,
  PackageStatus.EXPIRED,
  PackageStatus.CANCELLED,
];

export function getAggregatePackageStatus(
  items: ReadonlyArray<{ status?: PackageStatus | null }>,
): PackageStatus | undefined {
  const statuses = new Set(items.map((item) => item.status).filter(Boolean));
  return AGGREGATE_STATUS_PRIORITY.find((status) => statuses.has(status));
}
