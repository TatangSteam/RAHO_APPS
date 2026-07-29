import {
  billItemKey,
  billPurchaseOrderLineKey,
  billUomKey,
  buildZohoBillPayload,
  reconcileBill,
  SUPPLIER_INVOICE_POSTED_EVENT,
  validateBillSnapshot,
  ZohoBillDependencies,
  ZohoBillSnapshot,
} from '../zoho.bill.policy';
import { ZOHO_REQUIRED_SCOPES, ZOHO_SCOPE_VERSION } from '../zoho.client';

function bill(overrides: Partial<ZohoBillSnapshot> = {}): ZohoBillSnapshot {
  return {
    localEntityId: 'supplier-invoice-1',
    externalKey: 'RAHO:SUPPLIER_INVOICE:supplier-invoice-1',
    invoiceNumber: 'SI/2026/001',
    supplierInvoiceNumber: 'VENDOR-INV-88',
    purchaseOrderId: 'po-1',
    poNumber: 'PO/2026/001',
    supplierId: 'supplier-1',
    branchId: 'branch-hq',
    branchType: 'OWNED',
    invoiceDate: '2026-07-29',
    dueDate: '2026-08-28',
    currency: 'IDR',
    amount: '2000000.00',
    balanceAmount: '2000000.00',
    eligible: true,
    excludedReason: null,
    supplier: { code: 'SUP-001', name: 'Supplier Sehat' },
    branch: { code: 'HQ', name: 'Cabang HQ' },
    lines: [{
      id: 'invoice-line-1',
      lineNo: 1,
      purchaseOrderItemId: 'po-line-1',
      masterProductId: 'product-1',
      uomId: 'uom-1',
      sku: 'BOOST-01',
      name: 'Booster',
      uom: 'VIAL',
      billedQty: '4.0000',
      unitPrice: '500000.0000',
      lineTotal: '2000000.00',
    }],
    ...overrides,
  };
}

function dependencies(snapshot = bill()): ZohoBillDependencies {
  const line = snapshot.lines[0];
  return {
    vendorId: 'zoho-vendor-1',
    purchaseOrderId: 'zoho-po-1',
    locationId: 'zoho-location-hq',
    itemIds: { [billItemKey(line.masterProductId)]: 'zoho-item-1' },
    units: { [billUomKey(line)]: 'Vial' },
    purchaseOrderLineItemIds: {
      [billPurchaseOrderLineKey(line.purchaseOrderItemId)]: 'zoho-po-line-1',
    },
  };
}

describe('Zoho Sprint 11 Bill policy', () => {
  it('creates a partial Bill linked to the correct Zoho PO line', () => {
    const snapshot = bill();
    const payload = buildZohoBillPayload(snapshot, dependencies(snapshot));

    expect(payload).toMatchObject({
      vendor_id: 'zoho-vendor-1',
      purchaseorder_ids: ['zoho-po-1'],
      bill_number: 'VENDOR-INV-88',
      reference_number: 'SI/2026/001',
      location_id: 'zoho-location-hq',
      line_items: [{
        purchaseorder_item_id: 'zoho-po-line-1',
        item_id: 'zoho-item-1',
        quantity: 4,
        rate: 500000,
        unit: 'Vial',
      }],
    });
    expect(validateBillSnapshot(snapshot, dependencies(snapshot))).toEqual([]);
  });

  it('blocks amount-only legacy invoices, mapping gaps, and line total mismatch', () => {
    expect(validateBillSnapshot(bill({ lines: [] }), {})).toEqual(expect.arrayContaining([
      expect.stringContaining('alokasi quantity'),
      expect.stringContaining('Jumlah total baris'),
      expect.stringContaining('Supplier SUP-001'),
      expect.stringContaining('Purchase Order PO/2026/001'),
      expect.stringContaining('Cabang HQ'),
    ]));

    const mismatched = bill({
      lines: [{ ...bill().lines[0], lineTotal: '1999999.00' }],
    });
    expect(validateBillSnapshot(mismatched, dependencies(mismatched))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('quantity x harga'),
        expect.stringContaining('Jumlah total baris'),
      ]),
    );
  });

  it('never sends Goods Receipt, batch, expiry, FIFO, payment, or clinical data', () => {
    const snapshot = bill();
    const serialized = JSON.stringify(buildZohoBillPayload(snapshot, dependencies(snapshot)));
    expect(serialized).not.toMatch(
      /goods_receipt|batch|expiry|fifo|stock_mutation|vendor_payment|diagnosis|therapy/i,
    );
  });

  it('reconciles total, lines, reference, and Purchase Order link', () => {
    const snapshot = bill();
    expect(reconcileBill(snapshot, {
      bill_id: 'zoho-bill-1',
      reference_number: snapshot.invoiceNumber,
      total: 2000000,
      balance: 2000000,
      line_items: [{ purchaseorder_item_id: 'zoho-po-line-1', quantity: 4, rate: 500000 }],
      purchaseorders: [{
        purchaseorder_id: 'zoho-po-1',
        purchaseorder_number: snapshot.poNumber,
      }],
    })).toEqual({ status: 'MATCHED', differences: [] });

    expect(reconcileBill(snapshot, {
      bill_id: 'zoho-bill-1',
      reference_number: 'OTHER',
      total: 1900000,
      line_items: [],
      purchaseorders: [{ purchaseorder_number: 'OTHER-PO' }],
    }).status).toBe('MISMATCH');
    expect(reconcileBill(snapshot).status).toBe('MISSING');
  });

  it('declares the event and required Zoho Bill scopes', () => {
    expect(SUPPLIER_INVOICE_POSTED_EVENT).toBe('SUPPLIER_INVOICE_POSTED');
    expect(ZOHO_SCOPE_VERSION).toBe(12);
    expect(ZOHO_REQUIRED_SCOPES).toEqual(expect.arrayContaining([
      'ZohoBooks.bills.READ',
      'ZohoBooks.bills.CREATE',
      'ZohoBooks.bills.UPDATE',
    ]));
  });
});
