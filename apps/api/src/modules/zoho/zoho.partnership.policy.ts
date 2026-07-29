import { Prisma } from '@prisma/client';

export const PARTNERSHIP_PAYMENT_VERIFIED_EVENT = 'PARTNERSHIP_PAYMENT_VERIFIED';

export type PartnershipShipmentLineSnapshot = {
  masterProductId: string;
  sku: string | null;
  productName: string;
  quantity: string;
  unitPrice: string;
  unitCost: string;
  totalCost: string;
};

export type PartnershipGoodsShippedSnapshot = {
  sourceBranchId: string;
  partnershipBranchId: string;
  stockRequestId: string;
  stockRequestInvoiceId: string;
  shipmentCode: string;
  invoiceNumber: string;
  revenueAmount: string;
  costAmount: string;
  grossProfit: string;
  items: PartnershipShipmentLineSnapshot[];
};

export type PartnershipShipmentDependencies = {
  customerId: string;
  sourceLocationId: string;
  itemIds: Record<string, string>;
};

export type PartnershipPaymentSnapshot = {
  localEntityId: string;
  partnershipBranchId: string;
  stockRequestId: string;
  stockRequestInvoiceId: string;
  invoiceNumber: string;
  amount: string;
  paymentDate: string;
  referenceNumber: string;
  paymentAccountNumber: string | null;
};

export type PartnershipPaymentDependencies = {
  customerId: string;
  accountId: string;
  paymentMode: string;
  invoiceId?: string;
};

export type ZohoPartnershipInvoiceRemote = {
  invoice_id?: string | number;
  invoice_number?: string;
  reference_number?: string;
  status?: string;
  total?: number;
  balance?: number;
  line_items?: Array<{
    item_id?: string | number;
    quantity?: number;
    rate?: number;
    item_total?: number;
  }>;
};

function decimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function equalMoney(left: string | number | Prisma.Decimal, right: string | number | Prisma.Decimal) {
  return decimal(left).toDecimalPlaces(2).equals(decimal(right).toDecimalPlaces(2));
}

export function partnershipItemMappingKey(masterProductId: string): string {
  return `MASTER_PRODUCT:${masterProductId}`;
}

export function validatePartnershipShipmentSnapshot(
  snapshot: PartnershipGoodsShippedSnapshot,
  dependencies?: Partial<PartnershipShipmentDependencies>,
): string[] {
  const issues: string[] = [];
  if (!snapshot.sourceBranchId) issues.push('Cabang sumber shipment belum tersedia.');
  if (!snapshot.partnershipBranchId) issues.push('Cabang Partnership belum tersedia.');
  if (!snapshot.items.length) issues.push('Shipment Partnership tidak mempunyai item.');
  const uniqueProducts = new Set<string>();
  let revenue = new Prisma.Decimal(0);
  let cost = new Prisma.Decimal(0);
  for (const item of snapshot.items) {
    const quantity = decimal(item.quantity);
    const unitPrice = decimal(item.unitPrice);
    const unitCost = decimal(item.unitCost);
    const totalCost = decimal(item.totalCost);
    if (!quantity.greaterThan(0)) issues.push(`Quantity ${item.sku || item.masterProductId} harus positif.`);
    if (unitPrice.isNegative()) issues.push(`Harga ${item.sku || item.masterProductId} tidak boleh negatif.`);
    if (unitCost.isNegative() || totalCost.isNegative()) {
      issues.push(`HPP ${item.sku || item.masterProductId} tidak boleh negatif.`);
    }
    if (!equalMoney(unitCost.mul(quantity), totalCost)) {
      issues.push(`HPP ${item.sku || item.masterProductId} tidak sama dengan quantity x unit cost.`);
    }
    if (uniqueProducts.has(item.masterProductId)) {
      issues.push(`Produk ${item.sku || item.masterProductId} muncul lebih dari satu kali.`);
    }
    uniqueProducts.add(item.masterProductId);
    revenue = revenue.plus(quantity.mul(unitPrice));
    cost = cost.plus(totalCost);
    if (dependencies && !dependencies.itemIds?.[partnershipItemMappingKey(item.masterProductId)]) {
      issues.push(`Item ${item.sku || item.productName} belum dipetakan ke Zoho.`);
    }
  }
  if (!equalMoney(revenue, snapshot.revenueAmount)) {
    issues.push('Total harga item tidak sama dengan omzet snapshot shipment.');
  }
  if (!equalMoney(cost, snapshot.costAmount)) {
    issues.push('Total FIFO item tidak sama dengan HPP snapshot shipment.');
  }
  if (!equalMoney(decimal(snapshot.revenueAmount).minus(snapshot.costAmount), snapshot.grossProfit)) {
    issues.push('Omzet dikurangi HPP tidak sama dengan laba kotor snapshot.');
  }
  if (dependencies && !dependencies.customerId) {
    issues.push('Cabang Partnership belum dipetakan sebagai Customer Zoho.');
  }
  if (dependencies && !dependencies.sourceLocationId) {
    issues.push('Cabang sumber belum dipetakan sebagai Location Zoho.');
  }
  return Array.from(new Set(issues));
}

