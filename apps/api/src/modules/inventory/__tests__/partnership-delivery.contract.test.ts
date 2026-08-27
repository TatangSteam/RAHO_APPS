import { readFileSync } from 'fs';
import { resolve } from 'path';

const inventoryRoot = resolve(__dirname, '..');

describe('Partnership delivery confirmation contract', () => {
  it('closes delivery without posting destination inventory', () => {
    const ledger = readFileSync(resolve(inventoryRoot, 'services/shipment-ledger.service.ts'), 'utf8');
    const routes = readFileSync(resolve(inventoryRoot, 'inventory.routes.ts'), 'utf8');
    const service = readFileSync(resolve(inventoryRoot, 'shipment.service.ts'), 'utf8');

    expect(routes).toContain("'/shipments/:shipmentId/confirm-delivery'");
    expect(service).toContain('confirmPartnershipDelivery');
    expect(ledger).toContain('inventoryUpdated: false');
    expect(ledger).toContain('Partnership stock is external to company inventory');

    const confirmationStart = ledger.indexOf('export async function confirmPartnershipDelivery');
    const confirmationBody = ledger.slice(confirmationStart);
    expect(confirmationBody).not.toContain('InventoryPostingType.TRANSFER_IN');
    expect(confirmationBody).not.toContain('resolveDestinationInventory');
  });
});
