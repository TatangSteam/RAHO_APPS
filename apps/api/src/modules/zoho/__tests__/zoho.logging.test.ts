import { logger } from '@lib/logger';
import { AppError } from '@middleware/errorHandler';
import {
  logZohoErrorThrottled,
  resetZohoLogThrottleForTests,
} from '../zoho.logging';

describe('Zoho console logging', () => {
  const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);

  beforeEach(() => {
    resetZohoLogThrottleForTests();
    errorSpy.mockClear();
    jest.useFakeTimers().setSystemTime(new Date('2026-08-06T00:00:00.000Z'));
  });

  afterAll(() => {
    errorSpy.mockRestore();
    jest.useRealTimers();
  });

  it('tidak menulis error ketika Zoho Books belum terhubung', () => {
    logZohoErrorThrottled(
      'master-enqueue:MASTER_PRODUCT',
      'Gagal enqueue',
      new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.'),
    );

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('menekan error berulang dan melaporkan jumlah duplikat setelah jendela waktu', () => {
    const error = new Error('database unavailable');

    logZohoErrorThrottled('worker-cycle', 'Zoho worker cycle failed', error);
    logZohoErrorThrottled('worker-cycle', 'Zoho worker cycle failed', error);
    logZohoErrorThrottled('worker-cycle', 'Zoho worker cycle failed', error);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60_001);
    logZohoErrorThrottled('worker-cycle', 'Zoho worker cycle failed', error);

    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenLastCalledWith(
      'Zoho worker cycle failed',
      expect.objectContaining({ suppressedDuplicates: 2 }),
    );
  });

  it('memisahkan throttle berdasarkan jenis operasi', () => {
    const error = new Error('temporary failure');

    logZohoErrorThrottled('worker-cycle', 'Worker gagal', error);
    logZohoErrorThrottled('reconciliation-scheduler', 'Rekonsiliasi gagal', error);

    expect(errorSpy).toHaveBeenCalledTimes(2);
  });
});
