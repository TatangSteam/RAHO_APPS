import {
  IntegrationEvent,
  IntegrationEventStatus,
  Prisma,
  PurchaseOrderStatus,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import {
  assertBranchAccess,
  getAccessibleBranchIds,
} from '@modules/iam/authorization.service';
import { enqueueContact } from './zoho.contact.service';
import { getActiveZohoClient, ZohoClient } from './zoho.client';
import { ZohoApiError } from './zoho.error';
import { enqueueMaster } from './zoho.master.service';
import {
  buildZohoPurchaseOrderPayload,
  PO_CANCELLED_EVENT,
  PO_ISSUED_EVENT,
  purchaseOrderItemKey,
  purchaseOrderUomKey,
  reconcilePurchaseOrder,
  validatePurchaseOrderSnapshot,
  ZohoPurchaseOrderDependencies,
  ZohoPurchaseOrderRemote,
  ZohoPurchaseOrderSnapshot,
} from './zoho.purchase-order.policy';
import { stablePayloadHash } from './zoho.sanitizer';

type Tx = Prisma.TransactionClient;
type PurchaseOrderSource = Prisma.PurchaseOrderGetPayload<{
  include: { supplier: true; branch: true; items: true };
}>;

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function buildIssuedPurchaseOrderSnapshot(
  purchaseOrder: PurchaseOrderSource,
): ZohoPurchaseOrderSnapshot {
  const eligible = purchaseOrder.branch.type !== 'PARTNERSHIP';
  return {
    localEntityId: purchaseOrder.id,
    externalKey: `RAHO:PO:${purchaseOrder.id}`,
    poNumber: purchaseOrder.poNumber,
    purchaseRequestId: purchaseOrder.purchaseRequestId,
    supplierId: purchaseOrder.supplierId,
    branchId: purchaseOrder.branchId,
    branchType: purchaseOrder.branch.type,
    orderDate: day(purchaseOrder.orderDate),
    expectedDate: purchaseOrder.expectedDate ? day(purchaseOrder.expectedDate) : null,
    currency: purchaseOrder.currency,
    totalAmount: purchaseOrder.totalAmount.toFixed(2),
    notes: purchaseOrder.notes,
    eligible,
    excludedReason: eligible
      ? null
      : 'Cabang Partnership bukan Location internal Zoho; pembelian Partnership dilakukan melalui order barang ke pusat.',
    supplier: {
      code: purchaseOrder.supplier.code,
      name: purchaseOrder.supplier.name,
    },
    branch: {
      code: purchaseOrder.branch.branchCode,
      name: purchaseOrder.branch.name,
    },
    lines: purchaseOrder.items
      .sort((left, right) => left.lineNo - right.lineNo)
      .map((line) => ({
        id: line.id,
        lineNo: line.lineNo,
        masterProductId: line.masterProductId,
        uomId: line.uomId,
        sku: line.skuSnapshot,
        name: line.nameSnapshot,
        description: line.notes,
        uom: line.uomSnapshot,
        orderedQty: line.orderedQty.toFixed(4),
        unitPrice: line.unitPrice.toFixed(4),
        lineTotal: line.lineTotal.toFixed(2),
      })),
  };
}

export function enqueuePurchaseOrderIssuedTx(
  tx: Tx,
  snapshot: ZohoPurchaseOrderSnapshot,
  occurredAt: Date,
) {
  return tx.integrationEvent.upsert({
    where: {
      eventType_aggregateId: {
        eventType: PO_ISSUED_EVENT,
        aggregateId: snapshot.localEntityId,
      },
    },
    create: {
      eventType: PO_ISSUED_EVENT,
      eventVersion: 1,
      aggregateType: 'PurchaseOrder',
      aggregateId: snapshot.localEntityId,
      branchId: snapshot.branchId,
      payload: json(snapshot),
      payloadHash: stablePayloadHash(snapshot),
      status: IntegrationEventStatus.PENDING,
      occurredAt,
    },
    update: {
      branchId: snapshot.branchId,
      payload: json(snapshot),
      payloadHash: stablePayloadHash(snapshot),
      status: IntegrationEventStatus.PENDING,
      attempts: 0,
      availableAt: new Date(),
      processedAt: null,
      deadLetteredAt: null,
      ignoredAt: null,
      ignoredById: null,
      ignoreReason: null,
      lockedBy: null,
      leaseUntil: null,
      lastError: null,
      occurredAt,
    },
  });
}

export function enqueuePurchaseOrderCancelledTx(
  tx: Tx,
  input: {
    purchaseOrderId: string;
    poNumber: string;
    branchId: string;
    reason: string;
    cancelledAt: Date;
  },
) {
  const payload = {
    purchaseOrderId: input.purchaseOrderId,
    poNumber: input.poNumber,
    branchId: input.branchId,
    reason: input.reason,
    cancelledAt: input.cancelledAt.toISOString(),
  };
  return tx.integrationEvent.upsert({
    where: {
      eventType_aggregateId: {
        eventType: PO_CANCELLED_EVENT,
        aggregateId: input.purchaseOrderId,
      },
    },
    create: {
      eventType: PO_CANCELLED_EVENT,
      eventVersion: 1,
      aggregateType: 'PurchaseOrder',
      aggregateId: input.purchaseOrderId,
      branchId: input.branchId,
      payload: json(payload),
      payloadHash: stablePayloadHash(payload),
      status: IntegrationEventStatus.PENDING,
      occurredAt: input.cancelledAt,
    },
    update: {
      payload: json(payload),
      payloadHash: stablePayloadHash(payload),
      status: IntegrationEventStatus.PENDING,
      attempts: 0,
      availableAt: new Date(),
      processedAt: null,
      deadLetteredAt: null,
      ignoredAt: null,
      ignoredById: null,
      ignoreReason: null,
      lockedBy: null,
      leaseUntil: null,
      lastError: null,
      occurredAt: input.cancelledAt,
    },
  });
}

async function dependencies(
  connectionId: string,
  snapshot: ZohoPurchaseOrderSnapshot,
): Promise<Partial<ZohoPurchaseOrderDependencies>> {
  const units = await prisma.unitOfMeasure.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
  });
  const fallbackUomIds = snapshot.lines.flatMap((line) => {
    if (line.uomId) return [];
    const matches = units.filter((unit) =>
      unit.code.localeCompare(line.uom, 'id', { sensitivity: 'accent' }) === 0
      || unit.name.localeCompare(line.uom, 'id', { sensitivity: 'accent' }) === 0);
    return matches.length === 1 ? [matches[0].id] : [];
  });
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: connectionId,
      status: 'ACTIVE',
      OR: [
        { entityType: 'SUPPLIER', localEntityId: snapshot.supplierId },
        { entityType: 'BRANCH_LOCATION', localEntityId: snapshot.branchId },
        ...snapshot.lines.map((line) => ({
          entityType: 'MASTER_PRODUCT',
          localEntityId: line.masterProductId,
        })),
        ...Array.from(new Set([
          ...snapshot.lines.flatMap((line) => line.uomId ? [line.uomId] : []),
          ...fallbackUomIds,
        ])).map((id) => ({ entityType: 'UOM', localEntityId: id })),
      ],
    },
  });
  const find = (entityType: string, localEntityId: string) =>
    mappings.find((entry) =>
      entry.entityType === entityType && entry.localEntityId === localEntityId)?.zohoEntityId;
  return {
    vendorId: find('SUPPLIER', snapshot.supplierId),
    locationId: find('BRANCH_LOCATION', snapshot.branchId),
    itemIds: Object.fromEntries(snapshot.lines.flatMap((line) => {
      const id = find('MASTER_PRODUCT', line.masterProductId);
      return id ? [[purchaseOrderItemKey(line.masterProductId), id]] : [];
    })),
    units: Object.fromEntries(snapshot.lines.flatMap((line) => {
      const localUomId = line.uomId || (() => {
        const matches = units.filter((unit) =>
          unit.code.toLowerCase() === line.uom.toLowerCase()
          || unit.name.toLowerCase() === line.uom.toLowerCase());
        return matches.length === 1 ? matches[0].id : null;
      })();
      const value = localUomId ? find('UOM', localUomId) : null;
      return value ? [[purchaseOrderUomKey(line), value]] : [];
    })),
  };
}

