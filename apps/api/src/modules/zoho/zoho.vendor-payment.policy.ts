import { Prisma } from '@prisma/client';
import { paymentMethodMappingKey } from './zoho.payment.policy';

export const AP_PAYMENT_POSTED_EVENT = 'AP_PAYMENT_POSTED';
export const AP_PAYMENT_REFUNDED_EVENT = 'AP_PAYMENT_REFUNDED';

export interface ZohoVendorPaymentSnapshot {
  localEntityId: string;
  externalKey: string;
  referenceNumber: string;
  paymentNumber: string;
  supplierInvoiceId: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string;
  supplierId: string;
  branchId: string;
  branchType: string;
  cashBankAccountId: string;
  paymentMethod: 'CASH' | 'TRANSFER';
  paymentDate: string;
  paymentReference: string;
  amount: string;
  outstandingBefore: string;
  outstandingAfter: string;
  eligible: boolean;
  excludedReason: string | null;
}

export interface ZohoVendorPaymentDependencies {
  vendorId: string;
  billId: string;
  paidThroughAccountId: string;
  paymentMode: string;
}

export interface ZohoVendorPaymentRemote {
  payment_id?: string | number;
  vendor_id?: string | number;
  reference_number?: string;
  amount?: number;
  balance?: number;
  paid_through_account_id?: string | number;
  payment_mode?: string;
  bills?: Array<{
    bill_id?: string | number;
    bill_payment_id?: string | number;
    amount_applied?: number;
    balance?: number;
  }>;
}

export interface ZohoVendorPaymentRefundSnapshot {
  localEntityId: string;
  externalKey: string;
  referenceNumber: string;
  originalSupplierPaymentId: string;
  supplierInvoiceId: string;
  invoiceNumber: string;
  branchId: string;
  branchType: string;
  cashBankAccountId: string;
  paymentMethod: 'CASH' | 'TRANSFER';
  refundDate: string;
  amount: string;
  reason: string;
  originalPaymentAmount: string;
  remainingAppliedAmountAfterRefund: string;
  eligible: boolean;
  excludedReason: string | null;
}

export function vendorPaymentMethodMappingKey(method: string): string {
  return paymentMethodMappingKey(method);
}

export function validateVendorPaymentSnapshot(
  snapshot: ZohoVendorPaymentSnapshot,
  dependencies: Partial<ZohoVendorPaymentDependencies>,
): string[] {
  if (!snapshot.eligible) return [];
  const issues: string[] = [];
  const amount = new Prisma.Decimal(snapshot.amount);
  const before = new Prisma.Decimal(snapshot.outstandingBefore);
  const after = new Prisma.Decimal(snapshot.outstandingAfter);
  if (!amount.greaterThan(0)) issues.push('Nominal vendor payment harus lebih besar dari nol.');
  if (amount.greaterThan(before)) issues.push('Vendor payment melebihi saldo Bill sebelum pembayaran.');
  if (!before.minus(amount).equals(after)) {
    issues.push('Saldo AP setelah vendor payment tidak konsisten.');
  }
  if (!dependencies.vendorId) issues.push('Mapping supplier ke vendor Zoho belum tersedia.');
  if (!dependencies.billId) issues.push('Bill supplier belum terpetakan ke Zoho.');
  if (!dependencies.paidThroughAccountId) {
    issues.push('Mapping rekening paid-through Zoho belum tersedia.');
  }
  if (!dependencies.paymentMode) {
    issues.push(`Mapping metode pembayaran ${snapshot.paymentMethod} belum tersedia.`);
  }
  return issues;
}

export function buildZohoVendorPaymentPayload(
  snapshot: ZohoVendorPaymentSnapshot,
  dependencies: ZohoVendorPaymentDependencies,
) {
  return {
    vendor_id: dependencies.vendorId,
    bills: [{
      bill_id: dependencies.billId,
      amount_applied: Number(snapshot.amount),
    }],
    date: snapshot.paymentDate,
    amount: Number(snapshot.amount),
    paid_through_account_id: dependencies.paidThroughAccountId,
    payment_mode: dependencies.paymentMode,
    reference_number: snapshot.referenceNumber,
    description: [
      `Pembayaran ERP ${snapshot.invoiceNumber}`,
      `Bukti ${snapshot.paymentReference}`,
    ].join(' - '),
  };
}

export function buildZohoVendorPaymentRefundPayload(
  snapshot: ZohoVendorPaymentRefundSnapshot,
  toAccountId: string,
  refundMode: string,
) {
  return {
    date: snapshot.refundDate,
    refund_mode: refundMode,
    reference_number: snapshot.referenceNumber,
    amount: Number(snapshot.amount),
    to_account_id: toAccountId,
    description: `${snapshot.reason} (ERP ${snapshot.invoiceNumber})`,
  };
}

export type VendorPaymentReconciliationStatus =
  | 'MATCHED'
  | 'MISSING_IN_ZOHO'
  | 'AMOUNT_MISMATCH';

export function reconcileVendorPayment(
  snapshot: ZohoVendorPaymentSnapshot,
  dependencies: Pick<ZohoVendorPaymentDependencies, 'billId' | 'paidThroughAccountId'>,
  remote?: ZohoVendorPaymentRemote | null,
): { status: VendorPaymentReconciliationStatus; differences: string[] } {
  if (!remote?.payment_id) {
    return {
      status: 'MISSING_IN_ZOHO',
      differences: ['Vendor payment tidak ditemukan di Zoho.'],
    };
  }
  const differences: string[] = [];
  if (
    remote.amount == null
    || !new Prisma.Decimal(remote.amount).toDecimalPlaces(2)
      .equals(new Prisma.Decimal(snapshot.amount).toDecimalPlaces(2))
  ) {
    differences.push('Nominal vendor payment ERP berbeda dari Zoho.');
  }
  if (String(remote.paid_through_account_id || '') !== dependencies.paidThroughAccountId) {
    differences.push('Rekening paid-through vendor payment berbeda.');
  }
  const applied = remote.bills?.find((bill) => String(bill.bill_id) === dependencies.billId);
  if (
    !applied
    || applied.amount_applied == null
    || !new Prisma.Decimal(applied.amount_applied).toDecimalPlaces(2)
      .equals(new Prisma.Decimal(snapshot.amount).toDecimalPlaces(2))
  ) {
    differences.push('Vendor payment tidak diterapkan ke Bill/nominal aplikasi yang benar.');
  }
  return {
    status: differences.length ? 'AMOUNT_MISMATCH' : 'MATCHED',
    differences,
  };
}
