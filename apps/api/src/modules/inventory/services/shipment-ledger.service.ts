import { createHash, randomUUID } from 'crypto';
import {
  AccountType,
  AuditAction,
  BranchType,
  DiscrepancyType,
  InternalTransferStatus,
  InventoryPostingStatus,
  InventoryPostingType,
  InventoryValuationStatus,
  Prisma,
  ShipmentDiscrepancyStatus,
  ShipmentStatus,
  StockMutationType,
  StockRequestStatus,
  StockReservationStatus,
} from '@prisma/client';
import { env } from '@config/env';
import { uploadFile } from '@config/minio';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { postInventoryDerivedJournal } from '@modules/accounting/accounting.service';
import { assertBranchAccess, assertPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { logAudit } from '@utils/auditLog';
import {
  buildPartnershipGoodsShippedPayload,
  PARTNERSHIP_GOODS_SHIPPED_EVENT,
} from '@modules/zoho/zoho-routing.policy';
import type {
  DispatchShipmentInput,
  ReceiveShipmentLedgerInput,
  ShipmentReceiptEvidence,
} from '../shipment-ledger.schema';
import { allocateFifo, type FifoLayerInput, sumAllocationCost } from './fifo-allocation.service';
import { buildInternalTransferJournal, INTERNAL_TRANSFER_ACCOUNTS } from './internal-transfer-posting.helpers';

type Tx = Prisma.TransactionClient;

type LockedInventoryItem = {
  id: string;
  masterProductId: string;
  branchId: string;
  stock: Prisma.Decimal;
  warehouseId: string | null;
  stockLocationId: string | null;
};

type LockedCostLayer = FifoLayerInput & { currency: string };

type LockedTransferLayer = {
  id: string;
  shipmentItemId: string;
  sourceInventoryBalanceId: string;
  batchId: string | null;
  shippedQty: Prisma.Decimal;
  receivedQty: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  currency: string;
};

type ReceiptOptions = {
  receiptFile?: Express.Multer.File;
  evidence?: ShipmentReceiptEvidence;
};

const MAX_TRANSACTION_ATTEMPTS = 3;

async function assertInternalTransferAccounts(tx: Tx) {
  const accountCodes = [INTERNAL_TRANSFER_ACCOUNTS.inventory, INTERNAL_TRANSFER_ACCOUNTS.inTransit];
  const accounts = await tx.account.findMany({
    where: { code: { in: accountCodes } },
    select: { code: true, type: true, isActive: true, allowPosting: true },
  });
  const accountByCode = new Map(accounts.map((account) => [account.code, account]));
  for (const code of accountCodes) {
    const account = accountByCode.get(code);
    if (!account?.isActive || !account.allowPosting || account.type !== AccountType.ASSET) {
      throw errors.unprocessable(
        'INTERNAL_TRANSFER_ACCOUNT_INVALID',
        `Account ${code} wajib berupa akun aset aktif dan postable.`,
      );
    }
  }
}

async function postDispatchTransferAccounting(
  tx: Tx,
  input: {
    shipmentId: string;
    shipmentCode: string;
    fromBranchId: string;
    toBranchId: string;
    postingId: string;
    totalCost: Prisma.Decimal;
    occurredAt: Date;
    actorUserId: string;
  },
) {
  await assertInternalTransferAccounts(tx);
  const journalLines = buildInternalTransferJournal('DISPATCH', input.totalCost);
  const journalResult = await postInventoryDerivedJournal({
    postingKey: `INTERNAL_TRANSFER:DISPATCH:${input.shipmentId}`,
    transactionDate: input.occurredAt,
    branchId: input.fromBranchId,
    actorUserId: input.actorUserId,
    description: `Dispatch internal transfer ${input.shipmentCode}`,
    lines: journalLines.map((line) => ({
      ...line,
      branchId: input.fromBranchId,
      description: line.accountCode === INTERNAL_TRANSFER_ACCOUNTS.inTransit
        ? 'Persediaan dalam perjalanan'
        : 'Persediaan keluar untuk transfer internal',
    })),
    sourceLinks: [{
      sourceType: 'INTERNAL_TRANSFER',
      sourceId: input.shipmentId,
      sourceNumber: input.shipmentCode,
      relationType: 'DISPATCH',
    }],
    metadata: {
      policy: 'INTERNAL_TRANSFER_IN_TRANSIT',
      noRevenueOrExpense: true,
      inventoryValue: input.totalCost.toFixed(4),
    },
  }, tx);
  const ledger = await tx.internalTransferLedger.create({
    data: {
      shipmentId: input.shipmentId,
      fromBranchId: input.fromBranchId,
      toBranchId: input.toBranchId,
      totalValue: input.totalCost,
      dispatchInventoryPostingId: input.postingId,
      dispatchJournalEntryId: journalResult.journal.id,
      dispatchedAt: input.occurredAt,
    },
  });
  await tx.auditLog.create({
    data: {
      userId: input.actorUserId,
      branchId: input.fromBranchId,
      action: 'CREATE',
      module: 'INVENTORY',
      resource: 'InternalTransferLedger',
      resourceId: ledger.id,
      entityType: 'InternalTransferLedger',
      entityId: ledger.id,
      entityCode: input.shipmentCode,
      afterData: {
        status: ledger.status,
        totalValue: ledger.totalValue.toFixed(4),
        dispatchInventoryPostingId: input.postingId,
        dispatchJournalEntryId: journalResult.journal.id,
      },
      description: `Internal transfer ${input.shipmentCode} dispatched.`,
    },
  });
  return ledger;
}

async function postReceiptTransferAccounting(
  tx: Tx,
  input: {
    shipmentId: string;
    shipmentCode: string;
    receiptId: string;
    receiptPostingId: string;
    receiptCost: Prisma.Decimal;
    status: InternalTransferStatus;
    occurredAt: Date;
    actorUserId: string;
  },
) {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "internal_transfer_ledgers"
    WHERE "shipmentId" = ${input.shipmentId}
    FOR UPDATE
  `);
  const ledger = await tx.internalTransferLedger.findUnique({ where: { shipmentId: input.shipmentId } });
  if (!ledger) {
    throw errors.unprocessable(
      'TRANSFER_DISPATCH_MISSING',
      'Posting dispatch internal transfer tidak ditemukan.',
    );
  }
  const receivedValue = ledger.receivedValue.add(input.receiptCost);
  if (receivedValue.greaterThan(ledger.totalValue)) {
    throw errors.conflict('TRANSFER_VALUE_MISMATCH', 'Nilai receipt melebihi nilai internal transfer.');
  }

  let receiptJournalEntryId: string | undefined;
  if (input.receiptCost.isPositive()) {
    await assertInternalTransferAccounts(tx);
    const journalLines = buildInternalTransferJournal('RECEIPT', input.receiptCost);
    const journalResult = await postInventoryDerivedJournal({
      postingKey: `INTERNAL_TRANSFER:RECEIPT:${input.shipmentId}:${input.receiptId}`,
      transactionDate: input.occurredAt,
      branchId: ledger.toBranchId,
      actorUserId: input.actorUserId,
      description: `Receipt internal transfer ${input.shipmentCode}`,
      lines: journalLines.map((line) => ({
        ...line,
        branchId: line.accountCode === INTERNAL_TRANSFER_ACCOUNTS.inventory
          ? ledger.toBranchId
          : ledger.fromBranchId,
        description: line.accountCode === INTERNAL_TRANSFER_ACCOUNTS.inventory
          ? 'Persediaan diterima dari transfer internal'
          : 'Pelepasan persediaan dalam perjalanan',
      })),
      sourceLinks: [{
        sourceType: 'INTERNAL_TRANSFER',
        sourceId: input.shipmentId,
        sourceNumber: input.shipmentCode,
        relationType: 'RECEIPT',
      }],
      metadata: {
        policy: 'INTERNAL_TRANSFER_IN_TRANSIT',
        noRevenueOrExpense: true,
        shipmentReceiptId: input.receiptId,
        inventoryValue: input.receiptCost.toFixed(4),
      },
    }, tx);
    receiptJournalEntryId = journalResult.journal.id;
  }

  const updated = await tx.internalTransferLedger.update({
    where: { id: ledger.id },
    data: {
      status: input.status,
      receivedValue,
      receivedAt: input.occurredAt,
      ...(receiptJournalEntryId ? {
        receiptInventoryPostingId: input.receiptPostingId,
        receiptJournalEntryId,
      } : {}),
    },
  });
  await tx.auditLog.create({
    data: {
      userId: input.actorUserId,
      branchId: ledger.toBranchId,
      action: 'UPDATE',
      module: 'INVENTORY',
      resource: 'InternalTransferLedger',
      resourceId: ledger.id,
      entityType: 'InternalTransferLedger',
      entityId: ledger.id,
      entityCode: input.shipmentCode,
      beforeData: { status: ledger.status, receivedValue: ledger.receivedValue.toFixed(4) },
      afterData: {
        status: updated.status,
        receivedValue: updated.receivedValue.toFixed(4),
        receiptInventoryPostingId: updated.receiptInventoryPostingId,
        receiptJournalEntryId: updated.receiptJournalEntryId,
      },
      description: `Internal transfer ${input.shipmentCode} receipt posted.`,
    },
  });
  return updated;
}

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function postingNumber(prefix: 'SHP' | 'TRN'): string {
  return `INV-${prefix}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function receiptNumber(): string {
  return `RCPT-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function isRetryableTransactionError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : String(error);
  return code === 'P2002' || code === 'P2034' || /40001|40P01|serialization|deadlock/i.test(message);
}

async function withTransactionRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt + Math.floor(Math.random() * 15)));
    }
  }
  throw lastError;
}

async function lockInventoryItems(tx: Tx, ids: string[]): Promise<LockedInventoryItem[]> {
  const orderedIds = [...new Set(ids)].sort();
  if (orderedIds.length === 0) return [];
  return tx.$queryRaw<LockedInventoryItem[]>(Prisma.sql`
    SELECT "id", "masterProductId", "branchId", "stock", "warehouseId", "stockLocationId"
    FROM "inventory_items"
    WHERE "id" IN (${Prisma.join(orderedIds)})
    ORDER BY "id"
    FOR UPDATE
  `);
}

async function lockValidCostLayers(
  tx: Tx,
  inventoryBalanceId: string,
  occurredAt: Date,
): Promise<LockedCostLayer[]> {
  return tx.$queryRaw<LockedCostLayer[]>(Prisma.sql`
    SELECT l."id", l."inventoryBalanceId", l."batchId", l."receivedAt",
           l."remainingQty", l."unitCost", l."currency"
    FROM "inventory_cost_layers" l
    LEFT JOIN "inventory_batches" batch ON batch."id" = l."batchId"
    WHERE l."inventoryBalanceId" = ${inventoryBalanceId}
      AND l."remainingQty" > 0
      AND l."unitCost" IS NOT NULL
      AND l."valuationStatus" = 'VALUED'
      AND l."isVoided" = false
      AND l."receivedAt" <= ${occurredAt}
      AND (batch."id" IS NULL OR (
        batch."isBlocked" = false
        AND (batch."expiryDate" IS NULL OR batch."expiryDate" > ${occurredAt})
      ))
    ORDER BY l."receivedAt", l."id"
    FOR UPDATE OF l
  `);
}

async function lockTransferLayers(tx: Tx, shipmentItemId: string): Promise<LockedTransferLayer[]> {
  return tx.$queryRaw<LockedTransferLayer[]>(Prisma.sql`
    SELECT "id", "shipmentItemId", "sourceInventoryBalanceId", "batchId",
           "shippedQty", "receivedQty", "unitCost", "currency"
    FROM "shipment_transfer_layers"
    WHERE "shipmentItemId" = ${shipmentItemId}
      AND "receivedQty" < "shippedQty"
    ORDER BY "createdAt", "id"
    FOR UPDATE
  `);
}

function normalizeDispatchPayload(shipmentId: string, input: DispatchShipmentInput) {
  return {
    shipmentId,
    notes: input.notes ?? null,
    shipmentPhotoUrl: input.shipmentPhotoUrl ?? null,
    shipmentPhotoName: input.shipmentPhotoName ?? null,
    items: input.items
      ? [...input.items]
        .map((item) => ({ masterProductId: item.masterProductId, sentQty: item.sentQty }))
        .sort((a, b) => a.masterProductId.localeCompare(b.masterProductId))
      : null,
  };
}

function normalizeReceiptPayload(
  shipmentId: string,
  input: ReceiveShipmentLedgerInput,
  evidenceChecksum: string,
) {
  return {
    shipmentId,
    isFinal: input.isFinal,
    notes: input.notes ?? null,
    evidenceChecksum,
    receivedItems: [...input.receivedItems]
      .map((item) => ({
        masterProductId: item.masterProductId,
        receivedQty: item.receivedQty,
        quarantineQty: item.quarantineQty,
        stockLocationId: item.stockLocationId ?? null,
      }))
      .sort((a, b) => a.masterProductId.localeCompare(b.masterProductId)),
    discrepancies: [...input.discrepancies]
      .map((item) => ({
        masterProductId: item.masterProductId,
        discrepancyType: item.discrepancyType,
        notes: item.notes,
        photoUrl: item.photoUrl ?? null,
        photoFileName: item.photoFileName ?? null,
      }))
      .sort((a, b) => `${a.masterProductId}:${a.discrepancyType}`.localeCompare(`${b.masterProductId}:${b.discrepancyType}`)),
  };
}

async function validateLocation(tx: Tx, branchId: string, stockLocationId: string) {
  const location = await tx.stockLocation.findUnique({
    where: { id: stockLocationId },
    include: { warehouse: true },
  });
  if (!location?.isActive || !location.warehouse.isActive || location.warehouse.branchId !== branchId) {
    throw errors.badRequest('INVALID_DESTINATION_LOCATION', 'Stock location tujuan tidak aktif atau tidak sesuai branch tujuan.');
  }
  return location;
}

async function resolveDestinationInventory(
  tx: Tx,
  branchId: string,
  masterProductId: string,
  requestedLocationId?: string,
) {
  let inventoryItem = await tx.inventoryItem.findUnique({
    where: { masterProductId_branchId: { masterProductId, branchId } },
  });

  let stockLocationId = requestedLocationId ?? inventoryItem?.stockLocationId ?? undefined;
  if (!stockLocationId) {
    const defaultLocation = await tx.stockLocation.findFirst({
      where: { isActive: true, warehouse: { branchId, isActive: true } },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });
    if (!defaultLocation) {
      throw errors.unprocessable('DESTINATION_LOCATION_NOT_FOUND', 'Branch tujuan belum memiliki stock location aktif.');
    }
    stockLocationId = defaultLocation.id;
  }
  const location = await validateLocation(tx, branchId, stockLocationId);

  if (!inventoryItem) {
    inventoryItem = await tx.inventoryItem.create({
      data: {
        branchId,
        masterProductId,
        stock: 0,
        minThreshold: 0,
        warehouseId: location.warehouseId,
        stockLocationId: location.id,
      },
    });
  } else if (inventoryItem.warehouseId !== location.warehouseId || inventoryItem.stockLocationId !== location.id) {
    inventoryItem = await tx.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { warehouseId: location.warehouseId, stockLocationId: location.id },
    });
  }

  const [lockedItem] = await lockInventoryItems(tx, [inventoryItem.id]);
  if (!lockedItem) throw errors.notFound('Inventory item tujuan tidak ditemukan.');
  return { inventoryItem: lockedItem, location };
}

async function loadReceiptResult(receiptId: string) {
  return prisma.shipmentReceipt.findUniqueOrThrow({
    where: { id: receiptId },
    include: {
      inventoryPosting: { include: { stockMutations: true } },
      items: { include: { shipmentItem: { include: { masterProduct: true } }, transferLayer: true } },
      discrepancies: true,
      shipment: { include: { fromBranch: true, toBranch: true, items: { include: { masterProduct: true } } } },
    },
  });
}

async function prepareEvidence(
  shipmentId: string,
  options: ReceiptOptions,
): Promise<ShipmentReceiptEvidence> {
  if (options.evidence) return options.evidence;
  const file = options.receiptFile;
  if (!file) throw errors.badRequest('RECEIPT_FILE_REQUIRED', 'File tanda terima wajib diupload.');

  const checksum = createHash('sha256').update(file.buffer).digest('hex');
  const extension = file.mimetype === 'application/pdf' ? 'pdf' : 'jpg';
  const key = `uploads/shipments/${shipmentId}/receipt-${checksum.slice(0, 24)}.${extension}`;
  const uploaded = await uploadFile(file.buffer, key, file.mimetype);
  return {
    url: `${env.API_PREFIX}/files/${uploaded.key}`,
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
    checksum,
  };
}

export async function hasReservedShipment(shipmentId: string): Promise<boolean> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      shipIdempotencyKey: true,
      stockRequest: { select: { _count: { select: { reservations: true } } } },
      _count: { select: { receipts: true } },
    },
  });
  return Boolean(
    shipment
    && (shipment.shipIdempotencyKey || shipment.stockRequest._count.reservations > 0 || shipment._count.receipts > 0),
  );
}

export async function dispatchReservedShipment(
  actorUserId: string,
  shipmentId: string,
  input: DispatchShipmentInput,
) {
  const scope = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      fromBranchId: true,
      toBranchId: true,
      toBranch: { select: { type: true } },
    },
  });
  if (!scope) throw errors.notFound('Shipment tidak ditemukan.');
  await assertBranchAccess(actorUserId, scope.toBranchId);
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_SHIPMENT_DISPATCH, scope.fromBranchId);

  const payloadHash = hashPayload(normalizeDispatchPayload(shipmentId, input));
  const dispatchResult = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
    const duplicateKey = await tx.shipment.findUnique({ where: { shipIdempotencyKey: input.idempotencyKey } });
    if (duplicateKey) {
      if (duplicateKey.id !== shipmentId || duplicateKey.shipPayloadHash !== payloadHash) {
        throw errors.conflict('IDEMPOTENCY_CONFLICT', 'Idempotency key dispatch sudah digunakan dengan payload berbeda.');
      }
      const existingPosting = await tx.inventoryPosting.findUnique({
        where: { idempotencyKey: `SHIPMENT_DISPATCH:${input.idempotencyKey}` },
      });
      if (!existingPosting) throw errors.conflict('DISPATCH_LEDGER_MISSING', 'Shipment sudah dikirim tetapi posting ledger tidak ditemukan.');
      return { postingId: existingPosting.id, created: false };
    }

    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "shipments" WHERE "id" = ${shipmentId} FOR UPDATE`);
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: { include: { masterProduct: true } },
        stockRequest: {
          include: {
            invoice: { include: { items: true } },
            reservations: {
              where: { status: StockReservationStatus.ACTIVE },
              include: { inventoryBalance: true, stockRequestItem: true },
              orderBy: [{ inventoryBalanceId: 'asc' }, { id: 'asc' }],
            },
          },
        },
        toBranch: { select: { type: true } },
      },
    });
    if (!shipment) throw errors.notFound('Shipment tidak ditemukan.');
    if (shipment.status !== ShipmentStatus.PREPARING) {
      throw errors.conflict('INVALID_SHIPMENT_STATUS', `Shipment berstatus ${shipment.status} dan tidak dapat dikirim.`);
    }
    if (shipment.stockRequest.reservations.length === 0) {
      throw errors.unprocessable('ACTIVE_RESERVATION_REQUIRED', 'Dispatch ledger memerlukan reservation aktif.');
    }
    const isPartnershipShipment = shipment.toBranch.type === BranchType.PARTNERSHIP;
    if (isPartnershipShipment && !shipment.stockRequest.invoice) {
      throw errors.unprocessable(
        'PARTNERSHIP_INVOICE_REQUIRED',
        'Shipment Partnership wajib memiliki invoice sebelum dikirim.',
      );
    }

    const providedItems = new Map<string, Prisma.Decimal>();
    for (const item of input.items ?? []) {
      if (providedItems.has(item.masterProductId)) {
        throw errors.badRequest('DUPLICATE_SHIPMENT_ITEM', 'Item dispatch tidak boleh duplikat.');
      }
      providedItems.set(item.masterProductId, new Prisma.Decimal(item.sentQty));
    }
    if (providedItems.size > 0 && providedItems.size !== shipment.items.length) {
      throw errors.badRequest('INCOMPLETE_SHIPMENT_ITEMS', 'Semua item shipment harus dikirim dalam satu dispatch.');
    }

    const reservationsByProduct = new Map<string, typeof shipment.stockRequest.reservations>();
    for (const reservation of shipment.stockRequest.reservations) {
      const rows = reservationsByProduct.get(reservation.stockRequestItem.masterProductId) ?? [];
      rows.push(reservation);
      reservationsByProduct.set(reservation.stockRequestItem.masterProductId, rows);
    }
    if ([...reservationsByProduct.keys()].some(
      (productId) => !shipment.items.some((item) => item.masterProductId === productId),
    )) {
      throw errors.conflict('RESERVATION_SHIPMENT_MISMATCH', 'Reservation aktif tidak memiliki item shipment yang sesuai.');
    }

    for (const shipmentItem of shipment.items) {
      const sentQty = providedItems.get(shipmentItem.masterProductId) ?? shipmentItem.sentQty;
      const reservedQty = (reservationsByProduct.get(shipmentItem.masterProductId) ?? []).reduce(
        (sum, reservation) => sum.add(reservation.quantity.sub(reservation.releasedQty).sub(reservation.consumedQty)),
        new Prisma.Decimal(0),
      );
      if (!sentQty.equals(shipmentItem.sentQty) || !sentQty.equals(reservedQty)) {
        throw errors.unprocessable(
          'SHIPMENT_RESERVATION_MISMATCH',
          `Jumlah kirim ${shipmentItem.masterProduct.name} harus sama dengan reservation aktif ${reservedQty.toFixed(4)}.`,
        );
      }
    }
    if ([...providedItems.keys()].some((productId) => !shipment.items.some((item) => item.masterProductId === productId))) {
      throw errors.badRequest('INVALID_SHIPMENT_ITEM', 'Item dispatch tidak terdaftar pada shipment.');
    }

    const reservationIds = shipment.stockRequest.reservations.map((reservation) => reservation.id).sort();
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "stock_reservations"
      WHERE "id" IN (${Prisma.join(reservationIds)})
      ORDER BY "id" FOR UPDATE
    `);
    const sourceBalanceIds = [...new Set(
      shipment.stockRequest.reservations.map((reservation) => reservation.inventoryBalanceId),
    )].sort();
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "inventory_balances"
      WHERE "id" IN (${Prisma.join(sourceBalanceIds)})
      ORDER BY "id" FOR UPDATE
    `);
    const sourceItems = await lockInventoryItems(
      tx,
      shipment.stockRequest.reservations.map((reservation) => reservation.inventoryBalance.inventoryItemId),
    );
    const sourceItemById = new Map(sourceItems.map((item) => [item.id, item]));

    const posting = await tx.inventoryPosting.create({
      data: {
        postingNumber: postingNumber('SHP'),
        idempotencyKey: `SHIPMENT_DISPATCH:${input.idempotencyKey}`,
        payloadHash,
        type: InventoryPostingType.TRANSFER_OUT,
        status: InventoryPostingStatus.POSTED,
        reasonCode: 'SHIPMENT_DISPATCH',
        sourceType: 'SHIPMENT',
        sourceId: shipment.id,
        sourceNumber: shipment.shipmentCode,
        branchId: shipment.fromBranchId,
        occurredAt: input.occurredAt,
        totalCost: 0,
        postedBy: actorUserId,
      },
    });

    let postingTotalCost = new Prisma.Decimal(0);
    const costByProduct = new Map<string, Prisma.Decimal>();
    const shippedAt = input.occurredAt;
    for (const shipmentItem of [...shipment.items].sort((a, b) => a.id.localeCompare(b.id))) {
      const reservations = reservationsByProduct.get(shipmentItem.masterProductId) ?? [];
      for (const reservation of reservations) {
        const quantity = reservation.quantity.sub(reservation.releasedQty).sub(reservation.consumedQty);
        if (!quantity.isPositive()) continue;
        const balance = reservation.inventoryBalance;
        await tx.$queryRaw(Prisma.sql`
          SELECT "id" FROM "inventory_balances" WHERE "id" = ${balance.id} FOR UPDATE
        `);
        const layers = await lockValidCostLayers(tx, balance.id, input.occurredAt);
        const allocations = allocateFifo(quantity, layers);
        const allocationCost = sumAllocationCost(allocations);
        const sourceItem = sourceItemById.get(balance.inventoryItemId);
        if (
          !sourceItem
          || sourceItem.masterProductId !== shipmentItem.masterProductId
          || sourceItem.branchId !== shipment.fromBranchId
        ) {
          throw errors.conflict('RESERVATION_ITEM_MISMATCH', 'Reservation tidak konsisten dengan inventory source.');
        }

        const balanceUpdate = await tx.inventoryBalance.updateMany({
          where: { id: balance.id, onHandQty: { gte: quantity }, reservedQty: { gte: quantity } },
          data: {
            onHandQty: { decrement: quantity },
            reservedQty: { decrement: quantity },
            ...(!isPartnershipShipment ? { inTransitQty: { increment: quantity } } : {}),
            version: { increment: 1 },
          },
        });
        if (balanceUpdate.count !== 1) {
          throw errors.conflict('SOURCE_BALANCE_CHANGED', 'Stock source berubah saat dispatch. Silakan ulangi.');
        }
        const itemUpdate = await tx.inventoryItem.updateMany({
          where: { id: sourceItem.id, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (itemUpdate.count !== 1) throw errors.conflict('NEGATIVE_STOCK_PREVENTED', 'Dispatch akan membuat stock source negatif.');

        const mutation = await tx.stockMutation.create({
          data: {
            inventoryItemId: sourceItem.id,
            type: StockMutationType.TRANSFER_OUT,
            quantity,
            stockBefore: sourceItem.stock,
            stockAfter: sourceItem.stock.sub(quantity),
            referenceType: 'SHIPMENT',
            referenceId: shipment.id,
            notes: `Dispatch ${shipment.shipmentCode}`,
            createdBy: actorUserId,
            inventoryPostingId: posting.id,
            inventoryBalanceId: balance.id,
            batchId: balance.batchId,
            actualCost: allocationCost,
          },
        });
        void mutation;

        for (const allocation of allocations) {
          const layer = layers.find((candidate) => candidate.id === allocation.layerId)!;
          await tx.inventoryCostLayer.update({
            where: { id: allocation.layerId },
            data: { remainingQty: { decrement: allocation.quantity } },
          });
          await tx.shipmentTransferLayer.create({
            data: {
              shipmentItemId: shipmentItem.id,
              sourceCostLayerId: allocation.layerId,
              sourceInventoryBalanceId: allocation.inventoryBalanceId,
              batchId: allocation.batchId,
              shippedQty: allocation.quantity,
              unitCost: allocation.unitCost,
              totalCost: allocation.totalCost,
              currency: layer.currency,
            },
          });
        }

        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: {
            consumedQty: reservation.quantity,
            status: StockReservationStatus.CONSUMED,
            consumedBy: actorUserId,
            consumedAt: shippedAt,
          },
        });
        sourceItem.stock = sourceItem.stock.sub(quantity);
        postingTotalCost = postingTotalCost.add(allocationCost);
        costByProduct.set(
          shipmentItem.masterProductId,
          (costByProduct.get(shipmentItem.masterProductId) ?? new Prisma.Decimal(0)).add(allocationCost),
        );
      }
    }

    await tx.inventoryPosting.update({ where: { id: posting.id }, data: { totalCost: postingTotalCost } });
    if (isPartnershipShipment) {
      const invoice = shipment.stockRequest.invoice!;
      const payload = buildPartnershipGoodsShippedPayload({
        partnershipBranchId: shipment.toBranchId,
        stockRequestId: shipment.stockRequestId,
        stockRequestInvoiceId: invoice.id,
        shipmentCode: shipment.shipmentCode,
        invoiceNumber: invoice.invoiceNumber,
        revenueAmount: invoice.totalAmount,
        invoiceItems: invoice.items.map((item) => ({
          masterProductId: item.masterProductId,
          sku: item.sku,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
        })),
        shipmentCosts: shipment.items.map((item) => ({
          masterProductId: item.masterProductId,
          quantity: item.sentQty,
          totalCost: costByProduct.get(item.masterProductId) ?? new Prisma.Decimal(0),
        })),
      });
      await tx.integrationEvent.create({
        data: {
          eventType: PARTNERSHIP_GOODS_SHIPPED_EVENT,
          eventVersion: 1,
          aggregateType: 'Shipment',
          aggregateId: shipment.id,
          branchId: shipment.toBranchId,
          payload,
          occurredAt: shippedAt,
        },
      });
    } else {
      await postDispatchTransferAccounting(tx, {
        shipmentId: shipment.id,
        shipmentCode: shipment.shipmentCode,
        fromBranchId: shipment.fromBranchId,
        toBranchId: shipment.toBranchId,
        postingId: posting.id,
        totalCost: postingTotalCost,
        occurredAt: shippedAt,
        actorUserId,
      });
    }
    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: ShipmentStatus.SHIPPED,
        shipIdempotencyKey: input.idempotencyKey,
        shipPayloadHash: payloadHash,
        shippedAt,
        shippedBy: actorUserId,
        notes: input.notes ?? shipment.notes,
        shipmentPhotoUrl: input.shipmentPhotoUrl,
        shipmentPhotoName: input.shipmentPhotoName,
      },
    });
    await tx.stockRequest.update({
      where: { id: shipment.stockRequestId },
      data: { status: StockRequestStatus.SHIPPED, shippedAt, shippedBy: actorUserId },
    });
    return { postingId: posting.id, created: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

  const posting = await prisma.inventoryPosting.findUniqueOrThrow({
    where: { id: dispatchResult.postingId },
    include: { stockMutations: true },
  });
  if (dispatchResult.created) {
    await logAudit({
      userId: actorUserId,
      branchId: scope.fromBranchId,
      action: AuditAction.SHIPMENT,
      resource: 'Shipment',
      resourceId: shipmentId,
      afterData: {
        status: ShipmentStatus.SHIPPED,
        inventoryPostingId: posting.id,
        totalCost: posting.totalCost,
        mutationCount: posting.stockMutations.length,
      },
      meta: { idempotencyKey: input.idempotencyKey },
    });
  }
  return posting;
}

