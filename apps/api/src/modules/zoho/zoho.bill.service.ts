import {
  IntegrationEvent,
  IntegrationEventStatus,
  Prisma,
} from '@prisma/client';
import { env } from '@config/env';
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
  enqueuePurchaseOrder,
} from './zoho.purchase-order.service';
import {
  ZohoPurchaseOrderRemote,
} from './zoho.purchase-order.policy';
import {
  billItemKey,
  billPurchaseOrderLineKey,
  billUomKey,
  buildZohoBillPayload,
  reconcileBill,
  SUPPLIER_INVOICE_POSTED_EVENT,
  validateBillSnapshot,
  ZohoBillDependencies,
  ZohoBillRemote,
  ZohoBillSnapshot,
} from './zoho.bill.policy';
import { stablePayloadHash } from './zoho.sanitizer';

type Tx = Prisma.TransactionClient;
type SupplierInvoiceSource = Prisma.SupplierInvoiceGetPayload<{
  include: {
    supplier: true;
    branch: true;
    purchaseOrder: true;
    lines: { include: { purchaseOrderItem: true } };
  };
}>;

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function buildSupplierInvoiceSnapshot(
  supplierInvoice: SupplierInvoiceSource,
): ZohoBillSnapshot {
  const eligible = supplierInvoice.branch.type !== 'PARTNERSHIP';
  return {
    localEntityId: supplierInvoice.id,
    externalKey: `RAHO:SUPPLIER_INVOICE:${supplierInvoice.id}`,
    invoiceNumber: supplierInvoice.invoiceNumber,
    supplierInvoiceNumber: supplierInvoice.supplierInvoiceNumber,
    purchaseOrderId: supplierInvoice.purchaseOrderId,
    poNumber: supplierInvoice.purchaseOrder.poNumber,
    supplierId: supplierInvoice.supplierId,
    branchId: supplierInvoice.branchId,
    branchType: supplierInvoice.branch.type,
    invoiceDate: day(supplierInvoice.invoiceDate),
    dueDate: day(supplierInvoice.dueDate),
    currency: supplierInvoice.purchaseOrder.currency,
    amount: supplierInvoice.amount.toFixed(2),
    balanceAmount: supplierInvoice.balanceAmount.toFixed(2),
    eligible,
    excludedReason: eligible
      ? null
      : 'Pembelian Partnership tidak memakai Location internal Zoho.',
    supplier: {
      code: supplierInvoice.supplier.code,
      name: supplierInvoice.supplier.name,
    },
    branch: {
      code: supplierInvoice.branch.branchCode,
      name: supplierInvoice.branch.name,
    },
    lines: supplierInvoice.lines
      .sort((left, right) => left.lineNo - right.lineNo)
      .map((line) => ({
        id: line.id,
        lineNo: line.lineNo,
        purchaseOrderItemId: line.purchaseOrderItemId,
        masterProductId: line.purchaseOrderItem.masterProductId,
        uomId: line.purchaseOrderItem.uomId,
        sku: line.purchaseOrderItem.skuSnapshot,
        name: line.purchaseOrderItem.nameSnapshot,
        uom: line.purchaseOrderItem.uomSnapshot,
        billedQty: line.billedQty.toFixed(4),
        unitPrice: line.unitPrice.toFixed(4),
        lineTotal: line.lineTotal.toFixed(2),
      })),
  };
}