async function findExisting(
  client: ZohoClient,
  snapshot: ZohoPurchaseOrderSnapshot,
): Promise<ZohoPurchaseOrderRemote[]> {
  const rows = await client.listAll<ZohoPurchaseOrderRemote>(
    '/books/v3/purchaseorders',
    'purchaseorders',
    { reference_number: snapshot.poNumber },
  );
  return rows.filter((row) =>
    row.reference_number === snapshot.poNumber
    || row.purchaseorder_number === snapshot.poNumber);
}

async function saveMapping(input: {
  connectionId: string;
  snapshot: ZohoPurchaseOrderSnapshot;
  zohoPurchaseOrderId: string;
  operation: string;
}) {
  return prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: input.connectionId,
        entityType: 'PURCHASE_ORDER',
        localEntityId: input.snapshot.localEntityId,
      },
    },
    create: {
      zohoConnectionId: input.connectionId,
      entityType: 'PURCHASE_ORDER',
      localEntityId: input.snapshot.localEntityId,
      zohoEntityType: 'PURCHASE_ORDER',
      zohoEntityId: input.zohoPurchaseOrderId,
      externalKey: input.snapshot.externalKey,
      status: 'ACTIVE',
      metadata: json({
        operation: input.operation,
        poNumber: input.snapshot.poNumber,
        totalAmount: input.snapshot.totalAmount,
        status: 'OPEN',
      }),
      lastSyncedAt: new Date(),
    },
    update: {
      zohoEntityId: input.zohoPurchaseOrderId,
      status: 'ACTIVE',
      metadata: json({
        operation: input.operation,
        poNumber: input.snapshot.poNumber,
        totalAmount: input.snapshot.totalAmount,
        status: 'OPEN',
      }),
      lastSyncedAt: new Date(),
    },
  });
}

