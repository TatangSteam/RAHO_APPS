import { readFileSync } from 'fs';
import { resolve } from 'path';

const apiRoot = resolve(__dirname, '../../../..');

describe('Admin Manager role conversion contract', () => {
  it('exposes a Super Admin-only validated conversion endpoint', () => {
    const routes = readFileSync(resolve(apiRoot, 'src/modules/admin/admin.routes.ts'), 'utf8');
    const schema = readFileSync(resolve(apiRoot, 'src/modules/admin/admin.schema.ts'), 'utf8');

    expect(routes).toContain("'/managers/:managerId/convert-role'");
    expect(routes).toContain("authorize(['SUPER_ADMIN'])");
    expect(routes).toContain('validate(convertAdminManagerRoleSchema)');
    expect(schema).toContain("z.enum(['ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER'])");
  });

  it('keeps the user row and business history while replacing IAM assignments atomically', () => {
    const service = readFileSync(resolve(
      apiRoot,
      'src/modules/admin/services/user-management.service.ts',
    ), 'utf8');
    const conversion = service.slice(
      service.indexOf('async convertAdminManagerRole('),
      service.indexOf('async deleteAdminManager('),
    );

    expect(conversion).toContain('prisma.$transaction');
    expect(conversion).toContain('tx.user.update');
    expect(conversion).not.toContain('tx.user.delete');
    expect(service).toContain('ADMIN_LOGISTIK_DEFAULT');
    expect(service).toContain('FINANCE_LOGISTICS_CONTROLLER_DEFAULT');
    expect(conversion).toContain('tx.managerBranch.deleteMany');
    expect(conversion).toContain('tx.staffBranch.deleteMany');
    expect(conversion).toContain('historyPreserved: true');
  });

  it('allows direct creation of both global roles with the correct branch behavior', () => {
    const userService = readFileSync(resolve(apiRoot, 'src/modules/users/users.service.ts'), 'utf8');
    const createModal = readFileSync(resolve(
      apiRoot,
      '../web/src/components/staff/CreateStaffModal.tsx',
    ), 'utf8');

    expect(userService).toContain('Role.ADMIN_LOGISTIK');
    expect(userService).toContain('Role.FINANCE_LOGISTICS_CONTROLLER');
    expect(userService).toContain("branchCode: { not: 'EXT' }");
    expect(userService).toContain('managedBranches');
    expect(userService).toContain('staffBranches');
    expect(createModal).toContain("'FINANCE_LOGISTICS_CONTROLLER'");
    expect(createModal).toContain('Finance & Logistik');
  });

  it('shows a guided role conversion modal and warns that history is preserved', () => {
    const managerPage = readFileSync(resolve(
      apiRoot,
      '../web/src/app/(staff)/admin/managers/[managerId]/page.tsx',
    ), 'utf8');

    expect(managerPage).toContain('Ubah Peran');
    expect(managerPage).toContain('Admin Logistik');
    expect(managerPage).toContain("label: 'Finance & Logistik'");
    expect(managerPage).toContain('User ID dan seluruh histori transaksi lama tetap aman');
    expect(managerPage).toContain('Konfirmasi Ubah Peran');
  });
});
