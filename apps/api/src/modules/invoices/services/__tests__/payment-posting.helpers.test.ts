import { Prisma } from '@prisma/client';
import {
  assertPaymentMethodAccountType,
  calculatePaymentState,
  paymentPayloadHash,
} from '../payment-posting.helpers';

describe('payment posting helpers', () => {
  it('calculates partial and full payment with Decimal', () => {
    const partial = calculatePaymentState(new Prisma.Decimal('1000.10'), new Prisma.Decimal('0'), new Prisma.Decimal('400.05'));
    expect(partial.verifiedTotal.toFixed(2)).toBe('400.05');
    expect(partial.isFullyPaid).toBe(false);
    const full = calculatePaymentState(new Prisma.Decimal('1000.10'), partial.verifiedTotal, new Prisma.Decimal('600.05'));
    expect(full.verifiedTotal.toFixed(2)).toBe('1000.10');
    expect(full.isFullyPaid).toBe(true);
  });

  it('rejects overpayment', () => {
    expect(() => calculatePaymentState(new Prisma.Decimal('100'), new Prisma.Decimal('60'), new Prisma.Decimal('40.01')))
      .toThrow('melebihi sisa tagihan');
  });

  it('enforces cash versus bank account type', () => {
    expect(() => assertPaymentMethodAccountType('CASH', 'BANK')).toThrow('akun kas');
    expect(() => assertPaymentMethodAccountType('TRANSFER', 'CASH')).toThrow('akun bank');
    expect(() => assertPaymentMethodAccountType('QRIS', 'BANK')).not.toThrow();
  });

  it('builds a stable hash and detects changed evidence', () => {
    const base = {
      invoiceId: 'invoice-1', amount: '100.00', paymentMethod: 'TRANSFER',
      cashBankAccountId: 'bank-1', proofFileUrl: 'proof-1', proofChecksum: 'aaa',
    };
    expect(paymentPayloadHash(base)).toBe(paymentPayloadHash({ ...base, amount: '100' }));
    expect(paymentPayloadHash(base)).not.toBe(paymentPayloadHash({ ...base, proofChecksum: 'bbb' }));
  });
});
