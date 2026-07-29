import {
  buildRetainerApplicationPayload,
  buildRetainerInvoicePayload,
  buildRetainerPaymentPayload,
  buildTreatmentInvoicePayload,
  buildTreatmentJournalPayload,
} from '../zoho.retainer.policy';
import { ZOHO_REQUIRED_SCOPES, ZOHO_SCOPE_VERSION } from '../zoho.client';

const recognition = {
  recognitionId: 'rec-1',
  memberPackageId: 'pkg-1',
  sourceType: 'BOOSTER' as const,
  productCode: 'BST-NO',
  packagePricingId: 'pricing-1',
  amount: '250000.00',
  sessionOrdinal: 2,
  deferredRevenueAccountCode: '2200',
  revenueAccountCode: '4100',
};

describe('Zoho retainer and treatment revenue policy', () => {
  it('creates a liability retainer document and associates its payment', () => {
    expect(buildRetainerInvoicePayload({
      customerId: 'customer-1',
      locationId: 'location-1',
      referenceNumber: 'RAHO-RET:contract-1',
      date: '2026-07-28',
      packageCode: 'BST-NO',
      totalConsideration: '1000000.00',
    })).toMatchObject({
      customer_id: 'customer-1',
      reference_number: 'RAHO-RET:contract-1',
      location_id: 'location-1',
      line_items: [{ rate: 1000000 }],
    });
    expect(buildRetainerPaymentPayload({
      customerId: 'customer-1',
      retainerInvoiceId: 'retainer-1',
      accountId: 'bank-1',
      paymentMode: 'banktransfer',
      amount: '500000.00',
      date: '2026-07-28',
      referenceNumber: 'RAHO-RETPAY:move-1',
    })).toMatchObject({
      retainerinvoice_id: 'retainer-1',
      invoices: [],
      amount: 500000,
    });
  });

  it('recognizes exactly one package source by document or journal, never both', () => {
    expect(buildTreatmentInvoicePayload({
      customerId: 'customer-1',
      itemId: 'item-booster',
      referenceNumber: 'RAHO-SESSION:session-1',
      date: '2026-07-28',
      sessionCode: 'TRX-1',
      recognition,
    }).line_items).toEqual([expect.objectContaining({
      item_id: 'item-booster',
      rate: 250000,
    })]);
    expect(buildRetainerApplicationPayload('invoice-1', recognition.amount, '2026-07-28'))
      .toEqual({ invoice_payments: [{ invoice_id: 'invoice-1', amount_applied: 250000, apply_date: '2026-07-28' }] });
    expect(buildTreatmentJournalPayload({
      referenceNumber: 'RAHO-SESSION:session-1',
      date: '2026-07-28',
      deferredAccountId: 'deferred-1',
      revenueAccountId: 'revenue-1',
      sessionCode: 'TRX-1',
      amount: recognition.amount,
    }).line_items).toEqual([
      expect.objectContaining({ account_id: 'deferred-1', debit_or_credit: 'debit', amount: 250000 }),
      expect.objectContaining({ account_id: 'revenue-1', debit_or_credit: 'credit', amount: 250000 }),
    ]);
    expect(ZOHO_SCOPE_VERSION).toBe(12);
    expect(ZOHO_REQUIRED_SCOPES).toEqual(expect.arrayContaining([
      'ZohoBooks.invoices.CREATE',
      'ZohoBooks.invoices.DELETE',
      'ZohoBooks.customerpayments.CREATE',
      'ZohoBooks.accountants.CREATE',
      'ZohoBooks.accountants.UPDATE',
    ]));
  });
});
