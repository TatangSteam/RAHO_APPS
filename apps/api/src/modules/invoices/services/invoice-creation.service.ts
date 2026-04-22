// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { generateInvoiceNumber } from '../../../utils/codeGenerator';
import type { CreateInvoiceInput } from '../invoices.schema';

/**
 * Service for invoice creation
 */
export class InvoiceCreationService {
  /**
   * Create a new invoice (DRAFT status)
   */
  async createInvoice(data: CreateInvoiceInput, userId: string) {
    const { memberId, items, discountPercent, discountAmount, discountNote, taxPercent = 0, dueDate, notes } = data;

    // Get member
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    // Calculate invoice totals
    let subtotal = 0;
    const invoiceItems: any[] = [];

    for (const item of items) {
      let description = '';
      let code = '';
      let pricePerUnit = 0;
      let quantity = item.quantity || 1;

      if (item.itemType === 'PACKAGE') {
        const pkg = await prisma.memberPackage.findUnique({
          where: { id: item.itemId },
          include: { packagePricing: true }
        });
        if (!pkg) throw new Error(`Package ${item.itemId} not found`);
        
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
        pricePerUnit = Number(pkg.finalPrice);
        quantity = item.quantity || 1;
      } else if (item.itemType === 'ADDON') {
        const addon = await prisma.memberAddOn.findUnique({
          where: { id: item.itemId },
        });
        if (!addon) throw new Error(`Add-on ${item.itemId} not found`);
        
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
        pricePerUnit = Number(addon.pricePerUnit);
        quantity = addon.quantity || item.quantity || 1;
      } else if (item.itemType === 'NON_THERAPY') {
        const purchase = await (prisma as any).memberNonTherapyPurchase.findUnique({
          where: { id: item.itemId },
          include: { product: true }
        });
        if (!purchase) throw new Error(`Non-therapy purchase ${item.itemId} not found`);
        
        code = purchase.product?.productCode || `PROD-${purchase.id.slice(0, 8)}`;
        description = purchase.product?.name || 'Produk Non-Terapi';
        pricePerUnit = Number(purchase.pricePerUnit);
        quantity = purchase.quantity || item.quantity || 1;
      }

      const itemSubtotal = pricePerUnit * quantity;
      subtotal += itemSubtotal;

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
    let finalDiscountAmount = discountAmount || 0;
    if (discountPercent && discountPercent > 0) {
      finalDiscountAmount = (subtotal * discountPercent) / 100;
    }

    // Calculate tax
    const taxableAmount = subtotal - finalDiscountAmount;
    const taxAmount = (taxableAmount * taxPercent) / 100;

    // Calculate total
    const totalAmount = taxableAmount + taxAmount;

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
    const invoice = await (prisma as any).invoice.create({
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
        createdBy: userId,
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

    return invoice;
  }

  /**
   * Update invoice (only DRAFT invoices can be updated)
   */
  async updateInvoice(invoiceId: string, data: any) {
    const invoice = await (prisma as any).invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
      throw new Error('Only DRAFT invoices can be updated');
    }

    const updated = await (prisma as any).invoice.update({
      where: { id: invoiceId },
      data: {
        discountPercent: data.discountPercent,
        discountAmount: data.discountAmount,
        discountNote: data.discountNote,
        taxPercent: data.taxPercent,
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

    return updated;
  }

  /**
   * Generate invoice number with auto-increment
   */
  private async generateInvoiceNumber(branchCode: string): Promise<string> {
    const yymm = new Date().toISOString().slice(2, 7).replace('-', '');
    const prefix = `INV-${branchCode}-${yymm}-`;
    
    const lastInvoice = await (prisma as any).invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
      select: {
        invoiceNumber: true,
      },
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0');
      sequence = lastSeq + 1;
    }

    return generateInvoiceNumber(branchCode, sequence);
  }
}
