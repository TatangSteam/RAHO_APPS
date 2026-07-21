import { Prisma } from '@prisma/client';
import { buildPurchasingJournal, exactCurrency, purchaseOrderStatus, supplierInvoiceStatus } from '../purchasing.helpers';

describe('AC-003 purchasing and AP accounting policy', () => {
  it.each([
    ['GOODS_RECEIPT', ['1300', '2110']],
    ['SUPPLIER_INVOICE', ['2110', '2100']],
    ['SUPPLIER_PAYMENT', ['2100', '1101']],
  ] as const)('membentuk jurnal %s yang balanced', (source, accounts) => {
    const lines = buildPurchasingJournal(source, '125000.00', source === 'SUPPLIER_PAYMENT' ? '1101' : undefined);
    expect(lines.map((line) => line.accountCode)).toEqual(accounts);
    const debit = lines.reduce((sum, line) => sum.add(line.debit || 0), new Prisma.Decimal(0));
    const credit = lines.reduce((sum, line) => sum.add(line.credit || 0), new Prisma.Decimal(0));
    expect(debit.equals(credit)).toBe(true);
  });

  it('mendukung partial receipt serta partial/full supplier payment', () => {
    expect(purchaseOrderStatus(new Prisma.Decimal(10), new Prisma.Decimal(0))).toBe('ISSUED');
    expect(purchaseOrderStatus(new Prisma.Decimal(10), new Prisma.Decimal(4))).toBe('PARTIALLY_RECEIVED');
    expect(purchaseOrderStatus(new Prisma.Decimal(10), new Prisma.Decimal(10))).toBe('RECEIVED');
    expect(supplierInvoiceStatus(new Prisma.Decimal(600), new Prisma.Decimal(400))).toBe('PARTIALLY_PAID');
    expect(supplierInvoiceStatus(new Prisma.Decimal(0), new Prisma.Decimal(1000))).toBe('PAID');
  });

  it('menolak nilai PO/receipt yang tidak representable dalam dua desimal', () => {
    expect(() => exactCurrency(new Prisma.Decimal('1.001'), 'Nilai')).toThrow();
    expect(exactCurrency(new Prisma.Decimal('1.00'), 'Nilai').toFixed(2)).toBe('1.00');
  });
});
