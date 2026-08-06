import { prisma } from '../../../lib/prisma';
import { generateInvoiceNumber } from '../../../utils/invoiceGenerator';
import type { CreateInvoiceInput, UpdateInvoiceInput } from '../invoices.schema';
import { assertBranchAccess, assertPermission } from '../../iam/authorization.service';
import { PERMISSIONS } from '../../iam/permission-catalog';
import { logAudit } from '../../../utils/auditLog';
import { Prisma } from '@prisma/client';

/**
 * Service for invoice creation
 */
export class InvoiceCreationService {
  /**
   * Create a new invoice (DRAFT status)
   */
  async createInvoice(data: CreateInvoiceInput, user: { userId: string }) {
    const { memberId, items, discountPercent, discountAmount, discountNote, taxPercent = 0, dueDate, notes } = data;

    // Get member
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new Error('Member not found');
    }
    await assertBranchAccess(user.userId, member.registrationBranchId);
    await assertPermission(user.userId, PERMISSIONS.INVOICE_CREATE, member.registrationBranchId);

    // Calculate invoice totals
    let subtotal = new Prisma.Decimal(0);
    const invoiceItems: Prisma.InvoiceItemCreateWithoutInvoiceInput[] = [];

    for (const item of items) {
      let description = '';
      let code = '';
      let pricePerUnit = new Prisma.Decimal(0);
      let quantity = item.quantity || 1;

      if (item.itemType === 'PACKAGE') {
        const pkg = await prisma.memberPackage.findUnique({
          where: { id: item.itemId },
          include: { packagePricing: true }
        });
        if (!pkg) throw new Error(`Package ${item.itemId} not found`);
        if (pkg.memberId !== memberId || pkg.branchId !== member.registrationBranchId) {
          throw new Error('Package tidak dimiliki member/cabang invoice.');
        }
        
        code = pkg.productCode || pkg.packageCode || `PKG-${pkg.id.slice(0, 8)}`;
        
        if (pkg.boosterType) {
          // Booster package
          const serviceTypeLabel = pkg.serviceType === 'PM' ? 'Perawatan Mandiri' :
                                   pkg.serviceType === 'PS' ? 'Perawatan Standar' :
                                   pkg.serviceType === 'PTY' ? 'Perawatan Terapi' :
                                   pkg.serviceType === 'PDA' ? 'Perawatan Dokter' :
                                   pkg.serviceType === 'PHC' ? 'Perawatan Home Care' : pkg.serviceType;
          description = `Paket Booster ${pkg.boosterType} - ${pkg.totalSessions}x Sesi (${serviceTypeLabel})`;
        } else {
          // Basic package
          description = `Paket Terapi Dasar - ${pkg.totalSessions}x Sesi`;
        }
        
        // Use finalPrice from member package (sudah termasuk diskon jika ada)
        pricePerUnit = new Prisma.Decimal(pkg.finalPrice);
        quantity = item.quantity || 1;
      } else if (item.itemType === 'ADDON') {
        const addon = await prisma.memberAddOn.findUnique({
          where: { id: item.itemId },
        });
        if (!addon) throw new Error(`Add-on ${item.itemId} not found`);
        if (addon.memberId !== memberId || addon.branchId !== member.registrationBranchId) {
          throw new Error('Add-on tidak dimiliki member/cabang invoice.');
        }
        
        code = addon.addOnCode || `ADDON-${addon.id.slice(0, 8)}`;
        
        // Better addon descriptions
        const addOnLabels: Record<string, string> = {
          'AIR_NANO': 'Air Nano Premium',
          'ROKOK_KENKOU': 'Rokok Kenkou',
          'KONSULTASI_GIZI': 'Konsultasi Gizi',
          'KONSULTASI_PSIKOLOG': 'Konsultasi Psikolog',
          'LAINNYA': 'Layanan Tambahan'
        };
        
        description = `${addOnLabels[addon.addOnType] || addon.addOnType}`;
        pricePerUnit = new Prisma.Decimal(addon.pricePerUnit);
        quantity = addon.quantity || item.quantity || 1;
      } else if (item.itemType === 'NON_THERAPY') {
        const purchase = await prisma.memberNonTherapyPurchase.findUnique({
          where: { id: item.itemId },
          include: { product: true }
        });
        if (!purchase) throw new Error(`Non-therapy purchase ${item.itemId} not found`);
        if (purchase.memberId !== memberId || purchase.branchId !== member.registrationBranchId) {
          throw new Error('Pembelian non-terapi tidak dimiliki member/cabang invoice.');
        }
        
        code = purchase.product?.productCode || `PROD-${purchase.id.slice(0, 8)}`;
        description = purchase.product?.name || 'Produk Non-Terapi';
        pricePerUnit = new Prisma.Decimal(purchase.pricePerUnit);
        quantity = purchase.quantity || item.quantity || 1;
      }

      const itemSubtotal = pricePerUnit.mul(quantity);
      subtotal = subtotal.plus(itemSubtotal);

      invoiceItems.push({
        itemType: item.itemType,
        itemId: item.itemId,
        code,
        description,
        quantity,
        pricePerUnit,
        subtotal: itemSubtotal,
        discountAmount: 0,
        totalAmount: itemSubtotal,
      });
    }

