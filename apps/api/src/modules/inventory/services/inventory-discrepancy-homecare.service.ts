import { createHash, randomUUID } from 'crypto';
import {
  DiscrepancyResolutionAction,
  LogisticLocationType,
  LogisticTransactionType,
  Prisma,
  SessionType,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { postInventoryAdjustmentDerivedJournal } from '@modules/accounting/accounting.service';
import { issueAdjustmentInventoryInTransaction } from './inventory-ledger.service';
import type { CompleteMultiBagUsageInput, ResolveDiscrepancyInput } from '../inventory-control.schema';

const payloadHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const code = (prefix: string) => `${prefix}/${new Date().getUTCFullYear()}/${randomUUID().slice(0, 10).toUpperCase()}`;
const money = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

async function withSerializableRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const databaseCode = error instanceof Prisma.PrismaClientKnownRequestError
        ? String((error.meta as { code?: string } | undefined)?.code || '')
        : '';
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError
        && (error.code === 'P2034' || (error.code === 'P2010' && databaseCode === '40001'));
      if (!retryable || attempt === attempts) throw error;
    }
  }
  throw errors.conflict('INVENTORY_CONCURRENCY_CONFLICT', 'Transaksi inventory gagal setelah beberapa percobaan.');
}

export async function resolveShipmentDiscrepancy(userId: string, discrepancyId: string, input: ResolveDiscrepancyInput) {
  const candidate = await prisma.shipmentDiscrepancy.findUnique({
    where: { id: discrepancyId },
    include: { shipment: { select: { toBranchId: true, shipmentCode: true } } },
  });
  if (!candidate) throw errors.notFound('Discrepancy pengiriman tidak ditemukan.');
  await assertBranchAccess(userId, candidate.shipment.toBranchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_DISCREPANCY_RESOLVE, candidate.shipment.toBranchId);
  if (candidate.status === 'RESOLVED') {
    if (candidate.resolutionKey === input.idempotencyKey) return { discrepancy: candidate, idempotentReplay: true };
    throw errors.conflict('DISCREPANCY_ALREADY_RESOLVED', 'Discrepancy sudah diselesaikan.');
  }
  if (input.action === 'RETURN_TO_SENDER') {
    throw errors.badRequest(
      'DISCREPANCY_RETURN_WORKFLOW_REQUIRED',
      'Return to sender harus dibuat sebagai internal transfer agar nilai aset tetap terlacak.',
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "shipment_discrepancies" WHERE "id" = ${discrepancyId} FOR UPDATE`);
    const discrepancy = await tx.shipmentDiscrepancy.findUniqueOrThrow({
      where: { id: discrepancyId },
      include: {
        shipment: { select: { toBranchId: true, shipmentCode: true } },
        shipmentReceipt: {
          include: {
            items: {
              include: {
                inventoryBalance: true,
                transferLayer: true,
                shipmentItem: { select: { masterProductId: true } },
              },
            },
          },
        },
      },
    });
    if (discrepancy.status === 'RESOLVED') {
      if (discrepancy.resolutionKey === input.idempotencyKey) return discrepancy;
      throw errors.conflict('DISCREPANCY_ALREADY_RESOLVED', 'Discrepancy sudah diselesaikan.');
    }
    const resolutionQty = new Prisma.Decimal(input.quantity ?? discrepancy.quarantinedQty);
    const stockAction = input.action !== 'NO_STOCK_ACTION';
    if (stockAction && (!resolutionQty.greaterThan(0) || resolutionQty.greaterThan(discrepancy.quarantinedQty))) {
      throw errors.badRequest('DISCREPANCY_RESOLUTION_QTY_INVALID', 'Quantity resolusi melebihi quantity quarantine.');
    }
    if (input.action === 'NO_STOCK_ACTION' && discrepancy.quarantinedQty.greaterThan(0)) {
      throw errors.badRequest('DISCREPANCY_QUARANTINE_UNRESOLVED', 'Quantity quarantine harus dilepas atau di-write-off.');
    }

    const receiptItems = (discrepancy.shipmentReceipt?.items || []).filter(
      (item) => item.shipmentItem.masterProductId === discrepancy.masterProductId && item.quarantineQty.greaterThan(0),
    );
    if (stockAction && receiptItems.length === 0) {
      throw errors.conflict('DISCREPANCY_QUARANTINE_TRACE_MISSING', 'Trace inventory balance quarantine tidak ditemukan.');
    }
    let remaining = resolutionQty;
    const releasedByBalance = new Map<string, Prisma.Decimal>();
    const releasedByShipmentItem = new Map<string, Prisma.Decimal>();
    const releasedReceiptItems: Array<{ receiptItemId: string; quantity: Prisma.Decimal }> = [];
    for (const item of receiptItems) {
      if (!remaining.greaterThan(0)) break;
      const qty = Prisma.Decimal.min(remaining, item.quarantineQty);
      releasedByBalance.set(item.inventoryBalanceId, (releasedByBalance.get(item.inventoryBalanceId) || new Prisma.Decimal(0)).add(qty));
      releasedByShipmentItem.set(item.shipmentItemId, (releasedByShipmentItem.get(item.shipmentItemId) || new Prisma.Decimal(0)).add(qty));
      releasedReceiptItems.push({ receiptItemId: item.id, quantity: qty });
      remaining = remaining.sub(qty);
    }
    if (stockAction && remaining.greaterThan(0)) throw errors.conflict('DISCREPANCY_QUARANTINE_TRACE_INCOMPLETE', 'Trace quarantine tidak mencukupi.');

    for (const [balanceId, qty] of releasedByBalance) {
      const updated = await tx.inventoryBalance.updateMany({
        where: { id: balanceId, quarantineQty: { gte: qty } },
        data: { quarantineQty: { decrement: qty }, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw errors.conflict('INVENTORY_CONCURRENCY_CONFLICT', 'Quantity quarantine berubah saat diproses.');
    }
    for (const item of releasedReceiptItems) {
      const updated = await tx.shipmentReceiptItem.updateMany({
        where: { id: item.receiptItemId, quarantineQty: { gte: item.quantity } },
        data: { quarantineQty: { decrement: item.quantity } },
      });
      if (updated.count !== 1) throw errors.conflict('INVENTORY_CONCURRENCY_CONFLICT', 'Trace quarantine penerimaan berubah saat diproses.');
    }
    for (const [shipmentItemId, qty] of releasedByShipmentItem) {
      const updated = await tx.shipmentItem.updateMany({
        where: { id: shipmentItemId, quarantineQty: { gte: qty } },
        data: { quarantineQty: { decrement: qty } },
      });
      if (updated.count !== 1) throw errors.conflict('INVENTORY_CONCURRENCY_CONFLICT', 'Quantity quarantine shipment berubah saat diproses.');
    }

    let inventoryPostingId: string | undefined;
    let journalEntryId: string | undefined;
    if (input.action === 'WRITE_OFF') {
      const grouped = new Map<string, { inventoryItemId: string; stockLocationId: string; batchId?: string; quantity: Prisma.Decimal }>();
      for (const [balanceId, qty] of releasedByBalance) {
        const balance = receiptItems.find((item) => item.inventoryBalanceId === balanceId)!.inventoryBalance;
        const key = `${balance.inventoryItemId}:${balance.stockLocationId}:${balance.batchId || ''}`;
        const current = grouped.get(key);
        grouped.set(key, {
          inventoryItemId: balance.inventoryItemId,
          stockLocationId: balance.stockLocationId,
          batchId: balance.batchId || undefined,
          quantity: (current?.quantity || new Prisma.Decimal(0)).add(qty),
        });
      }
      inventoryPostingId = await issueAdjustmentInventoryInTransaction(userId, {
        idempotencyKey: `DISCREPANCY-WRITEOFF:${discrepancy.id}`,
        branchId: discrepancy.shipment.toBranchId,
        sourceType: 'SHIPMENT_DISCREPANCY', sourceId: discrepancy.id,
        sourceNumber: discrepancy.shipment.shipmentCode, reasonCode: `DISCREPANCY_${discrepancy.discrepancyType}`,
        occurredAt: new Date(),
        lines: [...grouped.values()].map((line) => ({ ...line, quantity: line.quantity.toFixed(4) })),
      }, tx);
      const posting = await tx.inventoryPosting.findUniqueOrThrow({ where: { id: inventoryPostingId } });
      const value = money(posting.totalCost);
      if (!value.greaterThan(0)) throw errors.unprocessable('DISCREPANCY_ZERO_VALUE', 'Nilai write-off harus minimal Rp0,01.');
      const journal = await postInventoryAdjustmentDerivedJournal({
        postingKey: `SHIPMENT_DISCREPANCY:${discrepancy.id}`,
        transactionDate: new Date(), branchId: discrepancy.shipment.toBranchId, actorUserId: userId,
        description: `Write-off discrepancy ${discrepancy.shipment.shipmentCode}`,
        lines: [
          { accountCode: '5210', debit: value, metadata: { adjustmentRole: 'LOSS' } },
          { accountCode: '1300', credit: value, metadata: { adjustmentRole: 'INVENTORY_OUT' } },
        ],
        sourceLinks: [{ sourceType: 'SHIPMENT_DISCREPANCY', sourceId: discrepancy.id, sourceNumber: discrepancy.shipment.shipmentCode }],
        metadata: { discrepancyType: discrepancy.discrepancyType },
      }, tx);
      journalEntryId = journal.journal.id;
    }

    const updated = await tx.shipmentDiscrepancy.update({
      where: { id: discrepancy.id },
      data: {
        status: 'RESOLVED', resolvedBy: userId, resolvedAt: new Date(), resolutionNotes: input.notes,
        resolutionAction: input.action as DiscrepancyResolutionAction,
        resolutionQty: stockAction ? resolutionQty : new Prisma.Decimal(0),
        resolutionKey: input.idempotencyKey, inventoryPostingId, journalEntryId,
      },
    });
    const [remainingOpen, shipmentItems] = await Promise.all([
      tx.shipmentDiscrepancy.count({ where: { shipmentId: discrepancy.shipmentId, status: 'OPEN' } }),
      tx.shipmentItem.findMany({ where: { shipmentId: discrepancy.shipmentId }, select: { sentQty: true, receivedQty: true } }),
    ]);
    if (remainingOpen === 0) {
      const allReceived = shipmentItems.every((item) => (item.receivedQty || new Prisma.Decimal(0)).greaterThanOrEqualTo(item.sentQty));
      await tx.shipment.update({
        where: { id: discrepancy.shipmentId },
        data: { status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
      });
      await tx.internalTransferLedger.updateMany({
        where: { shipmentId: discrepancy.shipmentId },
        data: { status: allReceived ? 'RECEIVED' : 'IN_TRANSIT' },
      });
    }
    await tx.auditLog.create({ data: {
      userId, branchId: discrepancy.shipment.toBranchId, action: 'STATUS_CHANGE', module: 'INVENTORY',
      resource: 'ShipmentDiscrepancy', resourceId: discrepancy.id, entityType: 'ShipmentDiscrepancy', entityId: discrepancy.id,
      entityCode: discrepancy.shipment.shipmentCode, description: `Discrepancy diselesaikan dengan ${input.action}.`,
      afterData: { action: input.action, quantity: resolutionQty, inventoryPostingId, journalEntryId },
    } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { discrepancy: result, idempotentReplay: false };
}

export async function completeMultiBagUsage(userId: string, input: CompleteMultiBagUsageInput) {
  await assertBranchAccess(userId, input.branchId);
  await assertPermission(userId, PERMISSIONS.HOMECARE_MULTI_BAG_COMPLETE, input.branchId);
  const normalized = {
    ...input,
    usageDate: input.usageDate.toISOString(),
    bags: [...input.bags].sort((a, b) => a.bagId.localeCompare(b.bagId)).map((bag) => ({
      ...bag,
      items: [...bag.items].sort((a, b) => a.masterProductId.localeCompare(b.masterProductId)),
    })),
  };
  const hash = payloadHash(normalized);
  const existing = await prisma.homecareMultiBagUsage.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.payloadHash !== hash) throw errors.conflict('HOMECARE_MULTI_BAG_KEY_REUSED', 'Idempotency key digunakan untuk payload berbeda.');
    return { completion: existing, idempotentReplay: true };
  }
  if (new Set(input.bags.map((bag) => bag.bagId)).size !== input.bags.length) {
    throw errors.badRequest('HOMECARE_BAG_DUPLICATE', 'Tas tidak boleh duplikat dalam satu finalisasi.');
  }
  for (const bag of input.bags) {
    if (new Set(bag.items.map((item) => item.masterProductId)).size !== bag.items.length) {
      throw errors.badRequest('HOMECARE_BAG_ITEM_DUPLICATE', 'Produk dalam satu tas tidak boleh duplikat.');
    }
  }

  try {
    const completion = await withSerializableRetry(() => prisma.$transaction(async (tx) => {
      const session = await tx.treatmentSession.findUnique({ where: { id: input.treatmentSessionId } });
      if (!session || session.branchId !== input.branchId) throw errors.notFound('Sesi homecare tidak ditemukan dalam branch.');
      if (session.pelaksanaan !== SessionType.HOME_CARE) throw errors.badRequest('SESSION_NOT_HOMECARE', 'Multi-bag hanya berlaku untuk sesi HOME_CARE.');
      if (session.completionStatus === 'CANCELLED') throw errors.conflict('SESSION_CANCELLED', 'Sesi yang dibatalkan tidak dapat memakai stok tas.');
      const bags = await tx.homecareBag.findMany({ where: { id: { in: input.bags.map((bag) => bag.bagId) } } });
      if (bags.length !== input.bags.length || bags.some((bag) => !bag.isActive || bag.teamId !== input.teamId || bag.branchId !== input.branchId)) {
        throw errors.badRequest('HOMECARE_BAG_SCOPE_INVALID', 'Semua tas harus aktif dan berasal dari tim serta branch yang sama.');
      }
      const requestedKeys = input.bags.flatMap((bag) => bag.items.map((item) => ({ bagId: bag.bagId, masterProductId: item.masterProductId })));
      const stocks = await tx.homecareBagStock.findMany({ where: { OR: requestedKeys } });
      if (stocks.length !== requestedKeys.length) throw errors.unprocessable('HOMECARE_BAG_STOCK_MISSING', 'Stok salah satu produk tidak tersedia pada tas.');
      const stockIds = stocks.map((stock) => stock.id).sort();
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "homecare_bag_stocks" WHERE "id" IN (${Prisma.join(stockIds)}) ORDER BY "id" FOR UPDATE`);
      const stockByKey = new Map(stocks.map((stock) => [`${stock.bagId}:${stock.masterProductId}`, stock]));
      const group = await tx.homecareMultiBagUsage.create({
        data: {
          completionNumber: code('HMB'), idempotencyKey: input.idempotencyKey, payloadHash: hash,
          treatmentSessionId: input.treatmentSessionId, teamId: input.teamId, branchId: input.branchId,
          usageIds: [], bagCount: input.bags.length,
          totalItemLines: input.bags.reduce((total, bag) => total + bag.items.length, 0),
          notes: input.notes, completedBy: userId, completedAt: input.usageDate,
        },
      });
      const usageIds: string[] = [];
      for (const bagInput of input.bags) {
        const usage = await tx.homecareBagUsage.create({
          data: {
            usageCode: code('HBU'), bagId: bagInput.bagId, teamId: input.teamId,
            treatmentSessionId: input.treatmentSessionId, multiBagUsageId: group.id,
            usedBy: userId, status: 'COMPLETED', usageDate: input.usageDate, notes: input.notes,
            items: { create: bagInput.items.map((item) => ({
              masterProductId: item.masterProductId, quantity: item.quantity, unit: item.unit, notes: item.notes,
            })) },
          },
        });
        usageIds.push(usage.id);
        for (const item of bagInput.items) {
          const stock = stockByKey.get(`${bagInput.bagId}:${item.masterProductId}`)!;
          const qty = new Prisma.Decimal(item.quantity);
          const updated = await tx.homecareBagStock.updateMany({ where: { id: stock.id, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
          if (updated.count !== 1) throw errors.unprocessable('HOMECARE_BAG_STOCK_INSUFFICIENT', 'Stok tas tidak mencukupi atau berubah saat diproses.');
          await tx.logisticStockMutation.create({ data: {
            mutationCode: `LGM-${randomUUID().toUpperCase()}`, locationType: LogisticLocationType.HOMECARE_BAG,
            locationId: bagInput.bagId, homecareBagId: bagInput.bagId, masterProductId: item.masterProductId,
            type: LogisticTransactionType.BAG_USAGE, quantity: qty, stockBefore: stock.stock,
            stockAfter: stock.stock.sub(qty), referenceType: 'HOMECARE_MULTI_BAG_USAGE', referenceId: group.id,
            notes: input.notes, createdBy: userId,
          } });
          stock.stock = stock.stock.sub(qty);
        }
      }
      const updatedGroup = await tx.homecareMultiBagUsage.update({ where: { id: group.id }, data: { usageIds } });
      await tx.auditLog.create({ data: {
        userId, branchId: input.branchId, action: 'COMPLETE', module: 'INVENTORY', resource: 'HomecareMultiBagUsage',
        resourceId: group.id, entityType: 'TreatmentSession', entityId: input.treatmentSessionId,
        entityCode: session.sessionCode, description: `Konsumsi ${input.bags.length} tas homecare difinalisasi.`,
        afterData: { usageIds, bagCount: input.bags.length, revenuePosted: false },
      } });
      return updatedGroup;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    return { completion, idempotentReplay: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const replay = await prisma.homecareMultiBagUsage.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (replay?.payloadHash === hash) return { completion: replay, idempotentReplay: true };
      const existingSession = await prisma.homecareMultiBagUsage.findUnique({ where: { treatmentSessionId: input.treatmentSessionId } });
      if (existingSession) throw errors.conflict('HOMECARE_SESSION_ALREADY_COMPLETED', 'Pemakaian multi-bag untuk sesi ini sudah difinalisasi.');
    }
    throw error;
  }
}