export function enqueueSupplierInvoicePostedTx(
  tx: Tx,
  snapshot: ZohoBillSnapshot,
  occurredAt: Date,
) {
  return tx.integrationEvent.upsert({
    where: {
      eventType_aggregateId: {
        eventType: SUPPLIER_INVOICE_POSTED_EVENT,
        aggregateId: snapshot.localEntityId,
      },
    },
    create: {
      eventType: SUPPLIER_INVOICE_POSTED_EVENT,
      eventVersion: 1,
      aggregateType: 'SupplierInvoice',
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

async function localSupplierInvoice(id: string): Promise<SupplierInvoiceSource> {
  const row = await prisma.supplierInvoice.findUnique({
    where: { id },
    include: {
      supplier: true,
      branch: true,
      purchaseOrder: true,
      lines: { include: { purchaseOrderItem: true } },
    },
  });
  if (!row) {
    throw new AppError(404, 'SUPPLIER_INVOICE_NOT_FOUND', 'Supplier invoice tidak ditemukan.');
  }
  return row;
}

async function baseDependencies(
  connectionId: string,
  snapshot: ZohoBillSnapshot,
) {
  const units = await prisma.unitOfMeasure.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
  });
  const fallbackUomIds = snapshot.lines.flatMap((line) => {
    if (line.uomId) return [];
    const matches = units.filter((unit) =>
      unit.code.toLowerCase() === line.uom.toLowerCase()
      || unit.name.toLowerCase() === line.uom.toLowerCase());
    return matches.length === 1 ? [matches[0].id] : [];
  });
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: connectionId,
      status: 'ACTIVE',
      OR: [
        { entityType: 'SUPPLIER', localEntityId: snapshot.supplierId },
        { entityType: 'BRANCH_LOCATION', localEntityId: snapshot.branchId },
        { entityType: 'PURCHASE_ORDER', localEntityId: snapshot.purchaseOrderId },
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
    units,
    vendorId: find('SUPPLIER', snapshot.supplierId),
    locationId: find('BRANCH_LOCATION', snapshot.branchId),
    purchaseOrderId: find('PURCHASE_ORDER', snapshot.purchaseOrderId),
    itemIds: Object.fromEntries(snapshot.lines.flatMap((line) => {
      const id = find('MASTER_PRODUCT', line.masterProductId);
      return id ? [[billItemKey(line.masterProductId), id]] : [];
    })),
    uomValues: Object.fromEntries(snapshot.lines.flatMap((line) => {
      const localUomId = line.uomId || (() => {
        const matches = units.filter((unit) =>
          unit.code.toLowerCase() === line.uom.toLowerCase()
          || unit.name.toLowerCase() === line.uom.toLowerCase());
        return matches.length === 1 ? matches[0].id : null;
      })();
      const value = localUomId ? find('UOM', localUomId) : null;
      return value ? [[billUomKey(line), value]] : [];
    })),
  };
}

async function resolveDependencies(
  client: ZohoClient,
  snapshot: ZohoBillSnapshot,
): Promise<Partial<ZohoBillDependencies>> {
  const base = await baseDependencies(client.connection.id, snapshot);
  const purchaseOrderLineItemIds: Record<string, string> = {};
  if (base.purchaseOrderId) {
    const response = await client.request<{ purchaseorder?: ZohoPurchaseOrderRemote }>(
      `/books/v3/purchaseorders/${base.purchaseOrderId}`,
    );
    const remoteLines = response.purchaseorder?.line_items || [];
    for (const line of snapshot.lines) {
      const itemId = base.itemIds[billItemKey(line.masterProductId)];
      const byOrder = remoteLines.find((remote) =>
        remote.item_order === line.lineNo && remote.line_item_id != null);
      const byItem = remoteLines.filter((remote) =>
        itemId && String(remote.item_id) === itemId && remote.line_item_id != null);
      const match = byOrder || (byItem.length === 1 ? byItem[0] : undefined);
      if (match?.line_item_id != null) {
        purchaseOrderLineItemIds[billPurchaseOrderLineKey(line.purchaseOrderItemId)] =
          String(match.line_item_id);
      }
    }
  }
  return {
    vendorId: base.vendorId,
    locationId: base.locationId,
    purchaseOrderId: base.purchaseOrderId,
    itemIds: base.itemIds,
    units: base.uomValues,
    purchaseOrderLineItemIds,
  };
}

async function findExisting(
  client: ZohoClient,
  snapshot: ZohoBillSnapshot,
): Promise<ZohoBillRemote[]> {
  const rows = await client.listAll<ZohoBillRemote>('/books/v3/bills', 'bills', {
    reference_number: snapshot.invoiceNumber,
  });
  return rows.filter((row) =>
    row.reference_number === snapshot.invoiceNumber
    || (
      row.bill_number === snapshot.supplierInvoiceNumber
      && row.purchaseorders?.some((po) => po.purchaseorder_number === snapshot.poNumber)
    ));
}

async function saveMapping(input: {
  connectionId: string;
  snapshot: ZohoBillSnapshot;
  zohoBillId: string;
  operation: string;
}) {
  return prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: input.connectionId,
        entityType: 'SUPPLIER_INVOICE',
        localEntityId: input.snapshot.localEntityId,
      },
    },
    create: {
      zohoConnectionId: input.connectionId,
      entityType: 'SUPPLIER_INVOICE',
      localEntityId: input.snapshot.localEntityId,
      zohoEntityType: 'BILL',
      zohoEntityId: input.zohoBillId,
      externalKey: input.snapshot.externalKey,
      status: 'ACTIVE',
      metadata: json({
        operation: input.operation,
        invoiceNumber: input.snapshot.invoiceNumber,
        supplierInvoiceNumber: input.snapshot.supplierInvoiceNumber,
        amount: input.snapshot.amount,
      }),
      lastSyncedAt: new Date(),
    },
    update: {
      zohoEntityId: input.zohoBillId,
      status: 'ACTIVE',
      metadata: json({
        operation: input.operation,
        invoiceNumber: input.snapshot.invoiceNumber,
        supplierInvoiceNumber: input.snapshot.supplierInvoiceNumber,
        amount: input.snapshot.amount,
      }),
      lastSyncedAt: new Date(),
    },
  });
}

