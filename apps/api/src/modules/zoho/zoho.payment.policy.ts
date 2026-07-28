import { Prisma } from '@prisma/client';

export type ZohoPaymentClassification = 'NORMAL_SALE' | 'THERAPY_ADVANCE';

export interface ZohoPaymentSnapshot {
  localEntityId: string;
  externalKey: string;
  referenceNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  memberId: string;
  branchId: string;
  branchType: string;
  classification: ZohoPaymentClassification;
  eligible: boolean;
  excludedReason: string | null;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  cashBankAccountId: string;
  paymentReference: string | null;
  invoiceTotal: string;
  outstandingBefore: string;
  outstandingAfter: string;
}

export interface ZohoPaymentDependencies {
  customerId: string;
  invoiceId: string;
  locationId: string;
  accountId: string;
  paymentMode: string;
}

export interface ZohoPaymentRefundSnapshot {
  localEntityId: string;
  externalKey: string;
  referenceNumber: string;
  originalPaymentId: string;
  invoiceId: string;
  invoiceNumber: string;
  branchId: string;
  branchType: string;
  classification: ZohoPaymentClassification;
  eligible: boolean;
  excludedReason: string | null;
  amount: string;
  refundDate: string;
  reason: string;
  cashBankAccountId: string;
  paymentMethod: string;
  remainingAppliedAmountAfterRefund: string;
}

export function paymentMethodMappingKey(paymentMethod: string): string {
  return `PAYMENT_METHOD:${paymentMethod}`;
}

export function validatePaymentSnapshot(
  snapshot: ZohoPaymentSnapshot,
  dependencies: Partial<ZohoPaymentDependencies>,
): string[] {
  if (!snapshot.eligible) return [];
  const issues: string[] = [];
  const amount = new Prisma.Decimal(snapshot.amount);
  const before = new Prisma.Decimal(snapshot.outstandingBefore);
  const after = new Prisma.Decimal(snapshot.outstandingAfter);
  if (!amount.greaterThan(0)) issues.push('Nominal pembayaran harus lebih besar dari nol.');
  if (amount.greaterThan(before)) issues.push('Nominal pembayaran melebihi sisa tagihan sebelum pembayaran.');
  if (!before.minus(amount).equals(after)) issues.push('Sisa tagihan setelah pembayaran tidak konsisten.');
  if (!dependencies.customerId) issues.push('Mapping member ke customer Zoho belum tersedia.');
  if (!dependencies.invoiceId) issues.push('Mapping invoice Zoho belum tersedia.');
  if (!dependencies.locationId) issues.push('Mapping lokasi cabang Zoho belum tersedia.');
  if (!dependencies.accountId) issues.push('Mapping rekening kas/bank Zoho belum tersedia.');
  if (!dependencies.paymentMode) issues.push(`Mapping metode pembayaran ${snapshot.paymentMethod} belum tersedia.`);
  return issues;
}

export function buildZohoCustomerPaymentPayload(
  snapshot: ZohoPaymentSnapshot,
  dependencies: ZohoPaymentDependencies,
) {
  return {
    customer_id: dependencies.customerId,
    payment_mode: dependencies.paymentMode,
    amount: Number(snapshot.amount),
    date: snapshot.paymentDate,
    reference_number: snapshot.referenceNumber,
    description: [
      `Pembayaran ERP ${snapshot.invoiceNumber}`,
      snapshot.paymentReference ? `Ref ${snapshot.paymentReference}` : null,
    ].filter(Boolean).join(' - '),
    account_id: dependencies.accountId,
    location_id: dependencies.locationId,
    invoices: [{
      invoice_id: dependencies.invoiceId,
      amount_applied: Number(snapshot.amount),
    }],
  };
}

export function buildZohoRefundPayload(
  snapshot: ZohoPaymentRefundSnapshot,
  fromAccountId: string,
  refundMode: string,
) {
  return {
    date: snapshot.refundDate,
    amount: Number(snapshot.amount),
    from_account_id: fromAccountId,
    refund_mode: refundMode,
    reference_number: snapshot.referenceNumber,
    description: `${snapshot.reason} (ERP ${snapshot.invoiceNumber})`,
  };
}

export type ReconciliationStatus = 'MATCHED' | 'MISMATCH' | 'MISSING';

export function reconcileReceivable(input: {
  localTotal: string;
  localBalance: string;
  localStatus: string;
  zohoTotal?: string | number | null;
  zohoBalance?: string | number | null;
  zohoStatus?: string | null;
}): { status: ReconciliationStatus; reasons: string[] } {
  if (input.zohoTotal == null || input.zohoBalance == null || !input.zohoStatus) {
    return { status: 'MISSING', reasons: ['Invoice atau saldo Zoho tidak ditemukan.'] };
  }
  const reasons: string[] = [];
  if (!new Prisma.Decimal(input.localTotal).equals(new Prisma.Decimal(input.zohoTotal))) {
    reasons.push('Total invoice ERP berbeda dengan Zoho.');
  }
  if (!new Prisma.Decimal(input.localBalance).equals(new Prisma.Decimal(input.zohoBalance))) {
    reasons.push('Sisa piutang ERP berbeda dengan Zoho.');
  }
  const local = normalizeInvoiceStatus(input.localStatus, input.localTotal, input.localBalance);
  const zoho = normalizeInvoiceStatus(input.zohoStatus, input.zohoTotal, input.zohoBalance);
  if (local !== zoho) reasons.push(`Status ERP ${local} berbeda dengan Zoho ${zoho}.`);
  return { status: reasons.length ? 'MISMATCH' : 'MATCHED', reasons };
}

function normalizeInvoiceStatus(
  status: string,
  total: string | number,
  balance: string | number,
): string {
  const value = status.toLowerCase();
  if (['paid', 'closed'].includes(value)) return 'PAID';
  if (['void', 'cancelled', 'canceled'].includes(value)) return 'VOID';
  const decimalBalance = new Prisma.Decimal(balance);
  if (decimalBalance.equals(0)) return 'PAID';
  if (decimalBalance.lessThan(new Prisma.Decimal(total))) return 'PARTIAL';
  return 'UNPAID';
}
