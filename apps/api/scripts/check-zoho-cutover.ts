import { prisma } from '../src/lib/prisma';
import {
  countValidatedCanaryEvents,
  getGoLiveControl,
} from '../src/modules/zoho/zoho.go-live.service';

async function main(): Promise<void> {
  const status = await getGoLiveControl();
  if (!status.connected) {
    console.log(JSON.stringify({ connected: false }, null, 2));
    process.exitCode = 2;
    return;
  }

  const control = status.control;
  const canaryBranchIds = Array.isArray(control?.canaryBranchIds)
    ? control.canaryBranchIds.filter((id): id is string => typeof id === 'string')
    : [];
  const [eventCounts, canaryEventTypes, deadLetters, canaryDryRunEvents, latestReconciliation, unresolvedMaterial, canaryBranches, availableBranches, approvers] = await Promise.all([
    prisma.integrationEvent.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.integrationEvent.groupBy({
      by: ['eventType'],
      where: {
        branchId: { in: canaryBranchIds },
        status: { in: ['DRY_RUN', 'PENDING', 'FAILED'] },
        syncAttempts: { some: { status: 'DRY_RUN' } },
      },
      _count: { _all: true },
      orderBy: { eventType: 'asc' },
    }),
    prisma.integrationEvent.count({ where: { status: 'DEAD_LETTER' } }),
    countValidatedCanaryEvents(canaryBranchIds),
    prisma.zohoReconciliationRun.findFirst({
      where: { zohoConnectionId: status.runtime.connectionId ?? undefined, runType: 'FULL' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.zohoReconciliationResult.count({
      where: {
        run: { zohoConnectionId: status.runtime.connectionId ?? undefined, runType: 'FULL' },
        resolvedAt: null,
        severity: { in: ['HIGH', 'CRITICAL'] },
        status: { not: 'MATCHED' },
      },
    }),
    prisma.branch.findMany({
      where: { id: { in: canaryBranchIds } },
      select: { id: true, branchCode: true, name: true, type: true, isActive: true },
    }),
    prisma.branch.findMany({
      where: { isActive: true, branchCode: { not: 'EXT' } },
      select: { id: true, branchCode: true, name: true, type: true },
      orderBy: { branchCode: 'asc' },
    }),
    prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', isActive: true },
      select: { id: true, email: true, profile: { select: { fullName: true } } },
      orderBy: { email: 'asc' },
    }),
  ]);

  console.log(JSON.stringify({
    connected: true,
    organizationName: status.organizationName,
    runtime: status.runtime,
    control: control ? {
      mode: control.mode,
      masterFrozen: control.masterFrozen,
      financeApproved: Boolean(control.financeApprovedAt),
      logisticsApproved: Boolean(control.logisticsApprovedAt),
      mismatchFreeBusinessDays: control.mismatchFreeBusinessDays,
      lastRehearsalAt: control.lastRehearsalAt,
      canaryCustomerId: control.canaryCustomerId,
      canaryVendorId: control.canaryVendorId,
    } : null,
    canaryBranches,
    eventCounts: Object.fromEntries(eventCounts.map((entry) => [entry.status, entry._count._all])),
    canaryEventTypes: Object.fromEntries(canaryEventTypes.map((entry) => [entry.eventType, entry._count._all])),
    deadLetters,
    canaryDryRunEvents,
    unresolvedMaterial,
    latestReconciliation: latestReconciliation ? {
      id: latestReconciliation.id,
      status: latestReconciliation.status,
      totalChecked: latestReconciliation.totalChecked,
      matchedCount: latestReconciliation.matchedCount,
      exceptionCount: latestReconciliation.exceptionCount,
      startedAt: latestReconciliation.startedAt,
      finishedAt: latestReconciliation.finishedAt,
    } : null,
    availableBranches,
    approvers,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      audited: false,
      reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
