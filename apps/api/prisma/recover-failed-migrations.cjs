const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { ALIGNMENT_MIGRATIONS, buildAlignmentRepair, isKnownAlignmentFailure } = require('./schema-alignment-recovery.cjs');

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

function runPrisma(args) {
  const windows = process.platform === 'win32';
  const executable = windows ? process.execPath : 'npx';
  const command = windows ? [require.resolve('prisma/build/index.js'), ...args] : ['prisma', ...args];
  const resolution = spawnSync(executable, command, { stdio: 'inherit', env: process.env });
  if (resolution.error) throw resolution.error;
  if (resolution.status !== 0) throw new Error(`Prisma ${args.join(' ')} exited with code ${resolution.status}.`);
}

async function recoverFailedMigrations(prisma, options = {}) {
  const root = options.root || process.cwd();
  const resolveMigration = options.runPrisma || runPrisma;
  const failed = await findFailedMigrations(prisma);
  if (failed.length === 0) {
    console.log('No unresolved failed migrations found.');
    return;
  }

  // Build and validate ALL plans before any DDL or migration resolution.
  const plans = failed.map((row) => {
    if (row.migration_name === RECOVERABLE_MIGRATION) return { row, statements: null };
    if (Object.prototype.hasOwnProperty.call(ALIGNMENT_MIGRATIONS, row.migration_name)) {
      const source = readFileSync(join(root, 'prisma', 'migrations', row.migration_name, 'migration.sql'), 'utf8');
      if (isKnownAlignmentFailure(row, source)) return { row, statements: buildAlignmentRepair(row.migration_name, source) };
    }
    throw new Error(`Automatic migration recovery refused for unrecognized failure: ${row.migration_name}`);
  });
  const repairPath = join(
    root,
    'prisma',
    'migrations',
    REPAIR_MIGRATION,
    'migration.sql',
  );
  if (plans.some((plan) => !plan.statements) && !existsSync(repairPath)) {
    throw new Error(`Repair migration ${REPAIR_MIGRATION} is missing; refusing automatic recovery.`);
  }
  const alignmentReconciliation = join(root, 'prisma', 'migrations', '20260917100000_reconcile_schema_alignment_indexes', 'migration.sql');
  if (plans.some((plan) => plan.statements) && !existsSync(alignmentReconciliation)) {
    throw new Error('Final schema alignment reconciliation migration is missing; refusing recovery.');
  }

  for (const { row, statements } of plans) {
    console.warn(`Recovering known failed migration: ${row.migration_name}`);
    if (statements) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30s'");
        for (const statement of statements) await tx.$executeRawUnsafe(statement);
      }, { maxWait: 5000, timeout: 60000 });
      console.log(`Reconciled ${statements.length} schema operations before migration resolution; future-table indexes are handled by the final reconciliation migration.`);
    } else {
      console.warn(`Schema and data will be reconciled by ${REPAIR_MIGRATION}.`);
    }
    // Never mark an alignment migration applied unless its entire repair
    // committed successfully. If resolve fails, the repair is safe to replay.
    await resolveMigration(['migrate', 'resolve', '--applied', row.migration_name]);
  }
}

async function main() {
  const prisma = new PrismaClient();
  try { await recoverFailedMigrations(prisma); }
  finally { await prisma.$disconnect(); }
}

module.exports = { recoverFailedMigrations, findFailedMigrations };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