export async function handleSupplierInvoicePosted(event: IntegrationEvent) {
  if (
    event.eventType !== SUPPLIER_INVOICE_POSTED_EVENT
    || event.eventVersion !== 1
    || event.aggregateType !== 'SupplierInvoice'
  ) {
    throw new ZohoApiError(
      'Kontrak event supplier invoice tidak didukung.',
      'ZOHO_BILL_EVENT_UNSUPPORTED',
      422,
      false,
    );
  }
  const snapshot = event.payload as unknown as ZohoBillSnapshot;
  if (!snapshot.eligible) {
    return { operation: 'SKIP_POLICY', reason: snapshot.excludedReason };
  }
  const client = await getActiveZohoClient(true);
  const mapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'SUPPLIER_INVOICE',
        localEntityId: snapshot.localEntityId,
      },
    },
  });
  if (mapping) return { operation: 'ALREADY_MAPPED', zohoBillId: mapping.zohoEntityId };

  const resolved = await resolveDependencies(client, snapshot);
  const issues = validateBillSnapshot(snapshot, resolved);
  if (issues.length) {
    throw new ZohoApiError(issues.join(' '), 'ZOHO_BILL_NEEDS_ACTION', 422, false);
  }
  const matches = await findExisting(client, snapshot);
  if (matches.length > 1) {
    throw new ZohoApiError(
      `Lebih dari satu Zoho Bill memakai referensi ${snapshot.invoiceNumber}.`,
      'ZOHO_BILL_AMBIGUOUS',
      409,
      false,
    );
  }
  let remote = matches[0];
  const operation = remote ? 'RECOVER_EXISTING' : 'CREATE';
  if (!remote) {
    const response = await client.request<{ bill?: ZohoBillRemote }>('/books/v3/bills', {
      method: 'POST',
      data: buildZohoBillPayload(snapshot, resolved as ZohoBillDependencies),
    });
    remote = response.bill;
  }
  const zohoBillId = remote?.bill_id == null ? null : String(remote.bill_id);
  if (!zohoBillId) {
    throw new ZohoApiError(
      'Zoho tidak mengembalikan bill_id.',
      'ZOHO_BILL_ID_MISSING',
      502,
      true,
    );
  }
  const saved = await saveMapping({
    connectionId: client.connection.id,
    snapshot,
    zohoBillId,
    operation,
  });
  return {
    operation,
    zohoBillId: saved.zohoEntityId,
    amount: snapshot.amount,
    lineCount: snapshot.lines.length,
  };
}

