import { prisma } from '../../lib/prisma';
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  RecordPaymentInput,
  CancelInvoiceInput,
} from './invoices.schema';
import { generateInvoiceNumber } from '../../utils/codeGenerator';

// ============================================================
// INVOICE SERVICE
// ============================================================

export const invoiceService = {
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
        // Will work after Prisma regeneration
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

    // Get next invoice sequence for this branch and month
    const yymm = new Date().toISOString().slice(2, 7).replace('-', '');
    const prefix = `INV-${branch.branchCode}-${yymm}-`;
    
    // Will work after Prisma regeneration
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

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber(branch.branchCode, sequence);

    // Create invoice - will work after Prisma regeneration
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
  },

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string) {
    const invoice = await (prisma as any).invoice.findUnique({
      where: { id: invoiceId },
      include: {
        member: true,
        branch: true,
        createdByUser: true,
        verifiedByUser: true,
        items: true,
        payments: {
          include: {
            receivedByUser: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    return this.formatInvoice(invoice);
  },

  /**
   * Get invoice by package ID
   */
  async getInvoiceByPackageId(packageId: string) {
    const invoice = await (prisma as any).invoice.findFirst({
      where: {
        items: {
          some: {
            itemType: 'PACKAGE',
            itemId: packageId,
          },
        },
      },
      include: {
        member: true,
        branch: true,
        createdByUser: true,
        verifiedByUser: true,
        items: true,
        payments: {
          include: {
            receivedByUser: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found for this package');
    }

    return this.formatInvoice(invoice);
  },

  /**
   * Get member's invoices
   */
  async getMemberInvoices(memberId: string) {
    const invoices = await (prisma as any).invoice.findMany({
      where: { memberId },
      include: {
        member: true,
        branch: true,
        createdByUser: true,
        verifiedByUser: true,
        items: true,
        payments: {
          include: {
            receivedByUser: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invoices.map((inv: any) => this.formatInvoice(inv));
  },

  /**
   * Update invoice (only DRAFT invoices can be updated)
   */
  async updateInvoice(invoiceId: string, data: UpdateInvoiceInput) {
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

    return this.formatInvoice(updated);
  },

  /**
   * Finalize invoice (DRAFT -> PENDING_PAYMENT)
   */
  async finalizeInvoice(invoiceId: string, dueDate?: string) {
    const invoice = await (prisma as any).invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
      throw new Error('Only DRAFT invoices can be finalized');
    }

    const updated = await (prisma as any).invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PENDING_PAYMENT',
        dueDate: dueDate ? new Date(dueDate) : invoice.dueDate,
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

    return this.formatInvoice(updated);
  },

  /**
   * Record payment and mark invoice as PAID
   */
  async recordPayment(invoiceId: string, data: RecordPaymentInput, userId: string) {
    const invoice = await (prisma as any).invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new Error('Invoice is already paid');
    }

    if (invoice.status === 'CANCELLED') {
      throw new Error('Cannot record payment for cancelled invoice');
    }

    // Calculate total paid amount
    const totalPaid = invoice.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0) + data.amount;

    // Check if fully paid
    const isPaid = totalPaid >= Number(invoice.totalAmount);

    // Record payment
    await (prisma as any).invoicePayment.create({
      data: {
        invoiceId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentReference || null,
        notes: data.notes || null,
        receivedBy: userId,
      },
    });

    // Update invoice status if fully paid
    if (isPaid) {
      await (prisma as any).invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          verifiedBy: userId,
          verifiedAt: new Date(),
        },
      });
    }

    return this.getInvoiceById(invoiceId);
  },

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string, data: CancelInvoiceInput) {
    const invoice = await (prisma as any).invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new Error('Cannot cancel paid invoice');
    }

    if (invoice.status === 'CANCELLED') {
      throw new Error('Invoice is already cancelled');
    }

    const updated = await (prisma as any).invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        notes: invoice.notes ? `${invoice.notes}\n\nCancellation reason: ${data.reason}` : `Cancellation reason: ${data.reason}`,
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

    return this.formatInvoice(updated);
  },

  /**
   * Format invoice for API response
   */
  formatInvoice(invoice: any) {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      memberId: invoice.memberId,
      memberName: invoice.member.fullName,
      memberNo: invoice.member.memberNo,
      branchId: invoice.branchId,
      branchName: invoice.branch.name,
      
      // Financial
      subtotal: Number(invoice.subtotal),
      discountPercent: invoice.discountPercent ? Number(invoice.discountPercent) : undefined,
      discountAmount: Number(invoice.discountAmount),
      discountNote: invoice.discountNote || undefined,
      taxPercent: Number(invoice.taxPercent),
      taxAmount: Number(invoice.taxAmount),
      totalAmount: Number(invoice.totalAmount),
      
      // Status
      status: invoice.status,
      dueDate: invoice.dueDate?.toISOString(),
      paidAt: invoice.paidAt?.toISOString(),
      cancelledAt: invoice.cancelledAt?.toISOString(),
      
      // Metadata
      notes: invoice.notes || undefined,
      createdBy: invoice.createdBy,
      createdByName: invoice.createdByUser.fullName,
      verifiedBy: invoice.verifiedBy || undefined,
      verifiedByName: invoice.verifiedByUser?.fullName,
      verifiedAt: invoice.verifiedAt?.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      
      // Relations
      items: invoice.items.map((item: any) => ({
        id: item.id,
        itemType: item.itemType,
        itemId: item.itemId,
        code: item.code || undefined,
        description: item.description,
        quantity: item.quantity,
        pricePerUnit: Number(item.pricePerUnit),
        subtotal: Number(item.subtotal),
        discountAmount: Number(item.discountAmount),
        totalAmount: Number(item.totalAmount),
      })),
      payments: invoice.payments.map((payment: any) => ({
        id: payment.id,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        paymentReference: payment.paymentReference || undefined,
        notes: payment.notes || undefined,
        receivedBy: payment.receivedBy,
        receivedByName: payment.receivedByUser.fullName,
        receivedAt: payment.receivedAt.toISOString(),
      })),
    };
  },
};
