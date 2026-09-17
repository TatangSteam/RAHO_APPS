import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const { recoverFailedMigrations } = require('../../../../prisma/recover-failed-migrations.cjs');
const root = resolve(__dirname, '../../../..');
const name = '20260729084954_rahoapps';
const original = readFileSync(resolve(root, 'prisma/migrations', name, 'migration.sql'), 'utf8');
const describeDatabase = process.env.RUN_MIGRATION_RECOVERY_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('schema alignment recovery PostgreSQL rollback/replay', () => {
  let db: PrismaClient;
  let schema: string;
  const runPrisma = jest.fn();

  beforeEach(async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    // This opt-in fixture must never create/drop schemas on a production DB.
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/migration_recovery') {
      throw new Error('Recovery tests require localhost database migration_recovery.');
    }
    schema = `recovery_test_${randomUUID().replace(/-/g, '')}`;
    url.searchParams.set('schema', schema);
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    runPrisma.mockReset();
    const tables = new Set([...original.matchAll(/ALTER TABLE "([A-Za-z0-9_]+)"/g)].map((match) => match[1]));
    tables.add('users');
    tables.add('index_fixture');
    for (const table of tables) await db.$executeRawUnsafe(`CREATE TABLE "${table}" ("id" TEXT PRIMARY KEY, "verifiedBy" TEXT, "updatedAt" TIMESTAMP DEFAULT now())`);
    await db.$executeRawUnsafe('CREATE TABLE "_prisma_migrations" ("migration_name" TEXT, "logs" TEXT, "started_at" TIMESTAMP DEFAULT now(), "finished_at" TIMESTAMP, "rolled_back_at" TIMESTAMP)');
    await db.$executeRaw`INSERT INTO "_prisma_migrations" ("migration_name", "logs") VALUES (${name}, ${'Database error code: 42704\nERROR: index "cash_bank_transactions_journalEntryId_idx" does not exist'})`;
    for (const match of original.matchAll(/ALTER TABLE "([A-Za-z0-9_]+)" RENAME CONSTRAINT "([A-Za-z0-9_]+)"/g)) {
      await db.$executeRawUnsafe(`ALTER TABLE "${match[1]}" ADD CONSTRAINT "${match[2]}" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id")`);
    }
    for (const match of original.matchAll(/ALTER INDEX "([A-Za-z0-9_]+)" RENAME TO/g)) {
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX "${match[1]}" ON "index_fixture"("id")`);
    }
    await db.$executeRawUnsafe('ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE RESTRICT');
    await db.$executeRawUnsafe("INSERT INTO users (id) VALUES ('doctor-1')");
    await db.$executeRawUnsafe("INSERT INTO invoice_payments (id, \"verifiedBy\") VALUES ('payment-1', 'doctor-1')");
    // All obsolete drop-index targets intentionally do not exist: reproduce
    // the production screenshot without deleting or touching application data.
  }, 20000);

  afterEach(async () => {
    if (db) {
      if (!/^recovery_test_[0-9a-f]{32}$/.test(schema)) throw new Error('Unsafe fixture cleanup');
      await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      await db.$disconnect();
    }
  });

  it('repairs missing-index failure without losing rows and may replay after resolve failure', async () => {
    await recoverFailedMigrations(db, { root, runPrisma });
    await recoverFailedMigrations(db, { root, runPrisma });
    expect(runPrisma).toHaveBeenCalledTimes(2);
    expect(runPrisma).toHaveBeenCalledWith(['migrate', 'resolve', '--applied', name]);
    expect(await db.$queryRawUnsafe('SELECT "id", "verifiedBy" FROM "invoice_payments"')).toEqual([{ id: 'payment-1', verifiedBy: 'doctor-1' }]);
    // The repaired FK must retain SET NULL, not merely have the right name.
    await db.$executeRawUnsafe("DELETE FROM users WHERE id = 'doctor-1'");
    expect(await db.$queryRawUnsafe('SELECT "id", "verifiedBy" FROM "invoice_payments"')).toEqual([{ id: 'payment-1', verifiedBy: null }]);
  }, 20000);

  it('rolls back all preceding DDL and refuses resolve when a required FK is missing', async () => {
    await db.$executeRawUnsafe('ALTER TABLE "approval_decisions" DROP CONSTRAINT "approval_decisions_approver_fkey"');
    await expect(recoverFailedMigrations(db, { root, runPrisma })).rejects.toThrow('Missing source and target');
    expect(runPrisma).not.toHaveBeenCalled();
    const constraints = await db.$queryRawUnsafe<Array<{ conname: string }>>('SELECT conname FROM pg_constraint WHERE conrelid = \'"approval_audit_logs"\'::regclass');
    expect(constraints.map((row) => row.conname)).toContain('approval_audit_logs_actor_fkey');
    expect(constraints.map((row) => row.conname)).not.toContain('approval_audit_logs_actorUserId_fkey');
    const defaults = await db.$queryRawUnsafe<Array<{ column_default: string | null }>>('SELECT column_default FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = \'approval_instances\' AND column_name = \'updatedAt\'');
    expect(defaults[0].column_default).not.toBeNull();
  }, 20000);

  it('refuses duplicate index names rather than dropping either unique index', async () => {
    await db.$executeRawUnsafe('CREATE UNIQUE INDEX "deferred_revenue_movements_invoicePaymentId_memberPackageId_key" ON "index_fixture"("id")');
    await expect(recoverFailedMigrations(db, { root, runPrisma })).rejects.toThrow('Conflicting schema objects');
    expect(runPrisma).not.toHaveBeenCalled();
    const indexes = await db.$queryRawUnsafe<Array<{ indexname: string }>>('SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = \'index_fixture\'');
    expect(indexes.map((row) => row.indexname)).toContain('deferred_revenue_movements_invoicePaymentId_memberPackageId_typ');
    expect(indexes.map((row) => row.indexname)).toContain('deferred_revenue_movements_invoicePaymentId_memberPackageId_key');
  }, 20000);
});
