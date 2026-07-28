import { readFileSync } from 'fs';
import { resolve } from 'path';

const apiRoot = resolve(__dirname, '../../../..');

describe('Finance & Logistics Controller contract', () => {
  it('adds the role and its branch-scoped read/control permissions', () => {
    const roleMigration = readFileSync(resolve(
      apiRoot,
      'prisma/migrations/20260728100000_add_finance_logistics_controller_role/migration.sql',
    ), 'utf8');
    const permissionMigration = readFileSync(resolve(
      apiRoot,
      'prisma/migrations/20260728101000_seed_finance_logistics_controller_permissions/migration.sql',
    ), 'utf8');

    expect(roleMigration).toContain("'FINANCE_LOGISTICS_CONTROLLER'");
    expect(permissionMigration).toContain("'FINANCE_LOGISTICS_CONTROLLER_DEFAULT'");
    expect(permissionMigration).toContain("'INVENTORY.SHIPMENT.DISPATCH'");
    expect(permissionMigration).toContain("'AP.READ'");
    expect(permissionMigration).toContain("'ZOHO.SYNC.RETRY'");
    const assignedPermissions = permissionMigration.slice(
      permissionMigration.indexOf('WHERE p."code" IN'),
    );
    expect(assignedPermissions).not.toContain("'ZOHO.CONNECTION.MANAGE'");
  });

  it('keeps maker-checker enforcement in the approval engine', () => {
    const approvalService = readFileSync(resolve(
      apiRoot,
      'src/modules/workflow/approval.service.ts',
    ), 'utf8');

    expect(approvalService).toContain('instance.makerUserId === input.actorUserId');
    expect(approvalService).toContain('Maker tidak boleh memutuskan dokumennya sendiri.');
  });
});
