import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { errors } from '@middleware/errorHandler';

export interface PaymentPayload {
  invoiceId: string;
  amount: string;
  paymentMethod: string;
  cashBankAccountId: string;
  paymentReference?: string;
  proofFileUrl?: string;
  proofChecksum?: string;
}

export function paymentPayloadHash(payload: PaymentPayload) {
  return createHash('sha256').update(JSON.stringify({
    invoiceId: payload.invoiceId,
    amount: new Prisma.Decimal(payload.amount).toFixed(2),
    paymentMethod: payload.paymentMethod,
    cashBankAccountId: payload.cashBankAccountId,
    paymentReference: payload.paymentReference?.trim() || null,
    proofFileUrl: payload.proofFileUrl || null,
    proofChecksum: payload.proofChecksum || null,
  })).digest('hex');
}

export function calculatePaymentState(
  invoiceTotal: Prisma.Decimal,
  previouslyVerified: Prisma.Decimal,
  currentPayment: Prisma.Decimal,
) {
  const verifiedTotal = previouslyVerified.plus(currentPayment);
  if (verifiedTotal.greaterThan(invoiceTotal)) {
    throw errors.conflict('PAYMENT_EXCEEDS_BALANCE', 'Pembayaran melebihi sisa tagihan invoice.');
  }
  return {
    verifiedTotal,
    isFullyPaid: verifiedTotal.equals(invoiceTotal),
  };
}

export function assertPaymentMethodAccountType(paymentMethod: string, accountType: 'CASH' | 'BANK') {
  const expected = paymentMethod === 'CASH' ? 'CASH' : 'BANK';
  if (accountType !== expected) {
    throw errors.badRequest(
      'PAYMENT_ACCOUNT_TYPE_INVALID',
      paymentMethod === 'CASH'
        ? 'Pembayaran cash harus masuk ke akun kas.'
        : 'Pembayaran non-cash harus masuk ke akun bank.',
    );
  }
}
