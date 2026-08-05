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
const basicRecognition = {
  ...recognition,
  recognitionId: 'rec-basic',
  memberPackageId: 'pkg-basic',
  sourceType: 'BASIC' as const,
  productCode: 'BSC-01',
  packagePricingId: 'pricing-basic',
  amount: '500000.00',
  sessionOrdinal: 1,
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

  it('recognizes Basic plus optional Booster as invoice lines or journal pairs', () => {
    expect(buildTreatmentInvoicePayload({
      customerId: 'customer-1',
      referenceNumber: 'RAHO-SESSION:session-1',
      date: '2026-07-28',
      sessionCode: 'TRX-1',
      lines: [
        { itemId: 'item-basic', recognition: basicRecognition },
        { itemId: 'item-booster', recognition },
      ],
    }).line_items).toEqual([
      expect.objectContaining({ item_id: 'item-basic', rate: 500000 }),
      expect.objectContaining({ item_id: 'item-booster', rate: 250000 }),
    ]);
    expect(buildRetainerApplicationPayload('invoice-1', recognition.amount, '2026-07-28'))
      .toEqual({ invoice_payments: [{ invoice_id: 'invoice-1', amount_applied: 250000, apply_date: '2026-07-28' }] });
    expect(buildTreatmentJournalPayload({
      referenceNumber: 'RAHO-SESSION:session-1',
      date: '2026-07-28',
      sessionCode: 'TRX-1',
      lines: [
        { deferredAccountId: 'deferred-basic', revenueAccountId: 'revenue-basic', recognition: basicRecognition },
        { deferredAccountId: 'deferred-booster', revenueAccountId: 'revenue-booster', recognition },
      ],
    }).line_items).toEqual([
      expect.objectContaining({ account_id: 'deferred-basic', debit_or_credit: 'debit', amount: 500000 }),
      expect.objectContaining({ account_id: 'revenue-basic', debit_or_credit: 'credit', amount: 500000 }),
      expect.objectContaining({ account_id: 'deferred-booster', debit_or_credit: 'debit', amount: 250000 }),
      expect.objectContaining({ account_id: 'revenue-booster', debit_or_credit: 'credit', amount: 250000 }),
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
