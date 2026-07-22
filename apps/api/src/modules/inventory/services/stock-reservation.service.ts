import { createHash, randomUUID } from 'crypto';
import { ApprovalDecisionType, AuditAction, Prisma, StockRequestStatus, StockReservationStatus } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission, getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { logAudit } from '@utils/auditLog';
import type {
  ApproveStockRequestReservationInput,
  ReleaseStockReservationInput,
  StockReservationQuery,
} from '../stock-reservation.schema';
import { decideApprovalInTransaction, startApprovalInTransaction } from '@modules/workflow/approval.service';

type Tx = Prisma.TransactionClient;

type ReservableBalance = {
  id: string;
  onHandQty: Prisma.Decimal;
  reservedQty: Prisma.Decimal;
  quarantineQty: Prisma.Decimal;
};

type LockedReservation = {
  id: string;
  inventoryBalanceId: string;
  quantity: Prisma.Decimal;
  releasedQty: Prisma.Decimal;
};

const MAX_TRANSACTION_ATTEMPTS = 3;

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
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

async function loadRequestResult(requestId: string) {
  return prisma.stockRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      branch: true,
      sourceBranch: true,
      items: { include: { masterProduct: true } },
      reservations: {
        include: {
          stockRequestItem: { include: { masterProduct: true } },
          inventoryBalance: { include: { stockLocation: { include: { warehouse: true } }, batch: true } },
        },
        orderBy: [{ stockRequestItemId: 'asc' }, { inventoryBalanceId: 'asc' }],
      },
      shipment: { include: { items: true } },
    },
  });
}

async function lockReservableBalances(
  tx: Tx,
  inventoryItemId: string,
  stockLocationId: string,
  occurredAt: Date,
): Promise<ReservableBalance[]> {
  return tx.$queryRaw<ReservableBalance[]>(Prisma.sql`
    SELECT b."id", b."onHandQty", b."reservedQty", b."quarantineQty"
    FROM "inventory_balances" b
    LEFT JOIN "inventory_batches" batch ON batch."id" = b."batchId"
    WHERE b."inventoryItemId" = ${inventoryItemId}
      AND b."stockLocationId" = ${stockLocationId}
      AND b."onHandQty" - b."reservedQty" - b."quarantineQty" > 0
      AND (batch."id" IS NULL OR (
        batch."isBlocked" = false
        AND (batch."expiryDate" IS NULL OR batch."expiryDate" > ${occurredAt})
      ))
    ORDER BY batch."expiryDate" ASC NULLS LAST, b."batchId" ASC NULLS LAST, b."id" ASC
    FOR UPDATE OF b
  `);
}

function normalizeApprovalPayload(input: ApproveStockRequestReservationInput) {
  return {
    ...input,
    lines: [...input.lines].sort((a, b) => a.stockRequestItemId.localeCompare(b.stockRequestItemId)),
  };
}

