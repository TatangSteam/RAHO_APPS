import { MaterialUsageStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { MaterialUsageService } from '../material-usage.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    treatmentSession: { findUnique: jest.fn() },
    inventoryItem: { findUnique: jest.fn(), findMany: jest.fn() },
    materialUsage: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('@modules/iam/authorization.service', () => ({
  assertBranchAccess: jest.fn(),
  assertPermission: jest.fn(),
}));

jest.mock('@modules/inventory/services/treatment-bom.service', () => ({
  resolveSessionMaterialRecommendations: jest.fn().mockResolvedValue({
    hasActiveBom: false,
    items: [],
  }),
}));

jest.mock('@utils/auditLog', () => ({ logAudit: jest.fn() }));

const service = new MaterialUsageService();
const currentSession = {
  id: 'session-1',
  sessionCode: 'SES-1',
  branchId: 'branch-1',
  isCompleted: false,
  materialPolicyVersion: 2,
};

describe('material usage virtual infusion kit policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.treatmentSession.findUnique as jest.Mock).mockResolvedValue(currentSession);
  });

  it('rejects recording a virtual kit parent as physical material', async () => {
    (prisma.inventoryItem.findUnique as jest.Mock).mockResolvedValue({
      id: 'inventory-kit',
      branchId: 'branch-1',
      masterProductId: 'product-kit',
      masterProduct: {
        name: 'Infus Set + Pelengkap',
        isActive: true,
        conversionFactor: new Prisma.Decimal(1),
        kitComponents: [{ id: 'component-link' }],
        componentOfKits: [],
      },
      balances: [],
    });

    await expect(service.createMaterialUsage(
      'session-1',
      { inventoryItemId: 'inventory-kit', quantity: '1' },
      'user-1',
      'branch-1',
    )).rejects.toMatchObject({
      status: 422,
      code: 'VIRTUAL_KIT_NOT_STOCKABLE',
    });
    expect(prisma.materialUsage.upsert).not.toHaveBeenCalled();
  });

  it('rejects changing a mandatory automatic component quantity', async () => {
    (prisma.inventoryItem.findUnique as jest.Mock).mockResolvedValue({
      id: 'inventory-swab',
      branchId: 'branch-1',
      masterProductId: 'product-swab',
      masterProduct: {
        name: 'Oneswab',
        isActive: true,
        usageUnit: 'Piece',
        conversionFactor: new Prisma.Decimal(1),
        kitComponents: [],
        componentOfKits: [{ quantity: new Prisma.Decimal(2) }],
      },
      balances: [{
        onHandQty: new Prisma.Decimal(100),
        reservedQty: new Prisma.Decimal(0),
        quarantineQty: new Prisma.Decimal(0),
      }],
    });

    await expect(service.createMaterialUsage(
      'session-1',
      { inventoryItemId: 'inventory-swab', quantity: '1' },
      'user-1',
      'branch-1',
    )).rejects.toMatchObject({
      status: 422,
      code: 'INFUS_KIT_QUANTITY_INVALID',
    });
    expect(prisma.materialUsage.upsert).not.toHaveBeenCalled();
  });

  it('rejects deleting a mandatory automatic component draft', async () => {
    (prisma.materialUsage.findFirst as jest.Mock).mockResolvedValue({
      id: 'usage-swab',
      status: MaterialUsageStatus.DRAFT,
      session: {
        branchId: 'branch-1',
        isCompleted: false,
        materialPolicyVersion: 2,
      },
      inventoryItem: {
        masterProduct: { componentOfKits: [{ id: 'component-link' }] },
      },
    });

    await expect(service.deleteMaterialUsage(
      'session-1',
      'usage-swab',
      'user-1',
      'branch-1',
    )).rejects.toMatchObject({
      status: 409,
      code: 'AUTOMATIC_MATERIAL_REQUIRED',
    });
    expect(prisma.materialUsage.delete).not.toHaveBeenCalled();
  });

  it('separates total, reserved, quarantined, and available branch stock', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([{
      id: 'inventory-ifa',
      masterProductId: 'product-ifa',
      branchId: 'branch-1',
      stock: new Prisma.Decimal(709),
      minThreshold: new Prisma.Decimal(10),
      storageLocation: null,
      masterProduct: {
        id: 'product-ifa',
        name: 'IFA + NO 2,5ml',
        baseUnit: 'Botol',
        usageUnit: 'Botol',
        conversionFactor: new Prisma.Decimal(1),
      },
      balances: [{
        onHandQty: new Prisma.Decimal(709),
        reservedQty: new Prisma.Decimal(707),
        quarantineQty: new Prisma.Decimal(0),
      }],
    }]);

    const [item] = await service.getAvailableInventoryItems('branch-1');

    expect(item.stockInfo.totalBaseStock.toFixed()).toBe('709');
    expect(item.stockInfo.reservedBaseStock.toFixed()).toBe('707');
    expect(item.stockInfo.quarantineBaseStock.toFixed()).toBe('0');
    expect(item.stockInfo.baseStock.toFixed()).toBe('2');
    expect(item.stockInfo.requiresLedgerReconciliation).toBe(false);
    expect(item.stockInfo.isLowStock).toBe(true);
  });

  it('flags a legacy mirror quantity that has not reached the ledger', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([{
      id: 'inventory-ifa',
      masterProductId: 'product-ifa',
      branchId: 'branch-1',
      stock: new Prisma.Decimal(709),
      minThreshold: new Prisma.Decimal(10),
      storageLocation: null,
      masterProduct: {
        id: 'product-ifa',
        name: 'IFA + NO 2,5ml',
        baseUnit: 'Botol',
        usageUnit: 'Botol',
        conversionFactor: new Prisma.Decimal(1),
      },
      balances: [{
        onHandQty: new Prisma.Decimal(2),
        reservedQty: new Prisma.Decimal(0),
        quarantineQty: new Prisma.Decimal(0),
      }],
    }]);

    const [item] = await service.getAvailableInventoryItems('branch-1');

    expect(item.stockInfo.totalBaseStock.toFixed()).toBe('2');
    expect(item.stockInfo.legacyMirrorStock.toFixed()).toBe('709');
    expect(item.stockInfo.requiresLedgerReconciliation).toBe(true);
  });
});
