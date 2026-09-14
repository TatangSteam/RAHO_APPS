import { prisma } from '@lib/prisma';
import { Prisma, IncentiveType } from '@prisma/client';
import { logger } from '@lib/logger';

/**
 * Calculate and record incentive when a member package is created
 */
export async function calculateAndRecordIncentive(
  memberPackageId: string,
  tx?: Prisma.TransactionClient,
  options: { incrementReferralCount?: boolean; forceIsFirstPackage?: boolean } = {},
) {
  if (!tx) {
    return prisma.$transaction((transaction) => calculateAndRecordIncentive(memberPackageId, transaction, options));
  }
  const db = tx || prisma;

  try {
    // Get member package with member and referral code info
    const memberPackage = await db.memberPackage.findUnique({
      where: { id: memberPackageId },
      include: {
        member: {
          include: {
            referralCode: true,
          },
        },
      },
    });

    if (!memberPackage) {
      logger.warn(`[IncentiveCalculation] MemberPackage not found: ${memberPackageId}`);
      return null;
    }

    if (
      memberPackage.status !== 'ACTIVE'
      || memberPackage.paymentPlanStatus !== 'PAID'
      || !memberPackage.verifiedAt
      || memberPackage.refundedAt
      || memberPackage.socialProgramRequestId
    ) {
      logger.info(`[IncentiveCalculation] Package ${memberPackageId} is not fully paid and verified`);
      return null;
    }

    // Check if member has referral code
    if (!memberPackage.member.referralCodeId || !memberPackage.member.referralCode) {
      logger.info(`[IncentiveCalculation] Member ${memberPackage.memberId} has no referral code`);
      return null;
    }

    const member = memberPackage.member;
    const referralCode = member.referralCode;

    // Check if referral code is active
    if (!referralCode.isActive) {
      logger.warn(`[IncentiveCalculation] Referral code ${referralCode.code} is inactive`);
      return null;
    }

    // Check if member has incentive settings
    if (!member.firstIncentiveType && !member.nextIncentiveType) {
      logger.info(`[IncentiveCalculation] Member ${member.memberNo} has no incentive settings`);
      return null;
    }

    const existingIncentive = await db.referralIncentiveRecord.findFirst({
      where: memberPackage.purchaseGroupId
        ? {
            OR: [
              { purchaseGroupId: memberPackage.purchaseGroupId },
              { memberPackage: { purchaseGroupId: memberPackage.purchaseGroupId } },
            ],
          }
        : { memberPackageId },
    });
    if (existingIncentive) {
      logger.info(`[IncentiveCalculation] Incentive already exists for purchase ${memberPackageId}, skipping`);
      return existingIncentive;
    }

    // Count how many purchase groups this member has (to determine if first package)
    // For bundled packages, count unique purchaseGroupIds
    // For standalone packages, count packages without purchaseGroupId
    const existingGroups = await db.memberPackage.findMany({
      where: {
        memberId: memberPackage.memberId,
        status: 'ACTIVE',
        paymentPlanStatus: 'PAID',
        verifiedAt: { not: null },
        refundedAt: null,
        socialProgramRequestId: null,
      },
      select: {
        id: true,
        purchaseGroupId: true,
      },
    });

    // Bundles count once, while every standalone package is its own purchase.
    const uniqueGroups = new Set(existingGroups.map((pkg) => (
      pkg.purchaseGroupId ? `group:${pkg.purchaseGroupId}` : `package:${pkg.id}`
    )));
    const isFirstPackage = options.forceIsFirstPackage ?? uniqueGroups.size === 1;

    // Get incentive settings from MEMBER (not referral code)
    const incentiveType = isFirstPackage
      ? member.firstIncentiveType
      : member.nextIncentiveType;
    const incentiveValue = isFirstPackage
      ? member.firstIncentiveValue
      : member.nextIncentiveValue;

    // Skip if no incentive configured for this package type
    if (!incentiveType || !incentiveValue) {
      logger.info(
        `[IncentiveCalculation] No incentive configured for member ${member.memberNo} ` +
          `(${isFirstPackage ? 'first' : 'next'} package)`
      );
      return null;
    }

    // Calculate package value for incentive
    // If part of a bundle, sum all packages in the same purchaseGroupId
    let packageValue: number;
    let packageName: string;

    if (memberPackage.purchaseGroupId) {
      // Get all packages in this bundle
      const bundlePackages = await db.memberPackage.findMany({
        where: {
          purchaseGroupId: memberPackage.purchaseGroupId,
          status: 'ACTIVE',
          paymentPlanStatus: 'PAID',
          verifiedAt: { not: null },
          refundedAt: null,
          socialProgramRequestId: null,
        },
        select: {
          id: true,
          packageType: true,
          finalPrice: true,
          discountAmount: true,
          discountPercent: true,
        },
      });

      // Sum all finalPrice in the bundle
      packageValue = bundlePackages.reduce((sum, pkg) => sum + Number(pkg.finalPrice), 0);
      
      const basicCount = bundlePackages.filter(p => p.packageType === 'BASIC').length;
      const boosterCount = bundlePackages.filter(p => p.packageType === 'BOOSTER').length;
      packageName = `Bundle (${basicCount} BASIC + ${boosterCount} BOOSTER)`;
      
      logger.info(
        `[IncentiveCalculation] Calculating incentive for bundle ${memberPackage.purchaseGroupId}: ` +
          `${bundlePackages.length} packages, total value Rp ${packageValue}`
      );
      
      // Debug: Log each package's finalPrice
      bundlePackages.forEach((pkg, idx) => {
        logger.info(
          `[IncentiveCalculation] Bundle package ${idx + 1}: ` +
            `${pkg.packageType} - finalPrice: Rp ${pkg.finalPrice}, ` +
            `discountAmount: Rp ${pkg.discountAmount || 0}, ` +
            `discountPercent: ${pkg.discountPercent || 0}%`
        );
      });
      
      logger.info(
        `[IncentiveCalculation] Total packageValue for bundle: Rp ${packageValue}`
      );
    } else {
      // Standalone package
      packageValue = Number(memberPackage.finalPrice);
      packageName = `${memberPackage.packageType} - ${memberPackage.totalSessions}x`;
    }

    // Calculate incentive amount
    let incentiveAmount: number;
    if (incentiveType === IncentiveType.PERCENTAGE) {
      incentiveAmount = (packageValue * Number(incentiveValue)) / 100;
      logger.info(
        `[IncentiveCalculation] Percentage calculation: ` +
          `Rp ${packageValue} × ${incentiveValue}% = Rp ${incentiveAmount}`
      );
    } else {
      // FIXED_AMOUNT
      incentiveAmount = Number(incentiveValue);
      logger.info(
        `[IncentiveCalculation] Fixed amount: Rp ${incentiveAmount}`
      );
    }

    // Round to nearest integer (no decimal)
    incentiveAmount = Math.round(incentiveAmount);
    
    logger.info(
      `[IncentiveCalculation] Final incentive amount (after rounding): Rp ${incentiveAmount}`
    );

    // Create incentive record
    const incentiveRecord = await db.referralIncentiveRecord.create({
      data: {
        referralCodeId: referralCode.id,
        memberId: memberPackage.memberId,
        memberPackageId: memberPackage.id,
        purchaseGroupId: memberPackage.purchaseGroupId,
        packageType: memberPackage.packageType,
        packageName,
        packageValue,
        isFirstPackage,
        incentiveType,
        incentiveValue,
        incentiveAmount,
        notes: memberPackage.purchaseGroupId
          ? `Auto-calculated incentive for ${isFirstPackage ? 'first' : 'subsequent'} bundle (total bundling)`
          : `Auto-calculated incentive for ${isFirstPackage ? 'first' : 'subsequent'} package`,
      },
    });

    // Update referral code statistics
    await db.referralCode.update({
      where: { id: referralCode.id },
      data: {
        totalReferrals: {
          increment: isFirstPackage && options.incrementReferralCount !== false ? 1 : 0,
        },
        totalIncentiveEarned: {
          increment: incentiveAmount,
        },
      },
    });

    logger.info(
      `[IncentiveCalculation] Created incentive record for referral ${referralCode.code}: ` +
        `${incentiveType} ${incentiveValue} = Rp ${incentiveAmount} ` +
        `(from member ${member.memberNo}, package value: Rp ${packageValue})`
    );

    return incentiveRecord;
  } catch (error) {
    logger.error('[IncentiveCalculation] Error calculating incentive:', error);
    throw error;
  }
}

