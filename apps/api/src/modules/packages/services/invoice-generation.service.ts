import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';
import { generateInvoiceNumber } from '../../../utils/invoiceGenerator';
import {
  allocateInvoiceItems,
  capInvoiceDiscount,
  cloneInvoiceItemsForAllocation,
  type InvoiceDiscount,
  type InvoiceItemForAllocation,
  shouldRecordInvoicePayment,
} from './invoice-generation.helpers';
import { createHash } from 'crypto';
import type {
  Member,
  MemberAddOn,
  MemberPackage,
  Invoice,
  Prisma,
} from '@prisma/client';

type InvoiceTargetStatus = 'PENDING_PAYMENT' | 'PAID';
type PaymentPlanConfig = {
  type: 'FULL_PAYMENT' | 'INSTALLMENT';
  installmentCount?: number;
  installments?: Array<{
    installmentNumber: number;
    amount?: number;
    dueDate?: string;
  }>;
};

type InvoiceMember = Pick<Member, 'id' | 'registrationBranchId'>;
type InvoicePackage = MemberPackage;
type InvoiceAddOn = MemberAddOn;
type InvoiceWithItemsAndPayments = Prisma.InvoiceGetPayload<{
  include: { items: true; payments: true };
}>;

/**
 * Service for creating invoice records from assigned packages/add-ons.
 *
 * The same invoice starts as PENDING_PAYMENT when packages are assigned, then
 * becomes PAID after staff verifies the payment. The paid invoice is used as
 * the receipt/kwitansi.
 */
export class InvoiceGenerationService {
  async generatePendingInvoiceForPackages(
    packages: InvoicePackage[],
    addOns: InvoiceAddOn[] = [],
    member: InvoiceMember,
    userId: string,
    paymentPlan?: PaymentPlanConfig,
    purchaseDiscount?: InvoiceDiscount,
  ) {
    return this.createOrUpdateInvoiceForPurchase({
      packages,
      addOns,
      member,
      userId,
      targetStatus: 'PENDING_PAYMENT',
      paymentPlan,
      purchaseDiscount,
    });
  }

  /**
   * Backward-compatible method used by older callers. It now marks the related
   * invoice as paid, or creates a paid invoice if the pending invoice is absent.
   */
  async generateInvoiceForPackages(
    packages: InvoicePackage[],
    member: InvoiceMember,
    userId: string,
  ) {
    return this.markInvoicePaidForPackages(packages, undefined, member, userId);
  }

  async markInvoicePaidForPackages(
    packages: InvoicePackage[],
    addOns: InvoiceAddOn[] | undefined,
    member: InvoiceMember,
    userId: string
  ) {
    return this.createOrUpdateInvoiceForPurchase({
      packages,
      addOns,
      member,
      userId,
      targetStatus: 'PAID',
    });
  }

  async markInvoicePaidForAddOns(
    addOns: InvoiceAddOn[],
    member: InvoiceMember,
    userId: string,
  ) {
    return this.createOrUpdateInvoiceForPurchase({
      packages: [],
      addOns,
      member,
      userId,
      targetStatus: 'PAID',
    });
  }

