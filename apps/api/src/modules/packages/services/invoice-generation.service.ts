// @ts-nocheck
import { prisma } from '../../../lib/prisma';

type InvoiceTargetStatus = 'PENDING_PAYMENT' | 'PAID';
type PaymentPlanConfig = {
  type: 'FULL_PAYMENT' | 'INSTALLMENT';
  installmentCount?: number;
  installments?: Array<{
    installmentNumber: number;
    amount: number;
    dueDate?: string;
  }>;
};

/**
 * Service for creating invoice records from assigned packages/add-ons.
 *
 * The same invoice starts as PENDING_PAYMENT when packages are assigned, then
 * becomes PAID after staff verifies the payment. The paid invoice is used as
 * the receipt/kwitansi.
 */
export class InvoiceGenerationService {
  async generatePendingInvoiceForPackages(
    packages: any[],
    addOns: any[] = [],
    member: any,
    userId: string,
    paymentPlan?: PaymentPlanConfig
  ) {
    return this.createOrUpdateInvoiceForPurchase({
      packages,
      addOns,
      member,
      userId,
      targetStatus: 'PENDING_PAYMENT',
      paymentPlan,
    });
  }

  /**
   * Backward-compatible method used by older callers. It now marks the related
   * invoice as paid, or creates a paid invoice if the pending invoice is absent.
   */
  async generateInvoiceForPackages(packages: any[], member: any, userId: string) {
    return this.markInvoicePaidForPackages(packages, undefined, member, userId);
  }

  async markInvoicePaidForPackages(
    packages: any[],
    addOns: any[] | undefined,
    member: any,
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

  async markInvoicePaidForAddOns(addOns: any[], member: any, userId: string) {
    return this.createOrUpdateInvoiceForPurchase({
      packages: [],
      addOns,
      member,
      userId,
      targetStatus: 'PAID',
    });
  }

  async verifyActiveInvoiceForPurchase(
    packages: any[],
    addOns: any[] | undefined,
    member: any,
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
    const paidAmount = Math.round(paymentData.paidAmount || invoiceTotal);

    await prisma.invoicePayment.create({
      data: {
        invoiceId: invoice.id,
        amount: paidAmount,
        paymentMethod: paymentData.proofFileUrl ? 'TRANSFER' : 'CASH',
        notes: paymentData.notes || null,
        proofFileUrl: paymentData.proofFileUrl || null,
        proofFileName: paymentData.proofFileName || null,
        proofFileSize: paymentData.proofFileSize || null,
        proofMimeType: paymentData.proofMimeType || null,
        receivedBy: userId,
        receivedAt: now,
      },
    });

    const paidInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
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
      await this.createNextInstallmentInvoice(invoice, paidAmount, userId);
    }

    return paidInvoice;
  }

