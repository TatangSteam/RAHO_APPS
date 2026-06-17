// @ts-nocheck
import { prisma } from '../../../lib/prisma';

type InvoiceTargetStatus = 'PENDING_PAYMENT' | 'PAID';

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
    userId: string
  ) {
    return this.createOrUpdateInvoiceForPurchase({
      packages,
      addOns,
      member,
      userId,
      targetStatus: 'PENDING_PAYMENT',
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

  private async createOrUpdateInvoiceForPurchase(params: {
    packages: any[];
    addOns?: any[];
    member: any;
    userId: string;
    targetStatus: InvoiceTargetStatus;
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
      const itemIds = [
        ...packages.map((pkg) => pkg.id),
        ...addOns.map((addon) => addon.id),
      ].filter(Boolean);

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
        subtotal,
        discountPercent: discountInfo.discountPercent || null,
        discountAmount: discountInfo.discountAmount,
        discountNote: discountInfo.discountNote || null,
        taxPercent: 0,
        taxAmount: 0,
        totalAmount,
        status: params.targetStatus,
      };

      if (params.targetStatus === 'PAID') {
        baseInvoiceData.paidAt = now;
        baseInvoiceData.paymentMethod = this.getPaymentMethod(packages, addOns);
        baseInvoiceData.verifiedBy = params.userId;
        baseInvoiceData.verifiedAt = now;
      } else {
        baseInvoiceData.dueDate = this.getDefaultDueDate(now);
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
              create: invoiceItems,
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
              create: invoiceItems,
            },
          },
        });
      }

      if (params.targetStatus === 'PAID') {
        await this.recordPaymentIfNeeded(invoice.id, totalAmount, packages, addOns, params.userId, now);
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
