// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import type { CancelInvoiceInput } from '../invoices.schema';

/**
 * Service for invoice cancellation
 */
export class InvoiceCancellationService {
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
        notes: invoice.notes 
          ? `${invoice.notes}\n\nCancellation reason: ${data.reason}` 
          : `Cancellation reason: ${data.reason}`,
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
}
