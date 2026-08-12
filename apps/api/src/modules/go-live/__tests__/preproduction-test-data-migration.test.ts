import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('preproduction test-data quarantine migration', () => {
  const migration = readFileSync(resolve(
    __dirname,
    '../../../../prisma/migrations/20260812133000_quarantine_preproduction_test_data/migration.sql',
  ), 'utf8');

  it('targets journals only when posting key and source are both UAT', () => {
    expect(migration).toContain("journal.\"postingKey\" LIKE 'UAT:%'");
    expect(migration).toContain('source."sourceType" = \'UAT\'');
    expect(migration).not.toMatch(/DELETE FROM "journal_entries"\s*;/);
  });

  it('soft-quarantines only unmistakable Sprint 9 users and branches', () => {
    expect(migration).toContain('"branchCode" LIKE \'S9%\'');
    expect(migration).toContain('"name" LIKE \'Sprint 9 %\'');
    expect(migration).toContain('"email" LIKE \'s9-%@test.local\'');
    expect(migration).not.toContain('DELETE FROM "branches"');
    expect(migration).not.toContain('DELETE FROM "users"');
  });
});
