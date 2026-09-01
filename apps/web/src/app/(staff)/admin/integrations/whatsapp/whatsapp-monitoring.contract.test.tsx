import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('WhatsApp delivery monitoring contract', () => {
  it('shows safe delivery status and retry controls to super admin', () => {
    const page = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');
    expect(page).toContain("user?.role !== 'SUPER_ADMIN'");
    expect(page).toContain("'/integrations/whatsapp/deliveries'");
    expect(page).toContain('recipientMasked');
    expect(page).toContain('canRetry');
    expect(page).toContain("/integrations/whatsapp/deliveries/${delivery.id}/retry");
    expect(page).not.toContain('recipientEncrypted');
    expect(page).not.toContain('payloadEncrypted');
  });

  it('guides super admin from server readiness through pairing and delivery readiness', () => {
    const page = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');
    expect(page).toContain('Alur Setup Super Admin');
    expect(page).toContain('Kesiapan sistem');
    expect(page).toContain('Pindai QR pengirim');
    expect(page).toContain('Verifikasi koneksi');
    expect(page).toContain('Siap mengirim');
    expect(page).toContain('WHATSAPP_ENABLED');
    expect(page).toContain('WHATSAPP_WORKER_ENABLED');
    expect(page).toContain('window.setInterval');
    expect(page).toContain('QR dan status diperbarui otomatis setiap 3 detik.');
    expect(page).toContain('QRCodeSVG');
    expect(page).not.toContain('connection/pair');
    expect(page).toContain("'/integrations/whatsapp/connection/qr'");
    expect(page).toContain('Buat ulang QR');
  });
});
