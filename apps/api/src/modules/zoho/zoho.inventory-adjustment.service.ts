import { IntegrationEvent, IntegrationEventStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { env } from '@config/env';
import { getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { getActiveZohoClient, ZohoClient } from './zoho.client';
import { ZohoApiError } from './zoho.error';
import {
  assertInventoryOutboundPrivacy,
  buildZohoInventoryAdjustmentPayload,
  InventorySyncDependencies,
  InventorySyncSnapshot,
  reconcileInventoryAdjustment,
} from './zoho.inventory-adjustment.policy';

type RemoteAdjustment = {
  inventory_adjustment_id?: string | number;
  reference_number?: string;
  total?: number;
  line_items?: Array<{
    item_id?: string | number;
    quantity_adjusted?: number;
    item_total?: number;
  }>;
};

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function resolvedSnapshot(event: IntegrationEvent): Promise<InventorySyncSnapshot> {
  const snapshot = event.payload as unknown as InventorySyncSnapshot;
  assertInventoryOutboundPrivacy(snapshot);
  const ids = snapshot.lines.map((line) => line.inventoryItemId);
  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: ids } },
    include: { masterProduct: { select: { sku: true } } },
  });
  const byId = new Map(items.map((item) => [item.id, item]));
  return {
    ...snapshot,
    lines: snapshot.lines.map((line) => {
      const item = byId.get(line.inventoryItemId);
      return {
        ...line,
        sku: line.sku || item?.masterProduct.sku || null,
        stockLocationId: line.stockLocationId || item?.stockLocationId || null,
      };
    }),
  };
}

async function dependencies(
  connectionId: string,
  snapshot: InventorySyncSnapshot,
): Promise<InventorySyncDependencies> {
  const itemIds = [...new Set(snapshot.lines.map((line) => line.inventoryItemId))];
  const locationIds = [...new Set(
    snapshot.lines.map((line) => line.stockLocationId).filter((id): id is string => Boolean(id)),
  )];
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: connectionId,
      status: 'ACTIVE',
      OR: [
        { entityType: 'MASTER_PRODUCT', localEntityId: { in: itemIds } },
        { entityType: 'STOCK_LOCATION', localEntityId: { in: locationIds } },
      ],
    },
  });

  // InventoryItem points to MasterProduct, while the item master mapping is keyed by MasterProduct id.
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, masterProductId: true },
  });
  const productMappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: connectionId,
      entityType: 'MASTER_PRODUCT',
      localEntityId: { in: inventoryItems.map((item) => item.masterProductId) },
      status: 'ACTIVE',
    },
  });
  const productById = new Map(productMappings.map((mapping) => [mapping.localEntityId, mapping.zohoEntityId]));
  const masterByInventory = new Map(inventoryItems.map((item) => [
    item.id,
    productById.get(item.masterProductId),
  ]));

  return {
    itemIds: new Map(
      itemIds
        .map((id) => [id, masterByInventory.get(id)] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
    ),
    locationIds: new Map(
      mappings
        .filter((mapping) => mapping.entityType === 'STOCK_LOCATION')
        .map((mapping) => [mapping.localEntityId, mapping.zohoEntityId]),
    ),
  };
}

async function findExisting(client: ZohoClient, referenceNumber: string): Promise<RemoteAdjustment[]> {
  const rows = await client.listAll<RemoteAdjustment>(
    '/inventory/v1/inventoryadjustments',
    'inventory_adjustments',
    { reference_number: referenceNumber },
  );
  return rows.filter((row) => row.reference_number === referenceNumber);
}

