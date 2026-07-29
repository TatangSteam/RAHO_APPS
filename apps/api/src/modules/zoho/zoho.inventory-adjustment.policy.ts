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

export type InventorySyncDependencies = {
  itemIds: Map<string, string>;
  locationIds: Map<string, string>;
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

export function validateInventorySyncSnapshot(
  snapshot: InventorySyncSnapshot,
  dependencies: InventorySyncDependencies,
): string[] {
  const issues: string[] = [];
  if (!snapshot.lines.length) issues.push('Adjustment tidak memiliki baris material.');
  for (const line of snapshot.lines) {
    if (!dependencies.itemIds.get(line.inventoryItemId)) {
      issues.push(`Item ${line.sku || line.inventoryItemId} belum dipetakan ke Zoho.`);
    }
    if (!line.stockLocationId || !dependencies.locationIds.get(line.stockLocationId)) {
      issues.push(`Location item ${line.sku || line.inventoryItemId} belum dipetakan ke Zoho.`);
    }
    const quantity = Number(line.quantityAdjusted);
    if (!Number.isFinite(quantity) || quantity === 0) {
      issues.push(`Quantity item ${line.sku || line.inventoryItemId} harus bukan nol.`);
    }
  }
  return issues;
}

export function buildZohoInventoryAdjustmentPayload(
  snapshot: InventorySyncSnapshot,
  dependencies: InventorySyncDependencies,
) {
  assertInventoryOutboundPrivacy(snapshot);
  return {
    date: snapshot.occurredAt.slice(0, 10),
    reason: snapshot.reason.slice(0, 100),
    description: `${snapshot.sourceType} ${snapshot.postingReference || snapshot.externalKey}`.slice(0, 500),
    reference_number: snapshot.externalKey.slice(0, 100),
    adjustment_type: 'quantity',
    line_items: snapshot.lines.map((line) => ({
      item_id: dependencies.itemIds.get(line.inventoryItemId),
      quantity_adjusted: Number(line.quantityAdjusted),
      location_id: line.stockLocationId
        ? dependencies.locationIds.get(line.stockLocationId)
        : undefined,
    })),
  };
}

export function reconcileInventoryAdjustment(
  snapshot: InventorySyncSnapshot,
  remote: {
    reference_number?: string;
    total?: number;
    line_items?: Array<{ quantity_adjusted?: number; item_total?: number }>;
  },
) {
  const localQuantity = snapshot.lines.reduce(
    (sum, line) => sum + Number(line.quantityAdjusted),
    0,
  );
  const remoteQuantity = (remote.line_items || []).reduce(
    (sum, line) => sum + Number(line.quantity_adjusted || 0),
    0,
  );
  const localValue = snapshot.lines.reduce((sum, line) => sum + Number(line.value || 0), 0);
  const remoteValue = Number(remote.total || 0);
  return {
    referenceMatched: remote.reference_number === snapshot.externalKey,
    quantityMatched: Math.abs(localQuantity - remoteQuantity) < 0.0001,
    valueMatched: localValue === 0 || Math.abs(Math.abs(localValue) - Math.abs(remoteValue)) < 0.01,
    localQuantity,
    remoteQuantity,
    localValue,
    remoteValue,
  };
}
