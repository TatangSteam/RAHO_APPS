// @ts-nocheck
import { prisma } from '@lib/prisma';
import { Prisma, IncentiveType } from '@prisma/client';
import { logger } from '@lib/logger';

/**
 * Calculate and record incentive when a member package is created
 */
export async function calculateAndRecordIncentive(
  memberPackageId: string,
  tx?: Prisma.TransactionClient
) {
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

    // If this package is part of a bundle (has purchaseGroupId), check if incentive already created for this group
    if (memberPackage.purchaseGroupId) {
      const existingGroupIncentive = await db.referralIncentiveRecord.findFirst({
        where: {
          memberPackage: {
            purchaseGroupId: memberPackage.purchaseGroupId,
          },
        },
      });

      // If incentive already exists for this bundle, skip creating duplicate
      if (existingGroupIncentive) {
        logger.info(
          `[IncentiveCalculation] Incentive already exists for bundle ${memberPackage.purchaseGroupId}, skipping`
        );
        return null;
      }
    }

    // Count how many purchase groups this member has (to determine if first package)
    // For bundled packages, count unique purchaseGroupIds
    // For standalone packages, count packages without purchaseGroupId
    const existingGroups = await db.memberPackage.findMany({
      where: {
        memberId: memberPackage.memberId,
        status: {
          in: ['ACTIVE', 'PENDING_PAYMENT'],
        },
      },
      select: {
        purchaseGroupId: true,
      },
    });

    // Get unique purchase groups (including null for standalone)
    const uniqueGroups = new Set(existingGroups.map(p => p.purchaseGroupId || 'standalone'));
    const isFirstPackage = uniqueGroups.size === 1;

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
    } else {
      // Standalone package
      packageValue = Number(memberPackage.finalPrice);
      packageName = `${memberPackage.packageType} - ${memberPackage.totalSessions}x`;
    }

    // Calculate incentive amount
    let incentiveAmount: number;
    if (incentiveType === IncentiveType.PERCENTAGE) {
      incentiveAmount = (packageValue * Number(incentiveValue)) / 100;
    } else {
      // FIXED_AMOUNT
      incentiveAmount = Number(incentiveValue);
    }

    // Round to nearest integer (no decimal)
    incentiveAmount = Math.round(incentiveAmount);

    // Create incentive record
    const incentiveRecord = await db.referralIncentiveRecord.create({
      data: {
        referralCodeId: referralCode.id,
        memberId: memberPackage.memberId,
        memberPackageId: memberPackage.id,
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
          increment: isFirstPackage ? 1 : 0, // Only increment on first package/bundle
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
  const db = tx || prisma;

  try {
    // Find existing incentive record
    const incentiveRecord = await db.referralIncentiveRecord.findFirst({
      where: { memberPackageId },
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
