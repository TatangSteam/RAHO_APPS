export async function syncMemberVoucherUsageCount(tx: any, memberId: string) {
  const basicUsageCount = await tx.treatmentSession.count({
    where: {
      encounter: { memberId },
    },
  });
  const boosterUsageCount = await tx.treatmentSession.count({
    where: {
      encounter: { memberId },
      boosterPackageId: { not: null },
    },
  });

  return tx.member.update({
    where: { id: memberId },
    data: { voucherCount: basicUsageCount + boosterUsageCount },
  });
}
