import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Partnership shipment delivery confirmation', () => {
  it('uses the Partnership endpoint and explains that company inventory is unchanged', () => {
    const page = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');
    const modal = readFileSync(resolve(__dirname, 'components/ReceiveModal.tsx'), 'utf8');
    const api = readFileSync(resolve(__dirname, '../../../../lib/api/inventoryApi.ts'), 'utf8');

    expect(page).toContain('confirmPartnershipDelivery');
    expect(page).toContain('Konfirmasi Delivery');
    expect(api).toContain('/confirm-delivery');
    expect(modal).toContain('Barang tidak akan ditambahkan ke inventory utama');
  });
});
