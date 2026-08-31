import { buildJakartaSessionDateRange } from '../session-date-range';

describe('session date range', () => {
  it('uses full Jakarta calendar-day boundaries for list and export filters', () => {
    expect(buildJakartaSessionDateRange('2026-08-01', '2026-08-07')).toEqual({
      gte: new Date('2026-08-01T00:00:00.000+07:00'),
      lte: new Date('2026-08-07T23:59:59.999+07:00'),
    });
  });
});
