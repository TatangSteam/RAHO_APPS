// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import type { AssignPackageInput } from '../packages.schema';
import { PackageType, PackageStatus, AuditAction } from '@prisma/client';

/**
 * Service for handling package assignment to members
 */
export class PackageAssignmentService {
  // Service type pricing configuration
  private readonly SERVICE_TYPE_PRICING: Record<string, number> = {
    PM: 1_000_000,
    PS: 650_000,
    PTY: 600_000,
    PDA: 65_000,
    PHC: 750_000,
  };

  /**
   * Generate package code
   */
  generatePackageCode(branchCode: string, packageType: PackageType, sequence: number): string {
    const typeCode = packageType === PackageType.BASIC ? 'BSC' : 'BST';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const sequenceStr = sequence.toString().padStart(4, '0');
    
    return `PKG-${branchCode}-${typeCode}-${year}${month}-${sequenceStr}`;
  }

  /**
   * Generate product code based on package details
   */
  generateProductCode(
    packageType: PackageType,
    totalSessions: number,
    serviceType?: string,
    boosterType?: string
  ): string {
    if (packageType === PackageType.BASIC) {
      // BASIC packages: TNB-P{sessions}-{serviceType}
      const sessionsCode = `P${totalSessions}`;
      const serviceCode = serviceType || 'PM';
      return `TNB-${sessionsCode}-${serviceCode}`;
    } else {
      // BOOSTER packages: BST-{boosterType}-P1-{serviceType}
      const boosterCode = boosterType || 'NO';
      const serviceCode = serviceType || 'PM';
      return `BST-${boosterCode}-P1-${serviceCode}`;
    }
  }

  /**
   * Assign package to member
   */
  async assignPackage(
    memberId: string,
    data: AssignPackageInput,
    branchId: string,
    userId: string
  ) {
    // Validate member access
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        registrationBranch: true,
        branchAccesses: true,
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Check if staff has access to this member
    const hasAccess =
      member.registrationBranchId === branchId ||
      member.branchAccesses.some((access) => access.branchId === branchId);

    if (!hasAccess) {
      throw {
        status: 403,
        code: 'MEMBER_ACCESS_DENIED',
        message: 'Anda tidak memiliki akses ke member ini',
      };
    }

    // Get branch for code generation
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan' };
    }

    // Fetch all pricing data
    const pricingIds = [...new Set(data.packages.map(p => p.pricingId))];
    const pricings = pricingIds.length > 0 ? await prisma.packagePricing.findMany({
      where: { id: { in: pricingIds } },
    }) : [];

    if (pricingIds.length > 0 && pricings.length !== pricingIds.length) {
      throw { status: 404, code: 'PRICING_NOT_FOUND', message: 'Beberapa harga paket tidak ditemukan' };
    }

    // Calculate total price
    const { subtotal, packageDetails } = this.calculatePackagePricing(data, pricings);

    // Add add-on subtotal
    const addOnSubtotal = (data.addOns || []).reduce((sum, addon) => sum + addon.price * addon.quantity, 0);
    const totalSubtotal = subtotal + addOnSubtotal;

    // Calculate discount
    const percentDiscount = Math.round((totalSubtotal * (data.discountPercent || 0)) / 100);
    const amountDiscount = Math.round(data.discountAmount || 0);
    const totalDiscountAmount = percentDiscount + amountDiscount;
    const finalTotal = Math.round(totalSubtotal - totalDiscountAmount);

    // Determine purchase group
    const purchaseGroupId = this.determinePurchaseGroup(packageDetails, data.addOns);

    // Get sequences for package codes
    const { basicSequence, boosterSequence } = await this.getNextSequences(branch.branchCode, branchId);

    // Create packages in transaction
    const result = await this.createPackagesTransaction(
      {
        memberId,
        branchId,
        branch,
        packageDetails,
        addOns: data.addOns || [],
        totalSubtotal,
        totalDiscountAmount,
        discountPercent: data.discountPercent,
        discountNote: data.discountNote,
        notes: data.notes,
        purchaseGroupId,
        userId,
      },
      basicSequence,
      boosterSequence
    );

