import { prisma } from '../src/lib/prisma';
import { getZohoRuntimeGate } from '../src/modules/zoho/zoho.go-live.service';
import { registerZohoHandlers } from '../src/modules/zoho/zoho.handlers';
import { runZohoWorkerOnce } from '../src/modules/zoho/zoho.worker';

async function main(): Promise<void> {
  const maxCycles = Number(process.argv[2] || 25);
  const batchSize = Number(process.argv[3] || 2);
  if (!Number.isInteger(maxCycles) || maxCycles < 1 || maxCycles > 100) {
    throw new Error('MAX_CYCLES_MUST_BE_1_TO_100');
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10) {
    throw new Error('BATCH_SIZE_MUST_BE_1_TO_10');
  }
  const gate = await getZohoRuntimeGate();
  if (gate.mode !== 'CANARY') throw new Error(`ZOHO_MODE_MUST_BE_CANARY:${gate.mode}`);
  registerZohoHandlers();

  let processed = 0;
  let cycles = 0;
  while (cycles < maxCycles) {
    const count = await runZohoWorkerOnce(batchSize);
    cycles += 1;
    processed += count;
    if (count === 0) break;
  }

  const [statuses, attempts, mappings, reviews, nonCanaryPending] = await Promise.all([
    prisma.integrationEvent.groupBy({
      by: ['status'],
      where: { branchId: { in: gate.canaryBranchIds } },
      _count: { _all: true },
    }),
    prisma.zohoSyncAttempt.groupBy({
      by: ['status'],
      where: { integrationEvent: { branchId: { in: gate.canaryBranchIds } } },
      _count: { _all: true },
    }),
    prisma.zohoEntityMapping.count({
      where: { zohoConnectionId: gate.connectionId!, entityType: 'MEMBER', status: 'ACTIVE' },
    }),
    prisma.zohoMappingReview.count({
      where: { zohoConnectionId: gate.connectionId!, entityType: 'MEMBER', status: 'PENDING' },
    }),
    prisma.integrationEvent.count({
      where: {
        status: 'PENDING',
        OR: [
          { branchId: null },
          { branchId: { notIn: gate.canaryBranchIds } },
        ],
      },
    }),
  ]);
  console.log(JSON.stringify({
    mode: gate.mode,
    batchSize,
    cycles,
    processed,
    canaryEventStatuses: Object.fromEntries(statuses.map((entry) => [entry.status, entry._count._all])),
    canaryAttemptStatuses: Object.fromEntries(attempts.map((entry) => [entry.status, entry._count._all])),
    activeMemberMappings: mappings,
    pendingMemberReviews: reviews,
    nonCanaryPendingHeld: nonCanaryPending,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      completed: false,
      reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
