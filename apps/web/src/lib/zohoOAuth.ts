export type ZohoOAuthFeedback = {
  type: 'success' | 'error' | 'warning' | 'pending';
  message: string;
};

/** Refresh the saved connection before setup, which can take longer than OAuth. */
export async function finishZohoOAuth(options: {
  result: string;
  message: string | null;
  refreshStatus: () => Promise<{ connected: boolean }>;
  setup: () => Promise<void>;
  feedback: (value: ZohoOAuthFeedback) => void;
  errorMessage: (error: unknown) => string;
}): Promise<boolean> {
  if (options.result !== 'success') {
    options.feedback({ type: 'error', message: options.message || 'Koneksi Zoho gagal. Klik Hubungkan Zoho untuk mencoba kembali.' });
    await options.refreshStatus().catch(() => undefined);
    return false;
  }
  let status: { connected: boolean };
  try {
    status = await options.refreshStatus();
  } catch (error) {
    options.feedback({ type: 'error', message: options.errorMessage(error) });
    return false;
  }
  if (!status.connected) {
    options.feedback({ type: 'error', message: 'Persetujuan Zoho diterima, tetapi koneksi belum aktif pada database ini. Periksa database aktif dan izin organisasi, lalu klik Hubungkan Zoho untuk mencoba kembali.' });
    return false;
  }
  options.feedback({ type: 'success', message: 'Zoho Books sudah terhubung. Sedang menyiapkan konfigurasi integrasi.' });
  try {
    await options.setup();
    options.feedback({ type: 'success', message: 'Zoho Books sudah terhubung. Konfigurasi otomatis selesai. Klik Tes koneksi untuk memeriksa akses.' });
  } catch {
    options.feedback({ type: 'warning', message: 'Zoho Books sudah terhubung, tetapi penyiapan otomatis belum selesai. Klik Siapkan otomatis untuk melanjutkan; tidak perlu menghubungkan ulang.' });
  }
  await options.refreshStatus().catch(() => undefined);
  return true;
}
