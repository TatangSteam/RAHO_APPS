import { TreatmentCompletionStatus } from '@prisma/client';
import { syncMemberVoucherUsageCount } from '../voucher-usage-counter';

describe('syncMemberVoucherUsageCount', () => {
  it('counts Basic and Booster usage while excluding cancelled sessions', async () => {
    const tx = {
      treatmentSession: {
        count: jest.fn()
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(2),
      },
      member: {
        update: jest.fn().mockResolvedValue({ id: 'member-1', voucherCount: 5 }),
      },
    };

    await syncMemberVoucherUsageCount(tx as never, 'member-1');

    expect(tx.treatmentSession.count).toHaveBeenNthCalledWith(1, {
      where: {
        encounter: { memberId: 'member-1' },
        completionStatus: { not: TreatmentCompletionStatus.CANCELLED },
      },
    });
    expect(tx.treatmentSession.count).toHaveBeenNthCalledWith(2, {
      where: {
        encounter: { memberId: 'member-1' },
        boosterPackageId: { not: null },
        completionStatus: { not: TreatmentCompletionStatus.CANCELLED },
      },
    });
    expect(tx.member.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: { voucherCount: 5 },
    });
  });
});
