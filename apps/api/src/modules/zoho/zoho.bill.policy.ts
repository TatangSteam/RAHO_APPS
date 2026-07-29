import { Prisma } from '@prisma/client';

export const SUPPLIER_INVOICE_POSTED_EVENT = 'SUPPLIER_INVOICE_POSTED';

export type ZohoBillLineSnapshot = {
  id: string;
  lineNo: number;
  purchaseOrderItemId: string;
  masterProductId: string;
  uomId: string | null;
  sku: string | null;
  name: string;
  uom: string;
  billedQty: string;
  unitPrice: string;
  lineTotal: string;
};

export type ZohoBillSnapshot = {
  localEntityId: string;
  externalKey: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string;
  purchaseOrderId: string;
  poNumber: string;
  supplierId: string;
  branchId: string;
  branchType: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  amount: string;
  balanceAmount: string;
  eligible: boolean;
  excludedReason: string | null;
  supplier: { code: string; name: string };
  branch: { code: string; name: string };
  lines: ZohoBillLineSnapshot[];
};

export type ZohoBillDependencies = {
  vendorId: string;
  purchaseOrderId: string;
  locationId: string;
  itemIds: Record<string, string>;
  units: Record<string, string>;
  purchaseOrderLineItemIds: Record<string, string>;
};

export type ZohoBillRemote = {
  bill_id?: string | number;
  bill_number?: string;
  reference_number?: string;
  status?: string;
  total?: number;
  balance?: number;
  line_items?: Array<{
    purchaseorder_item_id?: string | number;
    item_id?: string | number;
    quantity?: string | number;
    rate?: number;
    item_total?: number;
  }>;
  purchaseorders?: Array<{
    purchaseorder_id?: string | number;
    purchaseorder_number?: string;
  }>;
};

function decimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function equalMoney(
  left: string | number | Prisma.Decimal,
  right: string | number | Prisma.Decimal,
) {
  return decimal(left).toDecimalPlaces(2).equals(decimal(right).toDecimalPlaces(2));
}

export function billItemKey(masterProductId: string): string {
  return `MASTER_PRODUCT:${masterProductId}`;
}

export function billUomKey(line: ZohoBillLineSnapshot): string {
  return line.uomId ? `UOM:${line.uomId}` : `UOM_SNAPSHOT:${line.uom.trim().toLowerCase()}`;
}

export function billPurchaseOrderLineKey(purchaseOrderItemId: string): string {
  return `PURCHASE_ORDER_ITEM:${purchaseOrderItemId}`;
}

export function validateBillSnapshot(
  snapshot: ZohoBillSnapshot,
  dependencies?: Partial<ZohoBillDependencies>,
): string[] {
  if (!snapshot.eligible) return [];
  const issues: string[] = [];
  if (snapshot.currency !== 'IDR') {
    issues.push(`Currency ${snapshot.currency} belum didukung untuk Zoho Bill.`);
  }
  if (!snapshot.lines.length) {
    issues.push('Supplier invoice belum mempunyai alokasi quantity per baris PO.');
  }
  let total = new Prisma.Decimal(0);
  const poItems = new Set<string>();
  for (const line of snapshot.lines) {
    const quantity = decimal(line.billedQty);
    const rate = decimal(line.unitPrice);
    const lineTotal = decimal(line.lineTotal);
    if (!quantity.greaterThan(0)) issues.push(`Billed quantity baris ${line.lineNo} harus positif.`);
    if (rate.isNegative()) issues.push(`Harga baris ${line.lineNo} tidak boleh negatif.`);
    if (!equalMoney(quantity.mul(rate), lineTotal)) {
      issues.push(`Total baris ${line.lineNo} tidak sama dengan quantity x harga.`);
    }
    if (poItems.has(line.purchaseOrderItemId)) {
      issues.push(`Item PO pada baris ${line.lineNo} dialokasikan lebih dari satu kali.`);
    }
    poItems.add(line.purchaseOrderItemId);
    total = total.add(lineTotal);
    if (dependencies && !dependencies.itemIds?.[billItemKey(line.masterProductId)]) {
      issues.push(`Item ${line.sku || line.name} belum dipetakan ke Zoho.`);
    }
    if (dependencies && !dependencies.units?.[billUomKey(line)]) {
      issues.push(`UOM ${line.uom} untuk ${line.sku || line.name} belum dipetakan ke Zoho.`);
    }
    if (
      dependencies
      && !dependencies.purchaseOrderLineItemIds?.[
        billPurchaseOrderLineKey(line.purchaseOrderItemId)
      ]
    ) {
      issues.push(`Baris PO ${line.lineNo} belum ditemukan pada Purchase Order Zoho.`);
    }
  }
  if (!equalMoney(total, snapshot.amount)) {
    issues.push('Jumlah total baris tidak sama dengan amount supplier invoice.');
  }
  if (dependencies && !dependencies.vendorId) {
    issues.push(`Supplier ${snapshot.supplier.code} belum dipetakan sebagai Vendor Zoho.`);
  }
  if (dependencies && !dependencies.purchaseOrderId) {
    issues.push(`Purchase Order ${snapshot.poNumber} belum tersinkron ke Zoho.`);
  }
  if (dependencies && !dependencies.locationId) {
    issues.push(`Cabang ${snapshot.branch.code} belum dipetakan sebagai Location Zoho.`);
  }
  return Array.from(new Set(issues));
}

