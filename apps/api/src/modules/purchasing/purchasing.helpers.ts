import { Prisma, PurchaseOrderStatus, SupplierInvoiceStatus } from '@prisma/client';
import { errors } from '@middleware/errorHandler';

export function exactCurrency(value: Prisma.Decimal, label: string) {
  if (!value.equals(value.toDecimalPlaces(2))) throw errors.unprocessable('CURRENCY_PRECISION_INVALID', `${label} harus tepat maksimal dua desimal.`);
  return value;
}

export function purchaseOrderStatus(ordered: Prisma.Decimal, received: Prisma.Decimal): PurchaseOrderStatus {
  if (received.greaterThanOrEqualTo(ordered)) return PurchaseOrderStatus.RECEIVED;
  if (received.greaterThan(0)) return PurchaseOrderStatus.PARTIALLY_RECEIVED;
  return PurchaseOrderStatus.ISSUED;
}

export function supplierInvoiceStatus(balance: Prisma.Decimal, paid: Prisma.Decimal): SupplierInvoiceStatus {
  if (balance.isZero()) return SupplierInvoiceStatus.PAID;
  if (paid.greaterThan(0)) return SupplierInvoiceStatus.PARTIALLY_PAID;
  return SupplierInvoiceStatus.POSTED;
}

export const PURCHASING_ACCOUNTS = { inventory: '1300', ap: '2100', grni: '2110' } as const;

export function buildPurchasingJournal(source: 'GOODS_RECEIPT' | 'SUPPLIER_INVOICE' | 'SUPPLIER_PAYMENT', amountInput: Prisma.Decimal.Value, cashAccountCode?: string) {
  const amount = new Prisma.Decimal(amountInput);
  if (!amount.greaterThan(0)) throw errors.unprocessable('PURCHASING_AMOUNT_INVALID', 'Nilai posting harus lebih besar dari nol.');
  if (source === 'GOODS_RECEIPT') return [{ accountCode: PURCHASING_ACCOUNTS.inventory, debit: amount }, { accountCode: PURCHASING_ACCOUNTS.grni, credit: amount }];
  if (source === 'SUPPLIER_INVOICE') return [{ accountCode: PURCHASING_ACCOUNTS.grni, debit: amount }, { accountCode: PURCHASING_ACCOUNTS.ap, credit: amount }];
  if (!cashAccountCode) throw errors.badRequest('CASH_ACCOUNT_REQUIRED', 'Akun kas/bank wajib untuk pembayaran supplier.');
  return [{ accountCode: PURCHASING_ACCOUNTS.ap, debit: amount }, { accountCode: cashAccountCode, credit: amount }];
}
