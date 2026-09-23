import { MaterialUsageStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { logAudit } from '@utils/auditLog';
import { InfusionService } from '../infusion.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    infusionExecution: { findUnique: jest.fn() },
    treatmentSession: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('@utils/auditLog', () => ({ logAudit: jest.fn() }));

describe('InfusionService current inventory flow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses branch ledger stock and stages IFA usage when the legacy mirror is zero', async () => {
    (prisma.infusionExecution.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.treatmentSession.findUnique as jest.Mock).mockResolvedValue({
      id: 'session-1',
      sessionCode: 'SES-PUS-001',
      materialPolicyVersion: 2,
      skipInventoryConsumption: false,
      therapyPlan: null,
      vitalSigns: [],
    });

    const tx = {
      infusionExecution: {
        create: jest.fn().mockResolvedValue({ id: 'infusion-1' }),
      },
      masterProduct: { findMany: jest.fn() },
      inventoryItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inventory-ifa',
          stock: new Prisma.Decimal(0),
          minThreshold: new Prisma.Decimal(10),
          masterProduct: {
            id: 'product-ifa',
            name: 'IFA + NO 2,5ml',
            sku: 'PRD-INF-IFA-002',
            baseUnit: 'Botol',
            usageUnit: 'Botol',
            conversionFactor: new Prisma.Decimal(1),
          },
          balances: [{
            onHandQty: new Prisma.Decimal(70),
            reservedQty: new Prisma.Decimal(0),
            quarantineQty: new Prisma.Decimal(0),
          }],
        }),
        update: jest.fn(),
      },
      materialUsage: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'usage-1' }),
        update: jest.fn(),
      },
      stockMutation: { create: jest.fn() },
      user: { findMany: jest.fn() },
      notification: { create: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));

    await expect(new InfusionService().createInfusion(
      'session-1',
      { ifa250: 1 } as never,
      'doctor-1',
      'branch-pus',
    )).resolves.toMatchObject({ id: 'infusion-1' });

    expect(tx.materialUsage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        treatmentSessionId: 'session-1',
        inventoryItemId: 'inventory-ifa',
        quantity: 1,
        baseQuantity: new Prisma.Decimal(1),
        status: MaterialUsageStatus.DRAFT,
      }),
    });
    expect(tx.inventoryItem.update).not.toHaveBeenCalled();
    expect(tx.stockMutation.create).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalled();
  });
});