export async function handlePurchaseOrderEvent(event: IntegrationEvent) {
  if (event.eventType === PO_CANCELLED_EVENT) return handlePurchaseOrderCancelled(event);
  if (
    event.eventType !== PO_ISSUED_EVENT
    || event.eventVersion !== 1
    || event.aggregateType !== 'PurchaseOrder'
  ) {
    throw new ZohoApiError(
      'Kontrak event Purchase Order tidak didukung.',
      'ZOHO_PO_EVENT_UNSUPPORTED',
      422,
      false,
    );
  }
  const snapshot = event.payload as unknown as ZohoPurchaseOrderSnapshot;
  if (!snapshot.eligible) {
    return { operation: 'SKIP_POLICY', reason: snapshot.excludedReason };
  }
  const client = await getActiveZohoClient(true);
  let mapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'PURCHASE_ORDER',
        localEntityId: snapshot.localEntityId,
      },
    },
  });
  if (mapping) {
    return { operation: 'ALREADY_MAPPED', zohoPurchaseOrderId: mapping.zohoEntityId };
  }
  const resolved = await dependencies(client.connection.id, snapshot);
  const issues = validatePurchaseOrderSnapshot(snapshot, resolved);
  if (issues.length) {
    throw new ZohoApiError(issues.join(' '), 'ZOHO_PO_NEEDS_ACTION', 422, false);
  }
  const matches = await findExisting(client, snapshot);
  if (matches.length > 1) {
    throw new ZohoApiError(
      `Lebih dari satu Purchase Order Zoho memakai referensi ${snapshot.poNumber}.`,
      'ZOHO_PO_AMBIGUOUS',
      409,
      false,
    );
  }
  let remote = matches[0];
  let operation = remote ? 'RECOVER_EXISTING' : 'CREATE';
  const local = await prisma.purchaseOrder.findUnique({
    where: { id: snapshot.localEntityId },
    select: { status: true },
  });
  if (!remote && local?.status === PurchaseOrderStatus.CANCELLED) {
    return {
      operation: 'SKIP_CANCELLED_BEFORE_SYNC',
      poNumber: snapshot.poNumber,
    };
  }
  if (!remote) {
    const response = await client.request<{ purchaseorder?: ZohoPurchaseOrderRemote }>(
      '/books/v3/purchaseorders',
      {
        method: 'POST',
        params: { ignore_auto_number_generation: true },
        data: buildZohoPurchaseOrderPayload(
          snapshot,
          resolved as ZohoPurchaseOrderDependencies,
        ),
      },
    );
    remote = response.purchaseorder;
  }
  const zohoPurchaseOrderId = remote?.purchaseorder_id == null
    ? null
    : String(remote.purchaseorder_id);
  if (!zohoPurchaseOrderId) {
    throw new ZohoApiError(
      'Zoho tidak mengembalikan purchaseorder_id.',
      'ZOHO_PO_ID_MISSING',
      502,
      true,
    );
  }
  if (!remote?.status || remote.status.toLowerCase() === 'draft') {
    await client.request(
      `/books/v3/purchaseorders/${zohoPurchaseOrderId}/status/open`,
      { method: 'POST' },
    );
  }
  mapping = await saveMapping({
    connectionId: client.connection.id,
    snapshot,
    zohoPurchaseOrderId,
    operation,
  });
  return {
    operation,
    zohoPurchaseOrderId: mapping.zohoEntityId,
    poNumber: snapshot.poNumber,
    totalAmount: snapshot.totalAmount,
  };
}