async function snapshotForInvoice(id: string) {
  const event = await prisma.integrationEvent.findUnique({
    where: {
      eventType_aggregateId: {
        eventType: SUPPLIER_INVOICE_POSTED_EVENT,
        aggregateId: id,
      },
    },
  });
  if (event) {
    return {
      snapshot: event.payload as unknown as ZohoBillSnapshot,
      occurredAt: event.occurredAt,
    };
  }
  const invoice = await localSupplierInvoice(id);
  return {
    snapshot: buildSupplierInvoiceSnapshot(invoice),
    occurredAt: invoice.postedAt,
  };
}

export async function previewBill(actorUserId: string, id: string) {
  const invoice = await localSupplierInvoice(id);
  await assertBranchAccess(actorUserId, invoice.branchId);
  const { snapshot } = await snapshotForInvoice(id);
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  let resolved: Partial<ZohoBillDependencies> = {};
  let connectionIssue: string | null = null;
  if (connection && snapshot.eligible) {
    try {
      const client = await getActiveZohoClient(false);
      resolved = await resolveDependencies(client, snapshot);
    } catch (error) {
      connectionIssue = error instanceof Error ? error.message : 'Dependency Zoho gagal diperiksa.';
    }
  }
  const issues = connection
    ? [...validateBillSnapshot(snapshot, resolved), ...(connectionIssue ? [connectionIssue] : [])]
    : ['Zoho Books belum terhubung.'];
  return {
    snapshot,
    payload: connection && snapshot.eligible && !issues.length
      ? buildZohoBillPayload(snapshot, resolved as ZohoBillDependencies)
      : null,
    issues,
    liveReady: Boolean(connection) && snapshot.eligible && issues.length === 0,
    inventoryPolicy: 'Goods Receipt menaikkan stok/FIFO ERP. Zoho Bill adalah satu-satunya jalur yang menaikkan quantity Zoho; tidak ada inventory adjustment positif tambahan.',
    excludedFields: [
      'batch',
      'expiry',
      'stock_location_detail',
      'goods_receipt_document',
      'medical_data',
      'payment',
    ],
  };
}

export async function enqueueBill(actorUserId: string, id: string) {
  const invoice = await localSupplierInvoice(id);
  await assertBranchAccess(actorUserId, invoice.branchId);
  const current = await prisma.integrationEvent.findUnique({
    where: {
      eventType_aggregateId: {
        eventType: SUPPLIER_INVOICE_POSTED_EVENT,
        aggregateId: id,
      },
    },
  });
  if (current?.status === IntegrationEventStatus.PROCESSING) {
    throw new AppError(409, 'ZOHO_EVENT_PROCESSING', 'Zoho Bill sedang diproses.');
  }
  return prisma.$transaction((tx) => enqueueSupplierInvoicePostedTx(
    tx,
    buildSupplierInvoiceSnapshot(invoice),
    invoice.postedAt,
  ));
}

export async function enqueueBillDependencies(actorUserId: string, id: string) {
  const invoice = await localSupplierInvoice(id);
  await assertBranchAccess(actorUserId, invoice.branchId);
  if (invoice.branch.type === 'PARTNERSHIP') {
    throw new AppError(
      422,
      'ZOHO_BILL_PARTNERSHIP_EXCLUDED',
      'Bill Partnership tidak memakai Location internal Zoho.',
    );
  }
  await enqueueContact('SUPPLIER', invoice.supplierId);
  await enqueueMaster('BRANCH_LOCATION', invoice.branchId);
  await enqueuePurchaseOrder(actorUserId, invoice.purchaseOrderId);
  for (const productId of Array.from(new Set(
    invoice.lines.map((line) => line.purchaseOrderItem.masterProductId),
  ))) {
    await enqueueMaster('MASTER_PRODUCT', productId);
  }
  return {
    supplierId: invoice.supplierId,
    branchId: invoice.branchId,
    purchaseOrderId: invoice.purchaseOrderId,
    productIds: Array.from(new Set(
      invoice.lines.map((line) => line.purchaseOrderItem.masterProductId),
    )),
    note: 'UOM dipetakan manual pada tab Item & Location.',
  };
}

