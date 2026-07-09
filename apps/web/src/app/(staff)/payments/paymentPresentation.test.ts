import {
  calculateTotal,
  filterInvoices,
  getPaymentStatus,
  hasInvalidInvoiceItem,
  matchingProducts,
  parseInvoiceItemForms,
  remainingAmount,
  type Invoice,
} from './paymentPresentation';

const invoices: Invoice[] = [
  {
    id: 'INV-001',
    memberName: 'Ayu Lestari',
    items: [{ productName: 'IFA 250', quantity: 30, unitPrice: 10000, discount: 0 }],
    status: 'Menunggu Pembayaran',
    total: 300000,
    paidAmount: 0,
    paymentMethods: [],
    references: [],
    refundAmount: 0,
    createdAt: '2026-06-30',
  },
  {
    id: 'INV-002',
    memberName: 'Budi Santoso',
    items: [{ productName: 'Vitamin C', quantity: 2, unitPrice: 5000, discount: 1000 }],
    status: 'Lunas',
    total: 9000,
    paidAmount: 9000,
    paymentMethods: ['Transfer'],
    references: ['TRX-1'],
    refundAmount: 0,
    createdAt: '2026-07-01',
  },
];

describe('paymentPresentation', () => {
  it('calculates invoice total and remaining amount', () => {
    expect(
      calculateTotal([
        { productName: 'IFA 250', quantity: 30, unitPrice: 10000, discount: 50000 },
        { productName: 'Vitamin C', quantity: 10, unitPrice: 5000, discount: 0 },
      ])
    ).toBe(300000);

    expect(remainingAmount({ ...invoices[0], paidAmount: 100000, refundAmount: 50000 })).toBe(150000);
  });

  it('filters invoices by search, status, method, and date range', () => {
    expect(
      filterInvoices(invoices, {
        search: 'budi',
        statusFilter: 'Lunas',
        methodFilter: 'Transfer',
        startDate: '2026-07-01',
        endDate: '2026-07-02',
      })
    ).toEqual([invoices[1]]);
  });

  it('matches product suggestions case-insensitively', () => {
    expect(matchingProducts('vit')).toEqual([{ name: 'Vitamin C', price: 5000 }]);
    expect(matchingProducts('')).toHaveLength(4);
  });

  it('parses and validates invoice item forms', () => {
    const parsed = parseInvoiceItemForms([
      { productName: ' IFA 250 ', quantity: '30', unitPrice: '10000', discount: '' },
    ]);

    expect(parsed).toEqual([{ productName: 'IFA 250', quantity: 30, unitPrice: 10000, discount: 0 }]);
    expect(hasInvalidInvoiceItem(parsed)).toBe(false);
    expect(hasInvalidInvoiceItem([{ ...parsed[0], quantity: 0 }])).toBe(true);
  });

  it('returns partial or paid payment status', () => {
    expect(getPaymentStatus(300000, 150000)).toBe('Partial');
    expect(getPaymentStatus(300000, 300000)).toBe('Lunas');
  });
});
