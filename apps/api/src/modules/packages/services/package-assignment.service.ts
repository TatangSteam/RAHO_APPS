import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';
import { logAudit } from '../../../utils/auditLog';
import type { AssignPackageInput } from '../packages.schema';
import {
  PackageType,
  PackageStatus,
  AuditAction,
  AddOnType,
  type Branch,
  type MemberAddOn,
  type MemberPackage,
  type PackagePricing,
} from '@prisma/client';
import { calculateAndRecordIncentive } from '../../referrals/incentive-calculation.service';
import { InvoiceGenerationService } from './invoice-generation.service';
import {
  allocatePackageDiscount,
  calculatePurchaseDiscount,
  normalizeAddOnAssignments,
  type AddOnAssignmentInput,
  type NormalizedAddOnAssignment,
} from './package-assignment.helpers';
import { reserveAddOnStockInTransaction } from './add-on-inventory.service';
import { getAccessibleBranchIds } from '../../iam/authorization.service';
import { calculateCatalogPackageTotal } from './package-pricing-calculation';

type NormalizedPaymentPlan = {
  type: 'FULL_PAYMENT' | 'INSTALLMENT';
  installmentCount?: number;
  installments?: Array<{
    installmentNumber: number;
    amount?: number;
    dueDate?: string;
  }>;
};

interface PackageDetail {
  pricing: PackagePricing;
  quantity: number;
  boosterType?: string;
  serviceType?: string;
  pricePerSession: number;
  fixedListPrice?: number;
  fixedFinalPrice?: number;
  fixedDiscountNote?: string;
}

export const SOCIAL_PROGRAM_PRODUCT_CODE = 'SRV-TNB-TRP-PS-001';

export interface ApprovedSocialAssignmentContext {
  requestId: string;
  priceOverrides: Record<string, {
    listPrice: number;
    finalPrice: number;
    discountNote: string;
  }>;
}

type CreatedPackage = MemberPackage & {
  extendedBoosterType?: string;
};

type CreatedAddOn = MemberAddOn & {
  originalCode: string;
  originalName: string;
  originalType: AddOnAssignmentInput['type'];
};

interface PackageAssignmentTransactionResult {
  createdPackages: CreatedPackage[];
  createdAddOns: CreatedAddOn[];
  purchaseGroupId?: string;
  totalBasicSessions: number;
}

interface PackageAssignmentTransactionParams {
  memberId: string;
  branchId: string;
  branch: Pick<Branch, 'branchCode'>;
  packageDetails: PackageDetail[];
  addOns: NormalizedAddOnAssignment[];
  totalSubtotal: number;
  totalDiscountAmount: number;
  discountPercent?: number;
  discountNote?: string;
  notes?: string;
  purchaseGroupId?: string;
  userId: string;
  paymentPlan: NormalizedPaymentPlan;
  member: { id: string; registrationBranchId: string };
  socialProgramRequestId?: string;
  variableDiscountAmount: number;
}

/**
 * Service for handling package assignment to members
 */
