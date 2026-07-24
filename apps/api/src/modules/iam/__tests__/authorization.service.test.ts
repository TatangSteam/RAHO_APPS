import { PermissionEffect, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { logAudit } from '@utils/auditLog';
import { assertNotSelf, getEffectivePermissionCodes } from '../authorization.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    roleTemplate: { findUnique: jest.fn() },
    userPermissionOverride: { findMany: jest.fn() },
  },
}));
jest.mock('@utils/auditLog', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

describe('IAM anti-self-escalation', () => {
  it('rejects sensitive mutations against the actor account', async () => {
    await expect(assertNotSelf('user-a', 'user-a', 'mengubah permission'))
      .rejects.toThrow('Anda tidak dapat mengubah permission akun sendiri.');
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-a',
      action: 'ACCESS_DENIED',
      module: 'IAM',
      resource: 'SecurityEvent',
      resourceId: 'user-a',
      metadata: expect.objectContaining({ eventType: 'SELF_ESCALATION_DENIED' }),
    }));
  });

  it('allows mutations against another account', async () => {
    await expect(assertNotSelf('user-a', 'user-b', 'mengubah permission')).resolves.toBeUndefined();
  });
});

describe('effective permission evaluation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('applies template, global override, then branch override in deterministic order', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ role: Role.ADMIN_CABANG, isActive: true })
      .mockResolvedValueOnce({
        roleTemplate: {
          isActive: true,
          permissions: [
            { permission: { code: 'INVOICE.READ' } },
            { permission: { code: 'INVOICE.UPDATE' } },
          ],
        },
      });
    (prisma.userPermissionOverride.findMany as jest.Mock).mockResolvedValue([
      { effect: PermissionEffect.ALLOW, scopeKey: 'branch-a', permission: { code: 'INVOICE.READ' } },
      { effect: PermissionEffect.DENY, scopeKey: 'GLOBAL', permission: { code: 'INVOICE.READ' } },
      { effect: PermissionEffect.DENY, scopeKey: 'branch-a', permission: { code: 'INVOICE.UPDATE' } },
    ]);

    await expect(getEffectivePermissionCodes('user-a', 'branch-a'))
      .resolves.toEqual(['INVOICE.READ']);
  });

  it('returns no permission for an inactive user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: Role.ADMIN_CABANG, isActive: false });
    await expect(getEffectivePermissionCodes('user-a')).resolves.toEqual([]);
    expect(prisma.userPermissionOverride.findMany).not.toHaveBeenCalled();
  });
});
