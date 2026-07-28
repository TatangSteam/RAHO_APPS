import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { postJournal } from '@modules/accounting/accounting.service';
import type { RefundPaymentInput } from '../invoices.schema';
import {
  buildPaymentRefundSnapshot,
  enqueuePaymentRefundTx,
} from '@modules/zoho/zoho.payment.service';

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function payloadHash(paymentId: string, data: RefundPaymentInput): string {
  return createHash('sha256').update(JSON.stringify({
    paymentId,
    amount: new Prisma.Decimal(data.amount).toFixed(2),
    cashBankAccountId: data.cashBankAccountId,
    reason: data.reason,
    referenceNumber: data.referenceNumber || null,
    refundDate: data.refundDate || null,
  })).digest('hex');
}

export class InvoiceRefundService {
  async refundPayment(paymentId: string, data: RefundPaymentInput, userId: string) {
    const candidate = await prisma.invoicePayment.findUnique({
      where: { id: paymentId },
      select: { invoice: { select: { branchId: true } } },
    });
    if (!candidate) throw errors.notFound('Pembayaran tidak ditemukan.');
    await assertBranchAccess(userId, candidate.invoice.branchId);
    await assertPermission(userId, PERMISSIONS.PAYMENT_REFUND, candidate.invoice.branchId);

    const amount = new Prisma.Decimal(data.amount);
    const hash = payloadHash(paymentId, data);
    try {
      return await prisma.$transaction(async (tx) => {
        const replay = await tx.invoicePaymentRefund.findUnique({
          where: { idempotencyKey: data.postingKey },
        });
        if (replay) {
          if (replay.payloadHash !== hash) {
            throw errors.conflict('REFUND_KEY_REUSED', 'Idempotency key dipakai untuk refund yang berbeda.');
          }
          return { refund: replay, idempotentReplay: true };
        }

        const identity = await tx.invoicePayment.findUnique({
          where: { id: paymentId },
          select: { invoiceId: true },
        });
        if (!identity) throw errors.notFound('Pembayaran tidak ditemukan.');
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoices" WHERE "id" = ${identity.invoiceId} FOR UPDATE`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoice_payments" WHERE "id" = ${paymentId} FOR UPDATE`);
        const payment = await tx.invoicePayment.findUnique({
          where: { id: paymentId },
          include: {
            invoice: { include: { branch: true, items: true } },
            refunds: { where: { status: 'POSTED' } },
          },
        });
        if (!payment || payment.verificationStatus !== 'VERIFIED') {
          throw errors.conflict('PAYMENT_NOT_VERIFIED', 'Hanya pembayaran terverifikasi yang dapat direfund.');
        }
        if (payment.invoice.status === 'CANCELLED') {
          throw errors.conflict('INVOICE_CANCELLED', 'Refund pembayaran invoice batal harus melalui flow pembatalan.');
        }
        if (payment.invoice.branch.type === 'PARTNERSHIP') {
          throw errors.unprocessable('PARTNERSHIP_REFUND_SEPARATE_FLOW', 'Refund member Partnership tidak memakai flow omzet terapi Zoho.');
        }
        if (payment.invoice.items.some((line) => line.itemType === 'PACKAGE')) {
          throw errors.unprocessable('PACKAGE_REFUND_SEPARATE_FLOW', 'Refund uang muka paket harus memakai flow retainer Sprint 7.');
        }
        const refundedBefore = payment.refunds.reduce(
          (sum, refund) => sum.plus(refund.amount),
          new Prisma.Decimal(0),
        );
        const available = payment.amount.minus(refundedBefore);
        if (!amount.greaterThan(0) || amount.greaterThan(available)) {
          throw errors.conflict('REFUND_EXCEEDS_PAYMENT', `Maksimal refund pembayaran ini ${available.toFixed(2)}.`);
        }
        const account = await tx.cashBankAccount.findUnique({
          where: { id: data.cashBankAccountId },
          include: { coaAccount: true },
        });
        if (!account?.isActive || account.branchId !== payment.invoice.branchId || !account.coaAccount.allowPosting) {
          throw errors.unprocessable('REFUND_ACCOUNT_NOT_POSTABLE', 'Rekening refund tidak aktif, beda cabang, atau tidak dapat diposting.');
        }

        const refundDate = data.refundDate ? new Date(data.refundDate) : new Date();
        const refundId = randomUUID();
        const shortKey = createHash('sha256').update(data.postingKey).digest('hex').slice(0, 12).toUpperCase();
        const refundNumber = `RFD/${refundDate.getUTCFullYear()}/${shortKey}`;
        const postingKey = `INVOICE_PAYMENT_REFUND:${refundId}`;
        const posted = await postJournal({
          postingKey,
          transactionDate: refundDate,
          branchId: payment.invoice.branchId,
          actorUserId: userId,
          description: `Refund pembayaran ${payment.invoice.invoiceNumber}`,
          lines: [
            { accountCode: payment.invoice.settlementAccountCode, debit: amount },
            { accountCode: account.coaAccount.code, credit: amount },
          ],
          sourceLinks: [
            { sourceType: 'INVOICE_PAYMENT_REFUND', sourceId: refundId, sourceNumber: refundNumber },
            { sourceType: 'INVOICE_PAYMENT', sourceId: payment.id, sourceNumber: payment.invoice.invoiceNumber, relationType: 'REVERSAL_OF' },
            { sourceType: 'INVOICE', sourceId: payment.invoice.id, sourceNumber: payment.invoice.invoiceNumber },
          ],
          metadata: { originalPaymentId: payment.id, reason: data.reason },
        }, tx);
        const cashTransaction = await tx.cashBankTransaction.create({
          data: {
            transactionNumber: `CBP/${shortKey}`,
            postingKey,
            cashBankAccountId: account.id,
            branchId: payment.invoice.branchId,
            transactionDate: refundDate,
            type: 'PAYMENT',
            amount,
            sourceType: 'INVOICE_PAYMENT_REFUND',
            sourceId: refundId,
            sourceNumber: refundNumber,
            journalEntryId: posted.journal.id,
            description: `Refund ${payment.invoice.invoiceNumber}: ${data.reason}`,
            metadata: json({ originalPaymentId: payment.id, referenceNumber: data.referenceNumber || null }),
            createdBy: userId,
          },
        });
        const refund = await tx.invoicePaymentRefund.create({
          data: {
            id: refundId,
            refundNumber,
            idempotencyKey: data.postingKey,
            payloadHash: hash,
            invoicePaymentId: payment.id,
            cashBankAccountId: account.id,
            branchId: payment.invoice.branchId,
            amount,
            reason: data.reason,
            referenceNumber: data.referenceNumber || null,
            refundDate,
            journalEntryId: posted.journal.id,
            cashBankTransactionId: cashTransaction.id,
            createdBy: userId,
          },
        });
        const totalVerified = await tx.invoicePayment.aggregate({
          where: { invoiceId: payment.invoiceId, verificationStatus: 'VERIFIED' },
          _sum: { amount: true },
        });
        const allRefunds = await tx.invoicePaymentRefund.aggregate({
          where: {
            invoicePayment: { invoiceId: payment.invoiceId },
            status: 'POSTED',
          },
          _sum: { amount: true },
        });
        const netPaid = (totalVerified._sum.amount || new Prisma.Decimal(0))
          .minus(allRefunds._sum.amount || new Prisma.Decimal(0));
        const fullyPaid = netPaid.greaterThanOrEqualTo(payment.invoice.totalAmount);
        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            actualPaidAmount: netPaid,
            status: fullyPaid ? 'PAID' : 'PENDING_PAYMENT',
            paidAt: fullyPaid ? payment.invoice.paidAt : null,
            paymentVerificationStatus: fullyPaid ? 'VERIFIED' : 'PENDING',
            verifiedBy: fullyPaid ? payment.invoice.verifiedBy : null,
            verifiedAt: fullyPaid ? payment.invoice.verifiedAt : null,
          },
        });
        const snapshot = buildPaymentRefundSnapshot({
          refundId,
          refundNumber,
          payment,
          amount,
          refundDate,
          reason: data.reason,
          cashBankAccountId: account.id,
          remainingAppliedAmountAfterRefund: payment.amount.minus(refundedBefore).minus(amount),
        });
        await enqueuePaymentRefundTx(tx, snapshot);
        await tx.auditLog.create({
          data: {
            userId,
            branchId: payment.invoice.branchId,
            action: 'CREATE',
            module: 'FINANCE',
            resource: 'InvoicePaymentRefund',
            resourceId: refund.id,
            entityType: 'InvoicePayment',
            entityId: payment.id,
            entityCode: refundNumber,
            afterData: json({
              amount: amount.toFixed(2),
              originalPaymentId: payment.id,
              journalEntryId: posted.journal.id,
              cashBankTransactionId: cashTransaction.id,
            }),
            description: `Refund ${refundNumber} dibuat untuk pembayaran invoice ${payment.invoice.invoiceNumber}.`,
          },
        });
        return {
          refund,
          journal: posted.journal,
          cashBankTransaction: cashTransaction,
          idempotentReplay: false,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await prisma.invoicePaymentRefund.findUnique({
          where: { idempotencyKey: data.postingKey },
        });
        if (replay?.payloadHash === hash) return { refund: replay, idempotentReplay: true };
      }
      throw error;
    }
  }
}
