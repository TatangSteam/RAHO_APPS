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
});
