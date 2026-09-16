import { resolvePeriod, overdueDays, jakartaTimestamp } from '../ai.period';
import { chatBody, compareQuery, overdueQuery, performanceQuery, tasksQuery, todayQuery } from '../ai.schema';

const now = new Date('2026-09-16T07:30:00Z');
describe('RAIN period and query contract', () => {
  it.each([
    ['today', '2026-09-16', '2026-09-16', 1, true],
    ['yesterday', '2026-09-15', '2026-09-15', 1, false],
    ['this_week', '2026-09-14', '2026-09-16', 3, true],
    ['last_week', '2026-09-07', '2026-09-13', 7, false],
    ['this_month', '2026-09-01', '2026-09-16', 16, true],
    ['last_month', '2026-08-01', '2026-08-31', 31, false],
  ] as const)('resolves %s in Jakarta', (period, startDate, endDate, days, toDate) => {
    expect(resolvePeriod({ period }, now).period).toMatchObject({ startDate, endDate, days, toDate, timezone: 'Asia/Jakarta' });
  });
  it('uses Jakarta midnight and an exclusive next-day boundary', () => {
    const range = resolvePeriod({ period: 'today' }, new Date('2026-09-15T17:00:00Z'));
    expect(range.start.toISOString()).toBe('2026-09-15T17:00:00.000Z');
    expect(range.endExclusive.toISOString()).toBe('2026-09-16T17:00:00.000Z');
    expect(jakartaTimestamp(now)).toBe('2026-09-16T14:30:00.000+07:00');
  });
  it('handles Monday and year/month/leap-day transitions', () => {
    expect(resolvePeriod({ period: 'this_week' }, new Date('2026-09-14T01:00:00Z')).period.days).toBe(1);
    expect(resolvePeriod({ period: 'last_month' }, new Date('2026-01-01T01:00:00Z')).period.startDate).toBe('2025-12-01');
    expect(resolvePeriod({ period: 'last_month' }, new Date('2024-03-01T01:00:00Z')).period.endDate).toBe('2024-02-29');
  });
  it('counts calendar overdue days rather than elapsed 24-hour intervals', () => {
    expect(overdueDays(new Date('2026-09-15T23:00:00+07:00'), new Date('2026-09-16T01:00:00+07:00'))).toBe(1);
    expect(overdueDays(new Date('2026-09-16T10:00:00+07:00'), now)).toBe(0);
  });
  it('uses exactly 90 calendar dates including today by default for overdue', () => {
    expect(resolvePeriod({}, now, true).period).toMatchObject({ type: 'rolling_90_days', startDate: '2026-06-19', days: 90 });
  });
  it.each([
    { period: 'custom', startDate: '2026-02-30', endDate: '2026-03-01' },
    { period: 'custom', startDate: '2026-09-17', endDate: '2026-09-16' },
    { period: 'custom', startDate: '2025-01-01', endDate: '2026-09-16' },
    { period: 'custom', startDate: '2026-09-01' },
    { period: 'today', startDate: '2026-09-01', endDate: '2026-09-02' },
  ] as const)('rejects invalid/custom-extraneous dates %j', (input) => {
    expect(() => resolvePeriod(input, now)).toThrow(expect.objectContaining({ status: 400, code: 'INVALID_ARGUMENT' }));
  });
  it('accepts the inclusive 366-day maximum', () => {
    expect(resolvePeriod({ period: 'custom', startDate: '2024-01-01', endDate: '2024-12-31' }, now).period.days).toBe(366);
  });
  it('rejects identity/scope override, invalid status, and abusive pagination', () => {
    for (const identity of ['userId', 'role', 'branchId']) {
      expect(performanceQuery.safeParse({ period: 'today', [identity]: 'other' }).success).toBe(false);
      expect(tasksQuery.safeParse({ period: 'today', [identity]: 'other' }).success).toBe(false);
      expect(chatBody.safeParse({ message: 'kinerja hari ini', [identity]: 'other' }).success).toBe(false);
    }
    expect(todayQuery.safeParse({ period: 'today' }).success).toBe(false);
    expect(tasksQuery.safeParse({ period: 'today', status: 'INVALID' }).success).toBe(false);
    expect(tasksQuery.safeParse({ period: 'today', limit: 51 }).success).toBe(false);
    expect(tasksQuery.safeParse({ period: 'today', offset: -1 }).success).toBe(false);
    expect(overdueQuery.safeParse({ status: 'TODO' }).success).toBe(false);
    expect(compareQuery.safeParse({ periodA: 'today' }).success).toBe(false);
    expect(tasksQuery.safeParse({}).success).toBe(false);
  });
});
