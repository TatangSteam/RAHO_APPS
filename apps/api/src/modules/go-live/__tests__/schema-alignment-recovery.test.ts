import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../../../..');
const { buildAlignmentRepair, isKnownAlignmentFailure } = require('../../../../prisma/schema-alignment-recovery.cjs');
const { recoverFailedMigrations } = require('../../../../prisma/recover-failed-migrations.cjs');
const name = '20260729084954_rahoapps';
const source = readFileSync(resolve(root, 'prisma/migrations', name, 'migration.sql'), 'utf8');
const failure = { migration_name: name, logs: 'Database error code: 42704\nERROR: index "cash_bank_transactions_journalEntryId_idx" does not exist' };

describe('guarded schema alignment migration recovery', () => {
  const tx = { $executeRawUnsafe: jest.fn() };
  const prisma = { $queryRawUnsafe: jest.fn(), $transaction: jest.fn() };
  const runPrisma = jest.fn();
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$queryRawUnsafe.mockResolvedValue([failure]);
    prisma.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
    tx.$executeRawUnsafe.mockResolvedValue(0);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([[name, 51], ['20260818042140_teest', 56]])('replays every operation of exact reviewed migration %s', (migration, count) => {
    const sql = readFileSync(resolve(root, 'prisma/migrations', String(migration), 'migration.sql'), 'utf8');
    const repair = buildAlignmentRepair(migration, sql);
    expect(repair).toHaveLength(count);
    expect(repair.join('\n')).toContain('DROP INDEX IF EXISTS "cash_bank_transactions_journalEntryId_idx"');
    expect(repair.join('\n')).toContain('DROP CONSTRAINT IF EXISTS');
    expect(repair.join('\n')).toContain('Missing source and target');
    expect(repair.join('\n')).toContain('Conflicting schema objects');
    expect(repair.join('\n')).toContain('ON DELETE SET NULL ON UPDATE CASCADE');
    expect(repair.join('\n')).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM|CASCADE;/);
  });

  it('accepts Windows and Linux line endings without changing migration history', () => {
    expect(buildAlignmentRepair(name, source.replace(/\r\n/g, '\n'))).toEqual(buildAlignmentRepair(name, source.replace(/\r?\n/g, '\r\n')));
  });
  it('rejects modified SQL or unknown migration names', () => {
    expect(() => buildAlignmentRepair(name, source + '\nDROP TABLE users;')).toThrow('checksum');
    expect(() => buildAlignmentRepair('unexpected', source)).toThrow('checksum');
  });
  it.each([
    { ...failure, migration_name: 'unknown' },
    { ...failure, logs: 'Database error code: 42501\nERROR: permission denied' },
    { ...failure, logs: 'Database error code: 23503\nERROR: foreign key violation' },
    { ...failure, logs: 'Database error code: 42704\nERROR: index "unrelated_idx" does not exist' },
    { ...failure, logs: '' },
  ])('refuses an unknown failure without schema changes or resolve: %j', async (row) => {
    prisma.$queryRawUnsafe.mockResolvedValue([row]);
    await expect(recoverFailedMigrations(prisma, { root, runPrisma })).rejects.toThrow('unrecognized');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(runPrisma).not.toHaveBeenCalled();
  });
  it('recognizes only missing migration-owned indexes or constraints', () => {
    expect(isKnownAlignmentFailure(failure, source)).toBe(true);
    expect(isKnownAlignmentFailure({ ...failure, logs: 'Database error code: 42704\nERROR: constraint "invoice_payments_verifiedBy_fkey" of relation "invoice_payments" does not exist' }, source)).toBe(true);
    expect(isKnownAlignmentFailure({ ...failure, logs: 'Database error code: 42P01\nERROR: relation "supplier_invoice_lines_supplierInvoiceId_purchaseOrderItemId_ke" does not exist' }, source)).toBe(true);
    expect(isKnownAlignmentFailure({ ...failure, logs: 'Database error code: 42P01\nERROR: relation "users" does not exist' }, source)).toBe(false);
  });
  it('completes and commits all schema repairs before marking applied', async () => {
    let committed = false;
    prisma.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => { await work(tx); committed = true; });
    runPrisma.mockImplementation(() => expect(committed).toBe(true));
    await recoverFailedMigrations(prisma, { root, runPrisma });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(53);
    expect(runPrisma).toHaveBeenCalledWith(['migrate', 'resolve', '--applied', name]);
  });
  it('does not mark applied if any repair operation fails', async () => {
    tx.$executeRawUnsafe.mockRejectedValueOnce(new Error('Missing source and target'));
    await expect(recoverFailedMigrations(prisma, { root, runPrisma })).rejects.toThrow('Missing source and target');
    expect(runPrisma).not.toHaveBeenCalled();
  });
  it('refuses mixed recognized/unknown failures before executing any plan', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([failure, { migration_name: 'unknown', logs: '' }]);
    await expect(recoverFailedMigrations(prisma, { root, runPrisma })).rejects.toThrow('unrecognized');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(runPrisma).not.toHaveBeenCalled();
  });
  it('leaves databases without failed migrations untouched', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    await recoverFailedMigrations(prisma, { root, runPrisma });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(runPrisma).not.toHaveBeenCalled();
  });
  it('preserves the existing deferred revenue repair route', async () => {
    const migration = '20260722100000_add_deferred_revenue_recognition';
    prisma.$queryRawUnsafe.mockResolvedValue([{ migration_name: migration, logs: '' }]);
    await recoverFailedMigrations(prisma, { root, runPrisma });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(runPrisma).toHaveBeenCalledWith(['migrate', 'resolve', '--applied', migration]);
  });
});
