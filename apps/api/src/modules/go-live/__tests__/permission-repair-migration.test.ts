import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Finance and Logistics permission repair migration', () => {
  const migration = readFileSync(resolve(
    __dirname,
    '../../../../prisma/migrations/20260812100000_repair_missing_finance_logistics_permissions/migration.sql',
  ), 'utf8');

  it('repairs every permission required by the go-live audit', () => {
    expect(migration).toContain('WORKFLOW.RULE.MANAGE');
    expect(migration).toContain('INVENTORY.OPNAME.CREATE');
    expect(migration).toContain('ON CONFLICT ("code") DO UPDATE');
    expect(migration).toContain('"isActive" = true');
  });

  it('restores the intended role-template assignments idempotently', () => {
    expect(migration).toContain("'rt_super_admin', 'rt_admin_manager'");
    expect(migration).toContain("template.\"id\" = 'rt_admin_logistik'");
    expect(migration).toContain('ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING');
  });
});