export function buildZohoBillPayload(
  snapshot: ZohoBillSnapshot,
  dependencies: ZohoBillDependencies,
) {
  const issues = validateBillSnapshot(snapshot, dependencies);
  if (issues.length) throw new Error(issues.join(' '));
  return {
    vendor_id: dependencies.vendorId,
    purchaseorder_ids: [dependencies.purchaseOrderId],
    bill_number: snapshot.supplierInvoiceNumber,
    reference_number: snapshot.invoiceNumber,
    date: snapshot.invoiceDate,
    due_date: snapshot.dueDate,
    location_id: dependencies.locationId,
    line_items: snapshot.lines.map((line) => ({
      purchaseorder_item_id:
        dependencies.purchaseOrderLineItemIds[
          billPurchaseOrderLineKey(line.purchaseOrderItemId)
        ],
      item_id: dependencies.itemIds[billItemKey(line.masterProductId)],
      name: line.name.slice(0, 100),
      description: `${line.sku || '-'} - ${line.name}`.slice(0, 500),
      location_id: dependencies.locationId,
      quantity: Number(decimal(line.billedQty).toFixed(4)),
      rate: Number(decimal(line.unitPrice).toFixed(4)),
      unit: dependencies.units[billUomKey(line)],
      item_order: line.lineNo,
    })),
    notes: `Supplier invoice dari RAHO ERP (${snapshot.externalKey}).`,
  };
}

export type BillReconciliationStatus = 'MATCHED' | 'MISMATCH' | 'MISSING';

export function reconcileBill(
  snapshot: ZohoBillSnapshot,
  remote?: ZohoBillRemote | null,
): { status: BillReconciliationStatus; differences: string[] } {
  if (!remote) return { status: 'MISSING', differences: ['Zoho Bill tidak ditemukan.'] };
  const differences: string[] = [];
  if (remote.total == null || !equalMoney(remote.total, snapshot.amount)) {
    differences.push('Total Zoho Bill berbeda dari supplier invoice ERP.');
  }
  if ((remote.line_items?.length || 0) !== snapshot.lines.length) {
    differences.push('Jumlah baris Zoho Bill berbeda dari ERP.');
  }
  if (remote.reference_number && remote.reference_number !== snapshot.invoiceNumber) {
    differences.push('Reference Zoho Bill berbeda dari nomor invoice ERP.');
  }
  if (
    remote.purchaseorders?.length
    && !remote.purchaseorders.some((row) => row.purchaseorder_number === snapshot.poNumber)
  ) {
    differences.push('Zoho Bill tidak terhubung ke Purchase Order yang benar.');
  }
  return { status: differences.length ? 'MISMATCH' : 'MATCHED', differences };
}
