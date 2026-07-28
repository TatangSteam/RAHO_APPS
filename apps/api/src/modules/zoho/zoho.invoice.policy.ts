import { Prisma } from '@prisma/client';

export type InvoiceRevenueClassification = 'NORMAL_SALE' | 'THERAPY_ADVANCE';

export type ZohoInvoiceLineSnapshot = {
  id: string;
  itemType: string;
  itemId: string;
  code: string | null;
  description: string;
  quantity: number;
  rate: string;
  subtotal: string;
  discountAmount: string;
  totalAmount: string;
  mappingEntityType: 'MASTER_PRODUCT' | 'PACKAGE_PRICING' | null;
  mappingLocalEntityId: string | null;
};

export type ZohoInvoiceSnapshot = {
  localEntityId: string;
  externalKey: string;
  invoiceNumber: string;
  branchId: string;
  branchType: string;
  memberId: string;
  date: string;
  dueDate: string | null;
  currency: string;
  classification: InvoiceRevenueClassification;
  eligible: boolean;
  excludedReason: string | null;
  subtotal: string;
  discountAmount: string;
  taxPercent: string;
  taxAmount: string;
  totalAmount: string;
  notes: string | null;
  customer: {
    memberNo: string;
    name: string;
    email: string | null;
  };
  branch: {
    branchCode: string;
    name: string;
  };
  lines: ZohoInvoiceLineSnapshot[];
};

export type ZohoInvoiceDependencies = {
  customerId: string;
  locationId?: string;
  taxId?: string;
  itemIds: Record<string, string>;
};

function money(value: string | number | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function normalizedMoney(value: string | number | Prisma.Decimal): string {
  return money(value).toDecimalPlaces(2).toFixed(2);
}

export function invoiceLineMappingKey(line: ZohoInvoiceLineSnapshot): string | null {
  return line.mappingEntityType && line.mappingLocalEntityId
    ? `${line.mappingEntityType}:${line.mappingLocalEntityId}`
    : null;
}

export function invoiceTaxMappingKey(percent: string | number | Prisma.Decimal): string {
  return money(percent).toDecimalPlaces(4).toString();
}

export function validateInvoiceSnapshot(
  snapshot: ZohoInvoiceSnapshot,
  dependencies?: Partial<ZohoInvoiceDependencies>,
): string[] {
  const issues: string[] = [];
  if (!snapshot.eligible) return issues;
  if (snapshot.currency !== 'IDR') issues.push(`Currency ${snapshot.currency} belum didukung untuk sinkronisasi invoice.`);
  if (!snapshot.lines.length) issues.push('Invoice tidak memiliki baris.');
  if (money(snapshot.discountAmount).isNegative()) issues.push('Diskon invoice tidak boleh negatif.');
  if (money(snapshot.discountAmount).greaterThan(snapshot.subtotal)) issues.push('Diskon melebihi subtotal.');

  const lineSubtotal = snapshot.lines.reduce(
    (sum, line) => sum.plus(money(line.subtotal)),
    new Prisma.Decimal(0),
  );
  if (!lineSubtotal.toDecimalPlaces(2).equals(money(snapshot.subtotal).toDecimalPlaces(2))) {
    issues.push('Jumlah subtotal baris tidak sama dengan subtotal invoice.');
  }
  const lineDiscount = snapshot.lines.reduce(
    (sum, line) => sum.plus(money(line.discountAmount)),
    new Prisma.Decimal(0),
  );
  for (const line of snapshot.lines) {
    const expectedLineTotal = money(line.subtotal).minus(line.discountAmount).toDecimalPlaces(2);
    if (!expectedLineTotal.equals(money(line.totalAmount).toDecimalPlaces(2))) {
      issues.push(`Subtotal dan diskon baris ${line.code || line.id} tidak seimbang.`);
    }
  }
  const expectedTotal = money(snapshot.subtotal)
    .minus(lineDiscount)
    .minus(snapshot.discountAmount)
    .plus(snapshot.taxAmount)
    .toDecimalPlaces(2);
  if (!expectedTotal.equals(money(snapshot.totalAmount).toDecimalPlaces(2))) {
    issues.push('Subtotal, diskon, pajak, dan total invoice tidak seimbang.');
  }

  for (const line of snapshot.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      issues.push(`Quantity baris ${line.code || line.id} tidak valid.`);
    }
    if (!line.mappingEntityType || !line.mappingLocalEntityId) {
      issues.push(`Item ${line.code || line.description} belum mempunyai sumber mapping Zoho.`);
      continue;
    }
    const key = invoiceLineMappingKey(line)!;
    if (dependencies && !dependencies.itemIds?.[key]) {
      issues.push(`Item ${line.code || line.description} belum dipetakan ke Zoho.`);
    }
  }
  if (dependencies && !dependencies.customerId) issues.push('Customer belum dipetakan ke Zoho.');
  if (dependencies && !dependencies.locationId) issues.push('Location cabang belum dipetakan ke Zoho.');
  if (dependencies && money(snapshot.taxPercent).greaterThan(0) && !dependencies.taxId) {
    issues.push(`Pajak ${invoiceTaxMappingKey(snapshot.taxPercent)}% belum dipetakan ke Zoho.`);
  }
  return Array.from(new Set(issues));
}

export function buildZohoInvoicePayload(
  snapshot: ZohoInvoiceSnapshot,
  dependencies: ZohoInvoiceDependencies,
) {
  const issues = validateInvoiceSnapshot(snapshot, dependencies);
  if (issues.length) throw new Error(issues.join(' '));
  const hasTax = money(snapshot.taxPercent).greaterThan(0);
  return {
    customer_id: dependencies.customerId,
    invoice_number: snapshot.invoiceNumber,
    reference_number: snapshot.invoiceNumber,
    date: snapshot.date,
    ...(snapshot.dueDate ? { due_date: snapshot.dueDate } : {}),
    currency_code: snapshot.currency,
    discount: Number(normalizedMoney(snapshot.discountAmount)),
    discount_type: 'entity_level',
    is_discount_before_tax: true,
    allow_partial_payments: true,
    ...(dependencies.locationId ? { location_id: dependencies.locationId } : {}),
    line_items: snapshot.lines.map((line) => ({
      item_id: dependencies.itemIds[invoiceLineMappingKey(line)!],
      name: line.description.slice(0, 100),
      description: `${line.code ? `${line.code} - ` : ''}${line.description}`.slice(0, 500),
      quantity: line.quantity,
      rate: Number(normalizedMoney(line.rate)),
      discount_amount: Number(normalizedMoney(line.discountAmount)),
      ...(dependencies.locationId ? { location_id: dependencies.locationId } : {}),
      ...(hasTax && dependencies.taxId ? { tax_id: dependencies.taxId } : {}),
    })),
    notes: snapshot.notes?.slice(0, 2_000) || `Sinkron dari RAHO ERP (${snapshot.externalKey})`,
  };
}
