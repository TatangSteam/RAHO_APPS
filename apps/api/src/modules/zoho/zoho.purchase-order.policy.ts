import { Prisma } from '@prisma/client';
import { erpOriginMarker } from './zoho.origin';

export const PO_ISSUED_EVENT = 'PO_ISSUED';
export const PO_CANCELLED_EVENT = 'PO_CANCELLED';

export type ZohoPurchaseOrderLineSnapshot = {
  id: string;
  lineNo: number;
  masterProductId: string;
  uomId: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  uom: string;
  orderedQty: string;
  unitPrice: string;
  lineTotal: string;
};

export type ZohoPurchaseOrderSnapshot = {
  localEntityId: string;
  externalKey: string;
  poNumber: string;
  purchaseRequestId: string;
  supplierId: string;
  branchId: string;
  branchType: string;
  orderDate: string;
  expectedDate: string | null;
  currency: string;
  totalAmount: string;
  notes: string | null;
  eligible: boolean;
  excludedReason: string | null;
  supplier: { code: string; name: string };
  branch: { code: string; name: string };
  lines: ZohoPurchaseOrderLineSnapshot[];
};

export type ZohoPurchaseOrderDependencies = {
  vendorId: string;
  locationId: string;
  itemIds: Record<string, string>;
  units: Record<string, string>;
};

export type ZohoPurchaseOrderRemote = {
  purchaseorder_id?: string | number;
  purchaseorder_number?: string;
  reference_number?: string;
  status?: string;
  total?: number;
  line_items?: Array<{
    line_item_id?: string | number;
    item_id?: string | number;
    item_order?: number;
    unit?: string;
    quantity?: string | number;
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

export function purchaseOrderItemKey(masterProductId: string): string {
  return `MASTER_PRODUCT:${masterProductId}`;
}

export function purchaseOrderUomKey(line: ZohoPurchaseOrderLineSnapshot): string {
  return line.uomId ? `UOM:${line.uomId}` : `UOM_SNAPSHOT:${line.uom.trim().toLowerCase()}`;
}

export function validatePurchaseOrderSnapshot(
  snapshot: ZohoPurchaseOrderSnapshot,
  dependencies?: Partial<ZohoPurchaseOrderDependencies>,
): string[] {
  if (!snapshot.eligible) return [];
  const issues: string[] = [];
  if (snapshot.currency !== 'IDR') {
    issues.push(`Currency ${snapshot.currency} belum didukung untuk Purchase Order Zoho.`);
  }
  if (!snapshot.lines.length) issues.push('Purchase Order tidak mempunyai baris.');
  const lineNos = new Set<number>();
  let total = new Prisma.Decimal(0);
  for (const line of snapshot.lines) {
    const quantity = decimal(line.orderedQty);
    const unitPrice = decimal(line.unitPrice);
    const lineTotal = decimal(line.lineTotal);
    if (!quantity.greaterThan(0)) issues.push(`Quantity baris ${line.lineNo} harus positif.`);
    if (unitPrice.isNegative()) issues.push(`Harga baris ${line.lineNo} tidak boleh negatif.`);
    if (!equalMoney(quantity.mul(unitPrice), lineTotal)) {
      issues.push(`Total baris ${line.lineNo} tidak sama dengan quantity x harga.`);
    }
    if (lineNos.has(line.lineNo)) issues.push(`Nomor baris ${line.lineNo} duplikat.`);
    lineNos.add(line.lineNo);
    total = total.plus(lineTotal);
    if (dependencies && !dependencies.itemIds?.[purchaseOrderItemKey(line.masterProductId)]) {
      issues.push(`Item ${line.sku || line.name} belum dipetakan ke Zoho.`);
    }
    if (dependencies && !dependencies.units?.[purchaseOrderUomKey(line)]) {
      issues.push(`UOM ${line.uom} untuk item ${line.sku || line.name} belum dipetakan ke Zoho.`);
    }
  }
  if (!equalMoney(total, snapshot.totalAmount)) {
    issues.push('Jumlah total baris tidak sama dengan total Purchase Order.');
  }
  if (dependencies && !dependencies.vendorId) {
    issues.push(`Supplier ${snapshot.supplier.code} belum dipetakan sebagai Vendor Zoho.`);
  }
  if (dependencies && !dependencies.locationId) {
    issues.push(`Cabang ${snapshot.branch.code} belum dipetakan sebagai Location Zoho.`);
  }
  return Array.from(new Set(issues));
}

export function buildZohoPurchaseOrderPayload(
  snapshot: ZohoPurchaseOrderSnapshot,
  dependencies: ZohoPurchaseOrderDependencies,
) {
  const issues = validatePurchaseOrderSnapshot(snapshot, dependencies);
  if (issues.length) throw new Error(issues.join(' '));
  return {
    vendor_id: dependencies.vendorId,
    purchaseorder_number: snapshot.poNumber,
    reference_number: snapshot.poNumber,
    date: snapshot.orderDate,
    ...(snapshot.expectedDate ? { delivery_date: snapshot.expectedDate } : {}),
    currency_code: snapshot.currency,
    location_id: dependencies.locationId,
    line_items: snapshot.lines.map((line) => ({
      item_id: dependencies.itemIds[purchaseOrderItemKey(line.masterProductId)],
      name: line.name.slice(0, 100),
      description: [
        line.sku ? `${line.sku} - ${line.name}` : line.name,
        line.description,
      ].filter(Boolean).join(' · ').slice(0, 500),
      unit: dependencies.units[purchaseOrderUomKey(line)],
      quantity: Number(decimal(line.orderedQty).toFixed(4)),
      rate: Number(decimal(line.unitPrice).toFixed(4)),
      item_order: line.lineNo,
      location_id: dependencies.locationId,
    })),
    notes: [erpOriginMarker(snapshot.externalKey), snapshot.notes]
      .filter(Boolean).join('\n').slice(0, 2_000),
  };
}

export type PurchaseOrderReconciliationStatus = 'MATCHED' | 'MISMATCH' | 'MISSING';

export function reconcilePurchaseOrder(
  snapshot: ZohoPurchaseOrderSnapshot,
  remote?: ZohoPurchaseOrderRemote | null,
): { status: PurchaseOrderReconciliationStatus; differences: string[] } {
  if (!remote) return { status: 'MISSING', differences: ['Purchase Order Zoho tidak ditemukan.'] };
  const differences: string[] = [];
  if (remote.total == null || !equalMoney(remote.total, snapshot.totalAmount)) {
    differences.push('Total Purchase Order Zoho berbeda dari ERP.');
  }
  if ((remote.line_items?.length || 0) !== snapshot.lines.length) {
    differences.push('Jumlah baris Purchase Order Zoho berbeda dari ERP.');
  }
  if (remote.purchaseorder_number && remote.purchaseorder_number !== snapshot.poNumber) {
    differences.push('Nomor Purchase Order Zoho berbeda dari ERP.');
  }
  return { status: differences.length ? 'MISMATCH' : 'MATCHED', differences };
}
