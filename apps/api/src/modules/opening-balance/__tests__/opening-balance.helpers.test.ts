import { calculateOpeningTotals, hasExactCurrencyPrecision, isBalancedOpening, openingInventoryValue } from '../opening-balance.helpers';

describe('opening balance helpers', () => {
  it('menghitung total dengan Decimal tanpa floating point drift', () => {
    const totals = calculateOpeningTotals([
      { debit: '0.10', credit: '0' },
      { debit: '0.20', credit: '0' },
      { debit: '0', credit: '0.30' },
    ]);
    expect(totals.debit.toFixed(2)).toBe('0.30');
    expect(totals.credit.toFixed(2)).toBe('0.30');
    expect(isBalancedOpening([{ debit: '0.30', credit: '0' }, { debit: '0', credit: '0.30' }])).toBe(true);
  });

  it('menetapkan nilai opening stock dari quantity kali unit cost', () => {
    const exactValue = openingInventoryValue('3.2500', '12500.4000');
    expect(exactValue.toFixed(2)).toBe('40626.30');
    expect(hasExactCurrencyPrecision(exactValue)).toBe(true);
    expect(hasExactCurrencyPrecision(openingInventoryValue('3.2500', '12500.5000'))).toBe(false);
  });
});
