import { MaterialUsageStatus, Prisma } from '@prisma/client';
import { syncSessionInfusionToTherapyPlan } from '../services/infusion-material-sync.service';

function createTransaction(options: {
  materialStatus?: MaterialUsageStatus;
  inventoryFound?: boolean;
  skipInventoryConsumption?: boolean;
} = {}) {
  const inventoryItem = {
    id: 'inventory-ifa250',
    stock: new Prisma.Decimal(10),
    masterProduct: {
      name: 'IFA + NO 2,5ml',
      baseUnit: 'Botol',
      usageUnit: 'Botol',
      conversionFactor: new Prisma.Decimal(1),
    },
    balances: [{
      onHandQty: new Prisma.Decimal(10),
      reservedQty: new Prisma.Decimal(0),
      quarantineQty: new Prisma.Decimal(0),
    }],
  };
  const existingUsage = {
    id: 'usage-ifa250',
    status: options.materialStatus ?? MaterialUsageStatus.DRAFT,
  };

  return {
    treatmentSession: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-1',
        branchId: 'branch-1',
        sessionCode: 'SES-001',
        materialPolicyVersion: 2,
        skipInventoryConsumption: options.skipInventoryConsumption ?? false,
        isCompleted: false,
        infusion: {
          id: 'infusion-1',
          ifa250: 1,
          ifa500: null,
          hho: null,
          hhoKonsentrat: null,
          h2: null,
          no: null,
          gaso: null,
          o2: null,
          o3: null,
          edta: null,
          mb: null,
          h2s: null,
          kcl: null,
          jmlNb: null,
        },
      }),
    },
    inventoryItem: {
      findFirst: jest.fn().mockResolvedValue(
        options.inventoryFound === false ? null : inventoryItem
      ),
      update: jest.fn(),
    },
    materialUsage: {
      findFirst: jest.fn().mockResolvedValue(existingUsage),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    stockMutation: { create: jest.fn() },
    infusionExecution: { update: jest.fn().mockResolvedValue({}) },
  };
}

describe('syncSessionInfusionToTherapyPlan', () => {
  it('updates actual infusion and draft material without posting stock early', async () => {
    const tx = createTransaction();

    const result = await syncSessionInfusionToTherapyPlan(tx as unknown as Prisma.TransactionClient, {
      sessionId: 'session-1',
      therapyPlan: { id: 'plan-v2', ifa250: 2 },
      userId: 'doctor-1',
    });

    expect(tx.materialUsage.update).toHaveBeenCalledWith({
      where: { id: 'usage-ifa250' },
      data: expect.objectContaining({
        quantity: 2,
        unit: 'Botol',
        recordedBy: 'doctor-1',
      }),
    });
    expect(tx.inventoryItem.update).not.toHaveBeenCalled();
    expect(tx.stockMutation.create).not.toHaveBeenCalled();
    expect(tx.infusionExecution.update).toHaveBeenCalledWith({
      where: { id: 'infusion-1' },
      data: expect.objectContaining({
        therapyPlanId: 'plan-v2',
        ifa250: 2,
        deviationNotes: null,
      }),
    });
    expect(result).toEqual({ synced: true, adjustedMaterials: 1 });
  });

  it('does not mutate a posted ledger usage without reversal', async () => {
    const tx = createTransaction({ materialStatus: MaterialUsageStatus.CONSUMED });

    await expect(syncSessionInfusionToTherapyPlan(tx as unknown as Prisma.TransactionClient, {
      sessionId: 'session-1',
      therapyPlan: { id: 'plan-v2', ifa250: 2 },
      userId: 'doctor-1',
    })).rejects.toMatchObject({
      status: 409,
      code: 'POSTED_MATERIAL_REQUIRES_REVERSAL',
    });
    expect(tx.inventoryItem.update).not.toHaveBeenCalled();
    expect(tx.infusionExecution.update).not.toHaveBeenCalled();
  });

  it('updates clinical execution without touching current stock for historical no-stock sessions', async () => {
    const tx = createTransaction({ skipInventoryConsumption: true });

    const result = await syncSessionInfusionToTherapyPlan(tx as unknown as Prisma.TransactionClient, {
      sessionId: 'session-1',
      therapyPlan: { id: 'plan-v2', ifa250: 2 },
      userId: 'doctor-1',
    });

    expect(tx.inventoryItem.findFirst).not.toHaveBeenCalled();
    expect(tx.materialUsage.update).not.toHaveBeenCalled();
    expect(tx.infusionExecution.update).toHaveBeenCalledWith({
      where: { id: 'infusion-1' },
      data: expect.objectContaining({ therapyPlanId: 'plan-v2', ifa250: 2 }),
    });
    expect(result).toEqual({ synced: true, adjustedMaterials: 0 });
  });

  it('rolls back the edit when a changed material is not configured in branch stock', async () => {
    const tx = createTransaction({ inventoryFound: false });

    await expect(syncSessionInfusionToTherapyPlan(tx as unknown as Prisma.TransactionClient, {
      sessionId: 'session-1',
      therapyPlan: { id: 'plan-v2', ifa250: 2 },
      userId: 'doctor-1',
    })).rejects.toMatchObject({
      status: 409,
      code: 'MATERIAL_INVENTORY_NOT_FOUND',
    });
    expect(tx.materialUsage.update).not.toHaveBeenCalled();
    expect(tx.infusionExecution.update).not.toHaveBeenCalled();
  });
});
