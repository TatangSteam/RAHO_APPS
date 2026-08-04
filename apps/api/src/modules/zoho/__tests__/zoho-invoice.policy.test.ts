import {
  buildZohoInvoicePayload,
  invoiceTaxMappingKey,
  validateRecoveredInvoice,
  validateInvoiceSnapshot,
  ZohoInvoiceSnapshot,
} from '../zoho.invoice.policy';
import { ZOHO_REQUIRED_SCOPES, ZOHO_SCOPE_VERSION } from '../zoho.client';

function snapshot(overrides: Partial<ZohoInvoiceSnapshot> = {}): ZohoInvoiceSnapshot {
  return {
    localEntityId: 'invoice-1',
    externalKey: 'RAHO:INVOICE:invoice-1',
    invoiceNumber: '00001-HQ-07-2026',
    branchId: 'branch-1',
    branchType: 'PUSAT',
    memberId: 'member-1',
    date: '2026-07-28',
    dueDate: '2026-08-04',
    currency: 'IDR',
    classification: 'NORMAL_SALE',
    eligible: true,
    excludedReason: null,
    subtotal: '200000.00',
    discountAmount: '10000.00',
    taxPercent: '11',
    taxAmount: '20900.00',
    totalAmount: '210900.00',
    notes: null,
    customer: { memberNo: 'M-001', name: 'Customer UAT', email: 'uat@example.test' },
    branch: { branchCode: 'HQ', name: 'Cabang HQ' },
    lines: [
      {
        id: 'line-1',
        itemType: 'NON_THERAPY',
        itemId: 'purchase-1',
        code: 'SKU-1',
        description: 'Produk 1',
        quantity: 2,
        rate: '100000.00',
        subtotal: '200000.00',
        discountAmount: '0.00',
        totalAmount: '200000.00',
        mappingEntityType: 'MASTER_PRODUCT',
        mappingLocalEntityId: 'product-1',
      },
    ],
    ...overrides,
  };
}

describe('Zoho Sprint 5 invoice policy', () => {
  it('builds exact IDR totals, tax, discount, item, customer, and location payload', () => {
    const source = snapshot();
    const payload = buildZohoInvoicePayload(source, {
      customerId: 'zoho-customer-1',
      locationId: 'zoho-location-1',
      taxId: 'zoho-tax-11',
      itemIds: { 'MASTER_PRODUCT:product-1': 'zoho-item-1' },
    });
    expect(payload).toMatchObject({
      customer_id: 'zoho-customer-1',
      invoice_number: source.invoiceNumber,
      reference_number: source.invoiceNumber,
      discount: 10000,
      discount_type: 'entity_level',
      is_discount_before_tax: true,
      allow_partial_payments: true,
      location_id: 'zoho-location-1',
      line_items: [{
        item_id: 'zoho-item-1',
        quantity: 2,
        rate: 100000,
        tax_id: 'zoho-tax-11',
      }],
    });
    expect(validateInvoiceSnapshot(source, {
      customerId: 'zoho-customer-1',
      locationId: 'zoho-location-1',
      taxId: 'zoho-tax-11',
      itemIds: { 'MASTER_PRODUCT:product-1': 'zoho-item-1' },
    })).toEqual([]);
  });

  it('blocks a missing customer, item, and tax mapping with actionable issues', () => {
    expect(validateInvoiceSnapshot(snapshot(), { itemIds: {} })).toEqual(expect.arrayContaining([
      expect.stringContaining('Customer'),
      expect.stringContaining('Location'),
      expect.stringContaining('Item SKU-1'),
      expect.stringContaining('Pajak 11%'),
    ]));
  });

  it('preserves both line and invoice discounts in the total contract', () => {
    const source = snapshot({
      discountAmount: '5000.00',
      taxPercent: '0',
      taxAmount: '0.00',
      totalAmount: '185000.00',
      lines: [{
        ...snapshot().lines[0],
        discountAmount: '10000.00',
        totalAmount: '190000.00',
      }],
    });
    const dependencies = {
      customerId: 'customer',
      locationId: 'location',
      itemIds: { 'MASTER_PRODUCT:product-1': 'item' },
    };
    expect(validateInvoiceSnapshot(source, dependencies)).toEqual([]);
    expect(buildZohoInvoicePayload(source, dependencies)).toMatchObject({
      discount: 5000,
      line_items: [{ discount_amount: 10000 }],
    });
  });

  it('rejects a mismatched total after two-decimal IDR rounding', () => {
    expect(validateInvoiceSnapshot(snapshot({ totalAmount: '210901.00' }))).toContain(
      'Subtotal, diskon, pajak, dan total invoice tidak seimbang.',
    );
  });

  it('keeps therapy advances and Partnership member invoices out of ordinary sales revenue', () => {
    expect(validateInvoiceSnapshot(snapshot({
      classification: 'THERAPY_ADVANCE',
      eligible: false,
      excludedReason: 'deferred revenue',
    }), {})).toEqual([]);
    expect(validateInvoiceSnapshot(snapshot({
      branchType: 'PARTNERSHIP',
      eligible: false,
      excludedReason: 'shipment revenue only',
    }), {})).toEqual([]);
  });

  it('uses normalized tax keys and the Sprint 5 OAuth scopes', () => {
    expect(invoiceTaxMappingKey('11.0000')).toBe('11');
    expect(ZOHO_SCOPE_VERSION).toBe(12);
    expect(ZOHO_REQUIRED_SCOPES).toEqual(expect.arrayContaining([
      'ZohoBooks.invoices.READ',
      'ZohoBooks.invoices.CREATE',
      'ZohoBooks.invoices.UPDATE',
    ]));
  });

  it('never puts clinical, BOM, batch, expiry, or proof data in the Zoho payload', () => {
    const serialized = JSON.stringify(buildZohoInvoicePayload(snapshot(), {
      customerId: 'customer',
      locationId: 'location',
      taxId: 'tax',
      itemIds: { 'MASTER_PRODUCT:product-1': 'item' },
    }));
    expect(serialized).not.toMatch(/diagnosis|therapy_plan|medical_record|treatment_bom|batch|expiry|payment_proof/i);
  });

  it('recovers an existing invoice only when its critical identity and value match', () => {
    const source = snapshot();
    expect(validateRecoveredInvoice(source, { customerId: 'customer-1' }, {
      invoice_id: 'invoice-z-1',
      reference_number: source.invoiceNumber,
      customer_id: 'customer-1',
      currency_code: 'IDR',
      total: 210_900,
      status: 'sent',
    })).toEqual([]);

    expect(validateRecoveredInvoice(source, { customerId: 'customer-1' }, {
      invoice_id: 'invoice-z-2',
      reference_number: source.invoiceNumber,
      customer_id: 'customer-lain',
      currency_code: 'USD',
      total: 1,
      status: 'void',
    })).toEqual(expect.arrayContaining([
      expect.stringContaining('Customer'),
      expect.stringContaining('Currency'),
      expect.stringContaining('Total'),
      expect.stringContaining('void'),
    ]));
  });
});
