import { prisma } from '../src/lib/prisma';
import { runGoLiveAudit } from '../src/modules/go-live/go-live-audit.service';

async function main() {
  const cutoverArg = process.argv.find((arg) => arg.startsWith('--cutover='))?.split('=')[1];
  const cutoverAt = cutoverArg ? new Date(cutoverArg) : new Date();
  if (Number.isNaN(cutoverAt.getTime())) throw new Error('Gunakan --cutover=YYYY-MM-DD atau timestamp ISO yang valid.');
  const report = await runGoLiveAudit(cutoverAt);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.summary.status !== 'READY') process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`Go-live audit gagal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
