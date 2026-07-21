import { createHash, randomUUID } from 'crypto';
import {
  AccountType,
  InternalTransferStatus,
  InventoryCostAllocationType,
  InventoryPostingType,
  InventoryValuationStatus,
  Prisma,
  StockMutationType,
  StockReservationStatus,
} from '@prisma/client';
import { errors } from '@middleware/errorHandler';
import { postInventoryDerivedJournal } from '@modules/accounting/accounting.service';
import { allocateFifo, type FifoLayerInput } from './fifo-allocation.service';
import { buildInternalTransferJournal, INTERNAL_TRANSFER_ACCOUNTS } from './internal-transfer-posting.helpers';

type Tx = Prisma.TransactionClient;

export type TransferMovement = {
  masterProductId: string;
  quantity: number;
  sourceStockBefore?: number;
  sourceStockAfter?: number;
  destinationStockBefore?: number;
  destinationStockAfter?: number;
  notes?: string;
};

const INVENTORY_ACCOUNT = INTERNAL_TRANSFER_ACCOUNTS.inventory;
const IN_TRANSIT_ACCOUNT = INTERNAL_TRANSFER_ACCOUNTS.inTransit;

function postingNumber(prefix: 'OUT' | 'IN') {
  return `INV-TRF-${prefix}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function hashPayload(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function assertPolicyAccounts(tx: Tx) {
  const accounts = await tx.account.findMany({
    where: { code: { in: [INVENTORY_ACCOUNT, IN_TRANSIT_ACCOUNT] } },
    select: { code: true, type: true, isActive: true, allowPosting: true },
  });
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  for (const code of [INVENTORY_ACCOUNT, IN_TRANSIT_ACCOUNT]) {
    const account = byCode.get(code);
    if (!account?.isActive || !account.allowPosting || account.type !== AccountType.ASSET) {
      throw errors.unprocessable('INTERNAL_TRANSFER_ACCOUNT_INVALID', `Account ${code} wajib berupa akun aset aktif dan postable.`);
    }
  }
}

async function releaseReservation(
  tx: Tx,
  stockRequestId: string,
  inventoryBalanceId: string,
  quantity: Prisma.Decimal,
  actorUserId: string,
) {
  const reservations = await tx.stockReservation.findMany({
    where: { stockRequestId, inventoryBalanceId, status: StockReservationStatus.ACTIVE },
    orderBy: [{ reservedAt: 'asc' }, { id: 'asc' }],
  });
  let remaining = quantity;
  let released = new Prisma.Decimal(0);
  for (const reservation of reservations) {
    if (remaining.isZero()) break;
    const available = reservation.quantity.sub(reservation.releasedQty);
    const take = Prisma.Decimal.min(available, remaining);
    if (!take.isPositive()) continue;
    const nextReleased = reservation.releasedQty.add(take);
    await tx.stockReservation.update({
      where: { id: reservation.id },
      data: {
        releasedQty: nextReleased,
        status: nextReleased.equals(reservation.quantity) ? StockReservationStatus.RELEASED : StockReservationStatus.ACTIVE,
        ...(nextReleased.equals(reservation.quantity) ? { releasedBy: actorUserId, releasedAt: new Date(), releaseReason: 'SHIPMENT_DISPATCHED' } : {}),
      },
    });
    released = released.add(take);
    remaining = remaining.sub(take);
  }
  return released;
}

export async function dispatchInternalTransfer(
  tx: Tx,
  shipmentId: string,
  actorUserId: string,
  occurredAt: Date,
  notes: string,
) {
  const replay = await tx.internalTransferLedger.findUnique({ where: { shipmentId } });
  if (replay) return { ledger: replay, movements: [] as TransferMovement[], idempotentReplay: true };

  const shipment = await tx.shipment.findUnique({
    where: { id: shipmentId },
    include: { fromBranch: true, toBranch: true, items: true },
  });
  if (!shipment) throw errors.notFound('Shipment internal tidak ditemukan.');
  if (shipment.fromBranchId === shipment.toBranchId) throw errors.badRequest('TRANSFER_BRANCH_SAME', 'Cabang sumber dan tujuan transfer harus berbeda.');
  if (shipment.fromBranch.branchCode === 'EXT') throw errors.badRequest('TRANSFER_SOURCE_EXTERNAL', 'Posting internal transfer tidak berlaku untuk sumber eksternal.');
  await assertPolicyAccounts(tx);

  const productIds = [...new Set(shipment.items.map((item) => item.masterProductId))].sort();
  if (productIds.length !== shipment.items.length) throw errors.badRequest('TRANSFER_DUPLICATE_PRODUCT', 'Product shipment internal tidak boleh duplikat.');
  const sourceItems = await tx.inventoryItem.findMany({ where: { branchId: shipment.fromBranchId, masterProductId: { in: productIds } } });
  if (sourceItems.length !== productIds.length) throw errors.unprocessable('TRANSFER_SOURCE_STOCK_MISSING', 'Inventory item sumber transfer tidak lengkap.');
  const itemIds = sourceItems.map((item) => item.id).sort();
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "inventory_items" WHERE "id" IN (${Prisma.join(itemIds)}) ORDER BY "id" FOR UPDATE`);

  const balances = await tx.inventoryBalance.findMany({
    where: { inventoryItemId: { in: itemIds } },
    include: {
      costLayers: { where: { valuationStatus: InventoryValuationStatus.VALUED, isVoided: false, remainingQty: { gt: 0 } }, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }] },
      reservations: { where: { stockRequestId: shipment.stockRequestId, status: StockReservationStatus.ACTIVE } },
    },
    orderBy: { id: 'asc' },
  });
  if (!balances.length) throw errors.unprocessable('TRANSFER_COST_LAYER_MISSING', 'FIFO cost layer sumber transfer tidak tersedia.');
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "inventory_balances" WHERE "id" IN (${Prisma.join(balances.map((balance) => balance.id))}) ORDER BY "id" FOR UPDATE`);
  const layerIds = balances.flatMap((balance) => balance.costLayers.map((layer) => layer.id)).sort();
  if (layerIds.length) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "inventory_cost_layers" WHERE "id" IN (${Prisma.join(layerIds)}) ORDER BY "id" FOR UPDATE`);

  const itemByProduct = new Map(sourceItems.map((item) => [item.masterProductId, item]));
  const balanceById = new Map(balances.map((balance) => [balance.id, balance]));
  const layerContext = new Map<string, { balanceId: string; itemId: string; productId: string }>();
  const planned: Array<{ productId: string; allocation: ReturnType<typeof allocateFifo>[number] }> = [];

  for (const shipmentItem of shipment.items) {
    const item = itemByProduct.get(shipmentItem.masterProductId)!;
    const eligibleLayers: FifoLayerInput[] = [];
    for (const balance of balances.filter((row) => row.inventoryItemId === item.id)) {
      const ownReservation = balance.reservations.reduce((sum, reservation) => sum.add(reservation.quantity.sub(reservation.releasedQty)), new Prisma.Decimal(0));
      let eligibleQty = balance.onHandQty.sub(balance.quarantineQty).sub(balance.reservedQty).add(ownReservation);
      for (const layer of balance.costLayers) {
        if (!eligibleQty.isPositive() || !layer.unitCost) break;
        const layerQty = Prisma.Decimal.min(layer.remainingQty, eligibleQty);
        eligibleLayers.push({ id: layer.id, inventoryBalanceId: balance.id, batchId: layer.batchId, receivedAt: layer.receivedAt, remainingQty: layerQty, unitCost: layer.unitCost });
        layerContext.set(layer.id, { balanceId: balance.id, itemId: item.id, productId: shipmentItem.masterProductId });
        eligibleQty = eligibleQty.sub(layerQty);
      }
    }
    const allocations = allocateFifo(shipmentItem.sentQty, eligibleLayers);
    allocations.forEach((allocation) => planned.push({ productId: shipmentItem.masterProductId, allocation }));
  }

  const totalValue = planned.reduce((sum, row) => sum.add(row.allocation.totalCost), new Prisma.Decimal(0));
  if (!totalValue.toDecimalPlaces(2).isPositive()) throw errors.unprocessable('TRANSFER_ZERO_VALUE', 'Internal transfer harus memiliki nilai persediaan positif.');
  const dispatchPosting = await tx.inventoryPosting.create({
    data: {
      postingNumber: postingNumber('OUT'), idempotencyKey: `TRANSFER_DISPATCH:${shipmentId}`,
      payloadHash: hashPayload({ shipmentId, items: shipment.items.map((item) => ({ id: item.id, sentQty: item.sentQty.toFixed(4) })) }),
      type: InventoryPostingType.TRANSFER_OUT, reasonCode: 'INTERNAL_TRANSFER_DISPATCH', sourceType: 'SHIPMENT', sourceId: shipmentId,
      sourceNumber: shipment.shipmentCode, branchId: shipment.fromBranchId, occurredAt, totalCost: totalValue, postedBy: actorUserId,
    },
  });

  const grouped = new Map<string, typeof planned>();
  for (const row of planned) {
    const key = row.allocation.inventoryBalanceId;
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }
  const movementsByProduct = new Map<string, TransferMovement>();
  for (const [balanceId, rows] of grouped) {
    const context = layerContext.get(rows[0].allocation.layerId)!;
    const balance = balanceById.get(balanceId)!;
    const quantity = rows.reduce((sum, row) => sum.add(row.allocation.quantity), new Prisma.Decimal(0));
    const actualCost = rows.reduce((sum, row) => sum.add(row.allocation.totalCost), new Prisma.Decimal(0));
    const sourceItem = await tx.inventoryItem.findUniqueOrThrow({ where: { id: context.itemId } });
    const reservationReleased = await releaseReservation(tx, shipment.stockRequestId, balanceId, quantity, actorUserId);
    const balanceUpdate = await tx.inventoryBalance.updateMany({
      where: { id: balanceId, onHandQty: { gte: quantity }, reservedQty: { gte: reservationReleased } },
      data: { onHandQty: { decrement: quantity }, reservedQty: { decrement: reservationReleased }, inTransitQty: { increment: quantity }, version: { increment: 1 } },
    });
    if (balanceUpdate.count !== 1) throw errors.conflict('TRANSFER_STOCK_CONFLICT', 'Saldo sumber berubah saat dispatch.');
    await tx.inventoryItem.update({ where: { id: sourceItem.id }, data: { stock: { decrement: quantity } } });
    const mutation = await tx.stockMutation.create({
      data: { inventoryItemId: sourceItem.id, type: StockMutationType.TRANSFER_OUT, quantity, stockBefore: sourceItem.stock, stockAfter: sourceItem.stock.sub(quantity), referenceType: 'SHIPMENT', referenceId: shipmentId, notes, createdBy: actorUserId, inventoryPostingId: dispatchPosting.id, inventoryBalanceId: balanceId, actualCost },
    });
    for (const row of rows) {
      const update = await tx.inventoryCostLayer.updateMany({ where: { id: row.allocation.layerId, remainingQty: { gte: row.allocation.quantity } }, data: { remainingQty: { decrement: row.allocation.quantity } } });
      if (update.count !== 1) throw errors.conflict('TRANSFER_LAYER_CONFLICT', 'FIFO cost layer berubah saat dispatch.');
      await tx.inventoryCostAllocation.create({ data: { postingId: dispatchPosting.id, stockMutationId: mutation.id, costLayerId: row.allocation.layerId, type: InventoryCostAllocationType.CONSUMPTION, quantity: row.allocation.quantity, unitCost: row.allocation.unitCost, totalCost: row.allocation.totalCost } });
    }
    const movement = movementsByProduct.get(context.productId) || { masterProductId: context.productId, quantity: 0, sourceStockBefore: Number(sourceItem.stock), sourceStockAfter: Number(sourceItem.stock), notes };
    movement.quantity += Number(quantity);
    movement.sourceStockAfter = Number(new Prisma.Decimal(movement.sourceStockAfter || 0).sub(quantity));
    movementsByProduct.set(context.productId, movement);
  }

  const dispatchLines = buildInternalTransferJournal('DISPATCH', totalValue);
  const dispatchJournal = await postInventoryDerivedJournal({
    postingKey: `INTERNAL_TRANSFER:DISPATCH:${shipmentId}`, transactionDate: occurredAt, branchId: shipment.fromBranchId, actorUserId,
    description: `Dispatch internal transfer ${shipment.shipmentCode}`,
    lines: dispatchLines.map((line) => ({ ...line, branchId: shipment.fromBranchId, description: line.accountCode === IN_TRANSIT_ACCOUNT ? 'Persediaan dalam perjalanan' : 'Persediaan keluar untuk transfer internal' })),
    sourceLinks: [{ sourceType: 'INTERNAL_TRANSFER', sourceId: shipmentId, sourceNumber: shipment.shipmentCode, relationType: 'DISPATCH' }],
    metadata: { policy: 'INTERNAL_TRANSFER_IN_TRANSIT', noRevenueOrExpense: true, inventoryValue: totalValue.toFixed(4) },
  }, tx);

  const ledger = await tx.internalTransferLedger.create({
    data: { shipmentId, fromBranchId: shipment.fromBranchId, toBranchId: shipment.toBranchId, totalValue, dispatchInventoryPostingId: dispatchPosting.id, dispatchJournalEntryId: dispatchJournal.journal.id, dispatchedAt: occurredAt },
  });
  await tx.auditLog.create({ data: { userId: actorUserId, branchId: shipment.fromBranchId, action: 'CREATE', module: 'INVENTORY', resource: 'InternalTransferLedger', resourceId: ledger.id, entityType: 'InternalTransferLedger', entityId: ledger.id, entityCode: shipment.shipmentCode, afterData: { status: ledger.status, totalValue: totalValue.toFixed(4), dispatchInventoryPostingId: dispatchPosting.id, dispatchJournalEntryId: dispatchJournal.journal.id }, description: `Internal transfer ${shipment.shipmentCode} dispatched.` } });
  return { ledger, movements: [...movementsByProduct.values()], idempotentReplay: false };
}