  private async createOrUpdateInvoiceForPurchase(params: {
    packages: any[];
    addOns?: any[];
    member: any;
    userId: string;
    targetStatus: InvoiceTargetStatus;
    paymentPlan?: PaymentPlanConfig;
  }) {
    try {
      const packages = params.packages || [];
      const addOns = await this.resolveAddOns(packages, params.addOns);

      if (packages.length === 0 && addOns.length === 0) {
        console.warn('[InvoiceGeneration] No packages or add-ons to invoice');
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
        console.error('[InvoiceGeneration] Branch not found');
        return null;
      }

      const invoiceItems = this.buildInvoiceItems(packages, addOns);
      const subtotal = invoiceItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
      const discountInfo = this.calculateDiscount(packages);
      const totalAmount = Math.max(0, subtotal - discountInfo.discountAmount);
      const paymentPlan = params.paymentPlan || { type: 'FULL_PAYMENT' };
      const isInstallmentInvoice = params.targetStatus === 'PENDING_PAYMENT' && paymentPlan.type === 'INSTALLMENT';
      const firstInstallment = isInstallmentInvoice ? paymentPlan.installments?.[0] : undefined;
      const invoiceTotalAmount = isInstallmentInvoice ? Math.round(firstInstallment?.amount || 0) : totalAmount;
      const invoiceItemsForCreate = isInstallmentInvoice
        ? this.allocateInvoiceItems(invoiceItems, invoiceTotalAmount, subtotal)
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
      const baseInvoiceData: any = {
        memberId: params.member.id,
        branchId,
        subtotal: invoiceItemsForCreate.reduce((sum, item) => sum + Number(item.subtotal || 0), 0),
        discountPercent: discountInfo.discountPercent || null,
        discountAmount: isInstallmentInvoice ? 0 : discountInfo.discountAmount,
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

      let invoice: any;

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

      console.log(
        `[InvoiceGeneration] ${params.targetStatus} invoice ready: ${invoice.invoiceNumber}`
      );

      return invoice;
    } catch (error) {
      console.error('[InvoiceGeneration] Error generating invoice:', error);
      return null;
    }
  }

  private async resolveAddOns(packages: any[], providedAddOns?: any[]) {
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

  private buildInvoiceItems(packages: any[], addOns: any[]) {
    const items: any[] = [];

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

  private allocateInvoiceItems(items: any[], invoiceAmount: number, sourceTotal: number) {
    if (items.length === 0) return [];

    if (sourceTotal <= 0 || invoiceAmount <= 0) {
      return items.map((item, index) => ({
        ...item,
        description: index === 0 ? `${item.description} - Termin` : item.description,
        pricePerUnit: index === 0 ? invoiceAmount : 0,
        subtotal: index === 0 ? invoiceAmount : 0,
        totalAmount: index === 0 ? invoiceAmount : 0,
        discountAmount: 0,
      }));
    }

    let allocated = 0;

    return items.map((item, index) => {
      const isLast = index === items.length - 1;
      const rawAmount = isLast
        ? invoiceAmount - allocated
        : Math.round((Number(item.totalAmount || item.subtotal || 0) / sourceTotal) * invoiceAmount);
      allocated += rawAmount;

      return {
        ...item,
        pricePerUnit: rawAmount,
        subtotal: rawAmount,
        discountAmount: 0,
        totalAmount: rawAmount,
      };
    });
  }

  private getPaymentGroupId(packages: any[], addOns: any[]) {
    return (
      packages[0]?.purchaseGroupId ||
      packages[0]?.id ||
      addOns[0]?.packageId ||
      addOns[0]?.id ||
      `PAY-${Date.now()}`
    );
  }

  private calculateDiscount(packages: any[]) {
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

  private getPackageDescription(pkg: any) {
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

  private getAddOnDescription(addon: any) {
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

  private getPaymentMethod(packages: any[], addOns: any[]) {
    const proof = this.getPaymentProof(packages, addOns);
    return proof.proofFileUrl ? 'TRANSFER' : 'CASH';
  }

  private getPaymentProof(packages: any[], addOns: any[]) {
    const source = packages.find((pkg) => pkg.paymentProofUrl) ||
      addOns.find((addon) => addon.paymentProofUrl) ||
      packages[0] ||
      addOns[0] ||
      {};

    return {
      proofFileUrl: source.paymentProofUrl,
      proofFileName: source.paymentProofFileName,
      proofFileSize: source.paymentProofFileSize,
      proofMimeType: source.paymentProofMimeType,
    };
  }

  private async recordPaymentIfNeeded(
    invoiceId: string,
    totalAmount: number,
    packages: any[],
    addOns: any[],
    userId: string,
    receivedAt: Date
  ) {
    const existingPayment = await prisma.invoicePayment.findFirst({
      where: { invoiceId },
    });

    if (existingPayment) {
      return;
    }

    const proof = this.getPaymentProof(packages, addOns);

    await prisma.invoicePayment.create({
      data: {
        invoiceId,
        amount: totalAmount,
        paymentMethod: proof.proofFileUrl ? 'TRANSFER' : 'CASH',
        proofFileUrl: proof.proofFileUrl || null,
        proofFileName: proof.proofFileName || null,
        proofFileSize: proof.proofFileSize || null,
        proofMimeType: proof.proofMimeType || null,
        receivedBy: userId,
        receivedAt,
      },
    });
  }

  private async createNextInstallmentInvoice(previousInvoice: any, paidAmount: number, userId: string) {
    const nextInstallmentNumber = Number(previousInvoice.installmentNumber) + 1;
    const installmentTotal = Number(previousInvoice.installmentTotal);
    const schedule = Array.isArray(previousInvoice.installmentSchedule)
      ? previousInvoice.installmentSchedule
      : [];
    const nextSchedule = schedule.find((item: any) => Number(item.installmentNumber) === nextInstallmentNumber);
    const plannedAmount = Math.round(Number(nextSchedule?.amount || 0));
    const previousDue = Number(previousInvoice.totalAmount || 0);
    const carryOverAmount = Math.max(0, previousDue - paidAmount);
    const creditAmount = Math.max(0, paidAmount - previousDue);
    const nextAmount = Math.max(0, plannedAmount + carryOverAmount - creditAmount);

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
      console.error('[InvoiceGeneration] Branch not found for next installment');
      return null;
    }

    const invoiceNumber = await this.generateInvoiceNumber(branch.branchCode);
    const sourceItems = previousInvoice.items || [];
    const sourceTotal = sourceItems.reduce((sum: number, item: any) => sum + Number(item.totalAmount || 0), 0);
    const nextItems = this.allocateInvoiceItems(
      sourceItems.map((item: any) => ({
        itemType: item.itemType,
        itemId: item.itemId,
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        pricePerUnit: Number(item.pricePerUnit),
        subtotal: Number(item.subtotal),
        discountAmount: 0,
        totalAmount: Number(item.totalAmount),
      })),
      nextAmount,
      sourceTotal
    );

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
        installmentAmount: plannedAmount,
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
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `INV-${branchCode}-${year}${month}`;

    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    const sequence = lastInvoice
      ? parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0', 10) + 1
      : 1;

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }
}
