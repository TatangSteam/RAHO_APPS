// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import type { RecordPaymentInput } from '../invoices.schema';

/**
 * Service for invoice payment processing
 */
export class InvoicePaymentService {
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

    return updated;
  }

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

    return { success: true, isPaid };
  }
}
