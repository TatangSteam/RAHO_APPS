import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('remaining integration-test quarantine migration', () => {
  const migration = readFileSync(resolve(
    __dirname,
    '../../../../prisma/migrations/20260812163000_quarantine_remaining_integration_test_data/migration.sql',
  ), 'utf8');

  it('requires both generated branch code and fixture name', () => {
    for (const marker of [
      "\"branchCode\" LIKE 'AP%' AND \"name\" LIKE 'Approval %'",
      "\"branchCode\" LIKE 'PY%' AND \"name\" LIKE 'Payment Branch %'",
      "\"branchCode\" LIKE 'RD%' AND \"name\" LIKE 'Reservation Destination %'",
      "\"branchCode\" LIKE 'RS%' AND \"name\" LIKE 'Reservation Source %'",
      "\"branchCode\" LIKE 'SD%' AND \"name\" LIKE 'Shipment Destination %'",
      "\"branchCode\" LIKE 'SS%' AND \"name\" LIKE 'Shipment Source %'",
    ]) expect(migration).toContain(marker);
  });

  it('retains history and prevents unfinished test events from syncing', () => {
    expect(migration).toMatch(/BEGIN;[\s\S]*COMMIT;/);
    expect(migration).toContain('UPDATE "integration_events"');
    expect(migration).toContain('"status" = \'IGNORED\'');
    expect(migration).toContain('UPDATE "branches"');
    expect(migration).toContain('UPDATE "users"');
    expect(migration).toContain("'deleted-' || \"id\" || '@users.invalid'");
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });

  it('requires generated user IDs and reserved test domains together', () => {
    expect(migration).toContain('"id" ~ \'^apr_\' AND "email" LIKE \'%@test.local\'');
    expect(migration).toContain('"id" ~ \'^(pay|reserve|ship)_\' AND "email" LIKE \'%@example.test\'');
  });
});
