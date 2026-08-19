import { Prisma } from '@prisma/client';
import {
  consumeSessionTeamInventory,
  resolveSessionTeamInventory,
  type ResolvedSessionTeamInventory,
} from '../team-session-inventory.service';

function material(quantity = '3') {
  return {
    inventoryItemId: 'inventory-1',
    masterProductId: 'product-1',
    productName: 'IFA + NO',
    baseQuantity: new Prisma.Decimal(quantity),
    baseUnit: 'Botol',
  };
}

function teamWithBags(stocks: Array<{ bagId: string; bagCode: string; stock: string }>) {
  return {
    id: 'team-1',
    teamCode: 'TIM-001',
    name: 'Tim Satu',
    branchId: 'branch-1',
    description: null,
    isActive: true,
    createdBy: 'actor-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    bags: stocks.map((row) => ({
      id: row.bagId,
      bagCode: row.bagCode,
      name: row.bagCode,
      teamId: 'team-1',
      branchId: 'branch-1',
      status: 'ACTIVE',
      isActive: true,
      notes: null,
      createdBy: 'actor-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      stocks: [{
        id: `stock-${row.bagId}`,
        bagId: row.bagId,
        masterProductId: 'product-1',
        stock: new Prisma.Decimal(row.stock),
        minThreshold: new Prisma.Decimal(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
    })),
  };
}