  async verifyActiveInvoiceForPurchase(
    packages: InvoicePackage[],
    addOns: InvoiceAddOn[] | undefined,
    member: InvoiceMember,
    userId: string,
    paymentData: {
      paidAmount?: number;
      notes?: string;
      proofFileUrl?: string;
      proofFileName?: string;
      proofFileSize?: number;
      proofMimeType?: string;
    }
  ) {
    const resolvedAddOns = await this.resolveAddOns(packages, addOns);
    const itemIds = [
      ...packages.map((pkg) => pkg.id),
      ...resolvedAddOns.map((addon) => addon.id),
    ].filter(Boolean);

    const invoice = itemIds.length > 0
      ? await prisma.invoice.findFirst({
          where: {
            status: 'PENDING_PAYMENT',
            items: {
              some: {
                itemId: { in: itemIds },
              },
            },
          },
          include: {
            items: true,
            payments: true,
          },
          orderBy: [
            { installmentNumber: 'asc' },
            { createdAt: 'asc' },
          ],
        })
      : null;

    if (!invoice) {
      return this.markInvoicePaidForPackages(packages, resolvedAddOns, member, userId);
    }

    const now = new Date();
    const invoiceTotal = Number(invoice.totalAmount);
    const isOpenInstallmentAmount = invoice.paymentPlanType === 'INSTALLMENT' && invoiceTotal <= 0;
    const submittedPaidAmount = paymentData.paidAmount !== undefined ? Math.round(Number(paymentData.paidAmount)) : null;
    const paidAmount = Math.round(paymentData.paidAmount || invoiceTotal);
    const isFinalInstallment =
      invoice.paymentPlanType === 'INSTALLMENT' &&
      invoice.installmentNumber &&
      invoice.installmentTotal &&
      Number(invoice.installmentNumber) >= Number(invoice.installmentTotal);

    if (isOpenInstallmentAmount && paidAmount <= 0) {
      throw {
        status: 400,
        code: 'INSTALLMENT_PAID_AMOUNT_REQUIRED',
        message: 'Nominal pembayaran termin wajib diisi',
      };
    }

    let finalInstallmentRequiredAmount = invoiceTotal;
    if (isFinalInstallment && finalInstallmentRequiredAmount <= 0 && invoice.paymentGroupId) {
      const paidInvoices = await prisma.invoice.findMany({
        where: {
          paymentGroupId: invoice.paymentGroupId,
          status: 'PAID',
        },
        include: {
          payments: true,
        },
      });
      const totalPaid = paidInvoices.reduce((sum, paidInvoice) => (
        sum + paidInvoice.payments.reduce(
          (paymentSum, payment) => paymentSum + Number(payment.amount || 0),
          0,
        )
      ), 0);
      finalInstallmentRequiredAmount = Math.max(0, Number(invoice.totalPurchaseAmount || 0) - totalPaid);
    }

    if (isFinalInstallment && submittedPaidAmount !== finalInstallmentRequiredAmount) {
      throw {
        status: 400,
        code: 'FINAL_INSTALLMENT_FULL_AMOUNT_REQUIRED',
        message: `Termin terakhir wajib dibayar penuh sebesar Rp ${finalInstallmentRequiredAmount.toLocaleString('id-ID')}`,
      };
    }

    const paidInvoiceItems = isOpenInstallmentAmount
      ? (() => {
          const sourceItems = cloneInvoiceItemsForAllocation(invoice.items || []);
          const sourceTotal = sourceItems.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

          return allocateInvoiceItems(sourceItems, paidAmount, sourceTotal);
        })()
      : null;

    if (paidInvoiceItems) {
      await prisma.invoiceItem.deleteMany({
        where: { invoiceId: invoice.id },
      });

      await prisma.invoiceItem.createMany({
        data: paidInvoiceItems.map((item) => ({
          ...item,
          invoiceId: invoice.id,
        })),
      });
    }

    if (shouldRecordInvoicePayment(paidAmount)) {
      const paymentKey = `PACKAGE_INSTALLMENT_PAYMENT:${invoice.id}`;
      await prisma.invoicePayment.create({
        data: {
          invoiceId: invoice.id,
          idempotencyKey: paymentKey,
          payloadHash: createHash('sha256').update(paymentKey).digest('hex'),
          amount: paidAmount,
          paymentMethod: paymentData.proofFileUrl ? 'TRANSFER' : 'CASH',
          notes: paymentData.notes || null,
          proofFileUrl: paymentData.proofFileUrl || null,
          proofFileName: paymentData.proofFileName || null,
          proofFileSize: paymentData.proofFileSize || null,
          proofMimeType: paymentData.proofMimeType || null,
          receivedBy: userId,
          receivedAt: now,
          verificationStatus: 'VERIFIED',
          verifiedAt: now,
        },
      });
    }

    const paidInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        ...(isOpenInstallmentAmount
          ? {
              subtotal: paidAmount,
              totalAmount: paidAmount,
              installmentAmount: paidAmount,
            }
          : {}),
        status: 'PAID',
        paidAt: now,
        paymentMethod: paymentData.proofFileUrl ? 'TRANSFER' : 'CASH',
        paymentNotes: paymentData.notes || null,
        verifiedBy: userId,
        verifiedAt: now,
        actualPaidAmount: paidAmount,
        paymentVerificationStatus: 'VERIFIED',
      },
    });

    if (
      invoice.paymentPlanType === 'INSTALLMENT' &&
      invoice.installmentNumber &&
      invoice.installmentTotal &&
      invoice.installmentNumber < invoice.installmentTotal
    ) {
      await this.createNextInstallmentInvoice(
        {
          ...invoice,
          totalAmount: isOpenInstallmentAmount ? paidAmount : invoice.totalAmount,
          installmentAmount: isOpenInstallmentAmount ? paidAmount : invoice.installmentAmount,
          items: invoice.items,
        },
        paidAmount,
        userId
      );
    }

    return paidInvoice;
  }

  private async createOrUpdateInvoiceForPurchase(params: {
    packages: InvoicePackage[];
    addOns?: InvoiceAddOn[];
    member: InvoiceMember;
    userId: string;
    targetStatus: InvoiceTargetStatus;
    paymentPlan?: PaymentPlanConfig;
    purchaseDiscount?: InvoiceDiscount;
  }) {
    try {
      const packages = params.packages || [];
      const addOns = await this.resolveAddOns(packages, params.addOns);

      if (packages.length === 0 && addOns.length === 0) {
        logger.warn('[InvoiceGeneration] No packages or add-ons to invoice');
        return null;
      }

      const branchId =
        packages[0]?.branchId ||
        addOns[0]?.branchId ||
        params.member.registrationBranchId;

      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { branchCode: true },
      });

      if (!branch) {
        logger.error('[InvoiceGeneration] Branch not found', { branchId });
        return null;
      }

      const invoiceItems = this.buildInvoiceItems(packages, addOns);
      const subtotal = invoiceItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
      const discountInfo = capInvoiceDiscount(
        subtotal,
        params.purchaseDiscount || this.calculateDiscount(packages),
      );
      const totalAmount = Math.max(0, subtotal - discountInfo.discountAmount);
      const paymentPlan = params.paymentPlan || { type: 'FULL_PAYMENT' };
      const isInstallmentInvoice = params.targetStatus === 'PENDING_PAYMENT' && paymentPlan.type === 'INSTALLMENT';
      const firstInstallment = isInstallmentInvoice ? paymentPlan.installments?.[0] : undefined;
      const explicitInstallmentAmount = Math.round(firstInstallment?.amount || 0);
      const hasExplicitInstallmentAmount = explicitInstallmentAmount > 0;
      const invoiceTotalAmount = isInstallmentInvoice ? explicitInstallmentAmount : totalAmount;
      const invoiceItemsForCreate = isInstallmentInvoice && hasExplicitInstallmentAmount
        ? allocateInvoiceItems(invoiceItems, invoiceTotalAmount, subtotal)
        : invoiceItems;
      const itemIds = [
        ...packages.map((pkg) => pkg.id),
        ...addOns.map((addon) => addon.id),
      ].filter(Boolean);
      const paymentGroupId = this.getPaymentGroupId(packages, addOns);

      const existingInvoice = itemIds.length > 0
        ? await prisma.invoice.findFirst({
            where: {
              status: { not: 'CANCELLED' },
              items: {
                some: {
                  itemId: { in: itemIds },
                },
              },
            },
            include: {
              payments: true,
            },
            orderBy: { createdAt: 'desc' },
          })
        : null;

      const now = new Date();
      const baseInvoiceData = {
        memberId: params.member.id,
        branchId,
        subtotal: invoiceItemsForCreate.reduce((sum, item) => sum + Number(item.subtotal || 0), 0),
        discountPercent: discountInfo.discountPercent || null,
        discountAmount: isInstallmentInvoice && hasExplicitInstallmentAmount ? 0 : discountInfo.discountAmount,
        discountNote: discountInfo.discountNote || null,
        taxPercent: 0,
        taxAmount: 0,
        totalAmount: invoiceTotalAmount,
        status: params.targetStatus,
        paymentPlanType: paymentPlan.type,
        paymentGroupId,
        installmentNumber: isInstallmentInvoice ? 1 : null,
        installmentTotal: isInstallmentInvoice ? paymentPlan.installmentCount : null,
        installmentSchedule: isInstallmentInvoice ? paymentPlan.installments : null,
        totalPurchaseAmount: isInstallmentInvoice ? totalAmount : null,
        installmentAmount: isInstallmentInvoice ? invoiceTotalAmount : null,
        carryOverAmount: 0,
        creditAmount: 0,
        actualPaidAmount: null,
        paymentVerificationStatus: 'PENDING',
        paymentRejectionReason: null,
        isAdjustment: false,
      };

      if (params.targetStatus === 'PAID') {
        baseInvoiceData.paidAt = now;
        baseInvoiceData.paymentMethod = this.getPaymentMethod(packages, addOns);
        baseInvoiceData.verifiedBy = params.userId;
        baseInvoiceData.verifiedAt = now;
      } else {
        baseInvoiceData.dueDate = isInstallmentInvoice && firstInstallment?.dueDate
          ? new Date(firstInstallment.dueDate)
          : this.getDefaultDueDate(now);
        baseInvoiceData.paidAt = null;
        baseInvoiceData.paymentMethod = null;
        baseInvoiceData.paymentReference = null;
        baseInvoiceData.paymentNotes = null;
        baseInvoiceData.verifiedBy = null;
        baseInvoiceData.verifiedAt = null;
      }

      let invoice: Invoice;

      if (existingInvoice) {
        await prisma.invoiceItem.deleteMany({
          where: { invoiceId: existingInvoice.id },
        });

        invoice = await prisma.invoice.update({
          where: { id: existingInvoice.id },
          data: {
            ...baseInvoiceData,
            items: {
              create: invoiceItemsForCreate,
            },
          },
        });
      } else {
        const invoiceNumber = await this.generateInvoiceNumber(branch.branchCode);

        invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            ...baseInvoiceData,
            createdBy: params.userId,
            items: {
              create: invoiceItemsForCreate,
            },
          },
        });
      }

      if (params.targetStatus === 'PAID') {
        await this.recordPaymentIfNeeded(invoice.id, invoiceTotalAmount, packages, addOns, params.userId, now);
      }

      logger.info('[InvoiceGeneration] Invoice ready', {
        invoiceNumber: invoice.invoiceNumber,
        status: params.targetStatus,
      });

      return invoice;
    } catch (error) {
      logger.error('[InvoiceGeneration] Error generating invoice', { error });
      return null;
    }
  }

  private async resolveAddOns(
    packages: InvoicePackage[],
    providedAddOns?: InvoiceAddOn[],
  ): Promise<InvoiceAddOn[]> {
    if (providedAddOns) {
      return providedAddOns;
    }

    if (packages.length === 0) {
      return [];
    }

    let packageIds = packages.map((pkg) => pkg.id).filter(Boolean);

    if (packages[0]?.purchaseGroupId) {
      const groupPackages = await prisma.memberPackage.findMany({
        where: { purchaseGroupId: packages[0].purchaseGroupId },
        select: { id: true },
      });
      packageIds = groupPackages.map((pkg) => pkg.id);
    }

    if (packageIds.length === 0) {
      return [];
    }

    return prisma.memberAddOn.findMany({
      where: {
        packageId: { in: packageIds },
        status: { not: 'CANCELLED' },
      },
    });
  }

  private buildInvoiceItems(
    packages: InvoicePackage[],
    addOns: InvoiceAddOn[],
  ): InvoiceItemForAllocation[] {
    const items: InvoiceItemForAllocation[] = [];

    for (const pkg of packages) {
      const itemCode = pkg.productCode || pkg.packageCode;
      const discountAmount = Number(pkg.discountAmount || 0);
      const originalPrice = Number(pkg.finalPrice) + discountAmount;

      items.push({
        itemType: 'PACKAGE',
        itemId: pkg.id,
        code: itemCode,
        description: this.getPackageDescription(pkg),
        quantity: 1,
        pricePerUnit: originalPrice,
        subtotal: originalPrice,
        discountAmount: 0,
        totalAmount: originalPrice,
      });
    }

    for (const addon of addOns) {
      const totalPrice = Number(addon.totalPrice || 0);
      const quantity = Number(addon.quantity || 1);
      const pricePerUnit = Number(addon.pricePerUnit || (quantity > 0 ? totalPrice / quantity : 0));

      items.push({
        itemType: 'ADDON',
        itemId: addon.id,
        code: addon.addOnCode,
        description: this.getAddOnDescription(addon),
        quantity,
        pricePerUnit,
        subtotal: totalPrice,
        discountAmount: 0,
        totalAmount: totalPrice,
      });
    }

    return items;
  }

  private getPaymentGroupId(packages: InvoicePackage[], addOns: InvoiceAddOn[]) {
    return (
      packages[0]?.purchaseGroupId ||
      packages[0]?.id ||
      addOns[0]?.packageId ||
      addOns[0]?.id ||
      `PAY-${Date.now()}`
    );
  }

  private calculateDiscount(packages: InvoicePackage[]): InvoiceDiscount {
    let discountAmount = 0;
    let discountPercent = 0;
    let discountNote: string | undefined;

    for (const pkg of packages) {
      discountAmount += Number(pkg.discountAmount || 0);

      if (pkg.discountPercent && Number(pkg.discountPercent) > 0) {
        discountPercent = Number(pkg.discountPercent);
      }

      if (pkg.discountNote && !discountNote) {
        discountNote = pkg.discountNote;
      }
    }

    return {
      discountAmount,
      discountPercent,
      discountNote,
    };
  }

  private getPackageDescription(pkg: InvoicePackage) {
    const isBooster = pkg.packageType === 'BOOSTER' || pkg.boosterType || pkg.productCode?.startsWith('BST-');

    if (isBooster) {
      const boosterCodeFromProduct = pkg.productCode?.startsWith('BST-')
        ? pkg.productCode.split('-')[1]
        : undefined;
      const boosterType = boosterCodeFromProduct || pkg.boosterType;
      const boosterTypeLabel =
        boosterType === 'NO2' || boosterType === 'PST'
          ? 'NO'
          : boosterType === 'HK'
            ? 'H2S Konsentrat'
            : boosterType;

      return `Paket Booster ${boosterTypeLabel} - ${pkg.totalSessions}x Sesi (${this.getServiceTypeLabel(pkg.serviceType)})`;
    }

    return `Paket Terapi Dasar - ${pkg.totalSessions}x Sesi`;
  }

  private getAddOnDescription(addon: InvoiceAddOn) {
    const addOnLabels: Record<string, string> = {
      AIR_NANO: 'Air Nano',
      KONSULTASI_GIZI: 'Konsultasi Gizi',
      KONSULTASI_PSIKOLOG: 'Konsultasi Psikolog',
      LAINNYA: 'Lainnya',
    };

    return `Add-On: ${addOnLabels[addon.addOnType] || addon.addOnType}`;
  }

  private getServiceTypeLabel(serviceType?: string) {
    const serviceLabels: Record<string, string> = {
      PM: 'Premier',
      PS: 'Partnership',
      PTY: 'Partnership Attiya',
      PDA: 'Partnership Dr. Abhi',
      PHC: 'Partnership Homecare',
    };

    return serviceLabels[serviceType || ''] || serviceType || 'Premier';
  }

  private getPaymentMethod(packages: InvoicePackage[], addOns: InvoiceAddOn[]) {
    const proof = this.getPaymentProof(packages, addOns);
    return proof.proofFileUrl ? 'TRANSFER' : 'CASH';
  }

  private getPaymentProof(packages: InvoicePackage[], addOns: InvoiceAddOn[]) {
    const source = packages.find((pkg) => pkg.paymentProofUrl) ||
      addOns.find((addon) => addon.paymentProofUrl) ||
      packages[0] ||
      addOns[0];

    return {
      proofFileUrl: source?.paymentProofUrl,
      proofFileName: source?.paymentProofFileName,
      proofFileSize: source?.paymentProofFileSize,
      proofMimeType: source?.paymentProofMimeType,
    };
  }

  private async recordPaymentIfNeeded(
    invoiceId: string,
    totalAmount: number,
    packages: InvoicePackage[],
    addOns: InvoiceAddOn[],
    userId: string,
    receivedAt: Date
  ) {
    if (!shouldRecordInvoicePayment(totalAmount)) {
      return;
    }

    const existingPayment = await prisma.invoicePayment.findFirst({
      where: { invoiceId },
    });

    if (existingPayment) {
      return;
    }

    const proof = this.getPaymentProof(packages, addOns);

    const paymentKey = `PACKAGE_PAYMENT:${invoiceId}`;
    await prisma.invoicePayment.create({
      data: {
        invoiceId,
        idempotencyKey: paymentKey,
        payloadHash: createHash('sha256').update(paymentKey).digest('hex'),
        amount: totalAmount,
        paymentMethod: proof.proofFileUrl ? 'TRANSFER' : 'CASH',
        proofFileUrl: proof.proofFileUrl || null,
        proofFileName: proof.proofFileName || null,
        proofFileSize: proof.proofFileSize || null,
        proofMimeType: proof.proofMimeType || null,
        receivedBy: userId,
        receivedAt,
        verificationStatus: 'VERIFIED',
        verifiedAt: receivedAt,
      },
    });
  }

  private async createNextInstallmentInvoice(
    previousInvoice: InvoiceWithItemsAndPayments,
    paidAmount: number,
    userId: string,
  ) {
    const nextInstallmentNumber = Number(previousInvoice.installmentNumber) + 1;
    const installmentTotal = Number(previousInvoice.installmentTotal);
    const schedule = Array.isArray(previousInvoice.installmentSchedule)
      ? previousInvoice.installmentSchedule
      : [];
    const nextSchedule = schedule.find(
      (item) => typeof item === 'object'
        && item !== null
        && 'installmentNumber' in item
        && Number(item.installmentNumber) === nextInstallmentNumber,
    );
    const plannedAmount = Math.round(Number(nextSchedule?.amount || 0));
    const totalPurchaseAmount = Number(previousInvoice.totalPurchaseAmount || previousInvoice.totalAmount || 0);
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        paymentGroupId: previousInvoice.paymentGroupId,
        status: 'PAID',
      },
      include: {
        payments: true,
      },
    });
    const totalPaid = paidInvoices.reduce((sum, invoice) => (
      sum + invoice.payments.reduce(
        (paymentSum, payment) => paymentSum + Number(payment.amount || 0),
        0,
      )
    ), 0);
    const remainingAmount = Math.max(0, totalPurchaseAmount - totalPaid);
    const nextAmount = plannedAmount > 0 ? Math.min(plannedAmount, remainingAmount) : remainingAmount;
    const carryOverAmount = 0;
    const creditAmount = 0;

    const existingNextInvoice = await prisma.invoice.findFirst({
      where: {
        paymentGroupId: previousInvoice.paymentGroupId,
        installmentNumber: nextInstallmentNumber,
        status: { not: 'CANCELLED' },
      },
    });

    if (existingNextInvoice) {
      return existingNextInvoice;
    }

    const branch = await prisma.branch.findUnique({
      where: { id: previousInvoice.branchId },
      select: { branchCode: true },
    });

    if (!branch) {
      logger.error('[InvoiceGeneration] Branch not found for next installment', {
        branchId: previousInvoice.branchId,
      });
      return null;
    }

    const invoiceNumber = await this.generateInvoiceNumber(branch.branchCode);
    const sourceItems = previousInvoice.items || [];
    const sourceTotal = sourceItems.reduce(
      (sum, item) => sum + Number(item.totalAmount || 0),
      0,
    );
    const clonedSourceItems = cloneInvoiceItemsForAllocation(sourceItems);
    const nextItems = nextAmount > 0
      ? allocateInvoiceItems(clonedSourceItems, nextAmount, sourceTotal)
      : clonedSourceItems;

    return prisma.invoice.create({
      data: {
        invoiceNumber,
        memberId: previousInvoice.memberId,
        branchId: previousInvoice.branchId,
        subtotal: nextAmount,
        discountPercent: null,
        discountAmount: 0,
        discountNote: null,
        taxPercent: 0,
        taxAmount: 0,
        totalAmount: nextAmount,
        status: 'PENDING_PAYMENT',
        paymentPlanType: 'INSTALLMENT',
        paymentGroupId: previousInvoice.paymentGroupId,
        installmentNumber: nextInstallmentNumber,
        installmentTotal,
        installmentSchedule: previousInvoice.installmentSchedule,
        totalPurchaseAmount: previousInvoice.totalPurchaseAmount,
        installmentAmount: nextAmount,
        carryOverAmount,
        creditAmount,
        actualPaidAmount: null,
        paymentVerificationStatus: 'PENDING',
        paymentRejectionReason: null,
        isAdjustment: false,
        dueDate: nextSchedule?.dueDate ? new Date(nextSchedule.dueDate) : this.getDefaultDueDate(new Date()),
        paidAt: null,
        paymentMethod: null,
        paymentReference: null,
        paymentNotes: null,
        notes: `Termin ${nextInstallmentNumber}/${installmentTotal}`,
        createdBy: userId,
        verifiedBy: null,
        verifiedAt: null,
        items: {
          create: nextItems,
        },
      },
    });
  }

  private getDefaultDueDate(from: Date) {
    const dueDate = new Date(from);
    dueDate.setDate(dueDate.getDate() + 7);
    return dueDate;
  }

  private async generateInvoiceNumber(branchCode: string): Promise<string> {
    return generateInvoiceNumber(branchCode);
  }
}