async function handlePurchaseOrderCancelled(event: IntegrationEvent) {
  const payload = event.payload as unknown as {
    purchaseOrderId: string;
    poNumber: string;
    reason: string;
  };
  const client = await getActiveZohoClient(true);
  let mapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'PURCHASE_ORDER',
        localEntityId: payload.purchaseOrderId,
      },
    },
  });
  let remote: ZohoPurchaseOrderRemote | undefined;
  if (!mapping) {
    const issued = await prisma.integrationEvent.findUnique({
      where: {
        eventType_aggregateId: {
          eventType: PO_ISSUED_EVENT,
          aggregateId: payload.purchaseOrderId,
        },
      },
    });
    if (issued?.status === IntegrationEventStatus.PROCESSING) {
      throw new ZohoApiError(
        'Sinkronisasi penerbitan PO masih berjalan; pembatalan akan dicoba kembali.',
        'ZOHO_PO_ISSUE_STILL_PROCESSING',
        409,
        true,
      );
    }
    if (issued) {
      const snapshot = issued.payload as unknown as ZohoPurchaseOrderSnapshot;
      const matches = await findExisting(client, snapshot);
      if (matches.length > 1) {
        throw new ZohoApiError(
          'Purchase Order Zoho untuk cancellation ambigu.',
          'ZOHO_PO_CANCEL_AMBIGUOUS',
          409,
          false,
        );
      }
      remote = matches[0];
      const zohoId = remote?.purchaseorder_id == null
        ? null
        : String(remote.purchaseorder_id);
      if (zohoId) {
        mapping = await saveMapping({
          connectionId: client.connection.id,
          snapshot,
          zohoPurchaseOrderId: zohoId,
          operation: 'RECOVER_FOR_CANCEL',
        });
      }
    }
  }
  if (!mapping) {
    return { operation: 'NO_REMOTE_PO', poNumber: payload.poNumber };
  }
  if (!remote) {
    const response = await client.request<{ purchaseorder?: ZohoPurchaseOrderRemote }>(
      `/books/v3/purchaseorders/${mapping.zohoEntityId}`,
    );
    remote = response.purchaseorder;
  }
  const alreadyCancelled = remote?.status?.toLowerCase() === 'cancelled';
  if (!alreadyCancelled) {
    await client.request(
      `/books/v3/purchaseorders/${mapping.zohoEntityId}/status/cancelled`,
      { method: 'POST' },
    );
  }
  await prisma.zohoEntityMapping.update({
    where: { id: mapping.id },
    data: {
      status: 'INACTIVE',
      metadata: json({
        operation: alreadyCancelled ? 'ALREADY_CANCELLED' : 'CANCEL',
        poNumber: payload.poNumber,
        status: 'CANCELLED',
        reason: payload.reason,
      }),
      lastSyncedAt: new Date(),
    },
  });
  return {
    operation: alreadyCancelled ? 'ALREADY_CANCELLED' : 'CANCEL',
    zohoPurchaseOrderId: mapping.zohoEntityId,
  };
}

async function localPurchaseOrder(id: string): Promise<PurchaseOrderSource> {
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { supplier: true, branch: true, items: true },
  });
  if (!purchaseOrder) {
    throw new AppError(404, 'PURCHASE_ORDER_NOT_FOUND', 'Purchase Order tidak ditemukan.');
  }
  return purchaseOrder;
}

