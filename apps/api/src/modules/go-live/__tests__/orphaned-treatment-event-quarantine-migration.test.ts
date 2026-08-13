import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('orphaned treatment-event quarantine migration', () => {
  const migration = readFileSync(resolve(
    __dirname,
    '../../../../prisma/migrations/20260813090000_ignore_orphaned_treatment_test_events/migration.sql',
  ), 'utf8');

  it('requires matching fixture markers from all three identifiers', () => {
    expect(migration).toContain("event.\"eventType\" = 'TREATMENT_INVENTORY_REVERSED'");
    expect(migration).toContain("event.\"aggregateType\" = 'TreatmentSessionInventoryReversal'");
    expect(migration).toContain("event.\"aggregateId\" ~ '^treat_session_[0-9a-f]{14}:REVERSAL$'");
    expect(migration).toContain("event.\"branchId\" ~ '^treat_branch_[0-9a-f]{14}$'");
    expect(migration).toContain("event.\"payload\"->>'externalKey' ~ '^RAHO-TREATMENT-REV-SES-[0-9a-f]{14}$'");
    expect(migration).toContain("replace(split_part(event.\"aggregateId\", ':', 1), 'treat_session_', '')");
  });

  it('only quarantines orphaned retryable events and retains their history', () => {
    expect(migration).toMatch(/BEGIN;[\s\S]*COMMIT;/);
    expect(migration).toContain('UPDATE "integration_events"');
    expect(migration).toContain('"status" = \'IGNORED\'');
    expect(migration).toContain('AND NOT EXISTS (');
    expect(migration).toContain('FROM "branches" AS branch');
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });
});
