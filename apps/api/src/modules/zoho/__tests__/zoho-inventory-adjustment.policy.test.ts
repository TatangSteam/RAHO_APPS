import {
  assertInventoryOutboundPrivacy,
  InventorySyncSnapshot,
} from '../zoho.inventory-adjustment.policy';
import { ZOHO_REQUIRED_SCOPES, ZOHO_SCOPE_VERSION } from '../zoho.client';

const snapshot: InventorySyncSnapshot = {
  eventVersion: 1,
  sourceType: 'TREATMENT_COMPLETION',
  localEntityId: 'session-1',
  externalKey: 'RAHO-TREATMENT-TRX-001',
  branchId: 'branch-1',
  occurredAt: '2026-07-29T08:00:00.000Z',
  postingReference: 'POST-001',
  reason: 'Treatment material consumption',
  lines: [{
    inventoryItemId: 'inventory-item-1',
    sku: 'INFUS-001',
    stockLocationId: 'location-1',
    quantityAdjusted: '-2.0000',
    unitRate: '12500.0000',
    value: '-25000.0000',
  }],
};

describe('Sprint 13 Zoho inventory adjustment policy', () => {
  it('menggunakan kontrak OAuth Zoho Books-only tanpa scope Zoho Inventory', () => {
    expect(ZOHO_SCOPE_VERSION).toBe(12);
    expect(ZOHO_REQUIRED_SCOPES.length).toBeGreaterThan(0);
    expect(ZOHO_REQUIRED_SCOPES.every((scope) => scope.startsWith('ZohoBooks.'))).toBe(true);
    expect(ZOHO_REQUIRED_SCOPES.some((scope) => scope.startsWith('ZohoInventory.'))).toBe(false);
  });

  it('ADJ-U05 menolak field klinis walaupun bersarang', () => {
    expect(() => assertInventoryOutboundPrivacy({
      ...snapshot,
      hidden: { diagnosis: 'forbidden' },
    })).toThrow('ZOHO_INVENTORY_PRIVACY_VIOLATION');
  });

  it('ADJ-U05 menerima snapshot ERP yang hanya berisi data logistik', () => {
    expect(() => assertInventoryOutboundPrivacy(snapshot)).not.toThrow();
    expect(JSON.stringify(snapshot)).not.toMatch(/patient|member|diagnosis|complaint|doctor|lab|photo/i);
  });
});
