import {
  AddOnStockReservationStatus,
  Prisma,
} from '@prisma/client';
import { errors } from '@middleware/errorHandler';
import {
  issueInventoryInTransaction,
  reverseInventoryPostingInTransaction,
} from '@modules/inventory/services/inventory-ledger.service';
import {
  postAddOnCostInTransaction,
  reverseAddOnCostInTransaction,
} from '@modules/accounting/accounting.service';

type Tx = Prisma.TransactionClient;

interface LockedBalance {
  id: string;
  onHandQty: Prisma.Decimal;
  reservedQty: Prisma.Decimal;
  quarantineQty: Prisma.Decimal;
}

interface ValuedQuantity {
  inventoryBalanceId: string;
  quantity: Prisma.Decimal;
}

interface LockedAddOnReservation {
  id: string;
  inventoryBalanceId: string;
  inventoryItemId: string;
  stockLocationId: string;
  quantity: Prisma.Decimal;
}

export interface ReservableAddOn {
  id: string;
  addOnCode: string;
  branchId: string;
  inventorySku: string | null;
  stockQuantity: Prisma.Decimal | null;
}

async function lockInventoryItems(tx: Tx, inventoryItemIds: string[]): Promise<void> {
  const ids = [...new Set(inventoryItemIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "inventory_items"
    WHERE "id" IN (${Prisma.join(ids)})
    ORDER BY "id"
    FOR UPDATE
  `);
}

async function lockBalances(tx: Tx, balanceIds: string[]): Promise<void> {
  const ids = [...new Set(balanceIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "inventory_balances"
    WHERE "id" IN (${Prisma.join(ids)})
    ORDER BY "id"
    FOR UPDATE
  `);
}

/** Reserve only stock that already has a valid FIFO valuation layer. */
export async function reserveAddOnStockInTransaction(
  addOn: ReservableAddOn,
  actorUserId: string,
  tx: Tx,
): Promise<void> {
  if (!addOn.inventorySku || !addOn.stockQuantity) return;
  if (!addOn.stockQuantity.greaterThan(0)) {
    throw errors.badRequest('ADD_ON_STOCK_QUANTITY_INVALID', 'Quantity stok add-on tidak valid.');
  }

  const inventoryItem = await tx.inventoryItem.findFirst({
    where: {
      branchId: addOn.branchId,
      masterProduct: { sku: addOn.inventorySku, isActive: true },
    },
    select: { id: true, stockLocationId: true },
  });
  if (!inventoryItem?.stockLocationId) {
    throw errors.unprocessable(
      'ADD_ON_INVENTORY_NOT_CONFIGURED',
      `Inventory ${addOn.inventorySku} belum dikonfigurasi pada cabang ini.`,
    );
  }

  await lockInventoryItems(tx, [inventoryItem.id]);
  const balances = await tx.$queryRaw<LockedBalance[]>(Prisma.sql`
    SELECT b."id", b."onHandQty", b."reservedQty", b."quarantineQty"
    FROM "inventory_balances" b
    LEFT JOIN "inventory_batches" batch ON batch."id" = b."batchId"
    WHERE b."inventoryItemId" = ${inventoryItem.id}
      AND b."stockLocationId" = ${inventoryItem.stockLocationId}
      AND b."onHandQty" - b."reservedQty" - b."quarantineQty" > 0
      AND (batch."id" IS NULL OR (
        batch."isBlocked" = false
        AND (batch."expiryDate" IS NULL OR batch."expiryDate" > CURRENT_TIMESTAMP)
      ))
    ORDER BY batch."expiryDate" ASC NULLS LAST, b."batchId" ASC NULLS LAST, b."id" ASC
    FOR UPDATE OF b
  `);

  if (balances.length === 0) {
    throw errors.unprocessable(
      'ADD_ON_VALUED_STOCK_UNAVAILABLE',
      `Stok siap jual ${addOn.inventorySku} tidak tersedia pada cabang ini.`,
    );
  }

  const valuedRows = await tx.$queryRaw<ValuedQuantity[]>(Prisma.sql`
    SELECT l."inventoryBalanceId", SUM(l."remainingQty") AS "quantity"
    FROM "inventory_cost_layers" l
    WHERE l."inventoryBalanceId" IN (${Prisma.join(balances.map((balance) => balance.id))})
      AND l."remainingQty" > 0
      AND l."unitCost" IS NOT NULL
      AND l."valuationStatus" = 'VALUED'
      AND l."isVoided" = false
      AND l."receivedAt" <= CURRENT_TIMESTAMP
    GROUP BY l."inventoryBalanceId"
  `);
  const valuedByBalance = new Map(
    valuedRows.map((row) => [row.inventoryBalanceId, new Prisma.Decimal(row.quantity)]),
  );
  const allocatable = balances.map((balance) => ({
    balance,
    quantity: Prisma.Decimal.min(
      balance.onHandQty.sub(balance.reservedQty).sub(balance.quarantineQty),
      valuedByBalance.get(balance.id) || new Prisma.Decimal(0),
    ),
  }));
  const available = allocatable.reduce(
    (sum, row) => sum.add(row.quantity),
    new Prisma.Decimal(0),
  );
  if (available.lessThan(addOn.stockQuantity)) {
    if (available.isZero()) {
      throw errors.unprocessable(
        'ADD_ON_VALUED_STOCK_UNAVAILABLE',
        `Stok ${addOn.inventorySku} belum memiliki harga pokok (HPP) yang valid. Catat penerimaan barang atau opening stock sebelum menjual add-on.`,
      );
    }
    throw errors.unprocessable(
      'ADD_ON_VALUED_STOCK_UNAVAILABLE',
      `Stok siap jual ${addOn.inventorySku} tersisa ${available.toDecimalPlaces(4).toString()} unit, sedangkan transaksi membutuhkan ${addOn.stockQuantity.toDecimalPlaces(4).toString()} unit.`,
    );
  }

  let remaining = addOn.stockQuantity;
  for (const row of allocatable) {
    if (remaining.isZero()) break;
    const quantity = Prisma.Decimal.min(row.quantity, remaining);
    if (!quantity.greaterThan(0)) continue;
    await tx.inventoryBalance.update({
      where: { id: row.balance.id },
      data: { reservedQty: { increment: quantity }, version: { increment: 1 } },
    });
    await tx.addOnStockReservation.create({
      data: {
        memberAddOnId: addOn.id,
        inventoryBalanceId: row.balance.id,
        quantity,
        reservedBy: actorUserId,
      },
    });
    remaining = remaining.sub(quantity);
  }
}

async function lockActiveReservations(
  memberAddOnId: string,
  tx: Tx,
): Promise<LockedAddOnReservation[]> {
  const identities = await tx.addOnStockReservation.findMany({
    where: { memberAddOnId, status: AddOnStockReservationStatus.ACTIVE },
    select: {
      id: true,
      inventoryBalanceId: true,
      inventoryBalance: { select: { inventoryItemId: true, stockLocationId: true } },
    },
    orderBy: [{ inventoryBalanceId: 'asc' }, { id: 'asc' }],
  });
  await lockInventoryItems(tx, identities.map((row) => row.inventoryBalance.inventoryItemId));
  await lockBalances(tx, identities.map((row) => row.inventoryBalanceId));

  return tx.$queryRaw<LockedAddOnReservation[]>(Prisma.sql`
    SELECT r."id", r."inventoryBalanceId", b."inventoryItemId", b."stockLocationId", r."quantity"
    FROM "add_on_stock_reservations" r
    JOIN "inventory_balances" b ON b."id" = r."inventoryBalanceId"
    WHERE r."memberAddOnId" = ${memberAddOnId}
      AND r."status" = 'ACTIVE'
    ORDER BY r."inventoryBalanceId", r."id"
    FOR UPDATE OF r
  `);
}

/** Convert an add-on reservation into an immutable FIFO issue and HPP journal. */
export async function consumeAddOnStockInTransaction(
  memberAddOnId: string,
  actorUserId: string,
  occurredAt: Date,
  tx: Tx,
): Promise<string | null> {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "member_add_ons" WHERE "id" = ${memberAddOnId} FOR UPDATE
  `);
  const addOn = await tx.memberAddOn.findUnique({ where: { id: memberAddOnId } });
  if (!addOn) throw errors.notFound('Add-on tidak ditemukan.');
  if (!addOn.inventorySku || !addOn.stockQuantity) return null;
  if (addOn.inventoryPostingId) return addOn.inventoryPostingId;

  const reservations = await lockActiveReservations(memberAddOnId, tx);
  const reservedQuantity = reservations.reduce(
    (sum, reservation) => sum.add(reservation.quantity),
    new Prisma.Decimal(0),
  );
  if (reservations.length === 0 || !reservedQuantity.equals(addOn.stockQuantity)) {
    throw errors.conflict(
      'ADD_ON_RESERVATION_MISMATCH',
      'Reservasi stok add-on tidak lengkap. Batalkan transaksi atau lakukan rekonsiliasi inventory.',
    );
  }

  for (const reservation of reservations) {
    const released = await tx.inventoryBalance.updateMany({
      where: { id: reservation.inventoryBalanceId, reservedQty: { gte: reservation.quantity } },
      data: { reservedQty: { decrement: reservation.quantity }, version: { increment: 1 } },
    });
    if (released.count !== 1) {
      throw errors.conflict('ADD_ON_RESERVATION_BALANCE_MISMATCH', 'Saldo reservasi add-on tidak konsisten.');
    }
  }

  const inventoryItemIds = [...new Set(reservations.map((row) => row.inventoryItemId))];
  const stockLocationIds = [...new Set(reservations.map((row) => row.stockLocationId))];
  if (inventoryItemIds.length !== 1 || stockLocationIds.length !== 1) {
    throw errors.conflict('ADD_ON_RESERVATION_SCOPE_MISMATCH', 'Scope inventory add-on tidak konsisten.');
  }
  const postingId = await issueInventoryInTransaction(actorUserId, {
    idempotencyKey: `ADDON_ISSUE:${addOn.id}`,
    branchId: addOn.branchId,
    sourceType: 'MEMBER_ADD_ON',
    sourceId: addOn.id,
    sourceNumber: addOn.addOnCode,
    reasonCode: 'ADD_ON_SALE',
    occurredAt,
    lines: [{
      inventoryItemId: inventoryItemIds[0],
      stockLocationId: stockLocationIds[0],
      quantity: addOn.stockQuantity.toFixed(4),
    }],
  }, tx);
  const posting = await tx.inventoryPosting.findUniqueOrThrow({
    where: { id: postingId },
    select: { totalCost: true },
  });

  await tx.addOnStockReservation.updateMany({
    where: { memberAddOnId, status: AddOnStockReservationStatus.ACTIVE },
    data: {
      status: AddOnStockReservationStatus.CONSUMED,
      consumedBy: actorUserId,
      consumedAt: occurredAt,
    },
  });
  await tx.memberAddOn.update({
    where: { id: memberAddOnId },
    data: { inventoryPostingId: postingId },
  });
  await postAddOnCostInTransaction({
    actorUserId,
    branchId: addOn.branchId,
    memberAddOnId: addOn.id,
    addOnCode: addOn.addOnCode,
    inventoryPostingId: postingId,
    totalCost: posting.totalCost,
    occurredAt,
  }, tx);
  return postingId;
}

/** Release stock held by an unpaid/cancelled add-on. Idempotent when none remain. */
export async function releaseAddOnStockInTransaction(
  memberAddOnId: string,
  actorUserId: string,
  reason: string,
  tx: Tx,
): Promise<void> {
  const reservations = await lockActiveReservations(memberAddOnId, tx);
  if (reservations.length === 0) return;
  const releasedAt = new Date();
  for (const reservation of reservations) {
    const released = await tx.inventoryBalance.updateMany({
      where: { id: reservation.inventoryBalanceId, reservedQty: { gte: reservation.quantity } },
      data: { reservedQty: { decrement: reservation.quantity }, version: { increment: 1 } },
    });
    if (released.count !== 1) {
      throw errors.conflict('ADD_ON_RESERVATION_BALANCE_MISMATCH', 'Saldo reservasi add-on tidak konsisten.');
    }
  }
  await tx.addOnStockReservation.updateMany({
    where: { memberAddOnId, status: AddOnStockReservationStatus.ACTIVE },
    data: {
      status: AddOnStockReservationStatus.RELEASED,
      releasedBy: actorUserId,
      releasedAt,
      releaseReason: reason,
    },
  });
}

/** Return a paid physical add-on to stock and reverse its FIFO HPP atomically. */
export async function returnAddOnStockInTransaction(
  memberAddOnId: string,
  actorUserId: string,
  reason: string,
  occurredAt: Date,
  tx: Tx,
): Promise<string | null> {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "member_add_ons" WHERE "id" = ${memberAddOnId} FOR UPDATE
  `);
  const addOn = await tx.memberAddOn.findUnique({ where: { id: memberAddOnId } });
  if (!addOn) throw errors.notFound('Add-on tidak ditemukan.');
  if (!addOn.inventoryPostingId) return null;

  const reversalId = await reverseInventoryPostingInTransaction(
    actorUserId,
    addOn.inventoryPostingId,
    {
      idempotencyKey: `ADDON_RETURN:${addOn.id}`,
      reasonCode: 'ADD_ON_RETURN',
      occurredAt,
    },
    tx,
  );
  await reverseAddOnCostInTransaction({
    actorUserId,
    branchId: addOn.branchId,
    memberAddOnId: addOn.id,
    addOnCode: addOn.addOnCode,
    reason,
    occurredAt,
  }, tx);
  return reversalId;
}
