import type { Request } from 'express';
import { prisma } from '@lib/prisma';
import {
  getAccessibleBranchIds,
  hasPermission,
} from '@modules/iam/authorization.service';
import { buildAuditWhere } from '../audit.controller';

jest.mock('@lib/prisma', () => ({
  prisma: {
    branch: { findMany: jest.fn() },
  },
}));

jest.mock('@modules/iam/authorization.service', () => ({
  assertBranchAccess: jest.fn(),
  assertPermission: jest.fn(),
  getAccessibleBranchIds: jest.fn(),
  hasPermission: jest.fn(),
}));

describe('audit query filters and branch scope', () => {
  beforeEach(() => jest.clearAllMocks());

  it('combines actor, module, resource, and date filters', async () => {
    (getAccessibleBranchIds as jest.Mock).mockResolvedValue(null);
    (prisma.branch.findMany as jest.Mock).mockResolvedValue([]);
    (hasPermission as jest.Mock).mockResolvedValue(true);

    const where = await buildAuditWhere({
      user: { userId: 'super-admin' },
      query: {
        actor: 'superadmin@raho.id',
        module: 'INVENTORY',
        resource: 'Warehouse',
        startDate: '2026-07-23',
        endDate: '2026-07-23',
      },
    } as unknown as Request);

    expect(where).toMatchObject({
      module: 'INVENTORY',
      resource: 'Warehouse',
      createdAt: {
        gte: expect.any(Date),
        lte: expect.any(Date),
      },
      AND: [
        {
          OR: expect.arrayContaining([
            { user: { email: { contains: 'superadmin@raho.id', mode: 'insensitive' } } },
          ]),
        },
      ],
    });
  });

  it('limits an actor to branches in scope with effective AUDIT.READ', async () => {
    (getAccessibleBranchIds as jest.Mock).mockResolvedValue(['branch-a', 'branch-b']);
    (hasPermission as jest.Mock).mockImplementation(
      async (_userId: string, _permission: string, branchId: string) => branchId === 'branch-a',
    );

    const where = await buildAuditWhere({
      user: { userId: 'manager-a' },
      query: {},
    } as unknown as Request);

    expect(where.branchId).toEqual({ in: ['branch-a'] });
  });
});