export async function approveAndReserveStockRequest(
  actorUserId: string,
  requestId: string,
  input: ApproveStockRequestReservationInput,
) {
  const requestScope = await prisma.stockRequest.findUnique({ where: { id: requestId }, select: { branchId: true } });
  if (!requestScope) throw errors.notFound('Stock request tidak ditemukan.');
  await assertBranchAccess(actorUserId, requestScope.branchId);
  await assertBranchAccess(actorUserId, input.sourceBranchId);
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_REQUEST_APPROVE, requestScope.branchId);
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_RESERVATION_CREATE, input.sourceBranchId);

  const normalized = normalizeApprovalPayload(input);
  const payloadHash = hashPayload({ requestId, ...normalized });

  await withTransactionRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "stock_requests" WHERE "id" = ${requestId} FOR UPDATE`);
    const request = await tx.stockRequest.findUnique({
      where: { id: requestId },
      include: { items: true },
    });
    if (!request) throw errors.notFound('Stock request tidak ditemukan.');

    if (request.approvalIdempotencyKey) {
      if (request.approvalIdempotencyKey === input.idempotencyKey && request.approvalPayloadHash === payloadHash) return;
      throw errors.conflict('STOCK_REQUEST_ALREADY_DECIDED', 'Stock request sudah memiliki keputusan approval.');
    }
    if (request.status !== StockRequestStatus.PENDING) {
      throw errors.conflict('INVALID_STOCK_REQUEST_STATUS', `Stock request berstatus ${request.status} dan tidak dapat di-approve.`);
    }

    const approval = await startApprovalInTransaction({
      module: 'STOCK_REQUEST', entityType: 'StockRequest', entityId: request.id, entityNumber: request.requestCode,
      branchId: request.branchId, makerUserId: request.requestedBy, amount: 0,
      category: input.sourceBranchId, transactionType: 'STOCK_REQUEST',
      payload: { id: request.id, items: [...request.items].sort((a, b) => a.id.localeCompare(b.id)).map((item) => ({ id: item.id, requestedQty: item.requestedQty.toFixed(2), finalQty: item.finalQty?.toFixed(2) || null })) },
    }, tx);
    const decision = await decideApprovalInTransaction({
      instanceId: approval.instance.id, actorUserId, decision: ApprovalDecisionType.APPROVE, note: input.reviewNotes,
    }, tx);
    if (!decision.approved) return;

    const requestItems = new Map(request.items.map((item) => [item.id, item]));
    if (requestItems.size !== normalized.lines.length || normalized.lines.some((line) => !requestItems.has(line.stockRequestItemId))) {
      throw errors.badRequest('INCOMPLETE_APPROVAL_LINES', 'Semua item stock request harus memiliki keputusan quantity.');
    }

    let isFullApproval = true;
    for (const line of normalized.lines) {
      const requestItem = requestItems.get(line.stockRequestItemId)!;
      const requestedQty = requestItem.finalQty ?? requestItem.requestedQty;
      const approvedQty = new Prisma.Decimal(line.approvedQty);
      if (approvedQty.greaterThan(requestedQty)) {
        throw errors.badRequest('APPROVED_QTY_EXCEEDS_REQUEST', 'Approved quantity tidak boleh melebihi requested quantity.');
      }
      if (!approvedQty.equals(requestedQty)) isFullApproval = false;

      if (approvedQty.greaterThan(0)) {
        const inventoryItem = await tx.inventoryItem.findUnique({
          where: { masterProductId_branchId: { masterProductId: requestItem.masterProductId, branchId: input.sourceBranchId } },
        });
        if (!inventoryItem) {
          throw errors.unprocessable('SOURCE_INVENTORY_NOT_FOUND', 'Product belum tersedia pada inventory source branch.');
        }
        const location = await tx.stockLocation.findUnique({
          where: { id: line.stockLocationId! },
          include: { warehouse: true },
        });
        if (!location?.isActive || !location.warehouse.isActive || location.warehouse.branchId !== input.sourceBranchId) {
          throw errors.badRequest('INVALID_SOURCE_LOCATION', 'Stock location tidak aktif atau tidak berada pada source branch.');
        }

        const balances = await lockReservableBalances(tx, inventoryItem.id, location.id, new Date());
        const available = balances.reduce(
          (sum, balance) => sum.add(balance.onHandQty.sub(balance.reservedQty).sub(balance.quarantineQty)),
          new Prisma.Decimal(0),
        );
        if (available.lessThan(approvedQty)) {
          throw errors.unprocessable(
            'INSUFFICIENT_AVAILABLE_STOCK',
            `Available stock hanya ${available.toFixed(4)} unit untuk item yang diminta.`,
          );
        }

        let remaining = approvedQty;
        for (const balance of balances) {
          if (remaining.isZero()) break;
          const balanceAvailable = balance.onHandQty.sub(balance.reservedQty).sub(balance.quarantineQty);
          const reservedQuantity = Prisma.Decimal.min(balanceAvailable, remaining);
          if (reservedQuantity.lessThanOrEqualTo(0)) continue;
          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: { reservedQty: { increment: reservedQuantity }, version: { increment: 1 } },
          });
          await tx.stockReservation.create({
            data: {
              stockRequestId: request.id,
              stockRequestItemId: requestItem.id,
              inventoryBalanceId: balance.id,
              quantity: reservedQuantity,
              reservedBy: actorUserId,
            },
          });
          remaining = remaining.sub(reservedQuantity);
        }
        if (!remaining.isZero()) throw errors.conflict('RESERVATION_ALLOCATION_MISMATCH', 'Allocation reservation tidak lengkap.');
      }

      await tx.stockRequestItem.update({ where: { id: requestItem.id }, data: { approvedQty } });
    }

    await tx.stockRequest.update({
      where: { id: request.id },
      data: {
        sourceBranchId: input.sourceBranchId,
        status: isFullApproval ? StockRequestStatus.APPROVED : StockRequestStatus.PARTIALLY_APPROVED,
        reviewedBy: actorUserId,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes,
        approvalIdempotencyKey: input.idempotencyKey,
        approvalPayloadHash: payloadHash,
      },
    });

    const existingShipment = await tx.shipment.findUnique({ where: { stockRequestId: request.id } });
    const approvedLines = normalized.lines.filter((line) => new Prisma.Decimal(line.approvedQty).greaterThan(0));
    if (!existingShipment && approvedLines.length > 0) {
      await tx.shipment.create({
        data: {
          shipmentCode: `SHP-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          stockRequestId: request.id,
          fromBranchId: input.sourceBranchId,
          toBranchId: request.branchId,
          items: {
            create: approvedLines.map((line) => {
                const requestItem = requestItems.get(line.stockRequestItemId)!;
                return {
                  masterProductId: requestItem.masterProductId,
                  sentQty: new Prisma.Decimal(line.approvedQty),
                  requestedQty: requestItem.finalQty ?? requestItem.requestedQty,
                };
              }),
          },
        },
      });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

  const result = await loadRequestResult(requestId);
  await logAudit({
    userId: actorUserId,
    branchId: input.sourceBranchId,
    action: AuditAction.STOCK_REQUEST,
    resource: 'StockReservation',
    resourceId: requestId,
    afterData: {
      requestCode: result.requestCode,
      status: result.status,
      sourceBranchId: result.sourceBranchId,
      reservations: result.reservations.map((reservation) => ({
        id: reservation.id,
        stockRequestItemId: reservation.stockRequestItemId,
        inventoryBalanceId: reservation.inventoryBalanceId,
        quantity: reservation.quantity,
      })),
    },
  });
  return result;
}

