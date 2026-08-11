import { PackageStatus, TreatmentCompletionStatus } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { logAudit } from '../../../../utils/auditLog';
import { SessionDeletionService } from '../session-deletion.service';
import { cleanupDeletedSessionFiles } from '../session-file-cleanup';
import { syncMemberVoucherUsageCount } from '../voucher-usage-counter';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    treatmentSession: { findUnique: jest.fn() },
    stockMutation: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../../utils/auditLog', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../voucher-usage-counter', () => ({
  syncMemberVoucherUsageCount: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../session-file-cleanup', () => ({
  cleanupDeletedSessionFiles: jest.fn().mockResolvedValue({
    requested: 0,
    localDeleted: 0,
    failedUrls: [],
  }),
}));

const mockPrisma = prisma as unknown as {
  treatmentSession: { findUnique: jest.Mock };
  stockMutation: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

describe('SessionDeletionService', () => {
  const session = {
    id: 'session-1',
    sessionCode: 'SES-001',
    branchId: 'branch-1',
    treatmentDate: new Date('2026-08-11T08:00:00.000Z'),
    isCompleted: false,
    completionStatus: TreatmentCompletionStatus.IN_PROGRESS,
    encounter: {
      memberId: 'member-1',
      memberPackage: { id: 'basic-1' },
      member: { user: { profile: { fullName: 'Member Test' } } },
    },
    boosterPackage: { id: 'booster-1' },
    branch: { name: 'RAHO Jakarta' },
    infusion: { id: 'infusion-1' },
    materials: [{ id: 'material-1' }],
    therapyPlan: { id: 'plan-1', planCode: 'PLAN-001' },
    photo: null,
    supportingPhotos: [],
  };

  const makeTx = (sessionResult: Record<string, unknown> = session) => ({
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'session-1' }]),
    inventoryItem: {
      update: jest.fn()
        .mockResolvedValueOnce({ stock: 10 })
        .mockResolvedValueOnce({ stock: 5 }),
    },
    stockMutation: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(undefined),
    },
    memberPackage: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn()
        .mockResolvedValueOnce({
          status: PackageStatus.EXPIRED,
          usedSessions: 0,
          totalSessions: 1,
        })
        .mockResolvedValueOnce({
          status: PackageStatus.EXPIRED,
          usedSessions: 0,
          totalSessions: 1,
        }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    doctorEvaluation: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue(undefined),
    },
    doctorEvaluationHistory: { deleteMany: jest.fn().mockResolvedValue(undefined) },
    vitalSign: { deleteMany: jest.fn().mockResolvedValue(undefined) },
    materialUsage: { deleteMany: jest.fn().mockResolvedValue(undefined) },
    infusionExecution: { deleteMany: jest.fn().mockResolvedValue(undefined) },
    sessionPhoto: { deleteMany: jest.fn().mockResolvedValue(undefined) },
    sessionSupportingPhoto: { deleteMany: jest.fn().mockResolvedValue(undefined) },
    eMRNote: { deleteMany: jest.fn().mockResolvedValue(undefined) },
    sessionDoctor: { deleteMany: jest.fn().mockResolvedValue(undefined) },
    sessionNurse: { deleteMany: jest.fn().mockResolvedValue(undefined) },
    therapyPlan: { updateMany: jest.fn().mockResolvedValue(undefined) },
    treatmentSession: {
      findUnique: jest.fn().mockResolvedValue(sessionResult),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns Basic and Booster vouchers and restores only the net stock usage', async () => {
    const tx = makeTx();
    tx.stockMutation.findMany.mockResolvedValue([
      // Two units used, then one unit already returned by a therapy-plan edit.
      { inventoryItemId: 'item-1', stockBefore: 10, stockAfter: 8 },
      { inventoryItemId: 'item-1', stockBefore: 8, stockAfter: 9 },
      { inventoryItemId: 'item-2', stockBefore: 5, stockAfter: 4 },
    ]);
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await new SessionDeletionService().deleteSession('session-1', 'admin-1');

    expect(tx.inventoryItem.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'item-1' },
      data: { stock: { increment: 1 } },
      select: { stock: true },
    });
    expect(tx.inventoryItem.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'item-2' },
      data: { stock: { increment: 1 } },
      select: { stock: true },
    });
    expect(tx.memberPackage.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.memberPackage.updateMany).toHaveBeenCalledWith({
      where: { id: 'basic-1', usedSessions: { gt: 0 } },
      data: { usedSessions: { decrement: 1 } },
    });
    expect(tx.memberPackage.updateMany).toHaveBeenCalledWith({
      where: { id: 'booster-1', usedSessions: { gt: 0 } },
      data: { usedSessions: { decrement: 1 } },
    });
    expect(tx.memberPackage.update).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(syncMemberVoucherUsageCount).toHaveBeenCalledWith(tx, 'member-1');
    expect(tx.treatmentSession.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    expect(result).toMatchObject({
      sessionId: 'session-1',
      restoredStockItems: 2,
      restoredStockQuantity: 2,
      restoredVouchers: { basic: 1, booster: 1 },
    });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      meta: expect.objectContaining({
        restoredBasicVoucher: true,
        restoredBoosterVoucher: true,
        rolledBackStockMutations: 3,
      }),
    }));
    expect(cleanupDeletedSessionFiles).toHaveBeenCalledWith([undefined]);
  });

  it('rejects deletion after the session has been posted', async () => {
    const tx = makeTx({
      ...session,
      isCompleted: true,
      completionStatus: TreatmentCompletionStatus.COMPLETED,
    });
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      new SessionDeletionService().deleteSession('session-1', 'admin-1')
    ).rejects.toMatchObject({
      status: 409,
      code: 'POSTED_SESSION_IMMUTABLE',
    });

    expect(tx.stockMutation.findMany).not.toHaveBeenCalled();
    expect(tx.treatmentSession.delete).not.toHaveBeenCalled();
  });
});
