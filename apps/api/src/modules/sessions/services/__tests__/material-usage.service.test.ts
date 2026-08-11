import { MaterialUsageStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { MaterialUsageService } from '../material-usage.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    treatmentSession: { findUnique: jest.fn() },
    inventoryItem: { findUnique: jest.fn() },
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
});
