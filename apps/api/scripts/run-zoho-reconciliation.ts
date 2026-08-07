import { prisma } from '../src/lib/prisma';
import { startReconciliationRun } from '../src/modules/zoho/zoho.reconciliation.service';

async function main(): Promise<void> {
  const result = await startReconciliationRun({ triggerSource: 'MANUAL' });
  if ('skipped' in result && result.skipped) {
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 2;
    return;
  }

  console.log(JSON.stringify({
    id: result.id,
    status: result.status,
    totalChecked: result.totalChecked,
    matchedCount: result.matchedCount,
    exceptionCount: result.exceptionCount,
    errorCount: result.errorCount,
    lastError: result.lastError,
    exceptions: 'results' in result
      ? result.results.map((entry) => ({
        id: entry.id,
        entityType: entry.entityType,
        localEntityId: entry.localEntityId,
        status: entry.status,
        severity: entry.severity,
        differences: entry.differences,
        actionRequired: entry.actionRequired,
      }))
      : [],
  }, null, 2));

  if (result.status !== 'COMPLETED' || result.exceptionCount > 0) process.exitCode = 2;
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