    // Calculate discount
    let finalDiscountAmount = new Prisma.Decimal(discountAmount || 0);
    if (discountPercent && discountPercent > 0) {
      finalDiscountAmount = subtotal.mul(discountPercent).div(100);
    }

    // Calculate tax
    const taxableAmount = subtotal.minus(finalDiscountAmount);
    const taxAmount = taxableAmount.mul(taxPercent).div(100);

    // Calculate total
    const totalAmount = taxableAmount.plus(taxAmount);

    // Get branch code
    const branch = await prisma.branch.findUnique({
      where: { id: member.registrationBranchId },
      select: { branchCode: true },
    });

    if (!branch) {
      throw new Error('Branch not found');
    }

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(branch.branchCode);

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        memberId,
        branchId: member.registrationBranchId,
        subtotal,
        discountPercent: discountPercent || null,
        discountAmount: finalDiscountAmount,
        discountNote: discountNote || null,
        taxPercent,
        taxAmount,
        totalAmount,
        status: 'DRAFT',
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        createdBy: user.userId,
        items: {
          create: invoiceItems,
        },
      },
      include: {
        member: true,
        branch: true,
        createdByUser: true,
        items: true,
        payments: true,
      },
    });

    await logAudit({
      userId: user.userId,
      branchId: member.registrationBranchId,
      action: 'CREATE',
      module: 'FINANCE',
      resource: 'Invoice',
      resourceId: invoice.id,
      entityType: 'Invoice',
      entityId: invoice.id,
      entityCode: invoice.invoiceNumber,
      afterData: { status: invoice.status, memberId, totalAmount: invoice.totalAmount },
      description: `Invoice ${invoice.invoiceNumber} dibuat.`,
    });

    return invoice;
  }

  /**
   * Update invoice (only DRAFT invoices can be updated)
   */
  async updateInvoice(invoiceId: string, data: UpdateInvoiceInput, userId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }
    await assertBranchAccess(userId, invoice.branchId);
    await assertPermission(userId, PERMISSIONS.INVOICE_UPDATE, invoice.branchId);

    if (invoice.status !== 'DRAFT') {
      throw new Error('Only DRAFT invoices can be updated');
    }

    const discountPercent = data.discountPercent !== undefined
      ? new Prisma.Decimal(data.discountPercent)
      : new Prisma.Decimal(invoice.discountPercent || 0);
    let nextDiscount = data.discountAmount !== undefined
      ? new Prisma.Decimal(data.discountAmount)
      : new Prisma.Decimal(invoice.discountAmount || 0);
    if (discountPercent.greaterThan(0)) nextDiscount = new Prisma.Decimal(invoice.subtotal).mul(discountPercent).div(100);
    const taxPercent = data.taxPercent !== undefined
      ? new Prisma.Decimal(data.taxPercent)
      : new Prisma.Decimal(invoice.taxPercent || 0);
    const taxable = new Prisma.Decimal(invoice.subtotal).minus(nextDiscount);
    if (taxable.isNegative()) throw new Error('Discount cannot exceed invoice subtotal');
    const taxAmount = taxable.mul(taxPercent).div(100);
    const totalAmount = taxable.plus(taxAmount);

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        discountPercent,
        discountAmount: nextDiscount,
        discountNote: data.discountNote,
        taxPercent,
        taxAmount,
        totalAmount,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        notes: data.notes,
      },
      include: {
        member: true,
        branch: true,
        createdByUser: true,
        verifiedByUser: true,
        items: true,
        payments: true,
      },
    });

    await logAudit({
      userId,
      branchId: invoice.branchId,
      action: 'UPDATE',
      module: 'FINANCE',
      resource: 'Invoice',
      resourceId: invoiceId,
      entityCode: invoice.invoiceNumber,
      beforeData: invoice,
      afterData: updated,
      description: `Invoice ${invoice.invoiceNumber} diperbarui.`,
    });

    return updated;
  }

  /**
   * Generate invoice number with auto-increment
   * New format: {SEQ:05}-{BRANCH}-{MM}-{YYYY}
   */
  private async generateInvoiceNumber(branchCode: string): Promise<string> {
    return generateInvoiceNumber(branchCode);
  }
}
