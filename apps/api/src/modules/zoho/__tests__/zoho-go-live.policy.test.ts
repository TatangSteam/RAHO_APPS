import {
  canBootstrapCanaryFromDryRun,
  jakartaBusinessDayWindow,
} from '../zoho.go-live.service';

describe('Zoho go-live defensive policy', () => {
  it('menggunakan batas tanggal Asia/Jakarta', () => {
    const beforeMidnight = jakartaBusinessDayWindow(new Date('2026-07-29T16:59:59.000Z'));
    const afterMidnight = jakartaBusinessDayWindow(new Date('2026-07-29T17:00:00.000Z'));

    expect(beforeMidnight.start.toISOString()).toBe('2026-07-28T17:00:00.000Z');
    expect(afterMidnight.start.toISOString()).toBe('2026-07-29T17:00:00.000Z');
  });

  it('menolak Sabtu dan Minggu sebagai hari observasi canary', () => {
    expect(jakartaBusinessDayWindow(new Date('2026-08-01T03:00:00.000Z')).isBusinessDay).toBe(false);
    expect(jakartaBusinessDayWindow(new Date('2026-08-02T03:00:00.000Z')).isBusinessDay).toBe(false);
    expect(jakartaBusinessDayWindow(new Date('2026-08-03T03:00:00.000Z')).isBusinessDay).toBe(true);
  });

  it('mengizinkan bootstrap CANARY dari rehearsal, tetapi tidak melonggarkan LIVE', () => {
    expect(canBootstrapCanaryFromDryRun('CANARY', 0, 1)).toBe(true);
    expect(canBootstrapCanaryFromDryRun('CANARY', 0, 0)).toBe(false);
    expect(canBootstrapCanaryFromDryRun('LIVE', 0, 10)).toBe(false);
  });
});