export async function receiveInternalTransfer(
  tx: Tx,
  shipmentId: string,
  actorUserId: string,
  occurredAt: Date,
  receivedByProduct: Map<string, number>,
  notes: string,
) {
  const ledger = await tx.internalTransferLedger.findUnique({ where: { shipmentId } });
  if (!ledger) throw errors.unprocessable('TRANSFER_DISPATCH_MISSING', 'Posting dispatch internal transfer tidak ditemukan.');
  if (ledger.receiptInventoryPostingId) return { ledger, movements: [] as TransferMovement[], idempotentReplay: true };
  await assertPolicyAccounts(tx);
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "internal_transfer_ledgers" WHERE "id" = ${ledger.id} FOR UPDATE`);

  const allocations = await tx.inventoryCostAllocation.findMany({
    where: { postingId: ledger.dispatchInventoryPostingId, type: InventoryCostAllocationType.CONSUMPTION },
    include: { costLayer: true, stockMutation: { include: { inventoryItem: true } } },
    orderBy: [{ costLayer: { receivedAt: 'asc' } }, { id: 'asc' }],
  });
  const plan: Array<{ allocation: typeof allocations[number]; quantity: Prisma.Decimal; totalCost: Prisma.Decimal }> = [];
  for (const [productId, receivedNumber] of receivedByProduct) {
    let remaining = new Prisma.Decimal(receivedNumber);
    const productAllocations = allocations.filter((allocation) => allocation.stockMutation.inventoryItem.masterProductId === productId);
    const sent = productAllocations.reduce((sum, allocation) => sum.add(allocation.quantity), new Prisma.Decimal(0));
    if (remaining.isNegative() || remaining.greaterThan(sent)) throw errors.badRequest('TRANSFER_RECEIPT_QTY_INVALID', `Quantity diterima untuk product ${productId} melebihi quantity dikirim.`);
    for (const allocation of productAllocations) {
      if (!remaining.isPositive()) break;
      const quantity = Prisma.Decimal.min(allocation.quantity, remaining);
      plan.push({ allocation, quantity, totalCost: quantity.mul(allocation.unitCost) });
      remaining = remaining.sub(quantity);
    }
  }
  const receivedValue = plan.reduce((sum, row) => sum.add(row.totalCost), new Prisma.Decimal(0));
  const totalReceivedQty = plan.reduce((sum, row) => sum.add(row.quantity), new Prisma.Decimal(0));
  const totalSentQty = allocations.reduce((sum, allocation) => sum.add(allocation.quantity), new Prisma.Decimal(0));
  if (!receivedValue.isPositive()) {
    const updated = await tx.internalTransferLedger.update({ where: { id: ledger.id }, data: { status: InternalTransferStatus.DISCREPANCY, receivedAt: occurredAt } });
    return { ledger: updated, movements: [] as TransferMovement[], idempotentReplay: false };
  }

  const receiptPosting = await tx.inventoryPosting.create({
    data: {
      postingNumber: postingNumber('IN'), idempotencyKey: `TRANSFER_RECEIPT:${shipmentId}`,
      payloadHash: hashPayload({ shipmentId, received: [...receivedByProduct.entries()].sort(([a], [b]) => a.localeCompare(b)) }),
      type: InventoryPostingType.TRANSFER_IN, reasonCode: 'INTERNAL_TRANSFER_RECEIPT', sourceType: 'SHIPMENT', sourceId: shipmentId,
      sourceNumber: (await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } })).shipmentCode,
      branchId: ledger.toBranchId, occurredAt, totalCost: receivedValue, postedBy: actorUserId,
    },
  });

  const movementMap = new Map<string, TransferMovement>();
  for (const row of plan) {
    const sourceItem = row.allocation.stockMutation.inventoryItem;
    let destinationItem = await tx.inventoryItem.findUnique({ where: { masterProductId_branchId: { masterProductId: sourceItem.masterProductId, branchId: ledger.toBranchId } } });
    let location = destinationItem?.stockLocationId ? await tx.stockLocation.findUnique({ where: { id: destinationItem.stockLocationId } }) : null;
    if (!location) location = await tx.stockLocation.findFirst({ where: { warehouse: { branchId: ledger.toBranchId, isActive: true }, isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
    if (!location) throw errors.unprocessable('TRANSFER_DESTINATION_LOCATION_MISSING', 'Stock location tujuan transfer belum dikonfigurasi.');
    if (!destinationItem) destinationItem = await tx.inventoryItem.create({ data: { masterProductId: sourceItem.masterProductId, branchId: ledger.toBranchId, stock: 0, minThreshold: 0, warehouseId: location.warehouseId, stockLocationId: location.id } });
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "inventory_items" WHERE "id" = ${destinationItem.id} FOR UPDATE`);

    const batchKey = row.allocation.costLayer.batchId || 'NO_BATCH';
    const destinationBalance = await tx.inventoryBalance.upsert({
      where: { inventoryItemId_stockLocationId_batchKey: { inventoryItemId: destinationItem.id, stockLocationId: location.id, batchKey } },
      create: { inventoryItemId: destinationItem.id, stockLocationId: location.id, masterProductId: sourceItem.masterProductId, branchId: ledger.toBranchId, batchId: row.allocation.costLayer.batchId, batchKey },
      update: {},
    });
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "inventory_balances" WHERE "id" = ${destinationBalance.id} FOR UPDATE`);
    const currentItem = await tx.inventoryItem.findUniqueOrThrow({ where: { id: destinationItem.id } });
    await tx.inventoryBalance.update({ where: { id: destinationBalance.id }, data: { onHandQty: { increment: row.quantity }, version: { increment: 1 } } });
    const transitUpdate = await tx.inventoryBalance.updateMany({ where: { id: row.allocation.stockMutation.inventoryBalanceId!, inTransitQty: { gte: row.quantity } }, data: { inTransitQty: { decrement: row.quantity }, version: { increment: 1 } } });
    if (transitUpdate.count !== 1) throw errors.conflict('TRANSFER_TRANSIT_CONFLICT', 'Quantity in-transit berubah saat receipt.');
    await tx.inventoryItem.update({ where: { id: destinationItem.id }, data: { stock: { increment: row.quantity }, warehouseId: location.warehouseId, stockLocationId: location.id } });
    const mutation = await tx.stockMutation.create({
      data: { inventoryItemId: destinationItem.id, type: StockMutationType.TRANSFER_IN, quantity: row.quantity, stockBefore: currentItem.stock, stockAfter: currentItem.stock.add(row.quantity), referenceType: 'SHIPMENT', referenceId: shipmentId, notes, createdBy: actorUserId, inventoryPostingId: receiptPosting.id, inventoryBalanceId: destinationBalance.id, batchId: row.allocation.costLayer.batchId, actualCost: row.totalCost },
    });
    const destinationLayer = await tx.inventoryCostLayer.create({
      data: { inventoryBalanceId: destinationBalance.id, batchId: row.allocation.costLayer.batchId, sourceType: 'INTERNAL_TRANSFER', sourceId: shipmentId, originalQty: row.quantity, remainingQty: row.quantity, unitCost: row.allocation.unitCost, currency: row.allocation.costLayer.currency, valuationStatus: InventoryValuationStatus.VALUED, receivedAt: occurredAt },
    });
    await tx.inventoryCostAllocation.create({ data: { postingId: receiptPosting.id, stockMutationId: mutation.id, costLayerId: destinationLayer.id, type: InventoryCostAllocationType.TRANSFER_RECEIPT, quantity: row.quantity, unitCost: row.allocation.unitCost, totalCost: row.totalCost } });

    const movement = movementMap.get(sourceItem.masterProductId) || { masterProductId: sourceItem.masterProductId, quantity: 0, destinationStockBefore: Number(currentItem.stock), destinationStockAfter: Number(currentItem.stock), notes };
    movement.quantity += Number(row.quantity);
    movement.destinationStockAfter = Number(new Prisma.Decimal(movement.destinationStockAfter || 0).add(row.quantity));
    movementMap.set(sourceItem.masterProductId, movement);
  }

  const shipment = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  const receiptLines = buildInternalTransferJournal('RECEIPT', receivedValue);
  const receiptJournal = await postInventoryDerivedJournal({
    postingKey: `INTERNAL_TRANSFER:RECEIPT:${shipmentId}`, transactionDate: occurredAt, branchId: ledger.toBranchId, actorUserId,
    description: `Receipt internal transfer ${shipment.shipmentCode}`,
    lines: receiptLines.map((line) => ({ ...line, branchId: line.accountCode === INVENTORY_ACCOUNT ? ledger.toBranchId : ledger.fromBranchId, description: line.accountCode === INVENTORY_ACCOUNT ? 'Persediaan diterima dari transfer internal' : 'Pelepasan persediaan dalam perjalanan' })),
    sourceLinks: [{ sourceType: 'INTERNAL_TRANSFER', sourceId: shipmentId, sourceNumber: shipment.shipmentCode, relationType: 'RECEIPT' }],
    metadata: { policy: 'INTERNAL_TRANSFER_IN_TRANSIT', noRevenueOrExpense: true, inventoryValue: receivedValue.toFixed(4) },
  }, tx);
  const status = totalReceivedQty.equals(totalSentQty) ? InternalTransferStatus.RECEIVED : InternalTransferStatus.DISCREPANCY;
  const updated = await tx.internalTransferLedger.update({ where: { id: ledger.id }, data: { status, receivedValue, receiptInventoryPostingId: receiptPosting.id, receiptJournalEntryId: receiptJournal.journal.id, receivedAt: occurredAt } });
  await tx.auditLog.create({ data: { userId: actorUserId, branchId: ledger.toBranchId, action: 'UPDATE', module: 'INVENTORY', resource: 'InternalTransferLedger', resourceId: ledger.id, entityType: 'InternalTransferLedger', entityId: ledger.id, entityCode: shipment.shipmentCode, beforeData: { status: ledger.status, receivedValue: ledger.receivedValue.toFixed(4) }, afterData: { status: updated.status, receivedValue: receivedValue.toFixed(4), receiptInventoryPostingId: receiptPosting.id, receiptJournalEntryId: receiptJournal.journal.id }, description: `Internal transfer ${shipment.shipmentCode} received.` } });
  return { ledger: updated, movements: [...movementMap.values()], idempotentReplay: false };
}
