// @ts-nocheck
import { prisma } from '../../../lib/prisma';

/**
 * Service for retrieving package data
 */
export class PackageRetrievalService {
  /**
   * Get member packages with grouping
   */
  async getMemberPackages(memberId: string, branchId: string) {
    try {
      console.log('=== getMemberPackages called ===');
      console.log('memberId:', memberId);
      console.log('branchId:', branchId);
      
      // Query packages and add-ons in parallel
      const [packages, addOns] = await Promise.all([
        prisma.memberPackage.findMany({
          where: { memberId, branchId },
          include: { branch: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.memberAddOn.findMany({
          where: { memberId, branchId },
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
      const grouped = new Map<string, any[]>();
      const standalone: any[] = [];

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
        const basics = group.filter(p => !p.isAddOn && p.packageType === 'BASIC');
        const boosters = group.filter(p => !p.isAddOn && p.packageType === 'BOOSTER');
        const groupAddOns = group.filter(p => p.isAddOn);
        
        return {
          isGroup: true,
          purchaseGroupId: group[0]?.purchaseGroupId,
          basics,
          boosters,
          addOns: groupAddOns,
          totalPrice: group.reduce((sum, item) => {
            return sum + (item.finalPrice || item.totalPrice || 0);
          }, 0),
          status: group[0]?.status,
          createdAt: group[0]?.createdAt,
        };
      });

      // Combine grouped and standalone packages
      const result = [...groupedPackages, ...standalone];
      
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
  private formatPackageData(pkg: any, userMap: Map<string, any>) {
    return {
      id: pkg.id,
      packageId: pkg.id,
      packageCode: pkg.packageCode,
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
      boosterType: pkg.boosterType || undefined,
      branchName: pkg.branch.name,
      assignedBy: userMap.get(pkg.assignedBy)?.profile?.fullName || 'Unknown',
      verifiedBy: pkg.verifiedBy ? userMap.get(pkg.verifiedBy)?.profile?.fullName : undefined,
      paidAt: pkg.paidAt?.toISOString() || undefined,
      activatedAt: pkg.activatedAt?.toISOString() || undefined,
      createdAt: pkg.createdAt.toISOString(),
      purchaseGroupId: pkg.purchaseGroupId,
      upgradedFromId: pkg.upgradedFromId,
    };
  }

  /**
   * Format add-on data for response
   */
  private formatAddOnData(addon: any, userMap: Map<string, any>) {
    return {
      id: addon.id,
      addOnId: addon.id,
      addOnCode: addon.addOnCode,
      addOnType: addon.addOnType,
      quantity: addon.quantity,
      pricePerUnit: Number(addon.pricePerUnit),
      totalPrice: Number(addon.totalPrice),
      status: addon.status,
      notes: addon.notes || undefined,
      branchName: addon.branch.name,
      assignedBy: userMap.get(addon.assignedBy)?.profile?.fullName || 'Unknown',
      verifiedBy: addon.verifiedBy ? userMap.get(addon.verifiedBy)?.profile?.fullName : undefined,
      paidAt: addon.paidAt?.toISOString() || undefined,
      verifiedAt: addon.verifiedAt?.toISOString() || undefined,
      createdAt: addon.createdAt.toISOString(),
      isAddOn: true,
    };
  }
}
