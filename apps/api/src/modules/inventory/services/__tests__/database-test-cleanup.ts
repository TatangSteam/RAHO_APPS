import { prisma } from '@lib/prisma';

const SAFE_TEST_DATABASE = /(?:^|[_-])(test|testing|rehearsal|restore)(?:$|[_-])/i;

export async function deleteApprovalAuditLogsForDatabaseTest(approvalInstanceIds: string[]) {
  if (approvalInstanceIds.length === 0) return;

  const [database] = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT current_database() AS name
  `;
  if (!database || !SAFE_TEST_DATABASE.test(database.name)) {
    throw new Error(`Cleanup immutable approval audit ditolak untuk database ${database?.name || 'unknown'}.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'ALTER TABLE "approval_audit_logs" DISABLE TRIGGER "approval_audit_no_update"',
    );
    try {
      await tx.approvalAuditLog.deleteMany({
        where: { approvalInstanceId: { in: approvalInstanceIds } },
      });
    } finally {
      await tx.$executeRawUnsafe(
        'ALTER TABLE "approval_audit_logs" ENABLE TRIGGER "approval_audit_no_update"',
      );
    }
  });
}