    // Audit logs
    await this.logPackageAssignment(result, userId);

    const totalItems = result.createdPackages.length + result.createdAddOns.length;
    return {
      packages: result.createdPackages,
      addOns: result.createdAddOns,
      purchaseGroupId: result.purchaseGroupId,
      totalPackages: result.createdPackages.length,
      totalAddOns: result.createdAddOns.length,
      totalBasicSessions: result.totalBasicSessions,
      message: `${totalItems} item berhasil diassign`,
    };
  }

  /**
   * Calculate package pricing
   */
  private calculatePackagePricing(data: AssignPackageInput, pricings: any[]) {
    let subtotal = 0;
    const packageDetails: Array<{
      pricing: any;
      quantity: number;
      boosterType?: string;
      serviceType?: string;
      pricePerSession: number;
      totalPrice: number;
    }> = [];

    data.packages.forEach((pkg) => {
      const pricing = pricings.find(p => p.id === pkg.pricingId)!;
      let pricePerSession = Number(pricing.price);
      let totalPrice = 0;

      if (pricing.packageType === PackageType.BASIC) {
        totalPrice = pricePerSession * pkg.quantity;
      } else if (pricing.packageType === PackageType.BOOSTER) {
        if (pkg.serviceType) {
          pricePerSession = this.SERVICE_TYPE_PRICING[pkg.serviceType] || pricePerSession;
        }
        totalPrice = pricePerSession * pricing.totalSessions * pkg.quantity;
      }

      subtotal += totalPrice;

      packageDetails.push({
        pricing,
        quantity: pkg.quantity,
        boosterType: pkg.boosterType,
        serviceType: pkg.serviceType,
        pricePerSession,
        totalPrice,
      });
    });

    return { subtotal, packageDetails };
  }

  /**
   * Determine if packages should be grouped
   */
  private determinePurchaseGroup(packageDetails: any[], addOns: any[] = []): string | undefined {
    const hasBasic = packageDetails.some(p => p.pricing.packageType === PackageType.BASIC);
    const hasBooster = packageDetails.some(p => p.pricing.packageType === PackageType.BOOSTER);
    const totalPackagesToCreate = packageDetails.reduce((sum, detail) => sum + detail.quantity, 0);
    const hasAddOns = addOns.length > 0;
    
    if ((hasBasic && hasBooster) || totalPackagesToCreate > 1 || (totalPackagesToCreate > 0 && hasAddOns)) {
      return `GRP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    }
    
    return undefined;
  }

  /**
   * Get next sequence numbers for package codes
   */
  private async getNextSequences(branchCode: string, branchId: string) {
    const basicTypeCode = 'BSC';
    const boosterTypeCode = 'BST';
    const dateStr = `${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const branchPrefix = `PKG-${branchCode}`;
    
    const basicPattern = `${branchPrefix}-${basicTypeCode}-${dateStr}-%`;
    const boosterPattern = `${branchPrefix}-${boosterTypeCode}-${dateStr}-%`;
    
    const [lastBasicResult, lastBoosterResult] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT "packageCode" FROM "member_packages"
        WHERE "branchId" = ${branchId}
          AND "packageCode" LIKE ${basicPattern}
        ORDER BY "packageCode" DESC
        LIMIT 1
      `,
      prisma.$queryRaw<any[]>`
        SELECT "packageCode" FROM "member_packages"
        WHERE "branchId" = ${branchId}
          AND "packageCode" LIKE ${boosterPattern}
        ORDER BY "packageCode" DESC
        LIMIT 1
      `
    ]);
    
    let basicSequence = 1;
    if (lastBasicResult && lastBasicResult.length > 0) {
      const parts = lastBasicResult[0].packageCode.split('-');
      const lastSequence = parseInt(parts[parts.length - 1], 10);
      basicSequence = isNaN(lastSequence) ? 1 : lastSequence + 1;
    }
    
    let boosterSequence = 1;
    if (lastBoosterResult && lastBoosterResult.length > 0) {
      const parts = lastBoosterResult[0].packageCode.split('-');
      const lastSequence = parseInt(parts[parts.length - 1], 10);
      boosterSequence = isNaN(lastSequence) ? 1 : lastSequence + 1;
    }

    return { basicSequence, boosterSequence };
  }

  /**
   * Create packages and add-ons in transaction
   */
  private async createPackagesTransaction(
    params: {
      memberId: string;
      branchId: string;
      branch: any;
      packageDetails: any[];
      addOns: any[];
      totalSubtotal: number;
      totalDiscountAmount: number;
      discountPercent?: number;
      discountNote?: string;
      notes?: string;
      purchaseGroupId?: string;
      userId: string;
    },
    initialBasicSequence: number,
    initialBoosterSequence: number
  ) {
    return await prisma.$transaction(async (tx) => {
      const createdPackages: any[] = [];
      const createdAddOns: any[] = [];
      let totalBasicSessions = 0;
      let basicSequence = initialBasicSequence;
      let boosterSequence = initialBoosterSequence;

      // Track remaining discount
      let remainingDiscount = params.totalDiscountAmount;
      let packageIndex = 0;
      const totalPackages = params.packageDetails.reduce((sum, detail) => sum + detail.quantity, 0);
      const createdPackageCodes = new Set<string>();

      // Create packages
      for (const detail of params.packageDetails) {
        for (let i = 0; i < detail.quantity; i++) {
          packageIndex++;
          
          // Generate unique package code
          let currentSequence: number;
          if (detail.pricing.packageType === PackageType.BASIC) {
            currentSequence = basicSequence++;
          } else {
            currentSequence = boosterSequence++;
          }
          
          let packageCode = this.generatePackageCode(params.branch.branchCode, detail.pricing.packageType, currentSequence);
          
          while (createdPackageCodes.has(packageCode)) {
            if (detail.pricing.packageType === PackageType.BASIC) {
              currentSequence = basicSequence++;
            } else {
              currentSequence = boosterSequence++;
            }
            packageCode = this.generatePackageCode(params.branch.branchCode, detail.pricing.packageType, currentSequence);
          }
          
          createdPackageCodes.add(packageCode);
          
          // Calculate individual package price
          let packageSubtotal = 0;
          if (detail.pricing.packageType === PackageType.BASIC) {
            packageSubtotal = detail.pricePerSession;
          } else {
            packageSubtotal = detail.pricePerSession * detail.pricing.totalSessions;
          }
          
          // Distribute discount proportionally
          let packageDiscount = 0;
          if (packageIndex === totalPackages) {
            packageDiscount = remainingDiscount;
          } else {
            packageDiscount = Math.round((packageSubtotal / params.totalSubtotal) * params.totalDiscountAmount);
            remainingDiscount -= packageDiscount;
          }
          
          const packageFinalPrice = Math.round(packageSubtotal - packageDiscount);

          // Generate product code
          const productCode = this.generateProductCode(
            detail.pricing.packageType,
            detail.pricing.totalSessions,
            detail.serviceType,
            detail.boosterType
          );

          const memberPackage = await tx.memberPackage.create({
            data: {
              memberId: params.memberId,
              branchId: params.branchId,
              packageCode,
              packageType: detail.pricing.packageType,
              packagePricingId: detail.pricing.id,
              productCode,
              serviceType: detail.serviceType,
              totalSessions: detail.pricing.totalSessions,
              usedSessions: 0,
              finalPrice: packageFinalPrice,
              discountPercent: packageDiscount > 0 ? (params.discountPercent || 0) : 0,
              discountAmount: packageDiscount,
              discountNote: packageDiscount > 0 ? params.discountNote : null,
              status: PackageStatus.PENDING_PAYMENT,
              boosterType: detail.boosterType ? (detail.boosterType === 'NO' ? 'NO2' : 'HHO') : null,
              notes: params.notes,
              assignedBy: params.userId,
              purchaseGroupId: params.purchaseGroupId,
            },
          });

          createdPackages.push({
            ...memberPackage,
            extendedBoosterType: detail.boosterType,
            serviceType: detail.serviceType,
          });

          if (detail.pricing.packageType === PackageType.BASIC) {
            totalBasicSessions += detail.pricing.totalSessions;
          }
        }
      }

      // Update member voucher count
      if (totalBasicSessions > 0) {
        await tx.member.update({
          where: { id: params.memberId },
          data: { voucherCount: { increment: totalBasicSessions } },
        });
      }

      // Create add-ons
      for (const addon of params.addOns) {
        const addonDateStr = `${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
        const addonPattern = `ADO-${params.branch.branchCode}-${addonDateStr}-%`;
        const lastAddon = await tx.$queryRaw<any[]>`
          SELECT "addOnCode" FROM "member_add_ons"
          WHERE "branchId" = ${params.branchId}
            AND "addOnCode" LIKE ${addonPattern}
          ORDER BY "addOnCode" DESC
          LIMIT 1
        `;
        let addonSeq = 1;
        if (lastAddon && lastAddon.length > 0) {
          const parts = lastAddon[0].addOnCode.split('-');
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          addonSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
        }
        const addOnCode = `ADO-${params.branch.branchCode}-${addonDateStr}-${addonSeq.toString().padStart(4, '0')}`;

        const addOnTypeMap: Record<string, string> = {
          AIR_NANO: 'AIR_NANO',
          ROKOK_KENKOU: 'LAINNYA',
          KONSULTASI_GIZI: 'KONSULTASI_GIZI',
          KONSULTASI_PSIKOLOG: 'KONSULTASI_PSIKOLOG',
          LAINNYA: 'LAINNYA',
        };
        const prismaAddOnType = addOnTypeMap[addon.type] || 'LAINNYA';

        const linkedPackageId = createdPackages.length > 0 ? createdPackages[0].id : null;

        const memberAddOn = await tx.memberAddOn.create({
          data: {
            addOnCode,
            memberId: params.memberId,
            branchId: params.branchId,
            packageId: linkedPackageId,
            addOnType: prismaAddOnType as any,
            quantity: addon.quantity,
            pricePerUnit: addon.price,
            totalPrice: addon.price * addon.quantity,
            status: PackageStatus.PENDING_PAYMENT,
            notes: `${addon.name} (${addon.code})${params.notes ? ' - ' + params.notes : ''}`,
            assignedBy: params.userId,
          },
        });

        createdAddOns.push({
          ...memberAddOn,
          originalCode: addon.code,
          originalName: addon.name,
          originalType: addon.type,
        });
      }

      return { createdPackages, createdAddOns, purchaseGroupId: params.purchaseGroupId, totalBasicSessions };
    });
  }

  /**
   * Log audit for package assignment
   */
  private async logPackageAssignment(result: any, userId: string) {
    // Audit log for packages
    for (const pkg of result.createdPackages) {
      await logAudit({
        userId,
        action: AuditAction.CREATE,
        resource: 'MemberPackage',
        resourceId: pkg.id,
        meta: { 
          memberId: pkg.memberId, 
          packageType: pkg.packageType, 
          totalSessions: pkg.totalSessions,
          boosterType: pkg.extendedBoosterType,
          serviceType: pkg.serviceType,
          purchaseGroupId: result.purchaseGroupId 
        },
      });
    }

    // Audit log for add-ons
    for (const addon of result.createdAddOns) {
      await logAudit({
        userId,
        action: AuditAction.CREATE,
        resource: 'MemberAddOn',
        resourceId: addon.id,
        meta: {
          memberId: addon.memberId,
          addOnType: addon.addOnType,
          originalType: addon.originalType,
          originalCode: addon.originalCode,
          quantity: addon.quantity,
          purchaseGroupId: result.purchaseGroupId,
        },
      });
    }
  }
}
