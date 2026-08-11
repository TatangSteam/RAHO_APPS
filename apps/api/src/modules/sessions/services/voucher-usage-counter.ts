import { Prisma, TreatmentCompletionStatus } from '@prisma/client';

export async function syncMemberVoucherUsageCount(tx: Prisma.TransactionClient, memberId: string) {
  const basicUsageCount = await tx.treatmentSession.count({
    where: {
      encounter: { memberId },
      completionStatus: { not: TreatmentCompletionStatus.CANCELLED },
    },
  });
  const boosterUsageCount = await tx.treatmentSession.count({
    where: {
      encounter: { memberId },
      boosterPackageId: { not: null },
      completionStatus: { not: TreatmentCompletionStatus.CANCELLED },
    },
  });

  return tx.member.update({
    where: { id: memberId },
    data: { voucherCount: basicUsageCount + boosterUsageCount },
  });
}
