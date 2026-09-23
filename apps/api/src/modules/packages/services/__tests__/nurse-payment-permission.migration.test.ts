import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Nakes package payment permission migration', () => {
  it('grants INVOICE.PAYMENT to the active NURSE role template idempotently', () => {
    const sql = readFileSync(resolve(
      process.cwd(),
      'prisma/migrations/20260923130000_allow_nurse_package_payment/migration.sql',
    ), 'utf8');

    expect(sql).toContain(`role_template."baseRole" = 'NURSE'`);
    expect(sql).toContain(`permission."code" = 'INVOICE.PAYMENT'`);
    expect(sql).toContain('ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING');
  });
});