export async function probeInventoryAdjustmentCapability() {
  const client = await getActiveZohoClient(false);
  const checkedAt = new Date();
  if (!env.ZOHO_INVENTORY_SYNC_ENABLED) {
    return prisma.zohoConnection.update({
      where: { id: client.connection.id },
      data: {
        inventoryAdjustmentsSupported: false,
        inventoryAdjustmentsCapabilityError: 'ZOHO_INVENTORY_SYNC_ENABLED=false. Aktifkan flag dan hubungkan ulang untuk menjalankan capability PoC.',
        inventoryAdjustmentsLastCheckedAt: checkedAt,
      },
      select: {
        inventoryAdjustmentsSupported: true,
        inventoryAdjustmentsCapabilityError: true,
        inventoryAdjustmentsLastCheckedAt: true,
      },
    });
  }
  try {
    await client.request('/inventory/v1/inventoryadjustments', {
      params: { page: 1, per_page: 1 },
    });
    return prisma.zohoConnection.update({
      where: { id: client.connection.id },
      data: {
        inventoryAdjustmentsSupported: true,
        inventoryAdjustmentsCapabilityError: null,
        inventoryAdjustmentsLastCheckedAt: checkedAt,
      },
      select: {
        inventoryAdjustmentsSupported: true,
        inventoryAdjustmentsCapabilityError: true,
        inventoryAdjustmentsLastCheckedAt: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Capability tidak tersedia.';
    return prisma.zohoConnection.update({
      where: { id: client.connection.id },
      data: {
        inventoryAdjustmentsSupported: false,
        inventoryAdjustmentsCapabilityError: message.slice(0, 500),
        inventoryAdjustmentsLastCheckedAt: checkedAt,
      },
      select: {
        inventoryAdjustmentsSupported: true,
        inventoryAdjustmentsCapabilityError: true,
        inventoryAdjustmentsLastCheckedAt: true,
      },
    });
  }
}

export async function getInventoryAdjustmentCapability() {
  const client = await getActiveZohoClient(false);
  return {
    supported: client.connection.inventoryAdjustmentsSupported,
    error: client.connection.inventoryAdjustmentsCapabilityError,
    checkedAt: client.connection.inventoryAdjustmentsLastCheckedAt,
    fallback: client.connection.inventoryAdjustmentsSupported === true
      ? null
      : 'CONTROLLED_EXPORT_OR_ENABLE_ZOHO_INVENTORY',
  };
}

export async function handleInventoryAdjustmentEvent(event: IntegrationEvent) {
  if (event.eventVersion !== 1) {
    throw new ZohoApiError('Versi event adjustment tidak didukung.', 'ZOHO_INVENTORY_EVENT_UNSUPPORTED', 422, false);
  }
  const snapshot = await resolvedSnapshot(event);
  const branch = await prisma.branch.findUnique({
    where: { id: snapshot.branchId },
    select: { type: true },
  });
  if (branch?.type === 'PARTNERSHIP') {
    return { operation: 'SKIP_POLICY', reason: 'Stok cabang Partnership tetap lokal.' };
  }
  const client = await getActiveZohoClient(true);
  if (!env.ZOHO_INVENTORY_SYNC_ENABLED) {
    throw new ZohoApiError(
      'Sinkronisasi Zoho Inventory belum diaktifkan; gunakan ekspor terkontrol.',
      'CAPABILITY_UNSUPPORTED',
      422,
      false,
    );
  }
  if (client.connection.inventoryAdjustmentsSupported !== true) {
    throw new ZohoApiError(
      'Endpoint inventory adjustment belum terbukti tersedia untuk organisasi ini. Jalankan capability probe.',
      'CAPABILITY_UNSUPPORTED',
      422,
      false,
    );
  }
  const mapped = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'INVENTORY_ADJUSTMENT',
        localEntityId: snapshot.localEntityId,
      },
    },
  });
  if (mapped) return { operation: 'ALREADY_MAPPED', zohoInventoryAdjustmentId: mapped.zohoEntityId };

  const deps = await dependencies(client.connection.id, snapshot);
  const payload = buildZohoInventoryAdjustmentPayload(snapshot, deps);
  const issues = payload.line_items.flatMap((line, index) => [
    ...(!line.item_id ? [`Baris ${index + 1}: item belum dipetakan.`] : []),
    ...(!line.location_id ? [`Baris ${index + 1}: location belum dipetakan.`] : []),
  ]);
  if (issues.length) {
    throw new ZohoApiError(issues.join(' '), 'ZOHO_INVENTORY_ADJUSTMENT_NEEDS_ACTION', 422, false);
  }

  const matches = await findExisting(client, snapshot.externalKey);
  if (matches.length > 1) {
    throw new ZohoApiError('Referensi adjustment ditemukan lebih dari sekali.', 'ZOHO_INVENTORY_ADJUSTMENT_AMBIGUOUS', 409, false);
  }
  let remote = matches[0];
  const operation = remote ? 'RECOVER_EXISTING' : 'CREATE';
  if (!remote) {
    const response = await client.request<{ inventory_adjustment?: RemoteAdjustment }>(
      '/inventory/v1/inventoryadjustments',
      { method: 'POST', data: payload },
    );
    remote = response.inventory_adjustment;
  }
  if (remote?.inventory_adjustment_id == null) {
    throw new ZohoApiError('Zoho tidak mengembalikan inventory_adjustment_id.', 'ZOHO_INVENTORY_ADJUSTMENT_ID_MISSING', 502, true);
  }
  const zohoId = String(remote.inventory_adjustment_id);
  await prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'INVENTORY_ADJUSTMENT',
        localEntityId: snapshot.localEntityId,
      },
    },
    create: {
      zohoConnectionId: client.connection.id,
      entityType: 'INVENTORY_ADJUSTMENT',
      localEntityId: snapshot.localEntityId,
      zohoEntityType: 'INVENTORY_ADJUSTMENT',
      zohoEntityId: zohoId,
      externalKey: snapshot.externalKey,
      metadata: json({ sourceType: snapshot.sourceType, operation }),
      lastSyncedAt: new Date(),
    },
    update: {
      zohoEntityId: zohoId,
      status: 'ACTIVE',
      metadata: json({ sourceType: snapshot.sourceType, operation }),
      lastSyncedAt: new Date(),
    },
  });
  return { operation, zohoInventoryAdjustmentId: zohoId, referenceNumber: snapshot.externalKey };
}