export function buildPartnershipSalesInvoicePayload(input: {
  shipmentId: string;
  shippedAt: Date;
  snapshot: PartnershipGoodsShippedSnapshot;
  dependencies: PartnershipShipmentDependencies;
}) {
  const issues = validatePartnershipShipmentSnapshot(input.snapshot, input.dependencies);
  if (issues.length) throw new Error(issues.join(' '));
  const { snapshot, dependencies } = input;
  return {
    customer_id: dependencies.customerId,
    invoice_number: snapshot.invoiceNumber,
    reference_number: snapshot.shipmentCode,
    date: input.shippedAt.toISOString().slice(0, 10),
    currency_code: 'IDR',
    allow_partial_payments: true,
    location_id: dependencies.sourceLocationId,
    line_items: snapshot.items.map((item) => ({
      item_id: dependencies.itemIds[partnershipItemMappingKey(item.masterProductId)],
      name: item.productName.slice(0, 100),
      description: `${item.sku ? `${item.sku} - ` : ''}${item.productName}`.slice(0, 500),
      quantity: Number(item.quantity),
      rate: Number(decimal(item.unitPrice).toFixed(2)),
      location_id: dependencies.sourceLocationId,
    })),
    notes: [
      `Penjualan barang Partnership dari shipment ${snapshot.shipmentCode}.`,
      `RAHO:PARTNERSHIP_SHIPMENT:${input.shipmentId}`,
      `HPP FIFO ERP ${decimal(snapshot.costAmount).toFixed(2)}.`,
    ].join(' '),
  };
}

export function validatePartnershipPaymentSnapshot(
  snapshot: PartnershipPaymentSnapshot,
  dependencies?: Partial<PartnershipPaymentDependencies>,
): string[] {
  const issues: string[] = [];
  if (!decimal(snapshot.amount).greaterThan(0)) issues.push('Nominal pembayaran Partnership harus positif.');
  if (!snapshot.paymentAccountNumber) {
    issues.push('Nomor rekening penerima pembayaran Partnership belum tersedia.');
  }
  if (dependencies && !dependencies.customerId) {
    issues.push('Cabang Partnership belum dipetakan sebagai Customer Zoho.');
  }
  if (dependencies && !dependencies.accountId) {
    issues.push('Rekening penerima Partnership belum dipetakan ke rekening Zoho.');
  }
  if (dependencies && !dependencies.paymentMode) {
    issues.push('Metode pembayaran Partnership belum dipetakan.');
  }
  return Array.from(new Set(issues));
}

export function buildPartnershipCustomerPaymentPayload(
  snapshot: PartnershipPaymentSnapshot,
  dependencies: PartnershipPaymentDependencies,
) {
  const issues = validatePartnershipPaymentSnapshot(snapshot, dependencies);
  if (issues.length) throw new Error(issues.join(' '));
  return {
    customer_id: dependencies.customerId,
    payment_mode: dependencies.paymentMode,
    amount: Number(decimal(snapshot.amount).toFixed(2)),
    date: snapshot.paymentDate,
    reference_number: snapshot.referenceNumber,
    description: `Pembayaran order Partnership ${snapshot.invoiceNumber}`,
    account_id: dependencies.accountId,
    invoices: dependencies.invoiceId
      ? [{ invoice_id: dependencies.invoiceId, amount_applied: Number(decimal(snapshot.amount).toFixed(2)) }]
      : [],
  };
}

export function buildPartnershipPaymentApplicationPayload(paymentId: string, amount: string) {
  return {
    invoice_payments: [{
      payment_id: paymentId,
      amount_applied: Number(decimal(amount).toFixed(2)),
    }],
    apply_creditnotes: [],
  };
}

export type PartnershipReconciliationStatus = 'MATCHED' | 'MISMATCH' | 'MISSING';

export function reconcilePartnershipInvoice(
  snapshot: PartnershipGoodsShippedSnapshot,
  remote?: ZohoPartnershipInvoiceRemote | null,
): { status: PartnershipReconciliationStatus; differences: string[] } {
  if (!remote) return { status: 'MISSING', differences: ['Invoice Zoho tidak ditemukan.'] };
  const differences: string[] = [];
  if (remote.total == null || !equalMoney(remote.total, snapshot.revenueAmount)) {
    differences.push('Total invoice Zoho berbeda dari omzet shipment ERP.');
  }
  if ((remote.line_items?.length || 0) !== snapshot.items.length) {
    differences.push('Jumlah baris invoice Zoho berbeda dari shipment ERP.');
  }
  return { status: differences.length ? 'MISMATCH' : 'MATCHED', differences };
}
