import { Prisma } from '@prisma/client';
import { allocateConsideration, calculatePerSessionRevenue, revenueForOrdinal, treatmentCompletedEventPayload } from '../revenue.helpers';

describe('Sprint 7 benefit valuation and revenue per session', () => {
  it('mengalokasikan consideration berdasarkan relative standalone benefit value tanpa selisih rounding', () => {
    const result = allocateConsideration('900.00', [
      { key: 'BASIC', standaloneValue: '600.00' },
      { key: 'BOOSTER', standaloneValue: '400.00' },
    ]);
    expect(result.map((row) => row.amount.toFixed(2))).toEqual(['540.00', '360.00']);
    expect(result.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0)).toFixed(2)).toBe('900.00');
  });

  it('menempatkan sisa pembulatan pada sesi terakhir', () => {
    const schedule = calculatePerSessionRevenue('100.00', 6);
    expect(schedule.regularSessionRevenue.toFixed(2)).toBe('16.66');
    expect(schedule.finalSessionRevenue.toFixed(2)).toBe('16.70');
    const total = schedule.regularSessionRevenue.mul(5).add(schedule.finalSessionRevenue);
    expect(total.toFixed(2)).toBe('100.00');
    expect(revenueForOrdinal(schedule.regularSessionRevenue, schedule.finalSessionRevenue, 6, 6).toFixed(2)).toBe('16.70');
  });

  it('menghasilkan payload event yang deterministik', () => {
    const input = { sessionId: 's1', sessionCode: 'SES-1', branchId: 'b1', memberId: 'm1', treatmentDate: new Date('2026-07-22T01:00:00Z'), completedAt: new Date('2026-07-22T02:00:00Z'), packageIds: ['p2', 'p1', 'p1'] };
    const first = treatmentCompletedEventPayload(input);
    const second = treatmentCompletedEventPayload(input);
    expect(first).toEqual(second);
    expect(first.payload.eventType).toBe('TREATMENT_COMPLETED');
    expect(first.payload.packageIds).toEqual(['p1', 'p2']);
  });
});