/** Rebuild an incentive after package pricing or composition changes. */
export async function refreshIncentiveAfterPackageEdit(
  memberPackageId: string,
  tx?: Prisma.TransactionClient,
) {
  if (!tx) {
    return prisma.$transaction((transaction) => refreshIncentiveAfterPackageEdit(memberPackageId, transaction));
  }
  const previous = await deleteIncentiveOnCancel(memberPackageId, tx);
  return calculateAndRecordIncentive(memberPackageId, tx, {
    incrementReferralCount: !previous?.isFirstPackage,
    forceIsFirstPackage: previous?.isFirstPackage,
  });
}

/**
 * Reconcile a bundled purchase after one package is cancelled or refunded.
 * Standalone incentives are removed, while a bundle is recalculated from the
 * remaining eligible packages without counting the referral twice.
 */
export async function reconcileIncentiveAfterPackageCancellation(
  memberPackageId: string,
  tx?: Prisma.TransactionClient,
) {
  if (!tx) {
    return prisma.$transaction((transaction) => (
      reconcileIncentiveAfterPackageCancellation(memberPackageId, transaction)
    ));
  }

  const changedPackage = await tx.memberPackage.findUnique({
    where: { id: memberPackageId },
    select: { purchaseGroupId: true },
  });
  const previous = await deleteIncentiveOnCancel(memberPackageId, tx);
  if (!changedPackage?.purchaseGroupId) return null;

  const remainingPackage = await tx.memberPackage.findFirst({
    where: {
      purchaseGroupId: changedPackage.purchaseGroupId,
      status: 'ACTIVE',
      paymentPlanStatus: 'PAID',
      verifiedAt: { not: null },
      refundedAt: null,
      socialProgramRequestId: null,
    },
    select: { id: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (!remainingPackage) return null;

  return calculateAndRecordIncentive(remainingPackage.id, tx, {
    incrementReferralCount: !previous?.isFirstPackage,
    forceIsFirstPackage: previous?.isFirstPackage,
  });
}

/**
 * Recalculate incentive when package status changes
 * (e.g., from PENDING_PAYMENT to ACTIVE)
 */
export async function recalculateIncentiveOnStatusChange(
  memberPackageId: string,
  oldStatus: string,
  newStatus: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx || prisma;

  // Only recalculate if transitioning to ACTIVE from PENDING_PAYMENT
  if (oldStatus === 'PENDING_PAYMENT' && newStatus === 'ACTIVE') {
    // Check if incentive record already exists
    const existingRecord = await db.referralIncentiveRecord.findFirst({
      where: { memberPackageId },
    });

    if (!existingRecord) {
      // Create incentive record if it doesn't exist
      return await calculateAndRecordIncentive(memberPackageId, db);
    }
  }

  return null;
}

/**
 * Delete incentive record when package is cancelled
 */
export async function deleteIncentiveOnCancel(
  memberPackageId: string,
  tx?: Prisma.TransactionClient
) {
  if (!tx) {
    return prisma.$transaction((transaction) => deleteIncentiveOnCancel(memberPackageId, transaction));
  }
  const db = tx || prisma;

  try {
    const memberPackage = await db.memberPackage.findUnique({
      where: { id: memberPackageId },
      select: { purchaseGroupId: true },
    });

    // Find the purchase incentive even when the selected package is not the
    // first package in a bundle.
    const incentiveRecord = await db.referralIncentiveRecord.findFirst({
      where: memberPackage?.purchaseGroupId
        ? {
            OR: [
              { purchaseGroupId: memberPackage.purchaseGroupId },
              { memberPackage: { purchaseGroupId: memberPackage.purchaseGroupId } },
            ],
          }
        : { memberPackageId },
      include: {
        referralCode: true,
      },
    });

    if (!incentiveRecord) {
      return null;
    }

    // Update referral code statistics (subtract)
    await db.referralCode.update({
      where: { id: incentiveRecord.referralCodeId },
      data: {
        totalIncentiveEarned: {
          decrement: Number(incentiveRecord.incentiveAmount),
        },
        // Note: We don't decrement totalReferrals as the referral still happened
      },
    });

    // Delete the incentive record
    await db.referralIncentiveRecord.delete({
      where: { id: incentiveRecord.id },
    });

    logger.info(
      `[IncentiveCalculation] Deleted incentive record for cancelled package: ${memberPackageId}`
    );

    return incentiveRecord;
  } catch (error) {
    logger.error('[IncentiveCalculation] Error deleting incentive:', error);
    throw error;
  }
}
