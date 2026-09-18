import { prisma } from '@lib/prisma';
import { logAudit } from '@utils/auditLog';
import { UserManagementService } from '../user-management.service';

jest.mock('@lib/prisma', () => ({ prisma: {
  user: { findUnique: jest.fn() }, roleTemplate: { findUnique: jest.fn() },
  branch: { findMany: jest.fn() }, $transaction: jest.fn(),
} }));
jest.mock('@utils/auditLog', () => ({ logAudit: jest.fn() }));

const mocked = (value: unknown) => value as jest.Mock;
const tx = {
  managerBranch: { deleteMany: jest.fn(), createMany: jest.fn() },
  staffBranch: { deleteMany: jest.fn(), createMany: jest.fn() },
  userPermissionOverride: { deleteMany: jest.fn() },
  user: { update: jest.fn() },
};
const service = new UserManagementService();

describe('manager conversion uses existing IAM roles without replacing user history', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mocked(prisma.user.findUnique).mockResolvedValue({ id: 'manager', role: 'ADMIN_MANAGER', isActive: true, email: 'manager@example.test' });
    mocked(prisma.roleTemplate.findUnique).mockResolvedValue({ id: 'template', isActive: true, name: 'Role' });
    mocked(prisma.branch.findMany).mockResolvedValue([{ id: 'branch-1' }, { id: 'branch-2' }]);
    mocked(prisma.$transaction).mockImplementation(async (work) => work(tx));
    tx.user.update.mockImplementation(async ({ data }) => ({ id: 'manager', role: data.role }));
  });

  it.each([
    ['ADMIN_LOGISTIK', 'ADMIN_LOGISTIK_DEFAULT', 0],
    ['FINANCE_LOGISTICS_CONTROLLER', 'FINANCE_LOGISTICS_CONTROLLER_DEFAULT', 2],
  ] as const)('assigns %s with its exact template and branch behavior', async (role, template, count) => {
    const result = await service.convertAdminManagerRole('manager', role, 'super-admin');
    expect(prisma.roleTemplate.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { code: template } }));
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'manager', role: 'ADMIN_MANAGER' },
      data: { role, roleTemplateId: 'template', branchId: null, adminManagerAccessScope: 'FULL' },
    }));
    expect(result).toMatchObject({ id: 'manager', role, historyPreserved: true, assignedBranchCount: count });
    expect(tx.managerBranch.deleteMany).toHaveBeenCalledWith({ where: { userId: 'manager' } });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ userId: 'super-admin', resourceId: 'manager' }));
    if (count) {
      expect(prisma.branch.findMany).toHaveBeenCalledWith({ where: { isActive: true, branchCode: { not: 'EXT' } }, select: { id: true } });
      expect(tx.managerBranch.createMany).toHaveBeenCalledWith({ data: [
        { userId: 'manager', branchId: 'branch-1', accessScope: 'FULL' },
        { userId: 'manager', branchId: 'branch-2', accessScope: 'FULL' },
      ], skipDuplicates: true });
    } else {
      expect(prisma.branch.findMany).not.toHaveBeenCalled();
      expect(tx.managerBranch.createMany).not.toHaveBeenCalled();
      expect(tx.staffBranch.createMany).not.toHaveBeenCalled();
    }
  });

  it('rejects conversion of the actor own account', async () => {
    await expect(service.convertAdminManagerRole('super-admin', 'ADMIN_LOGISTIK', 'super-admin')).rejects.toMatchObject({ status: 403 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects accounts which are not Admin Managers', async () => {
    mocked(prisma.user.findUnique).mockResolvedValue({ id: 'manager', role: 'SUPER_ADMIN' });
    await expect(service.convertAdminManagerRole('manager', 'ADMIN_LOGISTIK', 'super-admin')).rejects.toMatchObject({ code: 'MANAGER_NOT_FOUND' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('refuses inactive templates before any assignment changes', async () => {
    mocked(prisma.roleTemplate.findUnique).mockResolvedValue({ id: 'template', isActive: false });
    await expect(service.convertAdminManagerRole('manager', 'ADMIN_LOGISTIK', 'super-admin')).rejects.toMatchObject({ code: 'ROLE_TEMPLATE_NOT_READY' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER'])('revokes %s and removes lingering grants without deleting the user', async (role) => {
    mocked(prisma.user.findUnique).mockResolvedValue({ id: 'manager', role, isActive: true });
    const result = await service.convertAdminManagerRole('manager', 'ADMIN_MANAGER', 'super-admin');
    expect(prisma.roleTemplate.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { code: 'ADMIN_MANAGER_DEFAULT' } }));
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'manager', role },
      data: { role: 'ADMIN_MANAGER', roleTemplateId: 'template', branchId: null, adminManagerAccessScope: 'FULL' },
    }));
    expect(tx.userPermissionOverride.deleteMany).toHaveBeenCalledWith({ where: { userId: 'manager', effect: 'ALLOW' } });
    expect(tx.managerBranch.deleteMany).toHaveBeenCalledWith({ where: { userId: 'manager' } });
    expect(tx.staffBranch.deleteMany).toHaveBeenCalledWith({ where: { userId: 'manager' } });
    expect(tx.managerBranch.createMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ role: 'ADMIN_MANAGER', accessRevoked: true, assignedBranchCount: 0, historyPreserved: true });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('dicabut') }));
  });
  it('allows revocation without enabling an inactive account', async () => {
    mocked(prisma.user.findUnique).mockResolvedValue({ id: 'manager', role: 'ADMIN_LOGISTIK', isActive: false });
    await service.convertAdminManagerRole('manager', 'ADMIN_MANAGER', 'super-admin');
    expect(tx.user.update.mock.calls[0][0].data).not.toHaveProperty('isActive');
  });
  it('blocks granting privileged roles to inactive managers', async () => {
    mocked(prisma.user.findUnique).mockResolvedValue({ id: 'manager', role: 'ADMIN_MANAGER', isActive: false });
    await expect(service.convertAdminManagerRole('manager', 'ADMIN_LOGISTIK', 'super-admin')).rejects.toMatchObject({ code: 'MANAGER_INACTIVE' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('blocks revocation when the account is already a manager', async () => {
    await expect(service.convertAdminManagerRole('manager', 'ADMIN_MANAGER', 'super-admin')).rejects.toMatchObject({ code: 'MANAGER_NOT_FOUND' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('does not emit a success audit if the transaction fails', async () => {
    mocked(prisma.user.findUnique).mockResolvedValue({ id: 'manager', role: 'ADMIN_LOGISTIK', isActive: true });
    mocked(prisma.$transaction).mockRejectedValue(new Error('transaction rolled back'));
    await expect(service.convertAdminManagerRole('manager', 'ADMIN_MANAGER', 'super-admin')).rejects.toThrow('rolled back');
    expect(logAudit).not.toHaveBeenCalled();
  });
});
