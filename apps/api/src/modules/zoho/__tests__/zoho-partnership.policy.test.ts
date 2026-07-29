import {
  buildPartnershipCustomerPaymentPayload,
  buildPartnershipPaymentApplicationPayload,
  buildPartnershipSalesInvoicePayload,
  PartnershipGoodsShippedSnapshot,
  PartnershipPaymentSnapshot,
  reconcilePartnershipInvoice,
  validatePartnershipShipmentSnapshot,
} from '../zoho.partnership.policy';

function shipment(
  overrides: Partial<PartnershipGoodsShippedSnapshot> = {},
): PartnershipGoodsShippedSnapshot {
  return {
    sourceBranchId: 'hq-1',
    partnershipBranchId: 'partner-1',
    stockRequestId: 'request-1',
    stockRequestInvoiceId: 'stock-invoice-1',
    shipmentCode: 'SHP-001',
    invoiceNumber: 'INV-PARTNER-001',
    revenueAmount: '5000000.00',
    costAmount: '3000000.0000',
    grossProfit: '2000000.0000',
    items: [{
      masterProductId: 'product-1',
      sku: 'VIT-C',
      productName: 'Vitamin C',
      quantity: '10.0000',
      unitPrice: '500000.00',
      unitCost: '300000.0000',
      totalCost: '3000000.0000',
    }],
    ...overrides,
  };
}

const dependencies = {
  customerId: 'zoho-partner-customer',
  sourceLocationId: 'zoho-hq-location',
  itemIds: { 'MASTER_PRODUCT:product-1': 'zoho-item-vit-c' },
};

describe('Zoho Sprint 9 Partnership sale policy', () => {
  it('builds the goods invoice from immutable shipment values and HQ location', () => {
    const source = shipment();
    const payload = buildPartnershipSalesInvoicePayload({
      shipmentId: 'shipment-1',
      shippedAt: new Date('2026-07-29T08:00:00.000Z'),
      snapshot: source,
      dependencies,
    });
    expect(payload).toMatchObject({
      customer_id: 'zoho-partner-customer',
      invoice_number: source.invoiceNumber,
      reference_number: source.shipmentCode,
      date: '2026-07-29',
      location_id: 'zoho-hq-location',
      line_items: [{
        item_id: 'zoho-item-vit-c',
        quantity: 10,
        rate: 500000,
        location_id: 'zoho-hq-location',
      }],
    });
    expect(validatePartnershipShipmentSnapshot(source, dependencies)).toEqual([]);
  });

  it('blocks total, FIFO, mapping, customer, and source-location mismatches', () => {
    const source = shipment({
      revenueAmount: '5000001.00',
      costAmount: '2999999.0000',
      grossProfit: '1.00',
    });
    const issues = validatePartnershipShipmentSnapshot(source, { itemIds: {} });
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining('Total harga item'),
      expect.stringContaining('Total FIFO'),
      expect.stringContaining('laba kotor'),
      expect.stringContaining('Customer Zoho'),
      expect.stringContaining('Location Zoho'),
      expect.stringContaining('Item VIT-C'),
    ]));
  });

  it('does not send treatment, clinical, proof, batch, or expiry data', () => {
    const serialized = JSON.stringify(buildPartnershipSalesInvoicePayload({
      shipmentId: 'shipment-1',
      shippedAt: new Date(),
      snapshot: shipment(),
      dependencies,
    }));
    expect(serialized).not.toMatch(
      /treatment|diagnosis|medical_record|therapy_plan|payment_proof|batch|expiry/i,
    );
  });

  it('creates an unapplied customer advance before the invoice exists', () => {
    const payment: PartnershipPaymentSnapshot = {
      localEntityId: 'stock-invoice-1',
      partnershipBranchId: 'partner-1',
      stockRequestId: 'request-1',
      stockRequestInvoiceId: 'stock-invoice-1',
      invoiceNumber: 'INV-PARTNER-001',
      amount: '5000000.00',
      paymentDate: '2026-07-28',
      referenceNumber: 'RAHO-PARTNER-ADV:stock-invoice-1',
      paymentAccountNumber: '123456',
    };
    expect(buildPartnershipCustomerPaymentPayload(payment, {
      customerId: 'customer',
      accountId: 'bank',
      paymentMode: 'banktransfer',
    })).toMatchObject({
      amount: 5000000,
      account_id: 'bank',
      invoices: [],
    });
    expect(buildPartnershipPaymentApplicationPayload('payment-1', payment.amount))
      .toEqual({
        invoice_payments: [{ payment_id: 'payment-1', amount_applied: 5000000 }],
        apply_creditnotes: [],
      });
  });

  it('reconciles revenue and line count without inventing a second HPP journal', () => {
    expect(reconcilePartnershipInvoice(shipment(), {
      invoice_id: 'zoho-invoice-1',
      total: 5000000,
      line_items: [{ item_id: 'zoho-item-vit-c', quantity: 10, rate: 500000 }],
    })).toEqual({ status: 'MATCHED', differences: [] });
    expect(reconcilePartnershipInvoice(shipment(), {
      invoice_id: 'zoho-invoice-1',
      total: 4999999,
      line_items: [],
    }).status).toBe('MISMATCH');
    expect(reconcilePartnershipInvoice(shipment()).status).toBe('MISSING');
  });
});
