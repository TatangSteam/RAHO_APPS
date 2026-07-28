// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import type { CancelInvoiceInput } from '../invoices.schema';
import { assertBranchAccess, assertPermission } from '../../iam/authorization.service';
import { PERMISSIONS } from '../../iam/permission-catalog';
import { Prisma } from '@prisma/client';
import { enqueueVoidedInvoiceTx, INVOICE_FINALIZED_EVENT } from '@modules/zoho/zoho.invoice.service';

/**
 * Service for invoice cancellation
 */
export class InvoiceCancellationService {
  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string, data: CancelInvoiceInput, userId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { branch: true, items: true },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }
    await assertBranchAccess(userId, invoice.branchId);
    await assertPermission(userId, PERMISSIONS.INVOICE_CANCEL, invoice.branchId);

    if (invoice.status === 'PAID') {
      throw new Error('Cannot cancel paid invoice');
    }

    if (invoice.status === 'CANCELLED') {
      throw new Error('Invoice is already cancelled');
    }

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`);
      const locked = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          member: true,
          branch: true,
          createdByUser: true,
          verifiedByUser: true,
          items: true,
          payments: true,
        },
      });
      if (!locked) throw new Error('Invoice not found');
      if (locked.status === 'PAID') throw new Error('Cannot cancel paid invoice');
      if (locked.status === 'CANCELLED') throw new Error('Invoice is already cancelled');
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          notes: locked.notes
            ? `${locked.notes}\n\nCancellation reason: ${data.reason}`
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
      const finalizedEvent = await tx.integrationEvent.findUnique({
        where: {
          eventType_aggregateId: {
            eventType: INVOICE_FINALIZED_EVENT,
            aggregateId: locked.id,
          },
        },
      });
      const eventSnapshot = finalizedEvent?.payload as {
        eligible?: boolean;
        excludedReason?: string | null;
      } | null;
      const classification = locked.items.some((line) => line.itemType === 'PACKAGE')
        ? 'THERAPY_ADVANCE'
        : 'NORMAL_SALE';
      const eligible = eventSnapshot?.eligible
        ?? (locked.branch.type !== 'PARTNERSHIP' && classification === 'NORMAL_SALE');
      if (locked.finalizedAt || finalizedEvent) {
        await enqueueVoidedInvoiceTx(tx, {
          invoiceId: locked.id,
          invoiceNumber: locked.invoiceNumber,
          branchId: locked.branchId,
          eligible,
          excludedReason: eventSnapshot?.excludedReason
            ?? (eligible ? null : 'Invoice dikecualikan oleh kebijakan revenue Zoho.'),
        });
      }
      await tx.auditLog.create({
        data: {
          userId,
          branchId: locked.branchId,
          action: 'UPDATE',
          module: 'FINANCE',
          resource: 'Invoice',
          resourceId: invoiceId,
          entityType: 'Invoice',
          entityId: invoiceId,
          entityCode: locked.invoiceNumber,
          beforeData: { status: locked.status },
          afterData: { status: updated.status, reason: data.reason },
          description: `Invoice ${locked.invoiceNumber} dibatalkan.`,
        },
      });
      return updated;
    });
  }
}
