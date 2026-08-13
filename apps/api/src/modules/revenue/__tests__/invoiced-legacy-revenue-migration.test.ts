import fs from 'fs';
import path from 'path';

describe('invoiced legacy revenue compatibility migration', () => {
  const migration = fs.readFileSync(
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'prisma',
      'migrations',
      '20260813120000_preserve_invoiced_legacy_revenue',
      'migration.sql',
    ),
    'utf8',
  );

  it('preserves only paid legacy evidence without a posted cash transaction', () => {
    expect(migration).toContain('invoice."status" = \'PAID\'');
    expect(migration).toContain('invoice."paymentVerificationStatus" = \'VERIFIED\'');
    expect(migration).toContain('cash_tx."status" = \'POSTED\'');
    expect(migration).toContain('NOT EXISTS');
    expect(migration).toContain('package."status" IN (\'ACTIVE\', \'EXPIRED\')');
  });
});
