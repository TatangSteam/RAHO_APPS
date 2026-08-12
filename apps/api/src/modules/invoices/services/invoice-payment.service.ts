import { PaymentVerificationStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import type { RecordPaymentInput, RejectPaymentInput, VerifyPaymentInput } from '../invoices.schema';
import { assertBranchAccess, assertPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { postJournal } from '@modules/accounting/accounting.service';
import { isAutonomousFinanceUser } from '@modules/iam/finance-policy';
import { fundPackageDeferredRevenueInTransaction } from '@modules/revenue/revenue.service';
import {
  assertPaymentMethodAccountType,
  calculatePaymentState,
  paymentPayloadHash,
} from './payment-posting.helpers';
import { createNotification } from '@modules/notifications/notification.service';
import {
  buildFinalizedInvoiceSnapshot,
  enqueueFinalizedInvoiceTx,
  finalizedTermsSnapshot,
} from '@modules/zoho/zoho.invoice.service';
import {
  buildVerifiedPaymentSnapshot,
  enqueueVerifiedPaymentTx,
} from '@modules/zoho/zoho.payment.service';
import { consumeAddOnStockInTransaction } from '@modules/packages/services/add-on-inventory.service';

interface PaymentEvidence {
  proofFileUrl?: string;
  proofFileName?: string;
  proofFileSize?: number;
  proofMimeType?: string;
  proofChecksum?: string;
}

const invoiceResultInclude = {
  member: { include: { user: { include: { profile: true } }, referralCode: true } },
  branch: true,
  createdByUser: { include: { profile: true } },
  verifiedByUser: { include: { profile: true } },
  items: true,
  payments: {
    include: {
      receivedByUser: { include: { profile: true } },
      verifiedByUser: { include: { profile: true } },
      cashBankAccount: { select: { id: true, code: true, name: true, type: true } },
    },
    orderBy: { receivedAt: 'asc' as const },
  },
} satisfies Prisma.InvoiceInclude;

function json(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class InvoicePaymentService {
  async assertInvoiceBranch(invoiceId: string, userId: string) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { branchId: true } });
    if (!invoice) throw errors.notFound('Invoice tidak ditemukan.');
    await assertBranchAccess(userId, invoice.branchId);
    await assertPermission(userId, PERMISSIONS.PAYMENT_SUBMIT, invoice.branchId);
  }

  async finalizeInvoice(invoiceId: string, dueDate: string | undefined, userId: string) {
    const candidate = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { branchId: true } });
    if (!candidate) throw errors.notFound('Invoice tidak ditemukan.');
    await assertBranchAccess(userId, candidate.branchId);
    await assertPermission(userId, PERMISSIONS.INVOICE_FINALIZE, candidate.branchId);

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`);
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: invoiceResultInclude,
      });
      if (!invoice) throw errors.notFound('Invoice tidak ditemukan.');
      if (invoice.status !== 'DRAFT') {
        throw errors.conflict('INVOICE_NOT_DRAFT', 'Hanya invoice DRAFT yang dapat difinalisasi.');
      }

      const finalizedAt = new Date();
      const finalizedDueDate = dueDate ? new Date(dueDate) : invoice.dueDate;
      const zohoSnapshot = await buildFinalizedInvoiceSnapshot(
        tx,
        invoice,
        finalizedAt,
        finalizedDueDate,
      );
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'PENDING_PAYMENT',
          dueDate: finalizedDueDate,
          finalizedAt,
          customerSnapshot: json({
            memberId: invoice.member.id,
            memberNo: invoice.member.memberNo,
            name: invoice.member.user.profile?.fullName || invoice.member.user.email,
            email: invoice.member.user.email,
          }),
          branchSnapshot: json({
            branchId: invoice.branch.id,
            branchCode: invoice.branch.branchCode,
            name: invoice.branch.name,
            address: invoice.branch.address,
            city: invoice.branch.city,
            phone: invoice.branch.phone,
          }),
          termsSnapshot: json({
            ...finalizedTermsSnapshot(
              zohoSnapshot,
              invoice.paymentPlanType,
              invoice.settlementAccountCode,
            ),
            finalizedAt: finalizedAt.toISOString(),
          }),
        },
        include: invoiceResultInclude,
      });
      await tx.auditLog.create({
        data: {
          userId,
          branchId: invoice.branchId,
          action: 'UPDATE',
          module: 'FINANCE',
          resource: 'Invoice',
          resourceId: invoice.id,
          entityType: 'Invoice',
          entityId: invoice.id,
          entityCode: invoice.invoiceNumber,
          beforeData: json({ status: invoice.status }),
          afterData: json({ status: updated.status, finalizedAt: finalizedAt.toISOString(), snapshotVersion: updated.snapshotVersion }),
          description: `Invoice ${invoice.invoiceNumber} difinalisasi dan snapshot dikunci.`,
        },
      });
      await enqueueFinalizedInvoiceTx(tx, zohoSnapshot);
      return updated;
    });
  }

  async recordPayment(
    invoiceId: string,
    data: RecordPaymentInput,
    evidence: PaymentEvidence,
    userId: string,
  ) {
    const candidate = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { branchId: true } });
    if (!candidate) throw errors.notFound('Invoice tidak ditemukan.');
    await assertBranchAccess(userId, candidate.branchId);
    await assertPermission(userId, PERMISSIONS.PAYMENT_SUBMIT, candidate.branchId);

    const amount = new Prisma.Decimal(data.amount);
    const payloadHash = paymentPayloadHash({
      invoiceId,
      amount: data.amount!,
      paymentMethod: data.paymentMethod!,
      cashBankAccountId: data.cashBankAccountId!,
      paymentReference: data.paymentReference,
      proofFileUrl: evidence.proofFileUrl,
      proofChecksum: evidence.proofChecksum,
    });
    try {
      return await prisma.$transaction(async (tx) => {
        const replay = await tx.invoicePayment.findUnique({ where: { idempotencyKey: data.postingKey } });
        if (replay) {
          if (replay.payloadHash !== payloadHash) {
            throw errors.conflict('PAYMENT_KEY_REUSED', 'Idempotency key digunakan untuk payload pembayaran berbeda.');
          }
          return { payment: replay, idempotentReplay: true };
        }

        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`);
        const replayAfterLock = await tx.invoicePayment.findUnique({ where: { idempotencyKey: data.postingKey } });
        if (replayAfterLock) {
          if (replayAfterLock.payloadHash !== payloadHash) {
            throw errors.conflict('PAYMENT_KEY_REUSED', 'Idempotency key digunakan untuk payload pembayaran berbeda.');
          }
          return { payment: replayAfterLock, idempotentReplay: true };
        }
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw errors.notFound('Invoice tidak ditemukan.');
        if (!['PENDING_PAYMENT', 'DEBT', 'OVERDUE'].includes(invoice.status)) {
          throw errors.conflict('INVOICE_NOT_PAYABLE', 'Invoice tidak berada pada status yang dapat dibayar.');
        }

        const account = await tx.cashBankAccount.findUnique({
          where: { id: data.cashBankAccountId },
          include: { coaAccount: { select: { code: true, allowPosting: true, isActive: true } } },
        });
        if (!account?.isActive || account.branchId !== invoice.branchId) {
          throw errors.badRequest('CASH_BANK_ACCOUNT_INVALID', 'Akun kas/bank tidak aktif atau bukan milik cabang invoice.');
        }
        assertPaymentMethodAccountType(data.paymentMethod, account.type);
        if (account.requiresReference && !data.paymentReference) {
          throw errors.badRequest('PAYMENT_REFERENCE_REQUIRED', 'Referensi transaksi wajib untuk rekening ini.');
        }
        if (data.paymentMethod !== 'CASH' && !evidence.proofFileUrl) {
          throw errors.badRequest('PAYMENT_EVIDENCE_REQUIRED', 'Bukti pembayaran wajib untuk pembayaran non-cash.');
        }

        const [committed, refunded] = await Promise.all([
          tx.invoicePayment.aggregate({
            where: { invoiceId, verificationStatus: { in: ['PENDING', 'VERIFIED'] } },
            _sum: { amount: true },
          }),
          tx.invoicePaymentRefund.aggregate({
            where: { invoicePayment: { invoiceId }, status: 'POSTED' },
            _sum: { amount: true },
          }),
        ]);
        const committedTotal = (committed._sum.amount || new Prisma.Decimal(0))
          .minus(refunded._sum.amount || new Prisma.Decimal(0));
        if (committedTotal.plus(amount).greaterThan(invoice.totalAmount)) {
          throw errors.conflict('PAYMENT_EXCEEDS_BALANCE', 'Pembayaran melebihi sisa tagihan invoice.');
        }

        const payment = await tx.invoicePayment.create({
          data: {
            invoiceId,
            idempotencyKey: data.postingKey,
            payloadHash,
            amount,
            paymentMethod: data.paymentMethod,
            cashBankAccountId: data.cashBankAccountId,
            paymentReference: data.paymentReference || null,
            notes: data.notes || null,
            proofFileUrl: evidence.proofFileUrl || null,
            proofFileName: evidence.proofFileName || null,
            proofFileSize: evidence.proofFileSize || null,
            proofMimeType: evidence.proofMimeType || null,
            proofChecksum: evidence.proofChecksum || null,
            receivedBy: userId,
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            branchId: invoice.branchId,
            action: 'CREATE',
            module: 'FINANCE',
            resource: 'InvoicePayment',
            resourceId: payment.id,
            entityType: 'Invoice',
            entityId: invoice.id,
            entityCode: invoice.invoiceNumber,
            afterData: json({ amount: amount.toFixed(2), status: payment.verificationStatus, paymentMethod: data.paymentMethod }),
            description: `Pembayaran invoice ${invoice.invoiceNumber} diajukan untuk verifikasi.`,
          },
        });
        return { payment, idempotentReplay: false };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await prisma.invoicePayment.findUnique({ where: { idempotencyKey: data.postingKey } });
        if (replay?.payloadHash === payloadHash) return { payment: replay, idempotentReplay: true };
      }
      throw error;
    }
  }

  async verifyPayment(paymentId: string, data: VerifyPaymentInput, userId: string) {
    const candidate = await prisma.invoicePayment.findUnique({
      where: { id: paymentId },
      select: { invoice: { select: { branchId: true } } },
    });
    if (!candidate) throw errors.notFound('Pembayaran tidak ditemukan.');
    await assertBranchAccess(userId, candidate.invoice.branchId);
    await assertPermission(userId, PERMISSIONS.PAYMENT_VERIFY, candidate.invoice.branchId);
    const canSelfReview = await isAutonomousFinanceUser(userId);

    return prisma.$transaction(async (tx) => {
      const identity = await tx.invoicePayment.findUnique({ where: { id: paymentId }, select: { invoiceId: true } });
      if (!identity) throw errors.notFound('Pembayaran tidak ditemukan.');
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoices" WHERE "id" = ${identity.invoiceId} FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoice_payments" WHERE "id" = ${paymentId} FOR UPDATE`);
      const payment = await tx.invoicePayment.findUnique({
        where: { id: paymentId },
        include: {
          invoice: { include: { branch: true, items: true } },
          cashBankAccount: { include: { coaAccount: true } },
          cashBankTransaction: true,
        },
      });
      if (!payment) throw errors.notFound('Pembayaran tidak ditemukan.');
      if (payment.verificationStatus === PaymentVerificationStatus.VERIFIED) {
        return { payment, cashBankTransaction: payment.cashBankTransaction, idempotentReplay: true };
      }
      if (payment.verificationStatus === PaymentVerificationStatus.REJECTED) {
        throw errors.conflict('PAYMENT_ALREADY_REJECTED', 'Pembayaran sudah ditolak.');
      }
      if (payment.receivedBy === userId && !canSelfReview) {
        throw errors.forbidden('Maker pembayaran tidak boleh memverifikasi transaksinya sendiri.');
      }
      const account = payment.cashBankAccount;
      if (!account?.isActive || account.branchId !== payment.invoice.branchId || !account.coaAccount.allowPosting) {
        throw errors.unprocessable('CASH_BANK_ACCOUNT_NOT_POSTABLE', 'Akun kas/bank pembayaran tidak dapat diposting.');
      }
      if (new Prisma.Decimal(payment.invoice.taxAmount || 0).greaterThan(0)) {
        throw errors.unprocessable(
          'INVOICE_TAX_LEDGER_NOT_CONFIGURED',
          'Pembayaran invoice berpajak diblokir sampai akun dan posting liabilitas pajak dikonfigurasi.',
        );
      }

      const [verified, refunded] = await Promise.all([
        tx.invoicePayment.aggregate({
          where: { invoiceId: payment.invoiceId, verificationStatus: 'VERIFIED', id: { not: payment.id } },
          _sum: { amount: true },
        }),
        tx.invoicePaymentRefund.aggregate({
          where: { invoicePayment: { invoiceId: payment.invoiceId }, status: 'POSTED' },
          _sum: { amount: true },
        }),
      ]);
      const previousVerifiedTotal = (verified._sum.amount || new Prisma.Decimal(0))
        .minus(refunded._sum.amount || new Prisma.Decimal(0));
      const state = calculatePaymentState(
        payment.invoice.totalAmount,
        previousVerifiedTotal,
        payment.amount,
      );
      const addOnIds = payment.invoice.items
        .filter((item) => item.itemType === 'ADDON')
        .map((item) => item.itemId);
      const verifiedAt = new Date();
      if (state.isFullyPaid) {
        for (const addOnId of addOnIds) {
          await consumeAddOnStockInTransaction(addOnId, userId, verifiedAt, tx);
        }
        if (addOnIds.length > 0) {
          await tx.memberAddOn.updateMany({
            where: { id: { in: addOnIds }, status: { in: ['PENDING_PAYMENT', 'WAITING_VERIFICATION'] } },
            data: {
              status: 'ACTIVE',
              paidAt: verifiedAt,
              verifiedAt,
              verifiedBy: userId,
              paymentPlanStatus: 'PAID',
            },
          });
        }
      }
      const postingKey = `INVOICE_PAYMENT:${payment.id}`;
      const posted = await postJournal({
        postingKey,
        transactionDate: new Date(),
        branchId: payment.invoice.branchId,
        actorUserId: userId,
        description: `Penerimaan pembayaran ${payment.invoice.invoiceNumber}`,
        lines: [
          { accountCode: account.coaAccount.code, debit: payment.amount },
          { accountCode: payment.invoice.settlementAccountCode, credit: payment.amount },
        ],
        sourceLinks: [
          { sourceType: 'INVOICE_PAYMENT', sourceId: payment.id, sourceNumber: payment.invoice.invoiceNumber },
          { sourceType: 'INVOICE', sourceId: payment.invoice.id, sourceNumber: payment.invoice.invoiceNumber, relationType: 'SETTLEMENT' },
        ],
        metadata: { cashBankAccountId: account.id, paymentMethod: payment.paymentMethod },
      }, tx);

      const zohoSnapshot = buildVerifiedPaymentSnapshot(
        payment,
        previousVerifiedTotal,
        verifiedAt,
      );
      const updatedPayment = await tx.invoicePayment.update({
        where: { id: payment.id },
        data: {
          verificationStatus: 'VERIFIED',
          verificationReason: data.reason || null,
          verifiedBy: userId,
          verifiedAt,
        },
      });
      const cashTransaction = await tx.cashBankTransaction.create({
        data: {
          transactionNumber: `CBR/${payment.id}`,
          postingKey,
          cashBankAccountId: account.id,
          branchId: payment.invoice.branchId,
          transactionDate: verifiedAt,
          type: 'RECEIPT',
          amount: payment.amount,
          sourceType: 'INVOICE_PAYMENT',
          sourceId: payment.id,
          sourceNumber: payment.invoice.invoiceNumber,
          invoicePaymentId: payment.id,
          journalEntryId: posted.journal.id,
          description: `Penerimaan ${payment.invoice.invoiceNumber}`,
          metadata: json({ paymentMethod: payment.paymentMethod, paymentReference: payment.paymentReference }),
          createdBy: userId,
        },
      });
      await tx.invoice.update({
        where: { id: payment.invoice.id },
        data: {
          actualPaidAmount: state.verifiedTotal,
          status: state.isFullyPaid ? 'PAID' : 'PENDING_PAYMENT',
          paidAt: state.isFullyPaid ? verifiedAt : null,
          paymentVerificationStatus: state.isFullyPaid ? 'VERIFIED' : 'PENDING',
          paymentMethod: payment.paymentMethod,
          paymentReference: payment.paymentReference,
          verifiedBy: state.isFullyPaid ? userId : null,
          verifiedAt: state.isFullyPaid ? verifiedAt : null,
        },
      });
      const deferredRevenueMovements = await fundPackageDeferredRevenueInTransaction({
        actorUserId: userId,
        invoicePaymentId: payment.id,
        invoiceId: payment.invoice.id,
        paymentAmount: payment.amount,
        journalEntryId: posted.journal.id,
        occurredAt: verifiedAt,
      }, tx);
      await tx.auditLog.create({
        data: {
          userId,
          branchId: payment.invoice.branchId,
          action: 'UPDATE',
          module: 'FINANCE',
          resource: 'InvoicePayment',
          resourceId: payment.id,
          entityType: 'Invoice',
          entityId: payment.invoice.id,
          entityCode: payment.invoice.invoiceNumber,
          beforeData: json({ status: 'PENDING' }),
          afterData: json({ status: 'VERIFIED', verifiedTotal: state.verifiedTotal.toFixed(2), journalEntryId: posted.journal.id, deferredRevenueMovementCount: deferredRevenueMovements.length }),
          description: `Pembayaran invoice ${payment.invoice.invoiceNumber} diverifikasi dan diposting.`,
        },
      });
      await enqueueVerifiedPaymentTx(tx, zohoSnapshot);
      return { payment: updatedPayment, cashBankTransaction: cashTransaction, journal: posted.journal, deferredRevenueMovements, idempotentReplay: false };
    });
  }

  async rejectPayment(paymentId: string, data: RejectPaymentInput, userId: string) {
    const candidate = await prisma.invoicePayment.findUnique({
      where: { id: paymentId },
      select: { receivedBy: true, invoice: { select: { branchId: true, invoiceNumber: true, id: true } } },
    });
    if (!candidate) throw errors.notFound('Pembayaran tidak ditemukan.');
    await assertBranchAccess(userId, candidate.invoice.branchId);
    await assertPermission(userId, PERMISSIONS.PAYMENT_REJECT, candidate.invoice.branchId);
    const canSelfReview = await isAutonomousFinanceUser(userId);
    if (candidate.receivedBy === userId && !canSelfReview) {
      throw errors.forbidden('Maker pembayaran non-Finance tidak boleh menolak transaksinya sendiri.');
    }

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoice_payments" WHERE "id" = ${paymentId} FOR UPDATE`);
      const payment = await tx.invoicePayment.findUnique({ where: { id: paymentId } });
      if (!payment) throw errors.notFound('Pembayaran tidak ditemukan.');
      if (payment.verificationStatus === 'VERIFIED') throw errors.conflict('PAYMENT_ALREADY_VERIFIED', 'Pembayaran terverifikasi tidak dapat ditolak.');
      if (payment.verificationStatus === 'REJECTED') return { payment, idempotentReplay: true };
      const updated = await tx.invoicePayment.update({
        where: { id: paymentId },
        data: { verificationStatus: 'REJECTED', verificationReason: data.reason, verifiedBy: userId, verifiedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId,
          branchId: candidate.invoice.branchId,
          action: 'UPDATE',
          module: 'FINANCE',
          resource: 'InvoicePayment',
          resourceId: paymentId,
          entityType: 'Invoice',
          entityId: candidate.invoice.id,
          entityCode: candidate.invoice.invoiceNumber,
          beforeData: json({ status: 'PENDING' }),
          afterData: json({ status: 'REJECTED', reason: data.reason }),
          description: `Pembayaran invoice ${candidate.invoice.invoiceNumber} ditolak.`,
        },
      });
      await createNotification(tx, {
        userId: payment.receivedBy,
        type: 'INVOICE',
        title: 'Pembayaran ditolak',
        body: `Pembayaran invoice ${candidate.invoice.invoiceNumber} ditolak: ${data.reason}`,
        deepLink: `/invoices/${candidate.invoice.id}`,
      });
      return { payment: updated, idempotentReplay: false };
    });
  }
}
