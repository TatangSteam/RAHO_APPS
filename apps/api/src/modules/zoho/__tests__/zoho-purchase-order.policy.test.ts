import {
  buildZohoPurchaseOrderPayload,
  PO_CANCELLED_EVENT,
  PO_ISSUED_EVENT,
  purchaseOrderItemKey,
  purchaseOrderUomKey,
  reconcilePurchaseOrder,
  validatePurchaseOrderSnapshot,
  ZohoPurchaseOrderDependencies,
  ZohoPurchaseOrderSnapshot,
} from '../zoho.purchase-order.policy';
import { ZOHO_REQUIRED_SCOPES, ZOHO_SCOPE_VERSION } from '../zoho.client';

function purchaseOrder(
  overrides: Partial<ZohoPurchaseOrderSnapshot> = {},
): ZohoPurchaseOrderSnapshot {
  return {
    localEntityId: 'po-1',
    externalKey: 'RAHO:PO:po-1',
    poNumber: 'PO-2026-001',
    purchaseRequestId: 'pr-1',
    supplierId: 'supplier-1',
    branchId: 'branch-1',
    branchType: 'OWNED',
    orderDate: '2026-07-29',
    expectedDate: '2026-08-02',
    currency: 'IDR',
    totalAmount: '1500000.00',
    notes: 'Kirim pagi.',
    eligible: true,
    excludedReason: null,
    supplier: { code: 'SUP-001', name: 'Supplier Sehat' },
    branch: { code: 'HQ', name: 'Cabang HQ' },
    lines: [{
      id: 'line-1',
      lineNo: 1,
      masterProductId: 'product-1',
      uomId: 'uom-1',
      sku: 'BOOST-01',
      name: 'Booster',
      description: 'Booster saja',
      uom: 'VIAL',
      orderedQty: '3.0000',
      unitPrice: '500000.0000',
      lineTotal: '1500000.00',
    }],
    ...overrides,
  };
}

function dependencies(snapshot = purchaseOrder()): ZohoPurchaseOrderDependencies {
  const line = snapshot.lines[0];
  return {
    vendorId: 'zoho-vendor-1',
    locationId: 'zoho-location-hq',
    itemIds: { [purchaseOrderItemKey(line.masterProductId)]: 'zoho-item-booster' },
    units: { [purchaseOrderUomKey(line)]: 'Vial' },
  };
}

describe('Zoho Sprint 10 Purchase Order policy', () => {
  it('builds an issued PO using mapped vendor, item, UOM, and location', () => {
    const snapshot = purchaseOrder();
    const payload = buildZohoPurchaseOrderPayload(snapshot, dependencies(snapshot));

    expect(payload).toMatchObject({
      vendor_id: 'zoho-vendor-1',
      purchaseorder_number: snapshot.poNumber,
      reference_number: snapshot.poNumber,
      date: '2026-07-29',
      delivery_date: '2026-08-02',
      currency_code: 'IDR',
      location_id: 'zoho-location-hq',
      line_items: [{
        item_id: 'zoho-item-booster',
        unit: 'Vial',
        quantity: 3,
        rate: 500000,
        location_id: 'zoho-location-hq',
      }],
    });
    expect(validatePurchaseOrderSnapshot(snapshot, dependencies(snapshot))).toEqual([]);
  });

  it('blocks missing mappings, invalid UOM conversion, and inconsistent totals', () => {
    const snapshot = purchaseOrder({
      totalAmount: '1499999.00',
      lines: [{
        ...purchaseOrder().lines[0],
        orderedQty: '2.0000',
        lineTotal: '1500000.00',
      }],
    });
    const issues = validatePurchaseOrderSnapshot(snapshot, {
      itemIds: {},
      units: {},
    });

    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining('quantity x harga'),
      expect.stringContaining('Jumlah total baris'),
      expect.stringContaining('Item BOOST-01'),
      expect.stringContaining('UOM VIAL'),
      expect.stringContaining('Supplier SUP-001'),
      expect.stringContaining('Cabang HQ'),
    ]));
  });

  it('excludes Partnership PO because it is not an internal Zoho Location', () => {
    const snapshot = purchaseOrder({
      branchType: 'PARTNERSHIP',
      eligible: false,
      excludedReason: 'Partnership bukan Location internal.',
    });
    expect(validatePurchaseOrderSnapshot(snapshot, {})).toEqual([]);
  });

  it('does not send receipt, stock, batch, expiry, invoice, payment, or medical data', () => {
    const snapshot = purchaseOrder();
    const serialized = JSON.stringify(
      buildZohoPurchaseOrderPayload(snapshot, dependencies(snapshot)),
    );
    expect(serialized).not.toMatch(
      /goods_receipt|stock_on_hand|batch|expiry|supplier_invoice|payment|diagnosis|therapy/i,
    );
  });

  it('reconciles PO number, total, and line count', () => {
    const snapshot = purchaseOrder();
    expect(reconcilePurchaseOrder(snapshot, {
      purchaseorder_id: 'zoho-po-1',
      purchaseorder_number: snapshot.poNumber,
      total: 1500000,
      line_items: [{ item_id: 'zoho-item-booster', quantity: 3, rate: 500000 }],
    })).toEqual({ status: 'MATCHED', differences: [] });

    expect(reconcilePurchaseOrder(snapshot, {
      purchaseorder_id: 'zoho-po-1',
      purchaseorder_number: 'OTHER',
      total: 1400000,
      line_items: [],
    }).status).toBe('MISMATCH');
    expect(reconcilePurchaseOrder(snapshot).status).toBe('MISSING');
  });

  it('declares issued/cancelled events and the required Zoho PO scopes', () => {
    expect(PO_ISSUED_EVENT).toBe('PO_ISSUED');
    expect(PO_CANCELLED_EVENT).toBe('PO_CANCELLED');
    expect(ZOHO_SCOPE_VERSION).toBe(12);
    expect(ZOHO_REQUIRED_SCOPES).toEqual(expect.arrayContaining([
      'ZohoBooks.purchaseorders.READ',
      'ZohoBooks.purchaseorders.CREATE',
      'ZohoBooks.purchaseorders.UPDATE',
    ]));
  });
});