export async function listBills(
  actorUserId: string,
  input: { page: number; limit: number; search?: string },
) {
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const where: Prisma.SupplierInvoiceWhereInput = {
    ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    ...(input.search ? {
      OR: [
        { invoiceNumber: { contains: input.search, mode: 'insensitive' } },
        { supplierInvoiceNumber: { contains: input.search, mode: 'insensitive' } },
        { supplier: { code: { contains: input.search, mode: 'insensitive' } } },
        { supplier: { name: { contains: input.search, mode: 'insensitive' } } },
        { purchaseOrder: { poNumber: { contains: input.search, mode: 'insensitive' } } },
      ],
    } : {}),
  };
  const [rows, total, connection] = await Promise.all([
    prisma.supplierInvoice.findMany({
      where,
      include: {
        supplier: true,
        branch: true,
        purchaseOrder: true,
        lines: true,
      },
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.supplierInvoice.count({ where }),
    prisma.zohoConnection.findFirst({ where: { isActive: true }, select: { id: true } }),
  ]);
  const ids = rows.map((row) => row.id);
  const [mappings, events] = await Promise.all([
    connection
      ? prisma.zohoEntityMapping.findMany({
        where: {
          zohoConnectionId: connection.id,
          entityType: 'SUPPLIER_INVOICE',
          localEntityId: { in: ids },
        },
      })
      : Promise.resolve([]),
    prisma.integrationEvent.findMany({
      where: {
        eventType: SUPPLIER_INVOICE_POSTED_EVENT,
        aggregateId: { in: ids },
      },
    }),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      supplierInvoiceNumber: row.supplierInvoiceNumber,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      amount: row.amount.toFixed(2),
      paidAmount: row.paidAmount.toFixed(2),
      balanceAmount: row.balanceAmount.toFixed(2),
      status: row.status,
      lineCount: row.lines.length,
      supplier: { id: row.supplier.id, code: row.supplier.code, name: row.supplier.name },
      branch: {
        id: row.branch.id,
        code: row.branch.branchCode,
        name: row.branch.name,
        type: row.branch.type,
      },
      purchaseOrder: { id: row.purchaseOrder.id, poNumber: row.purchaseOrder.poNumber },
      mapping: mappings.find((entry) => entry.localEntityId === row.id) || null,
      event: events.find((entry) => entry.aggregateId === row.id) || null,
    })),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

function daysSince(value: Date) {
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 86_400_000));
}

