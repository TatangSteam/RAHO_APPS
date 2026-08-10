import { Prisma } from '@prisma/client';
import { ensureAutomaticInfusionKitMaterialDrafts } from '../automatic-infusion-kit.service';

function component(id: string, sku: string, name: string, quantity: string) {
  return {
    id,
    componentProductId: `product-${id}`,
    quantity: new Prisma.Decimal(quantity),
    componentProduct: {
      name,
      sku,
      usageUnit: 'Piece',
      conversionFactor: new Prisma.Decimal(1),
    },
  };
}

describe('automatic infusion kit material drafts', () => {
  it('creates only kit components that are missing from an existing session', async () => {
    const client = {
      productKitComponent: {
        findMany: jest.fn().mockResolvedValue([
          component('infus', 'PRD-INF-SET-001', 'Infus Set', '1'),
          component('swab', 'PRD-MED-SWB-001', 'Oneswab', '2'),
        ]),
      },
      materialUsage: {
        findMany: jest.fn().mockResolvedValue([
          { inventoryItem: { masterProductId: 'product-infus' } },
        ]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'inventory-swab', masterProductId: 'product-swab' },
        ]),
      },
    } as any;

    await expect(ensureAutomaticInfusionKitMaterialDrafts(client, {
      sessionId: 'session-1',
      branchId: 'branch-1',
      materialPolicyVersion: 2,
      recordedBy: 'user-1',
    })).resolves.toBe(1);

    expect(client.materialUsage.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        usageKey: 'session-1:inventory-swab',
        inventoryItemId: 'inventory-swab',
        quantity: new Prisma.Decimal(2),
        baseQuantity: new Prisma.Decimal(2),
        recommendedQuantity: new Prisma.Decimal(2),
        recordedBy: 'user-1',
      })],
      skipDuplicates: true,
    });
  });

  it('reports a missing branch inventory component with an actionable error', async () => {
    const client = {
      productKitComponent: {
        findMany: jest.fn().mockResolvedValue([
          component('swab', 'PRD-MED-SWB-001', 'Oneswab', '2'),
        ]),
      },
      materialUsage: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn(),
      },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    await expect(ensureAutomaticInfusionKitMaterialDrafts(client, {
      sessionId: 'session-1',
      branchId: 'branch-1',
      materialPolicyVersion: 2,
      recordedBy: 'user-1',
    })).rejects.toMatchObject({
      status: 422,
      code: 'INFUS_KIT_NOT_IN_BRANCH_INVENTORY',
      message: expect.stringContaining('Oneswab'),
    });
    expect(client.materialUsage.createMany).not.toHaveBeenCalled();
  });

  it('leaves legacy sessions unchanged', async () => {
    const client = {
      productKitComponent: { findMany: jest.fn() },
    } as any;

    await expect(ensureAutomaticInfusionKitMaterialDrafts(client, {
      sessionId: 'session-legacy',
      branchId: 'branch-1',
      materialPolicyVersion: 1,
      recordedBy: 'user-1',
    })).resolves.toBe(0);
    expect(client.productKitComponent.findMany).not.toHaveBeenCalled();
  });
});
