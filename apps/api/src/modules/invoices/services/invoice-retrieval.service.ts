// @ts-nocheck
import { prisma } from '../../../lib/prisma';

/**
 * Service for invoice retrieval
 */
export class InvoiceRetrievalService {
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
  }

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
  }

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
  }

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
  }
}
