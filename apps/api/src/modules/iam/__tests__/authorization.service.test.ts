import { PermissionEffect, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { assertNotSelf, getEffectivePermissionCodes } from '../authorization.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    roleTemplate: { findUnique: jest.fn() },
    userPermissionOverride: { findMany: jest.fn() },
  },
}));

describe('IAM anti-self-escalation', () => {
  it('rejects sensitive mutations against the actor account', () => {
    expect(() => assertNotSelf('user-a', 'user-a', 'mengubah permission'))
      .toThrow('Anda tidak dapat mengubah permission akun sendiri.');
  });

  it('allows mutations against another account', () => {
    expect(() => assertNotSelf('user-a', 'user-b', 'mengubah permission')).not.toThrow();
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