export async function listInventoryAdjustmentEvents(
  actorUserId: string,
  input: { page: number; limit: number },
) {
  const branches = await getAccessibleBranchIds(actorUserId);
  const where: Prisma.IntegrationEventWhereInput = {
    eventType: { in: [
      'TREATMENT_INVENTORY_CONSUMED',
      'TREATMENT_INVENTORY_REVERSED',
      'INVENTORY_ADJUSTMENT_POSTED',
      'STOCK_OPNAME_POSTED',
    ] },
    ...(branches === null ? {} : { branchId: { in: branches } }),
  };
  const [items, total] = await prisma.$transaction([
    prisma.integrationEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.integrationEvent.count({ where }),
  ]);
  return { items, pagination: { ...input, total, totalPages: Math.ceil(total / input.limit) } };
}

export async function controlledInventoryExport(actorUserId: string): Promise<string> {
  const branches = await getAccessibleBranchIds(actorUserId);
  const events = await prisma.integrationEvent.findMany({
    where: {
      eventType: { in: [
        'TREATMENT_INVENTORY_CONSUMED',
        'TREATMENT_INVENTORY_REVERSED',
        'INVENTORY_ADJUSTMENT_POSTED',
        'STOCK_OPNAME_POSTED',
      ] },
      status: { in: [IntegrationEventStatus.PENDING, IntegrationEventStatus.FAILED, IntegrationEventStatus.DEAD_LETTER] },
      ...(branches === null ? {} : { branchId: { in: branches } }),
    },
    orderBy: { occurredAt: 'asc' },
  });
  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = ['event_reference,date,sku,location_reference,quantity,unit_rate,value,reason,posting_reference'];
  for (const event of events) {
    const snapshot = await resolvedSnapshot(event);
    for (const line of snapshot.lines) {
      rows.push([
        snapshot.externalKey,
        snapshot.occurredAt.slice(0, 10),
        line.sku,
        line.stockLocationId,
        line.quantityAdjusted,
        line.unitRate,
        line.value,
        snapshot.reason,
        snapshot.postingReference,
      ].map(quote).join(','));
    }
  }
  return `${rows.join('\n')}\n`;
}

export async function reconcileInventoryAdjustments() {
  const client = await getActiveZohoClient(true);
  if (client.connection.inventoryAdjustmentsSupported !== true) {
    throw new AppError(409, 'CAPABILITY_UNSUPPORTED', 'Capability inventory adjustment belum tersedia.');
  }
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: { zohoConnectionId: client.connection.id, entityType: 'INVENTORY_ADJUSTMENT', status: 'ACTIVE' },
  });
  const results = [];
  for (const mapping of mappings) {
    const event = await prisma.integrationEvent.findFirst({
      where: { aggregateId: mapping.localEntityId, eventType: { in: [
        'TREATMENT_INVENTORY_CONSUMED',
        'TREATMENT_INVENTORY_REVERSED',
        'INVENTORY_ADJUSTMENT_POSTED',
        'STOCK_OPNAME_POSTED',
      ] } },
    });
    if (!event) continue;
    const response = await client.request<{ inventory_adjustment?: RemoteAdjustment }>(
      `/inventory/v1/inventoryadjustments/${mapping.zohoEntityId}`,
    );
    results.push({
      localEntityId: mapping.localEntityId,
      ...reconcileInventoryAdjustment(await resolvedSnapshot(event), response.inventory_adjustment || {}),
    });
  }
  return { checked: results.length, results };
}