async function snapshotForPurchaseOrder(id: string) {
  const event = await prisma.integrationEvent.findUnique({
    where: {
      eventType_aggregateId: {
        eventType: PO_ISSUED_EVENT,
        aggregateId: id,
      },
    },
  });
  if (event) {
    return {
      snapshot: event.payload as unknown as ZohoPurchaseOrderSnapshot,
      occurredAt: event.occurredAt,
      event,
    };
  }
  const purchaseOrder = await localPurchaseOrder(id);
  return {
    snapshot: buildIssuedPurchaseOrderSnapshot(purchaseOrder),
    occurredAt: purchaseOrder.issuedAt,
    event: null,
  };
}

export async function previewPurchaseOrder(actorUserId: string, id: string) {
  const purchaseOrder = await localPurchaseOrder(id);
  await assertBranchAccess(actorUserId, purchaseOrder.branchId);
  const { snapshot } = await snapshotForPurchaseOrder(id);
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  const resolved = connection ? await dependencies(connection.id, snapshot) : {};
  const issues = validatePurchaseOrderSnapshot(snapshot, resolved);
  return {
    snapshot,
    payload: connection && snapshot.eligible && !issues.length
      ? buildZohoPurchaseOrderPayload(
        snapshot,
        resolved as ZohoPurchaseOrderDependencies,
      )
      : null,
    issues: connection ? issues : ['Zoho Books belum terhubung.'],
    liveReady: Boolean(connection) && snapshot.eligible && issues.length === 0,
    stockPolicy: 'Membuat Purchase Order tidak mengubah stock on hand; stok berubah hanya melalui Goods Receipt.',
    excludedFields: [
      'batch',
      'expiry',
      'goods_receipt',
      'supplier_invoice',
      'payment',
      'medical_data',
    ],
  };
}

export async function enqueuePurchaseOrder(actorUserId: string, id: string) {
  const purchaseOrder = await localPurchaseOrder(id);
  await assertBranchAccess(actorUserId, purchaseOrder.branchId);
  const current = await prisma.integrationEvent.findUnique({
    where: {
      eventType_aggregateId: {
        eventType: PO_ISSUED_EVENT,
        aggregateId: id,
      },
    },
  });
  if (current?.status === IntegrationEventStatus.PROCESSING) {
    throw new AppError(409, 'ZOHO_EVENT_PROCESSING', 'Purchase Order sedang diproses.');
  }
  if (purchaseOrder.status === PurchaseOrderStatus.CANCELLED) {
    return prisma.$transaction((tx) => enqueuePurchaseOrderCancelledTx(tx, {
      purchaseOrderId: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      branchId: purchaseOrder.branchId,
      reason: 'Enqueue ulang cancellation dari kontrol Zoho.',
      cancelledAt: new Date(),
    }));
  }
  return prisma.$transaction((tx) => enqueuePurchaseOrderIssuedTx(
    tx,
    buildIssuedPurchaseOrderSnapshot(purchaseOrder),
    purchaseOrder.issuedAt,
  ));
}

export async function enqueuePurchaseOrderDependencies(actorUserId: string, id: string) {
  const purchaseOrder = await localPurchaseOrder(id);
  await assertBranchAccess(actorUserId, purchaseOrder.branchId);
  if (purchaseOrder.branch.type === 'PARTNERSHIP') {
    throw new AppError(
      422,
      'ZOHO_PO_PARTNERSHIP_EXCLUDED',
      'PO cabang Partnership tidak memakai Location internal Zoho.',
    );
  }
  await enqueueContact('SUPPLIER', purchaseOrder.supplierId);
  await enqueueMaster('BRANCH_LOCATION', purchaseOrder.branchId);
  for (const productId of Array.from(new Set(
    purchaseOrder.items.map((line) => line.masterProductId),
  ))) {
    await enqueueMaster('MASTER_PRODUCT', productId);
  }
  return {
    supplierId: purchaseOrder.supplierId,
    branchId: purchaseOrder.branchId,
    productIds: Array.from(new Set(purchaseOrder.items.map((line) => line.masterProductId))),
    note: 'UOM tetap harus dipetakan pada tab Item & Location sebelum PO dikirim.',
  };
}