export class PackageAssignmentService {
  private readonly invoiceService = new InvoiceGenerationService();

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
    userId: string,
    approvedSocial?: ApprovedSocialAssignmentContext,
  ) {
    const normalizedAddOns = normalizeAddOnAssignments(data.addOns || []);

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

    // Global branch access (normally SUPER_ADMIN) bypasses the member/branch
    // intersection check. The controller still resolves the transaction branch
    // to the member's registration branch for direct Super Admin assignments.
    const accessibleBranchIds = await getAccessibleBranchIds(userId);
    const hasGlobalBranchAccess = accessibleBranchIds === null;

    // Check if scoped staff has access to this member
    const hasAccess =
      hasGlobalBranchAccess ||
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

    const unavailablePricing = pricings.find((pricing) =>
      !pricing.isActive || (pricing.branchId !== null && pricing.branchId !== branchId)
    );
    if (unavailablePricing) {
      throw {
        status: 409,
        code: 'PACKAGE_PRICING_SCOPE_MISMATCH',
        message: 'Harga paket tidak aktif atau tidak berlaku untuk cabang member ini. Muat ulang pilihan paket.',
      };
    }

    const mismatchedSelection = data.packages.find((selection) => {
      const pricing = pricings.find(item => item.id === selection.pricingId);
      if (!pricing || pricing.packageType !== PackageType.BOOSTER) return false;
      return (
        (selection.serviceType !== undefined && selection.serviceType !== pricing.serviceType) ||
        (selection.boosterType !== undefined && selection.boosterType !== pricing.boosterType)
      );
    });
    if (mismatchedSelection) {
      throw {
        status: 409,
        code: 'PACKAGE_PRICING_SELECTION_MISMATCH',
        message: 'Tipe booster atau layanan tidak sesuai dengan harga paket yang dipilih. Muat ulang pilihan paket.',
      };
    }

    const socialPricing = pricings.find((pricing) => pricing.productCode === SOCIAL_PROGRAM_PRODUCT_CODE);
    if (socialPricing && !approvedSocial) {
      throw {
        status: 403,
        code: 'SOCIAL_PROGRAM_APPROVAL_REQUIRED',
        message: 'Paket Program Sosial hanya dapat dibuat melalui pengajuan dan Approval Inbox.',
      };
    }
    if (approvedSocial && (normalizedAddOns.length > 0 || data.discountAmount || data.discountPercent)) {
      throw {
        status: 400,
        code: 'SOCIAL_PROGRAM_PRICING_INVALID',
        message: 'Harga Program Sosial ditentukan oleh approval dan tidak dapat digabung dengan diskon atau add-on lain.',
      };
    }

    // Calculate total price
    const { subtotal, packageDetails, fixedDiscountAmount } = this.calculatePackagePricing(data, pricings, approvedSocial);
    // Add add-on subtotal
    const addOnSubtotal = normalizedAddOns.reduce((sum, addon) => sum + addon.price * addon.quantity, 0);
    const totalSubtotal = subtotal + addOnSubtotal;

    // Calculate discount
    const { totalDiscountAmount: variableDiscountAmount } = calculatePurchaseDiscount(
      totalSubtotal,
      data.discountPercent,
      data.discountAmount,
    );
    const totalDiscountAmount = variableDiscountAmount + fixedDiscountAmount;
    const paymentPlan = this.normalizePaymentPlan(data);

    // Determine purchase group
    const purchaseGroupId = this.determinePurchaseGroup(packageDetails, normalizedAddOns);

    // Get sequences for package codes
    const { basicSequence, boosterSequence } = await this.getNextSequences(branch.branchCode, branchId);

    // Create packages in transaction
    const result = await this.createPackagesTransaction(
      {
        memberId,
        branchId,
        branch,
        packageDetails,
        addOns: normalizedAddOns,
        totalSubtotal,
        totalDiscountAmount,
        discountPercent: data.discountPercent,
        discountNote: data.discountNote,
        notes: data.notes,
        purchaseGroupId,
        userId,
        paymentPlan,
        member,
        socialProgramRequestId: approvedSocial?.requestId,
        variableDiscountAmount,
      },
      basicSequence,
      boosterSequence
    );

    // Audit logs
    await this.logPackageAssignment(result, branchId, userId);

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
  private calculatePackagePricing(
    data: AssignPackageInput,
    pricings: PackagePricing[],
    approvedSocial?: ApprovedSocialAssignmentContext,
  ) {
    let subtotal = 0;
    let fixedDiscountAmount = 0;
    const packageDetails: PackageDetail[] = [];

    data.packages.forEach((pkg) => {
      const pricing = pricings.find(p => p.id === pkg.pricingId)!;
      const fixed = approvedSocial?.priceOverrides[pricing.id];
      const pricePerSession = Number(pricing.price);
      let totalPrice = calculateCatalogPackageTotal(pricing, pkg.quantity);

      if (fixed) {
        if (fixed.listPrice < fixed.finalPrice || fixed.finalPrice < 0) {
          throw {
            status: 400,
            code: 'SOCIAL_PROGRAM_PRICE_OVERRIDE_INVALID',
            message: 'Override harga Program Sosial tidak valid.',
          };
        }
        totalPrice = fixed.listPrice * pkg.quantity;
        fixedDiscountAmount += (fixed.listPrice - fixed.finalPrice) * pkg.quantity;
      }

      subtotal += totalPrice;

      packageDetails.push({
        pricing,
        quantity: pkg.quantity,
        boosterType: pkg.boosterType,
        serviceType: pkg.serviceType,
        pricePerSession,
        fixedListPrice: fixed?.listPrice,
        fixedFinalPrice: fixed?.finalPrice,
        fixedDiscountNote: fixed?.discountNote,
      });
    });

    return { subtotal, packageDetails, fixedDiscountAmount };
  }

  /**
   * Determine if packages should be grouped
   */
  private determinePurchaseGroup(
    packageDetails: PackageDetail[],
    addOns: readonly AddOnAssignmentInput[] = [],
  ): string | undefined {
    const hasBasic = packageDetails.some(p => p.pricing.packageType === PackageType.BASIC);
    const hasBooster = packageDetails.some(p => p.pricing.packageType === PackageType.BOOSTER);
    const totalPackagesToCreate = packageDetails.reduce((sum, detail) => sum + detail.quantity, 0);
    const hasAddOns = addOns.length > 0;
    
    if ((hasBasic && hasBooster) || totalPackagesToCreate > 1 || (totalPackagesToCreate > 0 && hasAddOns)) {
      return `GRP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    }

    return undefined;
  }

  private normalizePaymentPlan(data: AssignPackageInput): NormalizedPaymentPlan {
    if (!data.paymentPlan || data.paymentPlan.type !== 'INSTALLMENT') {
      return { type: 'FULL_PAYMENT' };
    }

    const installmentCount = data.paymentPlan.installmentCount || 0;
    const providedInstallments = data.paymentPlan.installments || [];

    if (installmentCount < 2) {
      throw {
        status: 400,
        code: 'INVALID_INSTALLMENT_PLAN',
        message: 'Konfigurasi termin tidak valid',
      };
    }

    if (providedInstallments.length > 0 && providedInstallments.length !== installmentCount) {
      throw {
        status: 400,
        code: 'INVALID_INSTALLMENT_PLAN',
        message: 'Jumlah jadwal termin harus sesuai jumlah termin',
      };
    }

    const installments = Array.from({ length: installmentCount }, (_, index) => {
      const provided = providedInstallments[index];

      return {
        installmentNumber: index + 1,
        dueDate: provided?.dueDate,
      };
    });

    return {
      type: 'INSTALLMENT',
      installmentCount,
      installments,
    };
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
      prisma.$queryRaw<Array<{ packageCode: string }>>`
        SELECT "packageCode" FROM "member_packages"
        WHERE "branchId" = ${branchId}
          AND "packageCode" LIKE ${basicPattern}
        ORDER BY "packageCode" DESC
        LIMIT 1
      `,
      prisma.$queryRaw<Array<{ packageCode: string }>>`
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
    params: PackageAssignmentTransactionParams,
    initialBasicSequence: number,
    initialBoosterSequence: number
  ) {
    return await prisma.$transaction(async (tx) => {
      const createdPackages: CreatedPackage[] = [];
      const createdAddOns: CreatedAddOn[] = [];
      let totalBasicSessions = 0;
      let basicSequence = initialBasicSequence;
      let boosterSequence = initialBoosterSequence;

      // Track remaining discount
      let remainingDiscount = params.variableDiscountAmount;
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
          let packageSubtotal = calculateCatalogPackageTotal(detail.pricing);
          
          const hasFixedPrice = detail.fixedListPrice !== undefined && detail.fixedFinalPrice !== undefined;
          if (hasFixedPrice) packageSubtotal = detail.fixedListPrice!;

          // Program Sosial has an explicit per-item discount. Ordinary
          // assignments retain the existing proportional allocation.
          const packageDiscount = hasFixedPrice
            ? Math.round(detail.fixedListPrice! - detail.fixedFinalPrice!)
            : allocatePackageDiscount({
                packageSubtotal,
                purchaseSubtotal: params.totalSubtotal,
                purchaseDiscount: params.variableDiscountAmount,
                remainingDiscount,
                isLastPackage: packageIndex === totalPackages,
                hasAddOns: params.addOns.length > 0,
              });
          if (!hasFixedPrice) remainingDiscount -= packageDiscount;

          const packageFinalPrice = hasFixedPrice
            ? Math.round(detail.fixedFinalPrice!)
            : Math.round(packageSubtotal - packageDiscount);

          // Generate product code
          const productCode = detail.pricing.productCode || this.generateProductCode(
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
              discountPercent: packageDiscount > 0
                ? Math.round((packageDiscount / packageSubtotal) * 10000) / 100
                : 0,
              discountAmount: packageDiscount,
              discountNote: packageDiscount > 0 ? (detail.fixedDiscountNote || params.discountNote) : null,
              status: PackageStatus.PENDING_PAYMENT,
              paymentPlanType: params.paymentPlan.type,
              installmentTotal: params.paymentPlan.installmentCount || null,
              installmentSchedule: params.paymentPlan.installments || null,
              totalVerifiedPaid: 0,
              paymentPlanStatus: params.paymentPlan.type === 'INSTALLMENT' ? 'PENDING_FIRST_PAYMENT' : null,
              boosterType: detail.boosterType || null,
              notes: params.notes,
              assignedBy: params.userId,
              purchaseGroupId: params.purchaseGroupId,
              socialProgramRequestId: params.socialProgramRequestId,
            },
          });

          createdPackages.push({
            ...memberPackage,
            extendedBoosterType: detail.boosterType,
            serviceType: detail.serviceType,
          });

          // Don't calculate incentive here - will be done after all packages are created

          if (detail.pricing.packageType === PackageType.BASIC) {
            totalBasicSessions += detail.pricing.totalSessions;
          }
        }
      }

      // Calculate and record incentive AFTER all packages are created
      // This ensures bundle incentive is calculated with complete package data
      if (createdPackages.length > 0 && !params.socialProgramRequestId) {
        try {
          // Use the first package to trigger incentive calculation
          // The service will detect if it's a bundle and calculate accordingly
          await calculateAndRecordIncentive(createdPackages[0].id, tx);
        } catch (error) {
          logger.warn('[PackageAssignment] Incentive calculation failed', { error });
          // Don't fail the whole transaction if incentive calculation fails
        }
      }

      // Voucher count is recorded when a basic/booster voucher is used in a session.
      // Buying a package only creates the voucher inventory and keeps it on hold.

      // Create add-ons
      const addonDateStr = `${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
      const addonPattern = `ADO-${params.branch.branchCode}-${addonDateStr}-%`;
      const addOnSequenceLock = `MEMBER_ADD_ON:${params.branchId}:${addonDateStr}`;
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${addOnSequenceLock}))::text AS "lockResult"
      `;
      const lastAddon = await tx.$queryRaw<Array<{ addOnCode: string }>>`
        SELECT "addOnCode" FROM "member_add_ons"
        WHERE "branchId" = ${params.branchId}
          AND "addOnCode" LIKE ${addonPattern}
        ORDER BY "addOnCode" DESC
        LIMIT 1
      `;
      let addonSeq = 1;
      if (lastAddon.length > 0) {
        const parts = lastAddon[0].addOnCode.split('-');
        const lastSeq = Number.parseInt(parts[parts.length - 1], 10);
        addonSeq = Number.isNaN(lastSeq) ? 1 : lastSeq + 1;
      }

      for (const addon of params.addOns) {
        const addOnCode = `ADO-${params.branch.branchCode}-${addonDateStr}-${addonSeq.toString().padStart(4, '0')}`;
        addonSeq += 1;

        const linkedPackageId = createdPackages.length > 0 ? createdPackages[0].id : null;

        const memberAddOn = await tx.memberAddOn.create({
          data: {
            addOnCode,
            memberId: params.memberId,
            branchId: params.branchId,
            packageId: linkedPackageId,
            addOnType: addon.type as AddOnType,
            quantity: addon.quantity,
            pricePerUnit: addon.price,
            totalPrice: addon.price * addon.quantity,
            status: PackageStatus.PENDING_PAYMENT,
            paymentPlanType: params.paymentPlan.type,
            installmentTotal: params.paymentPlan.installmentCount || null,
            installmentSchedule: params.paymentPlan.installments || null,
            totalVerifiedPaid: 0,
            paymentPlanStatus: params.paymentPlan.type === 'INSTALLMENT' ? 'PENDING_FIRST_PAYMENT' : null,
            notes: `${addon.name} (${addon.code})${params.notes ? ' - ' + params.notes : ''}`,
            productCode: addon.code,
            inventorySku: addon.inventorySku || null,
            stockQuantity: addon.inventoryQuantityPerUnit
              ? addon.inventoryQuantityPerUnit * addon.quantity
              : null,
            assignedBy: params.userId,
          },
        });

        await reserveAddOnStockInTransaction(memberAddOn, params.userId, tx);

        createdAddOns.push({
          ...memberAddOn,
          originalCode: addon.code,
          originalName: addon.name,
          originalType: addon.type,
        });
      }

      await this.invoiceService.generatePendingInvoiceForPackages(
        createdPackages,
        createdAddOns,
        params.member,
        params.userId,
        params.paymentPlan,
        {
          discountAmount: params.totalDiscountAmount,
          discountPercent: params.discountPercent || 0,
          discountNote: params.discountNote,
        },
        tx,
      );

      return { createdPackages, createdAddOns, purchaseGroupId: params.purchaseGroupId, totalBasicSessions };
    });
  }

  /**
   * Log audit for package assignment
   */
  private async logPackageAssignment(
    result: PackageAssignmentTransactionResult,
    branchId: string,
    userId: string,
  ) {
    // Audit log for packages
    for (const pkg of result.createdPackages) {
      await logAudit({
        userId,
        branchId,
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
        branchId,
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
