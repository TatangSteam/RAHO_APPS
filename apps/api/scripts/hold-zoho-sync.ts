import { prisma } from '../src/lib/prisma';
import { rollbackGoLive } from '../src/modules/zoho/zoho.go-live.service';

async function main(): Promise<void> {
  const approverEmail = process.argv[2];
  const reason = process.argv.slice(3).join(' ').trim();
  if (!approverEmail || !reason) throw new Error('APPROVER_EMAIL_AND_REASON_REQUIRED');
  const actor = await prisma.user.findFirst({
    where: { email: approverEmail, role: 'SUPER_ADMIN', isActive: true },
  });
  if (!actor) throw new Error('ACTIVE_SUPER_ADMIN_NOT_FOUND');
  const control = await rollbackGoLive(actor.id, reason);
  console.log(JSON.stringify({ held: true, mode: control.mode, reason }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      held: false,
      reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
