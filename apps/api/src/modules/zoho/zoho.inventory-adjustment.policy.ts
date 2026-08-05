export const TREATMENT_INVENTORY_CONSUMED_EVENT = 'TREATMENT_INVENTORY_CONSUMED' as const;
export const TREATMENT_INVENTORY_REVERSED_EVENT = 'TREATMENT_INVENTORY_REVERSED' as const;
export const INVENTORY_ADJUSTMENT_POSTED_EVENT = 'INVENTORY_ADJUSTMENT_POSTED' as const;
export const STOCK_OPNAME_POSTED_EVENT = 'STOCK_OPNAME_POSTED' as const;
export const INVENTORY_SYNC_EVENT_VERSION = 1 as const;

export type InventorySyncSource =
  | 'TREATMENT_COMPLETION'
  | 'TREATMENT_CANCELLATION'
  | 'MANUAL_ADJUSTMENT'
  | 'STOCK_OPNAME';

export type InventorySyncLine = {
  inventoryItemId: string;
  sku: string | null;
  stockLocationId: string | null;
  quantityAdjusted: string;
  unitRate: string | null;
  value: string | null;
};

export type InventorySyncSnapshot = {
  eventVersion: typeof INVENTORY_SYNC_EVENT_VERSION;
  sourceType: InventorySyncSource;
  localEntityId: string;
  externalKey: string;
  branchId: string;
  occurredAt: string;
  postingReference: string | null;
  reason: string;
  lines: InventorySyncLine[];
};

const FORBIDDEN_CLINICAL_KEYS = /^(patient|patientName|member|memberId|diagnosis|complaint|doctorNote|labResult|photo|therapyDetail|deviationNotes)$/i;

export function assertInventoryOutboundPrivacy(value: unknown, path = 'payload'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertInventoryOutboundPrivacy(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_CLINICAL_KEYS.test(key)) {
      throw new Error(`ZOHO_INVENTORY_PRIVACY_VIOLATION:${path}.${key}`);
    }
    assertInventoryOutboundPrivacy(child, `${path}.${key}`);
  }
}
