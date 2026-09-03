import { Prisma, TreatmentCompletionStatus } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { assertBranchAccess, assertPermission } from '@modules/iam/authorization.service';
import { resolveInfusionKitAvailability } from '@modules/inventory/services/infusion-kit-availability.service';
import { logAudit } from '@utils/auditLog';
import { SessionMaterialActivationService } from '../session-material-activation.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    treatmentSession: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@modules/iam/authorization.service', () => ({
  assertBranchAccess: jest.fn(),
  assertPermission: jest.fn(),
}));

jest.mock('@modules/inventory/services/infusion-kit-availability.service', () => ({
  resolveInfusionKitAvailability: jest.fn(),
}));

jest.mock('@utils/auditLog', () => ({ logAudit: jest.fn() }));

const service = new SessionMaterialActivationService();

describe('SessionMaterialActivationService', () => {
  const tx = {
    $queryRaw: jest.fn(),
    treatmentSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    materialUsage: { createMany: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.treatmentSession.findUnique as jest.Mock).mockResolvedValue({ branchId: 'branch-1' });
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.$queryRaw.mockResolvedValue([]);
    tx.treatmentSession.findUnique.mockResolvedValue({
      id: 'session-1',
      sessionCode: 'SES-1',
      branchId: 'branch-1',
      isCompleted: false,
      completionStatus: TreatmentCompletionStatus.IN_PROGRESS,
      skipInventoryConsumption: true,
      materialPolicyVersion: 2,
    });
    tx.materialUsage.createMany.mockResolvedValue({ count: 1 });
    tx.treatmentSession.update.mockResolvedValue(undefined);
    (resolveInfusionKitAvailability as jest.Mock).mockResolvedValue({
      configured: true,
      available: true,
      availableSessionCount: 4,
      kitProduct: { id: 'kit-1', name: 'Infus Set + Pelengkap' },
      components: [{
        isAvailable: true,
        inventoryItem: { id: 'inventory-1' },
        availableUsageQuantity: new Prisma.Decimal(10),
        component: {
          quantity: new Prisma.Decimal(1),
          componentProduct: {
            name: 'Infus Set',
            usageUnit: 'Set',
            conversionFactor: new Prisma.Decimal(1),
          },
        },
      }],
    });
  });

  it('mengaktifkan inventory dan membuat komponen kit sebagai draft', async () => {
    const result = await service.activate('session-1', 'user-1', 'branch-1');

    expect(assertBranchAccess).toHaveBeenCalledWith('user-1', 'branch-1');
    expect(assertPermission).toHaveBeenCalledWith('user-1', expect.any(String), 'branch-1');
    expect(tx.materialUsage.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({
        treatmentSessionId: 'session-1',
        inventoryItemId: 'inventory-1',
        usageKey: 'session-1:inventory-1',
      })],
    }));
    expect(tx.treatmentSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { skipInventoryConsumption: false, materialPolicyVersion: 2 },
    });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'TreatmentSession',
      resourceId: 'session-1',
    }));
    expect(result).toMatchObject({
      alreadyActive: false,
      createdMaterialCount: 1,
      availableSessionCount: 4,
    });
  });

  it('tidak mengaktifkan material untuk sesi yang sudah selesai', async () => {
    tx.treatmentSession.findUnique.mockResolvedValue({
      id: 'session-1',
      sessionCode: 'SES-1',
      branchId: 'branch-1',
      isCompleted: true,
      completionStatus: TreatmentCompletionStatus.COMPLETED,
      skipInventoryConsumption: true,
      materialPolicyVersion: 2,
    });

    await expect(service.activate('session-1', 'user-1', 'branch-1')).rejects.toMatchObject({
      status: 409,
      code: 'SESSION_MATERIAL_ACTIVATION_LOCKED',
    });
    expect(tx.materialUsage.createMany).not.toHaveBeenCalled();
    expect(tx.treatmentSession.update).not.toHaveBeenCalled();
  });

  it('mengembalikan hasil idempoten jika material sudah aktif', async () => {
    tx.treatmentSession.findUnique.mockResolvedValue({
      id: 'session-1',
      sessionCode: 'SES-1',
      branchId: 'branch-1',
      isCompleted: false,
      completionStatus: TreatmentCompletionStatus.IN_PROGRESS,
      skipInventoryConsumption: false,
      materialPolicyVersion: 2,
    });

    const result = await service.activate('session-1', 'user-1', 'branch-1');

    expect(result.alreadyActive).toBe(true);
    expect(resolveInfusionKitAvailability).not.toHaveBeenCalled();
    expect(tx.materialUsage.createMany).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });
});
