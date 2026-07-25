import { formatCurrency, formatNumberWithDots } from './formatNumber';

describe('formatNumberWithDots', () => {
  it('formats a valid number with Indonesian thousand separators', () => {
    expect(formatNumberWithDots(1000000)).toBe('1.000.000');
  });

  it.each([undefined, null, Number.NaN, Number.POSITIVE_INFINITY])(
    'uses zero when dashboard data is empty or invalid (%s)',
    (value) => {
      expect(formatNumberWithDots(value)).toBe('0');
    }
  );
});

describe('formatCurrency', () => {
  it('does not throw when the API omits an amount', () => {
    expect(formatCurrency(undefined)).toBe('Rp 0');
  });
});
