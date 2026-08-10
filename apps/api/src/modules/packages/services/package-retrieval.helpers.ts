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

/**
 * Removed package rows remain CANCELLED for session and finance history. Do
 * not include those historical rows in current bundle quantities while the
 * purchase still has non-cancelled items.
 */
export function getCurrentPackageGroupItems<T extends { status?: PackageStatus | null }>(
  items: readonly T[],
): T[] {
  const currentItems = items.filter((item) => item.status !== PackageStatus.CANCELLED);
  return currentItems.length > 0 ? currentItems : [...items];
}
