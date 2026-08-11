import { prisma } from '../../../lib/prisma';
import { getAggregatePackageStatus, getCurrentPackageGroupItems } from './package-retrieval.helpers';
import { Prisma } from '@prisma/client';

type PackageWithDetails = Prisma.MemberPackageGetPayload<{
  include: {
    branch: true;
    packagePricing: true;
    incentiveRecords: {
      include: {
        referralCode: {
          select: { code: true; referrerName: true; referrerType: true };
        };
      };
    };
  };
}>;

type AddOnWithBranch = Prisma.MemberAddOnGetPayload<{ include: { branch: true } }>;
type UserWithProfile = Prisma.UserGetPayload<{ include: { profile: true } }>;

/**
 * Service for retrieving package data
 */
export class PackageRetrievalService {
  /**
   * Get member packages with grouping
   */
  async getMemberPackages(memberId: string, branchIds: string | string[]) {
    try {
      const accessibleBranchIds = Array.isArray(branchIds)
        ? Array.from(new Set(branchIds.filter(Boolean)))
        : [branchIds].filter(Boolean);

      console.log('=== getMemberPackages called ===');
      console.log('memberId:', memberId);
      console.log('branchIds:', accessibleBranchIds);

      if (accessibleBranchIds.length === 0) {
        console.log('No accessible branches provided, returning empty array');
        return [];
      }

      const branchWhere =
        accessibleBranchIds.length === 1
          ? accessibleBranchIds[0]
          : { in: accessibleBranchIds };
      
      // Query packages and add-ons in parallel
      const [packages, addOns] = await Promise.all([
        prisma.memberPackage.findMany({
          where: { memberId, branchId: branchWhere },
          include: { 
            branch: true,
            packagePricing: true, // Include pricing for edit functionality
            incentiveRecords: {
              include: {
                referralCode: {
                  select: {
                    code: true,
                    referrerName: true,
                    referrerType: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.memberAddOn.findMany({
          where: { memberId, branchId: branchWhere },
          include: { branch: true },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      console.log('Found packages count:', packages.length);
      console.log('Found add-ons count:', addOns.length);

      // If no packages and no add-ons, return empty array
      if (packages.length === 0 && addOns.length === 0) {
        console.log('No packages or add-ons found for this branch, returning empty array');
        return [];
      }

      // Get user info separately
      const userIds = Array.from(new Set([
        ...packages.map(p => p.assignedBy),
        ...packages.filter(p => p.verifiedBy).map(p => p.verifiedBy!),
        ...addOns.map(a => a.assignedBy),
        ...addOns.filter(a => a.verifiedBy).map(a => a.verifiedBy!),
      ]));
      
      const users = userIds.length > 0 ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        include: { profile: true },
      }) : [];

      const userMap = new Map(users.map(u => [u.id, u]));

      // Group packages by purchaseGroupId
      type FormattedItem =
        | ReturnType<PackageRetrievalService['formatPackageData']>
        | ReturnType<PackageRetrievalService['formatAddOnData']>;
      const grouped = new Map<string, FormattedItem[]>();
      const standalone: FormattedItem[] = [];

      packages.forEach((pkg) => {
        const pkgData = this.formatPackageData(pkg, userMap);

        if (pkg.purchaseGroupId) {
          if (!grouped.has(pkg.purchaseGroupId)) {
            grouped.set(pkg.purchaseGroupId, []);
          }
          grouped.get(pkg.purchaseGroupId)!.push(pkgData);
        } else {
          standalone.push(pkgData);
        }
      });

      // Process add-ons
      addOns.forEach((addon) => {
        const addonData = this.formatAddOnData(addon, userMap);

        // If add-on has packageId, try to find its group
        if (addon.packageId) {
          const pkg = packages.find(p => p.id === addon.packageId);
          if (pkg?.purchaseGroupId) {
            if (!grouped.has(pkg.purchaseGroupId)) {
              grouped.set(pkg.purchaseGroupId, []);
            }
            grouped.get(pkg.purchaseGroupId)!.push(addonData);
          } else {
            standalone.push(addonData);
          }
        } else {
          standalone.push(addonData);
        }
      });

      // Convert grouped packages to array format
      const groupedPackages = Array.from(grouped.values()).map(group => {
        const currentGroup = getCurrentPackageGroupItems(group);
        const basics = currentGroup.filter(p => !p.isAddOn && p.packageType === 'BASIC');
        const boosters = currentGroup.filter(p => !p.isAddOn && p.packageType === 'BOOSTER');
        const groupAddOns = currentGroup.filter(p => p.isAddOn);
        
        return {
          isGroup: true,
          purchaseGroupId: currentGroup[0]?.purchaseGroupId,
          basics,
          boosters,
          addOns: groupAddOns,
          totalPrice: currentGroup.reduce((sum, item) => {
            return sum + (item.finalPrice || item.totalPrice || 0);
          }, 0),
          status: getAggregatePackageStatus(currentGroup) || currentGroup[0]?.status,
          createdAt: currentGroup[0]?.createdAt,
        };
      });

      // Combine grouped and standalone packages
      const combined = [...groupedPackages, ...standalone];
      
      // Sort by createdAt descending (newest first)
      const result = combined.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Descending order (newest first)
      });
      
      console.log('Returning packages:', result.length);
      return result;
    } catch (error) {
      console.error('Error in getMemberPackages:', error);
      throw error;
    }
  }

  /**
   * Format package data for response
   */
  private formatPackageData(pkg: PackageWithDetails, userMap: Map<string, UserWithProfile>) {
    // Get incentive record if exists
    const incentiveRecord = pkg.incentiveRecords && pkg.incentiveRecords.length > 0 
      ? pkg.incentiveRecords[0] 
      : null;

    const productBoosterType = typeof pkg.productCode === 'string'
      ? pkg.productCode.match(/^BST-([^-]+)-/)?.[1]
      : undefined;

    // Calculate quantity from pricing if available
    const baseSessions = pkg.packagePricing?.totalSessions || pkg.totalSessions;
    const purchaseQuantity = baseSessions > 0 ? Math.round(pkg.totalSessions / baseSessions) : 1;

    return {
      id: pkg.id,
      isAddOn: false as const,
      totalPrice: undefined,
      packageId: pkg.id,
      packageCode: pkg.packageCode,
      packagePricingId: pkg.packagePricingId || undefined, // Include pricing ID for editing
      packageName: pkg.packagePricing?.name || undefined,
      baseSessions: baseSessions, // Base sessions from pricing
      purchaseQuantity: purchaseQuantity, // Calculated quantity
      productCode: pkg.productCode || undefined,
      serviceType: pkg.serviceType || undefined,
      packageType: pkg.packageType,
      totalSessions: pkg.totalSessions,
      usedSessions: pkg.usedSessions,
      remainingSessions: pkg.totalSessions - pkg.usedSessions,
      finalPrice: Number(pkg.finalPrice),
      discountPercent: pkg.discountPercent ? Number(pkg.discountPercent) : undefined,
      discountAmount: pkg.discountAmount ? Number(pkg.discountAmount) : undefined,
      discountNote: pkg.discountNote || undefined,
      notes: pkg.notes || undefined,
      status: pkg.status,
      paymentPlanType: pkg.paymentPlanType,
      installmentTotal: pkg.installmentTotal || undefined,
      totalVerifiedPaid: pkg.totalVerifiedPaid ? Number(pkg.totalVerifiedPaid) : 0,
      paymentPlanStatus: pkg.paymentPlanStatus || undefined,
      boosterType: productBoosterType || pkg.boosterType || undefined,
      branchId: pkg.branchId,
      branchName: pkg.branch.name,
      assignedBy: userMap.get(pkg.assignedBy)?.profile?.fullName || 'Unknown',
      verifiedBy: pkg.verifiedBy ? userMap.get(pkg.verifiedBy)?.profile?.fullName : undefined,
      paidAt: pkg.paidAt?.toISOString() || undefined,
      activatedAt: pkg.activatedAt?.toISOString() || undefined,
      createdAt: pkg.createdAt.toISOString(),
      purchaseGroupId: pkg.purchaseGroupId,
      upgradedFromId: pkg.upgradedFromId,
      // Payment proof fields
      paymentProofUrl: pkg.paymentProofUrl || undefined,
      paymentProofFileName: pkg.paymentProofFileName || undefined,
      paymentProofFileSize: pkg.paymentProofFileSize || undefined,
      paymentProofMimeType: pkg.paymentProofMimeType || undefined,
      // Refund fields
      refundAmount: pkg.refundAmount ? Number(pkg.refundAmount) : undefined,
      refundReason: pkg.refundReason || undefined,
      refundProofUrl: pkg.refundProofUrl || undefined,
      refundProofFileName: pkg.refundProofFileName || undefined,
      refundProofFileSize: pkg.refundProofFileSize || undefined,
      refundProofMimeType: pkg.refundProofMimeType || undefined,
      refundedBy: pkg.refundedBy ? userMap.get(pkg.refundedBy)?.profile?.fullName : undefined,
      refundedAt: pkg.refundedAt?.toISOString() || undefined,
      // Incentive information
      incentive: incentiveRecord ? {
        incentiveAmount: Number(incentiveRecord.incentiveAmount),
        incentiveType: incentiveRecord.incentiveType,
        incentiveValue: Number(incentiveRecord.incentiveValue),
        referralCode: incentiveRecord.referralCode ? {
          code: incentiveRecord.referralCode.code,
          referrerName: incentiveRecord.referralCode.referrerName,
          referrerType: incentiveRecord.referralCode.referrerType,
        } : null,
        createdAt: incentiveRecord.createdAt.toISOString(),
      } : undefined,
    };
  }

  /**
   * Format add-on data for response
   */
  private formatAddOnData(addon: AddOnWithBranch, userMap: Map<string, UserWithProfile>) {
    return {
      id: addon.id,
      finalPrice: undefined,
      packageType: undefined,
      purchaseGroupId: undefined,
      addOnId: addon.id,
      addOnCode: addon.addOnCode,
      addOnType: addon.addOnType,
      quantity: addon.quantity,
      pricePerUnit: Number(addon.pricePerUnit),
      totalPrice: Number(addon.totalPrice),
      status: addon.status,
      paymentPlanType: addon.paymentPlanType,
      installmentTotal: addon.installmentTotal || undefined,
      totalVerifiedPaid: addon.totalVerifiedPaid ? Number(addon.totalVerifiedPaid) : 0,
      paymentPlanStatus: addon.paymentPlanStatus || undefined,
      notes: addon.notes || undefined,
      branchName: addon.branch.name,
      assignedBy: userMap.get(addon.assignedBy)?.profile?.fullName || 'Unknown',
      verifiedBy: addon.verifiedBy ? userMap.get(addon.verifiedBy)?.profile?.fullName : undefined,
      paidAt: addon.paidAt?.toISOString() || undefined,
      verifiedAt: addon.verifiedAt?.toISOString() || undefined,
      createdAt: addon.createdAt.toISOString(),
      isAddOn: true,
      // Payment proof fields
      paymentProofUrl: addon.paymentProofUrl || undefined,
      paymentProofFileName: addon.paymentProofFileName || undefined,
      paymentProofFileSize: addon.paymentProofFileSize || undefined,
      paymentProofMimeType: addon.paymentProofMimeType || undefined,
    };
  }
}