export async function listGrniExceptions(
  actorUserId: string,
  input: { page: number; limit: number; search?: string; overdueOnly?: boolean },
) {
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const where: Prisma.PurchaseOrderWhereInput = {
    goodsReceipts: { some: {} },
    ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    ...(input.search ? {
      OR: [
        { poNumber: { contains: input.search, mode: 'insensitive' } },
        { supplier: { name: { contains: input.search, mode: 'insensitive' } } },
      ],
    } : {}),
  };
  const rows = await prisma.purchaseOrder.findMany({
    where,
    include: {
      supplier: true,
      branch: true,
      goodsReceipts: { orderBy: { receiptDate: 'asc' } },
      items: { orderBy: { lineNo: 'asc' } },
      invoices: { include: { lines: true } },
    },
    orderBy: { orderDate: 'desc' },
  });
  const calculated = rows.map((row) => {
    const receivedValue = row.goodsReceipts.reduce(
      (sum, receipt) => sum.add(receipt.totalValue),
      new Prisma.Decimal(0),
    );
    const billedValue = row.invoices.reduce(
      (sum, invoice) => sum.add(invoice.amount),
      new Prisma.Decimal(0),
    );
    const unbilledValue = Prisma.Decimal.max(receivedValue.sub(billedValue), 0);
    const oldestReceiptAt = row.goodsReceipts[0].receiptDate;
    const ageDays = daysSince(oldestReceiptAt);
    const status = unbilledValue.equals(0)
      ? 'CLEAR'
      : ageDays > env.ZOHO_GRNI_SLA_DAYS ? 'OVERDUE' : 'WAITING';
    const invoiceLines = row.invoices.flatMap((invoice) => invoice.lines);
    return {
      purchaseOrderId: row.id,
      poNumber: row.poNumber,
      supplier: { code: row.supplier.code, name: row.supplier.name },
      branch: { code: row.branch.branchCode, name: row.branch.name },
      oldestReceiptAt,
      ageDays,
      status,
      receivedValue: receivedValue.toFixed(2),
      billedValue: billedValue.toFixed(2),
      unbilledValue: unbilledValue.toFixed(2),
      receiptCount: row.goodsReceipts.length,
      billCount: row.invoices.length,
      hasLegacyAmountOnlyBill: row.invoices.some((invoice) => !invoice.lines.length),
      lines: row.items.map((line) => {
        const billedQty = invoiceLines
          .filter((invoiceLine) => invoiceLine.purchaseOrderItemId === line.id)
          .reduce((sum, invoiceLine) => sum.add(invoiceLine.billedQty), new Prisma.Decimal(0));
        return {
          purchaseOrderItemId: line.id,
          sku: line.skuSnapshot,
          name: line.nameSnapshot,
          receivedQty: line.receivedQty.toFixed(4),
          billedQty: billedQty.toFixed(4),
          unbilledQty: Prisma.Decimal.max(line.receivedQty.sub(billedQty), 0).toFixed(4),
        };
      }),
    };
  });
  const filtered = input.overdueOnly
    ? calculated.filter((row) => row.status === 'OVERDUE')
    : calculated;
  const start = (input.page - 1) * input.limit;
  return {
    summary: {
      waiting: calculated.filter((row) => row.status === 'WAITING').length,
      overdue: calculated.filter((row) => row.status === 'OVERDUE').length,
      clear: calculated.filter((row) => row.status === 'CLEAR').length,
      unbilledValue: calculated.reduce(
        (sum, row) => sum.add(row.unbilledValue),
        new Prisma.Decimal(0),
      ).toFixed(2),
      slaDays: env.ZOHO_GRNI_SLA_DAYS,
    },
    items: filtered.slice(start, start + input.limit),
    pagination: {
      page: input.page,
      limit: input.limit,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / input.limit),
    },
  };
}

export async function reconcileBills(actorUserId: string) {
  const client = await getActiveZohoClient(true);
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const events = await prisma.integrationEvent.findMany({
    where: {
      eventType: SUPPLIER_INVOICE_POSTED_EVENT,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    },
    orderBy: { occurredAt: 'desc' },
    take: 100,
  });
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: client.connection.id,
      entityType: 'SUPPLIER_INVOICE',
      localEntityId: { in: events.map((event) => event.aggregateId) },
    },
  });
  const localRows = await prisma.supplierInvoice.findMany({
    where: { id: { in: events.map((event) => event.aggregateId) } },
    select: { id: true, balanceAmount: true },
  });
  const rows = await Promise.all(events.map(async (event) => {
    const snapshot = event.payload as unknown as ZohoBillSnapshot;
    if (!snapshot.eligible) {
      return {
        supplierInvoiceId: event.aggregateId,
        invoiceNumber: snapshot.invoiceNumber,
        result: { status: 'MATCHED' as const, differences: [] },
      };
    }
    const mapping = mappings.find((entry) => entry.localEntityId === event.aggregateId);
    if (!mapping) {
      return {
        supplierInvoiceId: event.aggregateId,
        invoiceNumber: snapshot.invoiceNumber,
        result: reconcileBill(snapshot),
      };
    }
    const response = await client.request<{ bill?: ZohoBillRemote }>(
      `/books/v3/bills/${mapping.zohoEntityId}`,
    );
    const result = reconcileBill(snapshot, response.bill);
    const local = localRows.find((row) => row.id === event.aggregateId);
    if (
      response.bill?.balance != null
      && local
      && !new Prisma.Decimal(response.bill.balance).toDecimalPlaces(2)
        .equals(local.balanceAmount.toDecimalPlaces(2))
    ) {
      result.status = 'MISMATCH';
      result.differences.push('Saldo AP Zoho Bill berbeda dari balance supplier invoice ERP.');
    }
    return {
      supplierInvoiceId: event.aggregateId,
      invoiceNumber: snapshot.invoiceNumber,
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
