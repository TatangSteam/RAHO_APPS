import {
  buildZohoCustomerPaymentPayload,
  buildZohoRefundPayload,
  paymentMethodMappingKey,
  reconcileReceivable,
  validatePaymentSnapshot,
  ZohoPaymentDependencies,
  ZohoPaymentRefundSnapshot,
  ZohoPaymentSnapshot,
} from '../zoho.payment.policy';
import { ZOHO_REQUIRED_SCOPES, ZOHO_SCOPE_VERSION } from '../zoho.client';

function payment(overrides: Partial<ZohoPaymentSnapshot> = {}): ZohoPaymentSnapshot {
  return {
    localEntityId: 'payment-1',
    externalKey: 'RAHO:PAYMENT:payment-1',
    referenceNumber: 'RAHO-PAY:payment-1',
    invoiceId: 'invoice-1',
    invoiceNumber: 'INV/001',
    memberId: 'member-1',
    branchId: 'branch-1',
    branchType: 'OWNED',
    classification: 'NORMAL_SALE',
    eligible: true,
    excludedReason: null,
    amount: '250000.00',
    paymentDate: '2026-07-28',
    paymentMethod: 'TRANSFER',
    cashBankAccountId: 'bank-1',
    paymentReference: 'TRX-001',
    invoiceTotal: '1000000.00',
    outstandingBefore: '1000000.00',
    outstandingAfter: '750000.00',
    ...overrides,
  };
}

const dependencies: ZohoPaymentDependencies = {
  customerId: 'z-customer',
  invoiceId: 'z-invoice',
  locationId: 'z-location',
  accountId: 'z-bank',
  paymentMode: 'banktransfer',
};

describe('Zoho customer payment policy', () => {
  it('applies a partial payment only to its exact invoice', () => {
    const snapshot = payment();
    expect(validatePaymentSnapshot(snapshot, dependencies)).toEqual([]);
    expect(buildZohoCustomerPaymentPayload(snapshot, dependencies)).toMatchObject({
      customer_id: 'z-customer',
      amount: 250000,
      payment_mode: 'banktransfer',
      account_id: 'z-bank',
      invoices: [{ invoice_id: 'z-invoice', amount_applied: 250000 }],
    });
  });

  it('blocks overpayment and missing bank/method mapping', () => {
    const issues = validatePaymentSnapshot(payment({
      amount: '1100000.00',
      outstandingAfter: '-100000.00',
    }), { ...dependencies, accountId: undefined, paymentMode: undefined });
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining('melebihi'),
      expect.stringContaining('kas/bank'),
      expect.stringContaining('metode pembayaran'),
    ]));
  });

  it('routes package advances and Partnership member payments outside ordinary customer payments', () => {
    expect(validatePaymentSnapshot(payment({
      classification: 'THERAPY_ADVANCE',
      eligible: false,
      excludedReason: 'retainer',
    }), {})).toEqual([]);
    expect(validatePaymentSnapshot(payment({
      branchType: 'PARTNERSHIP',
      eligible: false,
      excludedReason: 'shipment',
    }), {})).toEqual([]);
  });

  it('builds a traceable refund referring to the original flow', () => {
    const snapshot: ZohoPaymentRefundSnapshot = {
      localEntityId: 'refund-1',
      externalKey: 'RAHO:PAYMENT_REFUND:refund-1',
      referenceNumber: 'RFD/2026/001',
      originalPaymentId: 'payment-1',
      invoiceId: 'invoice-1',
      invoiceNumber: 'INV/001',
      branchId: 'branch-1',
      branchType: 'OWNED',
      classification: 'NORMAL_SALE',
      eligible: true,
      excludedReason: null,
      amount: '50000.00',
      refundDate: '2026-07-28',
      reason: 'Kelebihan transfer member',
      cashBankAccountId: 'bank-1',
      paymentMethod: 'TRANSFER',
      remainingAppliedAmountAfterRefund: '200000.00',
    };
    expect(buildZohoRefundPayload(snapshot, 'z-bank', 'banktransfer')).toMatchObject({
      amount: 50000,
      from_account_id: 'z-bank',
      reference_number: 'RFD/2026/001',
    });
  });

  it.each([
    ['100.00', '100.00', 'PENDING_PAYMENT', 100, 100, 'sent', 'MATCHED'],
    ['100.00', '40.00', 'PENDING_PAYMENT', 100, 40, 'partially_paid', 'MATCHED'],
    ['100.00', '0.00', 'PAID', 100, 0, 'paid', 'MATCHED'],
    ['100.00', '40.00', 'PENDING_PAYMENT', 100, 50, 'partially_paid', 'MISMATCH'],
  ])('reconciles unpaid, partial, paid, and mismatch AR', (
    localTotal,
    localBalance,
    localStatus,
    zohoTotal,
    zohoBalance,
    zohoStatus,
    expected,
  ) => {
    expect(reconcileReceivable({
      localTotal,
      localBalance,
      localStatus,
      zohoTotal,
      zohoBalance,
      zohoStatus,
    }).status).toBe(expected);
  });

  it('marks missing Zoho invoices and requests Sprint 6 scopes', () => {
    expect(reconcileReceivable({
      localTotal: '100.00',
      localBalance: '100.00',
      localStatus: 'PENDING_PAYMENT',
    }).status).toBe('MISSING');
    expect(paymentMethodMappingKey('QRIS')).toBe('PAYMENT_METHOD:QRIS');
    expect(ZOHO_SCOPE_VERSION).toBe(6);
    expect(ZOHO_REQUIRED_SCOPES).toEqual(expect.arrayContaining([
      'ZohoBooks.customerpayments.READ',
      'ZohoBooks.customerpayments.CREATE',
      'ZohoBooks.customerpayments.UPDATE',
      'ZohoBooks.invoices.DELETE',
    ]));
  });
});