export async function releaseStockRequestReservations(
  actorUserId: string,
  requestId: string,
  input: ReleaseStockReservationInput,
) {
  const requestScope = await prisma.stockRequest.findUnique({
    where: { id: requestId },
    select: { branchId: true, sourceBranchId: true },
  });
  if (!requestScope?.sourceBranchId) throw errors.notFound('Stock request atau source branch reservation tidak ditemukan.');
  await assertBranchAccess(actorUserId, requestScope.sourceBranchId);
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_RESERVATION_RELEASE, requestScope.sourceBranchId);
  const payloadHash = hashPayload({ requestId, ...input });

  await withTransactionRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "stock_requests" WHERE "id" = ${requestId} FOR UPDATE`);
    const request = await tx.stockRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (request.releaseIdempotencyKey) {
      if (request.releaseIdempotencyKey === input.idempotencyKey && request.releasePayloadHash === payloadHash) return;
      throw errors.conflict('RESERVATION_ALREADY_RELEASED', 'Reservation stock request sudah dilepas.');
    }
    if (request.status !== StockRequestStatus.APPROVED && request.status !== StockRequestStatus.PARTIALLY_APPROVED) {
      throw errors.conflict('INVALID_STOCK_REQUEST_STATUS', `Reservation tidak dapat dilepas dari status ${request.status}.`);
    }

    const reservations = await tx.$queryRaw<LockedReservation[]>(Prisma.sql`
      SELECT "id", "inventoryBalanceId", "quantity", "releasedQty"
      FROM "stock_reservations"
      WHERE "stockRequestId" = ${requestId} AND "status" = 'ACTIVE'
      ORDER BY "inventoryBalanceId", "id"
      FOR UPDATE
    `);
    if (reservations.length === 0) throw errors.conflict('NO_ACTIVE_RESERVATION', 'Tidak ada reservation aktif untuk dilepas.');
    const balanceIds = [...new Set(reservations.map((reservation) => reservation.inventoryBalanceId))].sort();
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "inventory_balances"
      WHERE "id" IN (${Prisma.join(balanceIds)})
      ORDER BY "id" FOR UPDATE
    `);

    const releasedAt = new Date();
    for (const reservation of reservations) {
      const quantity = reservation.quantity.sub(reservation.releasedQty);
      const balanceUpdate = await tx.inventoryBalance.updateMany({
        where: { id: reservation.inventoryBalanceId, reservedQty: { gte: quantity } },
        data: { reservedQty: { decrement: quantity }, version: { increment: 1 } },
      });
      if (balanceUpdate.count !== 1) {
        throw errors.conflict('RESERVATION_BALANCE_MISMATCH', 'Reserved quantity pada balance tidak konsisten.');
      }
      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: {
          releasedQty: reservation.quantity,
          status: StockReservationStatus.RELEASED,
          releasedBy: actorUserId,
          releasedAt,
          releaseReason: input.reason,
        },
      });
    }

    const preparingShipment = await tx.shipment.findUnique({ where: { stockRequestId: requestId } });
    if (preparingShipment?.status === 'PREPARING') {
      await tx.shipment.delete({ where: { id: preparingShipment.id } });
    }

    await tx.stockRequest.update({
      where: { id: requestId },
      data: {
        status: StockRequestStatus.RESERVATION_RELEASED,
        releaseIdempotencyKey: input.idempotencyKey,
        releasePayloadHash: payloadHash,
        reservationReleasedAt: releasedAt,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

  const result = await loadRequestResult(requestId);
  await logAudit({
    userId: actorUserId,
    branchId: requestScope.sourceBranchId,
    action: 'UPDATE',
    resource: 'StockReservation',
    resourceId: requestId,
    beforeData: { status: 'ACTIVE' },
    afterData: { status: 'RELEASED', reason: input.reason, reservationCount: result.reservations.length },
  });
  return result;
}

export async function listStockReservations(actorUserId: string, query: StockReservationQuery) {
  const permissionBranchId = query.sourceBranchId ?? query.destinationBranchId;
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_REQUEST_READ, permissionBranchId);
  if (query.sourceBranchId) await assertBranchAccess(actorUserId, query.sourceBranchId);
  if (query.destinationBranchId) await assertBranchAccess(actorUserId, query.destinationBranchId);
  const accessibleBranchIds = await getAccessibleBranchIds(actorUserId);
  const where: Prisma.StockReservationWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.sourceBranchId
      ? { inventoryBalance: { branchId: query.sourceBranchId } }
      : accessibleBranchIds === null ? {} : { inventoryBalance: { branchId: { in: accessibleBranchIds } } }),
    ...(query.destinationBranchId ? { stockRequest: { branchId: query.destinationBranchId } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.stockReservation.findMany({
      where,
      include: {
        stockRequest: { include: { branch: true, sourceBranch: true } },
        stockRequestItem: { include: { masterProduct: true } },
        inventoryBalance: { include: { stockLocation: { include: { warehouse: true } }, batch: true } },
      },
      orderBy: [{ reservedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.stockReservation.count({ where }),
  ]);
  return { data: rows, meta: { ...query, total, totalPages: Math.ceil(total / query.limit) } };
}