export async function listPurchaseOrderMappings(
  actorUserId: string,
  input: { page: number; limit: number; search?: string },
) {
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const where: Prisma.PurchaseOrderWhereInput = {
    ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    ...(input.search ? {
      OR: [
        { poNumber: { contains: input.search, mode: 'insensitive' } },
        { supplier: { code: { contains: input.search, mode: 'insensitive' } } },
        { supplier: { name: { contains: input.search, mode: 'insensitive' } } },
        { branch: { branchCode: { contains: input.search, mode: 'insensitive' } } },
      ],
    } : {}),
  };
  const [rows, total, connection] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: { supplier: true, branch: true, items: true },
      orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.purchaseOrder.count({ where }),
    prisma.zohoConnection.findFirst({ where: { isActive: true }, select: { id: true } }),
  ]);
  const ids = rows.map((row) => row.id);
  const [mappings, events] = await Promise.all([
    connection
      ? prisma.zohoEntityMapping.findMany({
        where: {
          zohoConnectionId: connection.id,
          entityType: 'PURCHASE_ORDER',
          localEntityId: { in: ids },
        },
      })
      : Promise.resolve([]),
    prisma.integrationEvent.findMany({
      where: {
        aggregateId: { in: ids },
        eventType: { in: [PO_ISSUED_EVENT, PO_CANCELLED_EVENT] },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      poNumber: row.poNumber,
      orderDate: row.orderDate,
      expectedDate: row.expectedDate,
      status: row.status,
      currency: row.currency,
      totalAmount: row.totalAmount.toFixed(2),
      supplier: {
        id: row.supplier.id,
        code: row.supplier.code,
        name: row.supplier.name,
      },
      branch: {
        id: row.branch.id,
        code: row.branch.branchCode,
        name: row.branch.name,
        type: row.branch.type,
      },
      lineCount: row.items.length,
      mapping: mappings.find((entry) => entry.localEntityId === row.id) || null,
      events: events.filter((entry) => entry.aggregateId === row.id),
    })),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

export async function reconcilePurchaseOrders(actorUserId: string) {
  const client = await getActiveZohoClient(true);
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const events = await prisma.integrationEvent.findMany({
    where: {
      eventType: PO_ISSUED_EVENT,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    },
    orderBy: { occurredAt: 'desc' },
    take: 100,
  });
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: client.connection.id,
      entityType: 'PURCHASE_ORDER',
      localEntityId: { in: events.map((event) => event.aggregateId) },
    },
  });
  const rows = await Promise.all(events.map(async (event) => {
    const snapshot = event.payload as unknown as ZohoPurchaseOrderSnapshot;
    const mapping = mappings.find((entry) => entry.localEntityId === event.aggregateId);
    if (!snapshot.eligible) {
      return {
        purchaseOrderId: event.aggregateId,
        poNumber: snapshot.poNumber,
        result: { status: 'MATCHED' as const, differences: ['Dikecualikan oleh kebijakan Partnership.'] },
      };
    }
    if (!mapping) {
      return {
        purchaseOrderId: event.aggregateId,
        poNumber: snapshot.poNumber,
        result: reconcilePurchaseOrder(snapshot),
      };
    }
    const response = await client.request<{ purchaseorder?: ZohoPurchaseOrderRemote }>(
      `/books/v3/purchaseorders/${mapping.zohoEntityId}`,
    );
    const result = reconcilePurchaseOrder(snapshot, response.purchaseorder);
    const local = await prisma.purchaseOrder.findUnique({
      where: { id: event.aggregateId },
      select: { status: true },
    });
    if (
      local?.status === PurchaseOrderStatus.CANCELLED
      && response.purchaseorder?.status?.toLowerCase() !== 'cancelled'
    ) {
      result.status = 'MISMATCH';
      result.differences.push('Status ERP CANCELLED tetapi Purchase Order Zoho belum cancelled.');
    }
    return {
      purchaseOrderId: event.aggregateId,
      poNumber: snapshot.poNumber,
      result,
    };
  }));
  return {
    checked: rows.length,
    matched: rows.filter((row) => row.result.status === 'MATCHED').length,
    mismatched: rows.filter((row) => row.result.status === 'MISMATCH').length,
    missing: rows.filter((row) => row.result.status === 'MISSING').length,
    rows,
  };
}
