import { Prisma } from '@prisma/client';
import {
  buildLogisticsReportRange,
  createDailyTrend,
  decimalSum,
  reportDateKey,
  signedMutationQuantity,
} from '../logistics-report.helpers';

describe('Sprint 10 logistics report helpers', () => {
  it('builds a 30-day Jakarta reporting window by default', () => {
    const range = buildLogisticsReportRange(undefined, undefined, new Date('2026-07-22T10:00:00.000Z'));

    expect(range.startDate).toBe('2026-06-23');
    expect(range.endDate).toBe('2026-07-22');
    expect(range.start.toISOString()).toBe('2026-06-22T17:00:00.000Z');
    expect(range.endExclusive.toISOString()).toBe('2026-07-22T17:00:00.000Z');
    expect(range.days).toBe(30);
  });

  it('rejects an unbounded reporting range', () => {
    expect(() => buildLogisticsReportRange('2025-01-01', '2026-07-22')).toThrow('REPORT_DATE_RANGE_INVALID');
  });

  it('derives mutation direction from ledger before and after balances', () => {
    expect(signedMutationQuantity({ stockBefore: '10', stockAfter: '13.5' }).toFixed(4)).toBe('3.5000');
    expect(signedMutationQuantity({ stockBefore: '13.5', stockAfter: '9' }).toFixed(4)).toBe('-4.5000');
    expect(decimalSum([new Prisma.Decimal('1.25'), '2.75', null]).toFixed(2)).toBe('4.00');
  });

  it('creates stable daily buckets in the report time zone', () => {
    const rows = createDailyTrend('2026-07-20', 3);
    expect(rows.map((row) => row.date)).toEqual(['2026-07-20', '2026-07-21', '2026-07-22']);
    expect(reportDateKey(new Date('2026-07-21T18:00:00.000Z'))).toBe('2026-07-22');
  });
});
