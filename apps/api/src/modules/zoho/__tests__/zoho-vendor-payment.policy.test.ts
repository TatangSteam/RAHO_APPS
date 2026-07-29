import {
  AP_PAYMENT_POSTED_EVENT,
  AP_PAYMENT_REFUNDED_EVENT,
  buildZohoVendorPaymentPayload,
  buildZohoVendorPaymentRefundPayload,
  reconcileVendorPayment,
  validateVendorPaymentSnapshot,
  ZohoVendorPaymentDependencies,
  ZohoVendorPaymentSnapshot,
} from '../zoho.vendor-payment.policy';
import { ZOHO_REQUIRED_SCOPES, ZOHO_SCOPE_VERSION } from '../zoho.client';

const snapshot: ZohoVendorPaymentSnapshot = {
  localEntityId: 'supplier-payment-1',
  externalKey: 'RAHO:SUPPLIER_PAYMENT:supplier-payment-1',
  referenceNumber: 'SP/2026/ABC123',
  paymentNumber: 'SP/2026/ABC123',
  supplierInvoiceId: 'supplier-invoice-1',
  invoiceNumber: 'SI/2026/001',
  supplierInvoiceNumber: 'VENDOR-001',
  supplierId: 'supplier-1',
  branchId: 'branch-1',
  branchType: 'CENTRAL',
  cashBankAccountId: 'cash-1',
  paymentMethod: 'TRANSFER',
  paymentDate: '2026-07-29',
  paymentReference: 'BANK-001',
  amount: '400.00',
  outstandingBefore: '1000.00',
  outstandingAfter: '600.00',
  eligible: true,
  excludedReason: null,
};

const dependencies: ZohoVendorPaymentDependencies = {
  vendorId: 'zoho-vendor-1',
  billId: 'zoho-bill-1',
  paidThroughAccountId: 'zoho-bank-1',
  paymentMode: 'banktransfer',
};

describe('Zoho vendor payment policy', () => {
  it('blocks payment until the Bill and paid-through account are mapped', () => {
    expect(validateVendorPaymentSnapshot(snapshot, {
      vendorId: dependencies.vendorId,
      paymentMode: dependencies.paymentMode,
    })).toEqual(expect.arrayContaining([
      'Bill supplier belum terpetakan ke Zoho.',
      'Mapping rekening paid-through Zoho belum tersedia.',
    ]));
  });

  it('blocks overpayment and inconsistent AP balance', () => {
    expect(validateVendorPaymentSnapshot({
      ...snapshot,
      amount: '1200.00',
      outstandingAfter: '-200.00',
    }, dependencies)).toContain('Vendor payment melebihi saldo Bill sebelum pembayaran.');
  });

  it('applies a partial payment to exactly the mapped Bill', () => {
    expect(buildZohoVendorPaymentPayload(snapshot, dependencies)).toEqual({
      vendor_id: 'zoho-vendor-1',
      bills: [{ bill_id: 'zoho-bill-1', amount_applied: 400 }],
      date: '2026-07-29',
      amount: 400,
      paid_through_account_id: 'zoho-bank-1',
      payment_mode: 'banktransfer',
      reference_number: 'SP/2026/ABC123',
      description: 'Pembayaran ERP SI/2026/001 - Bukti BANK-001',
    });
  });

  it('reconciles matched, missing, and amount mismatch states', () => {
    expect(reconcileVendorPayment(snapshot, dependencies, {
      payment_id: 'zoho-payment-1',
      amount: 400,
      paid_through_account_id: 'zoho-bank-1',
      bills: [{ bill_id: 'zoho-bill-1', amount_applied: 400 }],
    }).status).toBe('MATCHED');
    expect(reconcileVendorPayment(snapshot, dependencies).status).toBe('MISSING_IN_ZOHO');
    expect(reconcileVendorPayment(snapshot, dependencies, {
      payment_id: 'zoho-payment-1',
      amount: 399,
      paid_through_account_id: 'zoho-bank-1',
      bills: [{ bill_id: 'zoho-bill-1', amount_applied: 399 }],
    }).status).toBe('AMOUNT_MISMATCH');
  });

  it('registers the Sprint 12 event and OAuth scopes', () => {
    expect(AP_PAYMENT_POSTED_EVENT).toBe('AP_PAYMENT_POSTED');
    expect(AP_PAYMENT_REFUNDED_EVENT).toBe('AP_PAYMENT_REFUNDED');
    expect(ZOHO_SCOPE_VERSION).toBe(12);
    expect(ZOHO_REQUIRED_SCOPES).toEqual(expect.arrayContaining([
      'ZohoBooks.vendorpayments.READ',
      'ZohoBooks.vendorpayments.CREATE',
      'ZohoBooks.vendorpayments.UPDATE',
    ]));
  });

  it('builds a refund that references the immutable original vendor payment flow', () => {
    expect(buildZohoVendorPaymentRefundPayload({
      localEntityId: 'supplier-payment-refund-1',
      externalKey: 'RAHO:SUPPLIER_PAYMENT_REFUND:supplier-payment-refund-1',
      referenceNumber: 'SPR/2026/001',
      originalSupplierPaymentId: snapshot.localEntityId,
      supplierInvoiceId: snapshot.supplierInvoiceId,
      invoiceNumber: snapshot.invoiceNumber,
      branchId: snapshot.branchId,
      branchType: snapshot.branchType,
      cashBankAccountId: snapshot.cashBankAccountId,
      paymentMethod: snapshot.paymentMethod,
      refundDate: '2026-07-30',
      amount: '100.00',
      reason: 'Dana dikembalikan supplier',
      originalPaymentAmount: snapshot.amount,
      remainingAppliedAmountAfterRefund: '300.00',
      eligible: true,
      excludedReason: null,
    }, 'zoho-bank-1', 'banktransfer')).toEqual({
      date: '2026-07-30',
      refund_mode: 'banktransfer',
      reference_number: 'SPR/2026/001',
      amount: 100,
      to_account_id: 'zoho-bank-1',
      description: 'Dana dikembalikan supplier (ERP SI/2026/001)',
    });
  });
});
