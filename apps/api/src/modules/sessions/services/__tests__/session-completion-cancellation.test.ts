import {
  PackageStatus,
  Prisma,
  TreatmentCompletionStatus,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { SessionCompletionService } from '../session-completion.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    treatmentSession: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@modules/iam/authorization.service', () => ({
  assertBranchAccess: jest.fn().mockResolvedValue(undefined),
  assertPermission: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@modules/inventory/services/inventory-ledger.service', () => ({
  issueInventoryInTransaction: jest.fn(),
  reverseInventoryPostingInTransaction: jest.fn(),
}));

jest.mock('@modules/inventory/services/treatment-bom.service', () => ({
  resolveSessionMaterialRecommendations: jest.fn(),
}));

jest.mock('@modules/revenue/revenue.service', () => ({
  createTreatmentCompletedEventInTransaction: jest.fn(),
  LEGACY_REVENUE_FLOW_VERSION: 1,
  postTreatmentCompletionFinancialsInTransaction: jest.fn(),
  reverseTreatmentCompletionFinancialsInTransaction: jest.fn(),
}));

jest.mock('@modules/zoho/zoho.inventory-outbox', () => ({
  createInventorySyncEventInTransaction: jest.fn(),
}));

jest.mock('@utils/auditLog', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

const mockPrisma = prisma as unknown as {
  treatmentSession: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

describe('SessionCompletionService.cancelCompletion package usage reversal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('restores both Basic and Booster counters and reads the locked rows once', async () => {
    const basicPackage = {
      id: 'basic-1',
      usedSessions: 1,
      totalSessions: 1,
      status: PackageStatus.EXPIRED,
      expiredAt: new Date('2026-08-01T00:00:00.000Z'),
    };
    const boosterPackage = {
      id: 'booster-1',
      usedSessions: 1,
      totalSessions: 1,
      status: PackageStatus.EXPIRED,
      expiredAt: new Date('2026-08-01T00:00:00.000Z'),
    };
    const session = {
      id: 'session-1',
      sessionCode: 'SES-001',
      branchId: 'branch-1',
      isCompleted: true,
      completionStatus: TreatmentCompletionStatus.COMPLETED,
      completionFlowVersion: 2,
      materialPostingId: null,
      completionJournalEntryId: null,
      recognizedRevenue: new Prisma.Decimal(0),
      materialCost: new Prisma.Decimal(0),
      revenuePackageId: basicPackage.id,
      boosterPackageId: boosterPackage.id,
      encounter: { memberPackageId: basicPackage.id },
    };

    mockPrisma.treatmentSession.findUnique.mockResolvedValue({ branchId: session.branchId });
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([basicPackage, boosterPackage]),
      treatmentSession: {
        findUnique: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockResolvedValue(undefined),
      },
      memberPackage: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      integrationEvent: {
        create: jest.fn().mockResolvedValue({ id: 'cancel-event-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    mockPrisma.$transaction.mockImplementation(
      (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await new SessionCompletionService().cancelCompletion(
      session.id,
      'actor-1',
      { idempotencyKey: 'cancel-1', reason: 'Sesi dibatalkan untuk koreksi' },
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.memberPackage.update).toHaveBeenCalledTimes(2);
    expect(tx.memberPackage.update).toHaveBeenCalledWith({
      where: { id: basicPackage.id },
      data: {
        usedSessions: 0,
        status: PackageStatus.ACTIVE,
        expiredAt: null,
      },
    });
    expect(tx.memberPackage.update).toHaveBeenCalledWith({
      where: { id: boosterPackage.id },
      data: {
        usedSessions: 0,
        status: PackageStatus.ACTIVE,
        expiredAt: null,
      },
    });
  });
});
