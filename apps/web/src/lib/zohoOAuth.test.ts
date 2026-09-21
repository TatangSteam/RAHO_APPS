import { finishZohoOAuth } from './zohoOAuth';

describe('Zoho OAuth return handling', () => {
  function handlers() {
    return {
      result: 'success', message: null,
      refreshStatus: jest.fn().mockResolvedValue({ connected: true }),
      setup: jest.fn().mockResolvedValue(undefined),
      feedback: jest.fn(), errorMessage: () => 'Status tidak dapat dimuat.',
    };
  }
  it('loads connection status before setup and confirms success afterward', async () => {
    const options = handlers();
    expect(await finishZohoOAuth(options)).toBe(true);
    expect(options.refreshStatus.mock.invocationCallOrder[0]).toBeLessThan(options.setup.mock.invocationCallOrder[0]);
    expect(options.refreshStatus).toHaveBeenCalledTimes(2);
    expect(options.feedback).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'success' }));
  });
  it('retains a readable callback error without running setup', async () => {
    const options = { ...handlers(), result: 'error', message: 'Sesi koneksi kedaluwarsa.' };
    expect(await finishZohoOAuth(options)).toBe(false);
    expect(options.feedback).toHaveBeenCalledWith({ type: 'error', message: options.message });
    expect(options.setup).not.toHaveBeenCalled();
  });
  it('does not claim success or run setup when no active connection was saved', async () => {
    const options = handlers();
    options.refreshStatus.mockResolvedValue({ connected: false });
    expect(await finishZohoOAuth(options)).toBe(false);
    expect(options.setup).not.toHaveBeenCalled();
    expect(options.feedback).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'error' }));
  });
  it('keeps OAuth connected when only automatic setup fails', async () => {
    const options = handlers();
    options.setup.mockRejectedValue(new Error('timeout'));
    expect(await finishZohoOAuth(options)).toBe(true);
    expect(options.feedback).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'warning' }));
  });
  it('shows a status retrieval error and allows a retry', async () => {
    const options = handlers();
    options.refreshStatus.mockRejectedValue(new Error('network'));
    expect(await finishZohoOAuth(options)).toBe(false);
    expect(options.setup).not.toHaveBeenCalled();
    expect(options.feedback).toHaveBeenCalledWith({ type: 'error', message: 'Status tidak dapat dimuat.' });
  });
});