export async function receiveReservedShipment(
  actorUserId: string,
  shipmentId: string,
  input: ReceiveShipmentLedgerInput,
  options: ReceiptOptions = {},
) {
  const scope = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      fromBranchId: true,
      toBranchId: true,
      toBranch: { select: { type: true } },
    },
  });
  if (!scope) throw errors.notFound('Shipment tidak ditemukan.');
  if (scope.toBranch.type === BranchType.PARTNERSHIP) {
    throw errors.unprocessable(
      'PARTNERSHIP_RECEIPT_IS_DELIVERY_CONFIRMATION',
      'Penerimaan Partnership tidak boleh menambah inventory milik perusahaan. Gunakan konfirmasi delivery.',
    );
  }
  await assertBranchAccess(actorUserId, scope.toBranchId);
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_SHIPMENT_RECEIVE, scope.toBranchId);

  const fileChecksum = options.evidence?.checksum
    ?? (options.receiptFile ? createHash('sha256').update(options.receiptFile.buffer).digest('hex') : '');
  if (!fileChecksum) throw errors.badRequest('RECEIPT_FILE_REQUIRED', 'File tanda terima wajib diupload.');
  const payloadHash = hashPayload(normalizeReceiptPayload(shipmentId, input, fileChecksum));

  const existing = await prisma.shipmentReceipt.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.shipmentId !== shipmentId || existing.payloadHash !== payloadHash) {
      throw errors.conflict('IDEMPOTENCY_CONFLICT', 'Idempotency key receipt sudah digunakan dengan payload berbeda.');
    }
    return loadReceiptResult(existing.id);
  }
  const evidence = await prepareEvidence(shipmentId, options);

  const receiptResult = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
    const duplicateKey = await tx.shipmentReceipt.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (duplicateKey) {
      if (duplicateKey.shipmentId !== shipmentId || duplicateKey.payloadHash !== payloadHash) {
        throw errors.conflict('IDEMPOTENCY_CONFLICT', 'Idempotency key receipt sudah digunakan dengan payload berbeda.');
      }
      return { receiptId: duplicateKey.id, created: false };
    }

    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "shipments" WHERE "id" = ${shipmentId} FOR UPDATE`);
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: { items: { include: { masterProduct: true } }, stockRequest: true },
    });
    if (!shipment) throw errors.notFound('Shipment tidak ditemukan.');
    if (shipment.status !== ShipmentStatus.SHIPPED && shipment.status !== ShipmentStatus.PARTIALLY_RECEIVED) {
      throw errors.conflict('INVALID_SHIPMENT_STATUS', `Shipment berstatus ${shipment.status} dan tidak dapat diterima.`);
    }

    const shipmentItemByProduct = new Map(shipment.items.map((item) => [item.masterProductId, item]));
    for (const item of input.receivedItems) {
      if (!shipmentItemByProduct.has(item.masterProductId)) {
        throw errors.badRequest('INVALID_RECEIPT_ITEM', 'Item receipt tidak terdaftar pada shipment.');
      }
    }
    for (const discrepancy of input.discrepancies) {
      if (!shipmentItemByProduct.has(discrepancy.masterProductId)) {
        throw errors.badRequest('INVALID_DISCREPANCY_ITEM', 'Item discrepancy tidak terdaftar pada shipment.');
      }
    }

    const posting = await tx.inventoryPosting.create({
      data: {
        postingNumber: postingNumber('TRN'),
        idempotencyKey: `SHIPMENT_RECEIPT:${input.idempotencyKey}`,
        payloadHash,
        type: InventoryPostingType.TRANSFER_IN,
        status: InventoryPostingStatus.POSTED,
        reasonCode: 'SHIPMENT_RECEIPT',
        sourceType: 'SHIPMENT',
        sourceId: shipment.id,
        sourceNumber: shipment.shipmentCode,
        branchId: shipment.toBranchId,
        occurredAt: input.occurredAt,
        totalCost: 0,
        postedBy: actorUserId,
      },
    });
    const receipt = await tx.shipmentReceipt.create({
      data: {
        receiptNumber: receiptNumber(),
        shipmentId: shipment.id,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        inventoryPostingId: posting.id,
        isFinal: input.isFinal,
        totalQuantity: 0,
        quarantinedQuantity: 0,
        totalCost: 0,
        evidenceFileUrl: evidence.url,
        evidenceFileName: evidence.fileName,
        evidenceFileSize: evidence.fileSize,
        evidenceMimeType: evidence.mimeType,
        evidenceChecksum: evidence.checksum,
        notes: input.notes,
        receivedBy: actorUserId,
        receivedAt: input.occurredAt,
      },
    });

    let receiptQuantity = new Prisma.Decimal(0);
    let receiptQuarantine = new Prisma.Decimal(0);
    let receiptCost = new Prisma.Decimal(0);
    const eventQuarantineByProduct = new Map<string, Prisma.Decimal>();

    for (const line of [...input.receivedItems].sort((a, b) => a.masterProductId.localeCompare(b.masterProductId))) {
      const shipmentItem = shipmentItemByProduct.get(line.masterProductId)!;
      const requestedQty = new Prisma.Decimal(line.receivedQty);
      const requestedQuarantine = new Prisma.Decimal(line.quarantineQty);
      if (requestedQty.isZero()) continue;

      const transferLayers = await lockTransferLayers(tx, shipmentItem.id);
      const outstandingQty = transferLayers.reduce(
        (sum, layer) => sum.add(layer.shippedQty.sub(layer.receivedQty)),
        new Prisma.Decimal(0),
      );
      if (requestedQty.greaterThan(outstandingQty)) {
        throw errors.unprocessable(
          'RECEIPT_EXCEEDS_IN_TRANSIT',
          `Penerimaan ${shipmentItem.masterProduct.name} melebihi quantity in-transit ${outstandingQty.toFixed(4)}.`,
        );
      }

      const destination = await resolveDestinationInventory(
        tx,
        shipment.toBranchId,
        shipmentItem.masterProductId,
        line.stockLocationId,
      );
      let destinationStock = destination.inventoryItem.stock;
      let remainingQty = requestedQty;
      let remainingQuarantine = requestedQuarantine;

      for (const transfer of transferLayers) {
        if (remainingQty.isZero()) break;
        const available = transfer.shippedQty.sub(transfer.receivedQty);
        const quantity = Prisma.Decimal.min(available, remainingQty);
        const quarantineQty = Prisma.Decimal.min(quantity, remainingQuarantine);
        const totalCost = quantity.mul(transfer.unitCost);
        const batchKey = transfer.batchId ?? 'NO_BATCH';

        const balance = await tx.inventoryBalance.upsert({
          where: {
            inventoryItemId_stockLocationId_batchKey: {
              inventoryItemId: destination.inventoryItem.id,
              stockLocationId: destination.location.id,
              batchKey,
            },
          },
          create: {
            inventoryItemId: destination.inventoryItem.id,
            stockLocationId: destination.location.id,
            masterProductId: shipmentItem.masterProductId,
            branchId: shipment.toBranchId,
            batchId: transfer.batchId,
            batchKey,
          },
          update: {},
        });
        await tx.$queryRaw(Prisma.sql`
          SELECT "id" FROM "inventory_balances" WHERE "id" = ${balance.id} FOR UPDATE
        `);

        const sourceBalanceUpdate = await tx.inventoryBalance.updateMany({
          where: { id: transfer.sourceInventoryBalanceId, inTransitQty: { gte: quantity } },
          data: { inTransitQty: { decrement: quantity }, version: { increment: 1 } },
        });
        if (sourceBalanceUpdate.count !== 1) {
          throw errors.conflict('IN_TRANSIT_BALANCE_MISMATCH', 'Quantity in-transit source tidak konsisten.');
        }
        const transferUpdate = await tx.shipmentTransferLayer.updateMany({
          where: { id: transfer.id, receivedQty: transfer.receivedQty },
          data: { receivedQty: { increment: quantity } },
        });
        if (transferUpdate.count !== 1) throw errors.conflict('TRANSFER_LAYER_CHANGED', 'Transfer layer berubah saat receipt.');

        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            onHandQty: { increment: quantity },
            quarantineQty: { increment: quarantineQty },
            version: { increment: 1 },
          },
        });
        await tx.inventoryItem.update({
          where: { id: destination.inventoryItem.id },
          data: { stock: { increment: quantity } },
        });
        await tx.inventoryCostLayer.create({
          data: {
            inventoryBalanceId: balance.id,
            batchId: transfer.batchId,
            sourceType: 'SHIPMENT_RECEIPT',
            sourceId: receipt.id,
            originalQty: quantity,
            remainingQty: quantity,
            unitCost: transfer.unitCost,
            currency: transfer.currency,
            valuationStatus: InventoryValuationStatus.VALUED,
            receivedAt: input.occurredAt,
          },
        });
        await tx.stockMutation.create({
          data: {
            inventoryItemId: destination.inventoryItem.id,
            type: StockMutationType.TRANSFER_IN,
            quantity,
            stockBefore: destinationStock,
            stockAfter: destinationStock.add(quantity),
            referenceType: 'SHIPMENT',
            referenceId: shipment.id,
            notes: `Receipt ${receipt.receiptNumber}${quarantineQty.isPositive() ? ' (quarantine)' : ''}`,
            createdBy: actorUserId,
            inventoryPostingId: posting.id,
            inventoryBalanceId: balance.id,
            batchId: transfer.batchId,
            actualCost: totalCost,
          },
        });
        await tx.shipmentReceiptItem.create({
          data: {
            shipmentReceiptId: receipt.id,
            shipmentItemId: shipmentItem.id,
            transferLayerId: transfer.id,
            inventoryBalanceId: balance.id,
            receivedQty: quantity,
            quarantineQty,
            unitCost: transfer.unitCost,
            totalCost,
          },
        });

        destinationStock = destinationStock.add(quantity);
        remainingQty = remainingQty.sub(quantity);
        remainingQuarantine = remainingQuarantine.sub(quarantineQty);
        receiptCost = receiptCost.add(totalCost);
      }
      if (!remainingQty.isZero() || !remainingQuarantine.isZero()) {
        throw errors.conflict('RECEIPT_ALLOCATION_MISMATCH', 'Allocation receipt tidak lengkap.');
      }

      const currentReceived = shipmentItem.receivedQty ?? new Prisma.Decimal(0);
      await tx.shipmentItem.update({
        where: { id: shipmentItem.id },
        data: {
          receivedQty: currentReceived.add(requestedQty),
          quarantineQty: { increment: requestedQuarantine },
        },
      });
      receiptQuantity = receiptQuantity.add(requestedQty);
      receiptQuarantine = receiptQuarantine.add(requestedQuarantine);
      eventQuarantineByProduct.set(line.masterProductId, requestedQuarantine);
    }

    const updatedItems = await tx.shipmentItem.findMany({
      where: { shipmentId: shipment.id },
      include: { masterProduct: true },
    });
    const updatedItemByProduct = new Map(updatedItems.map((item) => [item.masterProductId, item]));

    for (const discrepancy of input.discrepancies) {
      const item = updatedItemByProduct.get(discrepancy.masterProductId)!;
      await tx.shipmentDiscrepancy.create({
        data: {
          shipmentId: shipment.id,
          shipmentReceiptId: receipt.id,
          masterProductId: item.masterProductId,
          productName: item.masterProduct.name,
          expectedQty: item.sentQty,
          receivedQty: item.receivedQty ?? 0,
          discrepancyType: discrepancy.discrepancyType,
          quarantinedQty: eventQuarantineByProduct.get(item.masterProductId) ?? 0,
          notes: discrepancy.notes,
          photoUrl: discrepancy.photoUrl,
          photoFileName: discrepancy.photoFileName,
          reportedBy: actorUserId,
        },
      });
    }

    const explicitDiscrepancyProducts = new Set(input.discrepancies.map((item) => item.masterProductId));
    for (const [productId, quarantinedQty] of eventQuarantineByProduct) {
      if (!quarantinedQty.isPositive() || explicitDiscrepancyProducts.has(productId)) continue;
      const item = updatedItemByProduct.get(productId)!;
      await tx.shipmentDiscrepancy.create({
        data: {
          shipmentId: shipment.id,
          shipmentReceiptId: receipt.id,
          masterProductId: productId,
          productName: item.masterProduct.name,
          expectedQty: item.sentQty,
          receivedQty: item.receivedQty ?? 0,
          discrepancyType: DiscrepancyType.DAMAGE,
          quarantinedQty,
          notes: 'Barang ditempatkan pada quarantine saat penerimaan.',
          reportedBy: actorUserId,
        },
      });
    }

    if (input.isFinal) {
      for (const item of updatedItems) {
        const receivedQty = item.receivedQty ?? new Prisma.Decimal(0);
        if (receivedQty.greaterThanOrEqualTo(item.sentQty)) continue;
        const alreadyReported = input.discrepancies.some(
          (discrepancy) => discrepancy.masterProductId === item.masterProductId
            && discrepancy.discrepancyType === DiscrepancyType.SHORTAGE,
        );
        if (alreadyReported) continue;
        await tx.shipmentDiscrepancy.create({
          data: {
            shipmentId: shipment.id,
            shipmentReceiptId: receipt.id,
            masterProductId: item.masterProductId,
            productName: item.masterProduct.name,
            expectedQty: item.sentQty,
            receivedQty,
            discrepancyType: DiscrepancyType.SHORTAGE,
            notes: `Final receipt kurang ${item.sentQty.sub(receivedQty).toFixed(4)} unit.`,
            reportedBy: actorUserId,
          },
        });
      }
    }

    const remainingQuantity = updatedItems.reduce(
      (sum, item) => sum.add(item.sentQty.sub(item.receivedQty ?? 0)),
      new Prisma.Decimal(0),
    );
    const openDiscrepancyCount = await tx.shipmentDiscrepancy.count({
      where: { shipmentId: shipment.id, status: ShipmentDiscrepancyStatus.OPEN },
    });
    const totalQuarantine = updatedItems.reduce(
      (sum, item) => sum.add(item.quarantineQty),
      new Prisma.Decimal(0),
    );
    const shipmentStatus = remainingQuantity.isPositive()
      ? input.isFinal ? ShipmentStatus.RECEIVED_WITH_ISSUE : ShipmentStatus.PARTIALLY_RECEIVED
      : openDiscrepancyCount > 0 || totalQuarantine.isPositive()
        ? ShipmentStatus.RECEIVED_WITH_ISSUE
        : ShipmentStatus.RECEIVED;
    const transferStatus = shipmentStatus === ShipmentStatus.RECEIVED
      ? InternalTransferStatus.RECEIVED
      : shipmentStatus === ShipmentStatus.RECEIVED_WITH_ISSUE
        || openDiscrepancyCount > 0
        || totalQuarantine.isPositive()
        ? InternalTransferStatus.DISCREPANCY
        : InternalTransferStatus.IN_TRANSIT;

    await tx.inventoryPosting.update({ where: { id: posting.id }, data: { totalCost: receiptCost } });
    await tx.shipmentReceipt.update({
      where: { id: receipt.id },
      data: { totalQuantity: receiptQuantity, quarantinedQuantity: receiptQuarantine, totalCost: receiptCost },
    });
    await postReceiptTransferAccounting(tx, {
      shipmentId: shipment.id,
      shipmentCode: shipment.shipmentCode,
      receiptId: receipt.id,
      receiptPostingId: posting.id,
      receiptCost,
      status: transferStatus,
      occurredAt: input.occurredAt,
      actorUserId,
    });
    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: shipmentStatus,
        receivedAt: input.occurredAt,
        receivedBy: actorUserId,
        receiptFileUrl: evidence.url,
        receiptFileName: evidence.fileName,
        receiptFileSize: evidence.fileSize,
        receiptMimeType: evidence.mimeType,
        notes: input.notes ?? shipment.notes,
      },
    });
    await tx.stockRequest.update({
      where: { id: shipment.stockRequestId },
      data: {
        status: shipmentStatus === ShipmentStatus.RECEIVED
          ? StockRequestStatus.COMPLETED
          : shipmentStatus === ShipmentStatus.RECEIVED_WITH_ISSUE
            ? StockRequestStatus.COMPLETED_WITH_ISSUE
            : StockRequestStatus.SHIPPED,
        receivedAt: input.occurredAt,
        receivedBy: actorUserId,
        receivingNotes: input.notes,
      },
    });
    return { receiptId: receipt.id, created: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

  const receipt = await loadReceiptResult(receiptResult.receiptId);
  if (receiptResult.created) {
    await logAudit({
      userId: actorUserId,
      branchId: scope.toBranchId,
      action: AuditAction.RECEIVE_SHIPMENT,
      resource: 'ShipmentReceipt',
      resourceId: receipt.id,
      afterData: {
        shipmentId,
        receiptNumber: receipt.receiptNumber,
        totalQuantity: receipt.totalQuantity,
        quarantinedQuantity: receipt.quarantinedQuantity,
        totalCost: receipt.totalCost,
        shipmentStatus: receipt.shipment.status,
      },
      meta: { idempotencyKey: input.idempotencyKey, evidenceChecksum: receipt.evidenceChecksum },
    });
  }
  return receipt;
}
