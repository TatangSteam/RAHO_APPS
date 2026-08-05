import { IntegrationEvent, IntegrationEventStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { getActiveZohoClient } from './zoho.client';
import { ZohoApiError } from './zoho.error';
import { erpOriginMarker } from './zoho.origin';
import {
  assertInventoryOutboundPrivacy,
  InventorySyncSnapshot,
} from './zoho.inventory-adjustment.policy';

const BOOKS_ONLY_CAPABILITY_MESSAGE =
  'Mode Zoho Books-only aktif. Zoho Books tidak menyediakan endpoint Books API v3 untuk inventory adjustment; gunakan ekspor terkontrol dari ERP.';

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

export async function probeInventoryAdjustmentCapability() {
  const client = await getActiveZohoClient(false);
  const checkedAt = new Date();
  return prisma.zohoConnection.update({
    where: { id: client.connection.id },
    data: {
      inventoryAdjustmentsSupported: false,
      inventoryAdjustmentsCapabilityError: BOOKS_ONLY_CAPABILITY_MESSAGE,
      inventoryAdjustmentsLastCheckedAt: checkedAt,
    },
    select: {
      inventoryAdjustmentsSupported: true,
      inventoryAdjustmentsCapabilityError: true,
      inventoryAdjustmentsLastCheckedAt: true,
    },
  });
}

export async function getInventoryAdjustmentCapability() {
  const client = await getActiveZohoClient(false);
  return {
    supported: false,
    error: client.connection.inventoryAdjustmentsCapabilityError || BOOKS_ONLY_CAPABILITY_MESSAGE,
    checkedAt: client.connection.inventoryAdjustmentsLastCheckedAt,
    fallback: 'CONTROLLED_EXPORT_TO_ZOHO_BOOKS' as const,
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
  throw new ZohoApiError(
    `${BOOKS_ONLY_CAPABILITY_MESSAGE} Referensi ERP: ${snapshot.externalKey}.`,
    'ZOHO_BOOKS_INVENTORY_EXPORT_REQUIRED',
    422,
    false,
  );
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
  const mappings = items.length ? await prisma.zohoEntityMapping.findMany({
    where: {
      entityType: 'INVENTORY_ADJUSTMENT',
      localEntityId: { in: items.map((event) => event.aggregateId) },
    },
  }) : [];
  return {
    items: items.map((event) => ({
      ...event,
      mapping: mappings.find((mapping) => mapping.localEntityId === event.aggregateId) || null,
    })),
    pagination: { ...input, total, totalPages: Math.ceil(total / input.limit) },
  };
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
  const rows = ['event_reference,data_origin,erp_marker,date,sku,location_reference,quantity,unit_rate,value,reason,posting_reference'];
  for (const event of events) {
    const snapshot = await resolvedSnapshot(event);
    for (const line of snapshot.lines) {
      rows.push([
        snapshot.externalKey,
        'ERP',
        erpOriginMarker(snapshot.externalKey),
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
  return {
    checked: 0,
    results: [],
    mode: 'BOOKS_ONLY_CONTROLLED_EXPORT' as const,
    message: BOOKS_ONLY_CAPABILITY_MESSAGE,
  };
}
