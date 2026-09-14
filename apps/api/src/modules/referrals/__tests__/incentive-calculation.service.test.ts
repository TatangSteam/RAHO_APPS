import { IncentiveType } from '@prisma/client';
import {
  calculateAndRecordIncentive,
  deleteIncentiveOnCancel,
  reconcileIncentiveAfterPackageCancellation,
} from '../incentive-calculation.service';

function createTransactionMock() {
  return {
    memberPackage: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    referralIncentiveRecord: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    referralCode: { update: jest.fn() },
  };
}

function paidPackage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'package-2',
    memberId: 'member-1',
    purchaseGroupId: null,
    packageType: 'BASIC',
    totalSessions: 10,
    finalPrice: 1_000_000,
    status: 'ACTIVE',
    paymentPlanStatus: 'PAID',
    verifiedAt: new Date(),
    refundedAt: null,
    socialProgramRequestId: null,
    member: {
      memberNo: 'M001',
      referralCodeId: 'referral-1',
      firstIncentiveType: IncentiveType.FIXED_AMOUNT,
      firstIncentiveValue: 100_000,
      nextIncentiveType: IncentiveType.FIXED_AMOUNT,
      nextIncentiveValue: 25_000,
      referralCode: { id: 'referral-1', code: 'REF001', isActive: true },
    },
    ...overrides,
  };
}

describe('referral incentive lifecycle', () => {
  it('does not record an incentive before payment is fully paid and verified', async () => {
    const tx = createTransactionMock();
    tx.memberPackage.findUnique.mockResolvedValue(paidPackage({ paymentPlanStatus: 'ACTIVE_INSTALLMENT' }));

    await expect(calculateAndRecordIncentive('package-2', tx as any)).resolves.toBeNull();
    expect(tx.referralIncentiveRecord.create).not.toHaveBeenCalled();
  });

  it('counts each standalone purchase separately when selecting the next-purchase rate', async () => {
    const tx = createTransactionMock();
    tx.memberPackage.findUnique.mockResolvedValue(paidPackage());
    tx.referralIncentiveRecord.findFirst.mockResolvedValue(null);
    tx.memberPackage.findMany.mockResolvedValue([
      { id: 'package-1', purchaseGroupId: null },
      { id: 'package-2', purchaseGroupId: null },
    ]);
    tx.referralIncentiveRecord.create.mockImplementation(({ data }) => Promise.resolve({ id: 'incentive-1', ...data }));

    await calculateAndRecordIncentive('package-2', tx as any);

    expect(tx.referralIncentiveRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isFirstPackage: false,
        incentiveType: IncentiveType.FIXED_AMOUNT,
        incentiveValue: 25_000,
        incentiveAmount: 25_000,
      }),
    });
  });

  it('does not let an unpaid pending package change the first-purchase rate', async () => {
    const tx = createTransactionMock();
    tx.memberPackage.findUnique.mockResolvedValue(paidPackage());
    tx.referralIncentiveRecord.findFirst.mockResolvedValue(null);
    tx.memberPackage.findMany.mockResolvedValue([
      { id: 'package-2', purchaseGroupId: null },
    ]);
    tx.referralIncentiveRecord.create.mockImplementation(({ data }) => Promise.resolve({ id: 'incentive-1', ...data }));

    await calculateAndRecordIncentive('package-2', tx as any);

    expect(tx.memberPackage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'ACTIVE',
        paymentPlanStatus: 'PAID',
        verifiedAt: { not: null },
      }),
    }));
    expect(tx.referralIncentiveRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isFirstPackage: true,
        incentiveValue: 100_000,
      }),
    });
  });

  it('reverses a bundle incentive even when cancellation starts from another package', async () => {
    const tx = createTransactionMock();
    tx.memberPackage.findUnique.mockResolvedValue({ purchaseGroupId: 'group-1' });
    tx.referralIncentiveRecord.findFirst.mockResolvedValue({
      id: 'incentive-1',
      referralCodeId: 'referral-1',
      incentiveAmount: 125_000,
    });

    await deleteIncentiveOnCancel('package-2', tx as any);

    expect(tx.referralCode.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { totalIncentiveEarned: { decrement: 125_000 } },
    }));
    expect(tx.referralIncentiveRecord.delete).toHaveBeenCalledWith({ where: { id: 'incentive-1' } });
  });

  it('recalculates a bundle from its remaining paid packages after a partial cancellation', async () => {
    const tx = createTransactionMock();
    tx.memberPackage.findUnique
      .mockResolvedValueOnce({ purchaseGroupId: 'group-1' })
      .mockResolvedValueOnce({ purchaseGroupId: 'group-1' })
      .mockResolvedValueOnce(paidPackage({ id: 'package-1', purchaseGroupId: 'group-1' }));
    tx.referralIncentiveRecord.findFirst
      .mockResolvedValueOnce({
        id: 'incentive-old',
        referralCodeId: 'referral-1',
        incentiveAmount: 200_000,
        isFirstPackage: true,
      })
      .mockResolvedValueOnce(null);
    tx.memberPackage.findFirst.mockResolvedValue({ id: 'package-1' });
    tx.memberPackage.findMany
      .mockResolvedValueOnce([{ id: 'package-1', purchaseGroupId: 'group-1' }])
      .mockResolvedValueOnce([{
        id: 'package-1',
        packageType: 'BASIC',
        finalPrice: 1_000_000,
        discountAmount: 0,
        discountPercent: 0,
      }]);
    tx.referralIncentiveRecord.create.mockImplementation(({ data }) => Promise.resolve({ id: 'incentive-new', ...data }));

    await reconcileIncentiveAfterPackageCancellation('package-2', tx as any);

    expect(tx.referralIncentiveRecord.delete).toHaveBeenCalledWith({ where: { id: 'incentive-old' } });
    expect(tx.referralIncentiveRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        memberPackageId: 'package-1',
        purchaseGroupId: 'group-1',
        packageValue: 1_000_000,
        isFirstPackage: true,
      }),
    });
    expect(tx.referralCode.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ totalReferrals: { increment: 0 } }),
    }));
  });
});
