import fs from 'node:fs';
import path from 'node:path';

describe('verified paid invoice reconciliation migration', () => {
  it('backfills only paid invoices that already have verifier evidence', () => {
    const migration = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'prisma/migrations/20260929160000_reconcile_verified_paid_invoices/migration.sql',
      ),
      'utf8',
    );

    expect(migration).toContain('"status" = \'PAID\'');
    expect(migration).toContain('"verifiedAt" IS NOT NULL');
    expect(migration).toContain('"verifiedBy" IS NOT NULL');
    expect(migration).toContain('"paymentVerificationStatus" = \'PENDING\'');
    expect(migration).toContain('"paymentVerificationStatus" = \'VERIFIED\'');
  });
});
