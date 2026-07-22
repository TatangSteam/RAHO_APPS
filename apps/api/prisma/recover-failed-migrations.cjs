const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { PrismaClient } = require('@prisma/client');

const RECOVERABLE_MIGRATION = '20260722100000_add_deferred_revenue_recognition';
const REPAIR_MIGRATION = '20260722150000_recover_deferred_revenue_recognition';

async function findFailedMigrations(prisma) {
  try {
    return await prisma.$queryRawUnsafe(`
      SELECT "migration_name", "logs"
      FROM "_prisma_migrations"
      WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL
      ORDER BY "started_at" ASC
    `);
  } catch (error) {
    if (/(_prisma_migrations.*does not exist|relation.*_prisma_migrations)/i.test(String(error))) {
      return [];
    }
    throw error;
  }
}

async function main() {
  const repairPath = join(
    process.cwd(),
    'prisma',
    'migrations',
    REPAIR_MIGRATION,
    'migration.sql',
  );
  if (!existsSync(repairPath)) {
    throw new Error(`Repair migration ${REPAIR_MIGRATION} is missing; refusing automatic recovery.`);
  }

  const prisma = new PrismaClient();
  const failed = await findFailedMigrations(prisma);
  await prisma.$disconnect();
  if (failed.length === 0) {
    console.log('No unresolved failed migrations found.');
    return;
  }

  const unexpected = failed.filter((row) => row.migration_name !== RECOVERABLE_MIGRATION);
  if (unexpected.length > 0) {
    for (const row of unexpected) {
      console.error(`Unrecognized failed migration: ${row.migration_name}`);
      if (row.logs) console.error(String(row.logs));
    }
    throw new Error('Automatic migration recovery refused for an unrecognized failure.');
  }

  const failedRow = failed[0];
  console.warn(`Recovering known failed migration: ${RECOVERABLE_MIGRATION}`);
  if (failedRow.logs) console.warn(String(failedRow.logs));
  console.warn(`Schema and data will be reconciled by ${REPAIR_MIGRATION}.`);

  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const resolution = spawnSync(
    executable,
    ['prisma', 'migrate', 'resolve', '--applied', RECOVERABLE_MIGRATION],
    { stdio: 'inherit', env: process.env },
  );
  if (resolution.error) throw resolution.error;
  if (resolution.status !== 0) {
    throw new Error(`Prisma migrate resolve exited with code ${resolution.status}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
