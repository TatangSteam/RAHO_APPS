import {
  assertInventoryOutboundPrivacy,
  buildZohoInventoryAdjustmentPayload,
  InventorySyncSnapshot,
  reconcileInventoryAdjustment,
} from '../zoho.inventory-adjustment.policy';
import { ZOHO_INVENTORY_SCOPES, ZOHO_SCOPE_VERSION } from '../zoho.client';

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

const dependencies = {
  itemIds: new Map([['inventory-item-1', 'zoho-item-1']]),
  locationIds: new Map([['location-1', 'zoho-location-1']]),
};

describe('Sprint 13 Zoho inventory adjustment policy', () => {
  it('meminta scope resmi Zoho Inventory pada kontrak OAuth Sprint 13', () => {
    expect(ZOHO_SCOPE_VERSION).toBe(12);
    expect(ZOHO_INVENTORY_SCOPES).toEqual(expect.arrayContaining([
      'ZohoInventory.inventoryadjustments.READ',
      'ZohoInventory.inventoryadjustments.CREATE',
    ]));
  });

  it('ADJ-U05 hanya membentuk payload inventory yang diizinkan', () => {
    const payload = buildZohoInventoryAdjustmentPayload(snapshot, dependencies);
    expect(payload).toEqual(expect.objectContaining({
      reference_number: snapshot.externalKey,
      adjustment_type: 'quantity',
      line_items: [{
        item_id: 'zoho-item-1',
        location_id: 'zoho-location-1',
        quantity_adjusted: -2,
      }],
    }));
    expect(JSON.stringify(payload)).not.toMatch(/patient|member|diagnosis|complaint|doctor|lab|photo/i);
  });

  it('ADJ-U05 menolak field klinis walaupun bersarang', () => {
    expect(() => assertInventoryOutboundPrivacy({
      ...snapshot,
      hidden: { diagnosis: 'forbidden' },
    })).toThrow('ZOHO_INVENTORY_PRIVACY_VIOLATION');
  });

  it('ADJ-C02 reversal membalik quantity dan tetap dapat direkonsiliasi', () => {
    const reversal = {
      ...snapshot,
      sourceType: 'TREATMENT_CANCELLATION' as const,
      quantity: undefined,
      lines: snapshot.lines.map((line) => ({ ...line, quantityAdjusted: '2.0000', value: '25000.0000' })),
    };
    expect(buildZohoInventoryAdjustmentPayload(reversal, dependencies).line_items[0].quantity_adjusted).toBe(2);
    expect(reconcileInventoryAdjustment(reversal, {
      reference_number: reversal.externalKey,
      total: 25000,
      line_items: [{ quantity_adjusted: 2, item_total: 25000 }],
    })).toEqual(expect.objectContaining({
      referenceMatched: true,
      quantityMatched: true,
      valueMatched: true,
    }));
  });

  it('ADJ-C01 mendeteksi selisih quantity/value', () => {
    expect(reconcileInventoryAdjustment(snapshot, {
      reference_number: snapshot.externalKey,
      total: 12000,
      line_items: [{ quantity_adjusted: -1, item_total: -12000 }],
    })).toEqual(expect.objectContaining({
      quantityMatched: false,
      valueMatched: false,
    }));
  });
});