describe('team session inventory source resolver', () => {
  it('falls back to branch stock when no shared active team exists', async () => {
    const tx = {
      homecareMultiBagUsage: { findUnique: jest.fn().mockResolvedValue(null) },
      homecareTeam: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const result = await resolveSessionTeamInventory(tx as never, {
      sessionId: 'session-1',
      branchId: 'branch-1',
      adminLayananId: 'admin-1',
      clinicalUserIds: ['nurse-1'],
      materials: [material()],
    });

    expect(result).toBeNull();
  });

  it('uses the shared team and allocates stock deterministically across active bags', async () => {
    const team = teamWithBags([
      { bagId: 'bag-a', bagCode: 'BAG-001', stock: '2' },
      { bagId: 'bag-b', bagCode: 'BAG-002', stock: '4' },
    ]);
    const tx = {
      homecareMultiBagUsage: { findUnique: jest.fn().mockResolvedValue(null) },
      homecareTeam: { findMany: jest.fn().mockResolvedValue([team]) },
    };

    const result = await resolveSessionTeamInventory(tx as never, {
      sessionId: 'session-1',
      branchId: 'branch-1',
      adminLayananId: 'admin-1',
      clinicalUserIds: ['nurse-1'],
      materials: [material('5')],
    });

    expect(result?.team.id).toBe('team-1');
    expect(result?.allocations.map((row) => ({ bagId: row.bagId, quantity: row.quantity.toString() }))).toEqual([
      { bagId: 'bag-a', quantity: '2' },
      { bagId: 'bag-b', quantity: '3' },
    ]);
  });

  it('does not silently fall back to branch when an assigned team has insufficient stock', async () => {
    const tx = {
      homecareMultiBagUsage: { findUnique: jest.fn().mockResolvedValue(null) },
      homecareTeam: {
        findMany: jest.fn().mockResolvedValue([teamWithBags([{ bagId: 'bag-a', bagCode: 'BAG-001', stock: '1' }])]),
      },
    };

    await expect(resolveSessionTeamInventory(tx as never, {
      sessionId: 'session-1',
      branchId: 'branch-1',
      adminLayananId: 'admin-1',
      clinicalUserIds: ['nurse-1'],
      materials: [material('2')],
    })).rejects.toMatchObject({ code: 'SESSION_TEAM_STOCK_INSUFFICIENT' });
  });

  it('rejects ambiguous assignments to prevent a non-deterministic deduction', async () => {
    const first = teamWithBags([{ bagId: 'bag-a', bagCode: 'BAG-001', stock: '5' }]);
    const second = { ...teamWithBags([{ bagId: 'bag-b', bagCode: 'BAG-002', stock: '5' }]), id: 'team-2' };
    const tx = {
      homecareMultiBagUsage: { findUnique: jest.fn().mockResolvedValue(null) },
      homecareTeam: { findMany: jest.fn().mockResolvedValue([first, second]) },
    };

    await expect(resolveSessionTeamInventory(tx as never, {
      sessionId: 'session-1',
      branchId: 'branch-1',
      adminLayananId: 'admin-1',
      clinicalUserIds: ['nurse-1'],
      materials: [material()],
    })).rejects.toMatchObject({ code: 'SESSION_INVENTORY_TEAM_AMBIGUOUS' });
  });

  it('reuses a matching pre-recorded bag usage without deducting the bag twice', async () => {
    const team = teamWithBags([{ bagId: 'bag-a', bagCode: 'BAG-001', stock: '3' }]);
    const tx = {
      homecareMultiBagUsage: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'completion-old',
          teamId: 'team-1',
          branchId: 'branch-1',
          status: 'COMPLETED',
          usageIds: ['usage-old'],
        }),
      },
      homecareTeam: {
        findUnique: jest.fn().mockResolvedValue(team),
        findMany: jest.fn(),
      },
      homecareBagUsage: {
        findMany: jest.fn().mockResolvedValue([{
          bagId: 'bag-a',
          bag: { bagCode: 'BAG-001' },
          items: [{ masterProductId: 'product-1', quantity: new Prisma.Decimal(3), unit: 'Botol' }],
        }]),
      },
    };

    const result = await resolveSessionTeamInventory(tx as never, {
      sessionId: 'session-1',
      branchId: 'branch-1',
      adminLayananId: 'admin-1',
      clinicalUserIds: ['nurse-1'],
      materials: [material('3')],
    });

    expect(result?.team.id).toBe('team-1');
    expect(result?.allocations[0].quantity.toString()).toBe('3');
    expect(tx.homecareTeam.findMany).not.toHaveBeenCalled();
  });

  it('decrements only the allocated bag stock and records an auditable usage', async () => {
    const team = teamWithBags([{ bagId: 'bag-a', bagCode: 'BAG-001', stock: '5' }]);
    const resolved: ResolvedSessionTeamInventory = {
      team: team as never,
      allocations: [{
        bagId: 'bag-a',
        bagCode: 'BAG-001',
        masterProductId: 'product-1',
        quantity: new Prisma.Decimal(2),
        unit: 'Botol',
      }],
    };
    const tx = {
      homecareMultiBagUsage: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'completion-1' }),
        update: jest.fn().mockResolvedValue({ id: 'completion-1' }),
      },
      homecareBagStock: {
        findMany: jest.fn().mockResolvedValue(team.bags[0].stocks),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      homecareBagUsage: {
        create: jest.fn().mockResolvedValue({ id: 'usage-1' }),
      },
      logisticStockMutation: { create: jest.fn().mockResolvedValue({ id: 'mutation-1' }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    await consumeSessionTeamInventory(tx as never, {
      sessionId: 'session-1',
      sessionCode: 'SES-001',
      branchId: 'branch-1',
      actorUserId: 'actor-1',
      completedAt: new Date('2026-08-18T00:00:00.000Z'),
      resolved,
    });

    expect(tx.homecareBagStock.updateMany).toHaveBeenCalledWith({
      where: { id: 'stock-bag-a', stock: { gte: new Prisma.Decimal(2) } },
      data: { stock: { decrement: new Prisma.Decimal(2) } },
    });
    expect(tx.logisticStockMutation.create).toHaveBeenCalledTimes(1);
  });

  it('reuses a cancelled completion group and deducts stock again for the new posting cycle', async () => {
    const team = teamWithBags([{ bagId: 'bag-a', bagCode: 'BAG-001', stock: '5' }]);
    const resolved: ResolvedSessionTeamInventory = {
      team: team as never,
      allocations: [{
        bagId: 'bag-a',
        bagCode: 'BAG-001',
        masterProductId: 'product-1',
        quantity: new Prisma.Decimal(2),
        unit: 'Botol',
      }],
    };
    const cancelledGroup = {
      id: 'completion-1',
      status: 'CANCELLED',
      treatmentSessionId: 'session-1',
    };
    const tx = {
      homecareMultiBagUsage: {
        findUnique: jest.fn().mockResolvedValue(cancelledGroup),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(cancelledGroup),
      },
      homecareBagStock: {
        findMany: jest.fn().mockResolvedValue(team.bags[0].stocks),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      homecareBagUsage: { create: jest.fn().mockResolvedValue({ id: 'usage-revision-1' }) },
      logisticStockMutation: { create: jest.fn().mockResolvedValue({ id: 'mutation-revision-1' }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    await consumeSessionTeamInventory(tx as never, {
      sessionId: 'session-1',
      sessionCode: 'SES-001',
      branchId: 'branch-1',
      actorUserId: 'manager-1',
      completedAt: new Date('2026-08-19T00:00:00.000Z'),
      completionAttemptKey: 'revision-1',
      resolved,
    });

    expect(tx.homecareMultiBagUsage.create).not.toHaveBeenCalled();
    expect(tx.homecareMultiBagUsage.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: cancelledGroup.id },
      data: expect.objectContaining({ status: 'COMPLETED', usageIds: [] }),
    }));
    expect(tx.homecareBagStock.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.homecareBagUsage.create).toHaveBeenCalledTimes(1);
  });
});
