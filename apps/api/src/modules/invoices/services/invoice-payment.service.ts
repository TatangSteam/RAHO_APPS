// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import type { RecordPaymentInput } from '../invoices.schema';
import { assertBranchAccess, assertPermission } from '../../iam/authorization.service';
import { PERMISSIONS } from '../../iam/permission-catalog';
import { logAudit } from '../../../utils/auditLog';

/**
 * Service for invoice payment processing
 */
export class InvoicePaymentService {
  async assertInvoiceBranch(invoiceId: string, userId: string) {
    const invoice = await (prisma as any).invoice.findUnique({
      where: { id: invoiceId },
      select: { branchId: true },
    });
    if (!invoice) throw new Error('Invoice not found');
    await assertBranchAccess(userId, invoice.branchId);
    await assertPermission(userId, PERMISSIONS.INVOICE_PAYMENT, invoice.branchId);
  }
  /**
   * Finalize invoice (DRAFT -> PENDING_PAYMENT)
   */
  async finalizeInvoice(invoiceId: string, dueDate: string | undefined, userId: string) {
    const invoice = await (prisma as any).invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }
    await assertBranchAccess(userId, invoice.branchId);
    await assertPermission(userId, PERMISSIONS.INVOICE_FINALIZE, invoice.branchId);

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

    await logAudit({
      userId,
      branchId: invoice.branchId,
      action: 'UPDATE',
      module: 'FINANCE',
      resource: 'Invoice',
      resourceId: invoiceId,
      entityCode: invoice.invoiceNumber,
      beforeData: { status: invoice.status },
      afterData: { status: updated.status, dueDate: updated.dueDate },
      description: `Invoice ${invoice.invoiceNumber} difinalisasi.`,
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
    await assertBranchAccess(userId, invoice.branchId);
    await assertPermission(userId, PERMISSIONS.INVOICE_PAYMENT, invoice.branchId);

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

    await logAudit({
      userId,
      branchId: invoice.branchId,
      action: 'CREATE',
      module: 'FINANCE',
      resource: 'Payment',
      resourceId: invoiceId,
      entityType: 'Invoice',
      entityId: invoiceId,
      entityCode: invoice.invoiceNumber,
      afterData: { amount: data.amount, paymentMethod: data.paymentMethod, isPaid },
      description: `Pembayaran invoice ${invoice.invoiceNumber} dicatat.`,
    });

    return { success: true, isPaid };
  }
}
