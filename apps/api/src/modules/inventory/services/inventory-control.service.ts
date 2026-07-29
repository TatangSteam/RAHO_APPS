import { createHash, randomUUID } from 'crypto';
import {
  ApprovalInstanceStatus,
  InventoryAdjustmentDirection,
  InventoryAdjustmentStatus,
  InventoryValuationStatus,
  Prisma,
  Role,
  StockOpnameResolution,
  StockOpnameStatus,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission, getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { decideApprovalInTransaction, submitApprovalInTransaction } from '@modules/approvals/approval.service';
import { postInventoryAdjustmentDerivedJournal } from '@modules/accounting/accounting.service';
import {
  issueAdjustmentInventoryInTransaction,
  receiveAdjustmentInventoryInTransaction,
} from './inventory-ledger.service';
import type {
  AdjustmentDecisionInput,
  CountStockOpnameInput,
  CreateAdjustmentInput,
  DirectStockAdjustmentInput,
  InventoryControlListQuery,
  StartStockOpnameInput,
} from '../inventory-control.schema';

type Tx = Prisma.TransactionClient;

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const documentNumber = (prefix: string) => `${prefix}/${new Date().getUTCFullYear()}/${randomUUID().slice(0, 10).toUpperCase()}`;
const money = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

const adjustmentInclude = {
  lines: { orderBy: { lineNo: 'asc' as const } },
} satisfies Prisma.InventoryAdjustmentInclude;

const opnameInclude = {
  lines: { orderBy: { lineNo: 'asc' as const } },
} satisfies Prisma.StockOpnameInclude;

async function estimateOutbound(
  tx: Tx,
  input: { inventoryItemId: string; stockLocationId: string; batchId?: string; quantity: Prisma.Decimal },
) {
  const balances = await tx.inventoryBalance.findMany({
    where: {
      inventoryItemId: input.inventoryItemId,
      stockLocationId: input.stockLocationId,
      ...(input.batchId ? { batchId: input.batchId } : {}),
    },
    include: {
      costLayers: {
        where: { remainingQty: { gt: 0 }, isVoided: false, valuationStatus: 'VALUED', unitCost: { not: null } },
        orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      },
    },
  });
  const available = balances.reduce(
    (sum, balance) => sum.add(balance.onHandQty.sub(balance.reservedQty).sub(balance.quarantineQty)),
    new Prisma.Decimal(0),
  );
  if (available.lessThan(input.quantity)) {
    throw errors.unprocessable('INSUFFICIENT_AVAILABLE_STOCK', `Stok tersedia hanya ${available.toFixed(4)} unit.`);
  }
  let remaining = input.quantity;
  let value = new Prisma.Decimal(0);
  for (const balance of balances) {
    let balanceAvailable = balance.onHandQty.sub(balance.reservedQty).sub(balance.quarantineQty);
    for (const layer of balance.costLayers) {
      if (!remaining.greaterThan(0) || !balanceAvailable.greaterThan(0)) break;
      const allocated = Prisma.Decimal.min(remaining, balanceAvailable, layer.remainingQty);
      value = value.add(allocated.mul(layer.unitCost!));
      remaining = remaining.sub(allocated);
      balanceAvailable = balanceAvailable.sub(allocated);
    }
  }
  if (remaining.greaterThan(0)) {
    throw errors.unprocessable('FIFO_LAYER_INSUFFICIENT', 'Cost layer bernilai tidak cukup untuk adjustment keluar.');
  }
  return money(value);
}

async function validateAdjustmentLines(tx: Tx, input: CreateAdjustmentInput) {
  const reason = await tx.inventoryAdjustmentReasonCode.findUnique({ where: { code: input.reasonCode } });
  if (!reason?.isActive) throw errors.badRequest('ADJUSTMENT_REASON_INVALID', 'Reason code adjustment tidak aktif atau tidak ditemukan.');
  const location = await tx.stockLocation.findUnique({ where: { id: input.stockLocationId }, include: { warehouse: true } });
  if (!location?.isActive || !location.warehouse.isActive || location.warehouse.branchId !== input.branchId) {
    throw errors.badRequest('STOCK_LOCATION_INVALID', 'Stock location tidak aktif atau tidak sesuai branch.');
  }
  const keys = input.lines.map((line) => `${line.inventoryItemId}:${line.batchId || ''}:${line.direction}`);
  if (new Set(keys).size !== keys.length) throw errors.badRequest('ADJUSTMENT_LINE_DUPLICATE', 'Item, batch, dan arah tidak boleh duplikat.');
  const items = await tx.inventoryItem.findMany({
    where: { id: { in: [...new Set(input.lines.map((line) => line.inventoryItemId))] }, branchId: input.branchId },
    include: { masterProduct: true },
  });
  const itemById = new Map(items.map((item) => [item.id, item]));
  if (itemById.size !== new Set(input.lines.map((line) => line.inventoryItemId)).size) {
    throw errors.notFound('Satu atau lebih inventory item tidak ditemukan dalam branch.');
  }

  let total = new Prisma.Decimal(0);
  const lines = [];
  for (const [index, line] of input.lines.entries()) {
    const item = itemById.get(line.inventoryItemId)!;
    if (reason.direction && reason.direction !== line.direction) {
      throw errors.badRequest('ADJUSTMENT_REASON_DIRECTION_INVALID', `Reason ${reason.code} hanya boleh untuk arah ${reason.direction}.`);
    }
    if (line.batchId) {
      const batch = await tx.inventoryBatch.findFirst({ where: { id: line.batchId, masterProductId: item.masterProductId } });
      if (!batch) throw errors.badRequest('ADJUSTMENT_BATCH_INVALID', 'Batch tidak sesuai product adjustment.');
    } else if (item.masterProduct.tracksBatch) {
      throw errors.badRequest('ADJUSTMENT_BATCH_REQUIRED', `Batch wajib untuk ${item.masterProduct.name}.`);
    }
    const qty = new Prisma.Decimal(line.quantity);
    let estimatedValue: Prisma.Decimal;
    if (line.direction === 'IN') {
      if (line.unitCost === undefined) throw errors.badRequest('ADJUSTMENT_UNIT_COST_REQUIRED', 'Unit cost wajib untuk adjustment masuk.');
      estimatedValue = money(qty.mul(new Prisma.Decimal(line.unitCost)));
    } else {
      estimatedValue = await estimateOutbound(tx, {
        inventoryItemId: line.inventoryItemId,
        stockLocationId: input.stockLocationId,
        batchId: line.batchId,
        quantity: qty,
      });
    }
    total = total.add(estimatedValue);
    lines.push({
      lineNo: index + 1,
      inventoryItemId: line.inventoryItemId,
      batchId: line.batchId,
      direction: line.direction as InventoryAdjustmentDirection,
      quantity: qty,
      unitCost: line.unitCost,
      estimatedValue,
      notes: line.notes,
    });
  }
  return { reason, location, lines, total: money(total) };
}

async function submitAdjustmentDocument(tx: Tx, adjustmentId: string, actorUserId: string) {
  const adjustment = await tx.inventoryAdjustment.findUnique({ where: { id: adjustmentId }, include: adjustmentInclude });
  if (!adjustment) throw errors.notFound('Adjustment tidak ditemukan.');
  if (adjustment.status !== InventoryAdjustmentStatus.DRAFT && adjustment.status !== InventoryAdjustmentStatus.REJECTED) {
    if (adjustment.status === InventoryAdjustmentStatus.PENDING_APPROVAL) return adjustment;
    throw errors.conflict('ADJUSTMENT_STATUS_INVALID', 'Adjustment tidak dapat diajukan dari status ini.');
  }
  const reason = await tx.inventoryAdjustmentReasonCode.findUniqueOrThrow({ where: { code: adjustment.reasonCode } });
  const requiresApproval = reason.requiresApproval
    && adjustment.totalEstimatedValue.greaterThanOrEqualTo(reason.approvalThreshold);
  if (!requiresApproval) {
    const approved = await tx.inventoryAdjustment.update({
      where: { id: adjustment.id },
      data: {
        status: 'APPROVED',
        submittedAt: new Date(),
        approvedAt: new Date(),
        rejectionReason: null,
      },
      include: adjustmentInclude,
    });
    await tx.auditLog.create({ data: {
      userId: actorUserId, branchId: adjustment.branchId, action: 'STATUS_CHANGE', module: 'INVENTORY',
      resource: 'InventoryAdjustment', resourceId: adjustment.id, entityType: 'InventoryAdjustment', entityId: adjustment.id,
      entityCode: adjustment.adjustmentNumber, description: `Adjustment ${adjustment.adjustmentNumber} auto-approved sesuai threshold reason code.`,
      beforeData: { status: adjustment.status }, afterData: { status: approved.status, approvalThreshold: reason.approvalThreshold },
    } });
    return approved;
  }
  const approval = await submitApprovalInTransaction(tx, {
    subjectType: 'INVENTORY_ADJUSTMENT',
    subjectId: adjustment.id,
    branchId: adjustment.branchId,
    makerId: adjustment.createdBy,
    amount: adjustment.totalEstimatedValue,
    category: adjustment.reasonCode,
    transactionType: adjustment.sourceType,
    metadata: { adjustmentNumber: adjustment.adjustmentNumber },
  });
  return tx.inventoryAdjustment.update({
    where: { id: adjustment.id },
    data: {
      status: approval.status === ApprovalInstanceStatus.APPROVED ? 'APPROVED' : 'PENDING_APPROVAL',
      approvalInstanceId: approval.id,
      submittedAt: new Date(),
      rejectionReason: null,
    },
    include: adjustmentInclude,
  });
}

export async function createAdjustment(userId: string, input: CreateAdjustmentInput) {
  await assertBranchAccess(userId, input.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_ADJUSTMENT_CREATE, input.branchId);
  const payloadHash = hash(input);
  return prisma.$transaction(async (tx) => {
    const replay = await tx.inventoryAdjustment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: adjustmentInclude });
    if (replay) {
      if (replay.payloadHash !== payloadHash) throw errors.conflict('ADJUSTMENT_KEY_REUSED', 'Idempotency key digunakan untuk payload berbeda.');
      return { adjustment: replay, idempotentReplay: true };
    }
    const validated = await validateAdjustmentLines(tx, input);
    const adjustment = await tx.inventoryAdjustment.create({
      data: {
        adjustmentNumber: documentNumber('ADJ'),
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        branchId: input.branchId,
        stockLocationId: input.stockLocationId,
        reasonCode: validated.reason.code,
        description: input.description,
        totalEstimatedValue: validated.total,
        createdBy: userId,
        lines: { create: validated.lines },
      },
      include: adjustmentInclude,
    });
    const result = input.submit ? await submitAdjustmentDocument(tx, adjustment.id, userId) : adjustment;
    await tx.auditLog.create({ data: {
      userId, branchId: input.branchId, action: 'CREATE', module: 'INVENTORY', resource: 'InventoryAdjustment',
      resourceId: adjustment.id, entityType: 'InventoryAdjustment', entityId: adjustment.id,
      entityCode: adjustment.adjustmentNumber, description: `Adjustment ${adjustment.adjustmentNumber} dibuat.`,
      afterData: { status: result.status, reasonCode: result.reasonCode, totalEstimatedValue: result.totalEstimatedValue },
    } });
    return { adjustment: result, idempotentReplay: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function submitAdjustment(userId: string, adjustmentId: string) {
  const candidate = await prisma.inventoryAdjustment.findUnique({ where: { id: adjustmentId } });
  if (!candidate) throw errors.notFound('Adjustment tidak ditemukan.');
  await assertBranchAccess(userId, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_ADJUSTMENT_CREATE, candidate.branchId);
  if (candidate.createdBy !== userId) throw errors.forbidden('Hanya maker yang dapat mengajukan adjustment.');
  return prisma.$transaction((tx) => submitAdjustmentDocument(tx, adjustmentId, userId));
}

export async function decideAdjustment(userId: string, adjustmentId: string, input: AdjustmentDecisionInput) {
  const candidate = await prisma.inventoryAdjustment.findUnique({ where: { id: adjustmentId } });
  if (!candidate) throw errors.notFound('Adjustment tidak ditemukan.');
  await assertBranchAccess(userId, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_ADJUSTMENT_APPROVE, candidate.branchId);
  return prisma.$transaction(async (tx) => {
    const approval = await decideApprovalInTransaction(tx, {
      subjectType: 'INVENTORY_ADJUSTMENT', subjectId: adjustmentId, actorUserId: userId,
      decision: input.decision, note: input.note,
    });
    return tx.inventoryAdjustment.update({
      where: { id: adjustmentId },
      data: input.decision === 'REJECT'
        ? { status: 'REJECTED', rejectionReason: input.note }
        : approval.status === 'APPROVED'
          ? { status: 'APPROVED', approvedBy: userId, approvedAt: new Date(), rejectionReason: null }
          : { status: 'PENDING_APPROVAL' },
      include: adjustmentInclude,
    });
  });
}

async function postAdjustmentInTransaction(tx: Tx, adjustmentId: string, actorUserId: string, bypassOpnameId?: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "inventory_adjustments" WHERE "id" = ${adjustmentId} FOR UPDATE`);
  const adjustment = await tx.inventoryAdjustment.findUnique({ where: { id: adjustmentId }, include: adjustmentInclude });
  if (!adjustment) throw errors.notFound('Adjustment tidak ditemukan.');
  if (adjustment.status === InventoryAdjustmentStatus.POSTED) return adjustment;
  if (adjustment.status !== InventoryAdjustmentStatus.APPROVED) {
    throw errors.conflict('ADJUSTMENT_NOT_APPROVED', 'Adjustment belum disetujui penuh.');
  }
  const reason = await tx.inventoryAdjustmentReasonCode.findUniqueOrThrow({ where: { code: adjustment.reasonCode } });
  const now = new Date();
  let inboundTotal = new Prisma.Decimal(0);
  let outboundTotal = new Prisma.Decimal(0);
  let firstInboundPostingId: string | undefined;
  let outboundPostingId: string | undefined;

  for (const line of adjustment.lines.filter((candidate) => candidate.direction === InventoryAdjustmentDirection.IN)) {
    const batch = line.batchId ? await tx.inventoryBatch.findUniqueOrThrow({ where: { id: line.batchId } }) : null;
    const posting = await receiveAdjustmentInventoryInTransaction(actorUserId, {
      idempotencyKey: `ADJ-IN:${adjustment.id}:${line.id}`,
      branchId: adjustment.branchId,
      inventoryItemId: line.inventoryItemId,
      stockLocationId: adjustment.stockLocationId,
      quantity: line.quantity.toFixed(4),
      unitCost: line.unitCost!.toFixed(4),
      currency: 'IDR',
      batch: batch ? {
        batchNumber: batch.batchNumber,
        manufactureDate: batch.manufactureDate || undefined,
        expiryDate: batch.expiryDate || undefined,
      } : undefined,
      sourceType: adjustment.stockOpnameId ? 'STOCK_OPNAME' : 'INVENTORY_ADJUSTMENT',
      sourceId: adjustment.id,
      sourceNumber: adjustment.adjustmentNumber,
      reasonCode: adjustment.reasonCode,
      occurredAt: now,
    }, tx, bypassOpnameId);
    const value = money(posting.totalCost);
    inboundTotal = inboundTotal.add(value);
    firstInboundPostingId ||= posting.id;
    await tx.inventoryAdjustmentLine.update({
      where: { id: line.id }, data: { postedValue: value, inventoryPostingId: posting.id },
    });
  }

  const outboundLines = adjustment.lines.filter((candidate) => candidate.direction === InventoryAdjustmentDirection.OUT);
  if (outboundLines.length > 0) {
    outboundPostingId = await issueAdjustmentInventoryInTransaction(actorUserId, {
      idempotencyKey: `ADJ-OUT:${adjustment.id}`,
      branchId: adjustment.branchId,
      sourceType: adjustment.stockOpnameId ? 'STOCK_OPNAME' : 'INVENTORY_ADJUSTMENT',
      sourceId: adjustment.id,
      sourceNumber: adjustment.adjustmentNumber,
      reasonCode: adjustment.reasonCode,
      occurredAt: now,
      lines: outboundLines.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        stockLocationId: adjustment.stockLocationId,
        batchId: line.batchId || undefined,
        quantity: line.quantity.toFixed(4),
      })),
    }, tx, bypassOpnameId);
    const posting = await tx.inventoryPosting.findUniqueOrThrow({
      where: { id: outboundPostingId }, include: { stockMutations: true },
    });
    outboundTotal = money(posting.totalCost);
    for (const line of outboundLines) {
      const mutation = posting.stockMutations.find((candidate) => (
        candidate.inventoryItemId === line.inventoryItemId
        && (!line.batchId || candidate.batchId === line.batchId)
      ));
      if (!mutation) throw errors.conflict('ADJUSTMENT_MUTATION_TRACE_MISSING', 'Mutation adjustment keluar tidak lengkap.');
      await tx.inventoryAdjustmentLine.update({
        where: { id: line.id }, data: { postedValue: money(mutation.actualCost ?? new Prisma.Decimal(0)), inventoryPostingId: posting.id },
      });
    }
  }

  const journalLines = [];
  if (inboundTotal.greaterThan(0)) journalLines.push(
    { accountCode: '1300', debit: money(inboundTotal), metadata: { adjustmentRole: 'INVENTORY_IN' } },
    { accountCode: reason.gainAccountCode, credit: money(inboundTotal), metadata: { adjustmentRole: 'GAIN' } },
  );
  if (outboundTotal.greaterThan(0)) journalLines.push(
    { accountCode: reason.lossAccountCode, debit: money(outboundTotal), metadata: { adjustmentRole: 'LOSS' } },
    { accountCode: '1300', credit: money(outboundTotal), metadata: { adjustmentRole: 'INVENTORY_OUT' } },
  );
  if (journalLines.length === 0) throw errors.unprocessable('ADJUSTMENT_ZERO_VALUE', 'Nilai adjustment harus minimal Rp0,01.');
  const journal = await postInventoryAdjustmentDerivedJournal({
    postingKey: `INVENTORY_ADJUSTMENT:${adjustment.id}`,
    transactionDate: now,
    branchId: adjustment.branchId,
    actorUserId,
    description: `${adjustment.adjustmentNumber} - ${adjustment.description}`,
    lines: journalLines,
    sourceLinks: [{
      sourceType: adjustment.stockOpnameId ? 'STOCK_OPNAME' : 'INVENTORY_ADJUSTMENT',
      sourceId: adjustment.stockOpnameId || adjustment.id,
      sourceNumber: adjustment.adjustmentNumber,
    }],
    metadata: { reasonCode: adjustment.reasonCode, adjustmentId: adjustment.id },
  }, tx);
  const posted = await tx.inventoryAdjustment.update({
    where: { id: adjustment.id },
    data: {
      status: 'POSTED',
      inboundPostingId: firstInboundPostingId,
      outboundPostingId,
      journalEntryId: journal.journal.id,
      totalPostedValue: money(inboundTotal.add(outboundTotal)),
      postedBy: actorUserId,
      postedAt: now,
    },
    include: adjustmentInclude,
  });
  await tx.auditLog.create({ data: {
    userId: actorUserId, branchId: adjustment.branchId, action: 'STOCK_ADJUSTMENT', module: 'INVENTORY',
    resource: 'InventoryAdjustment', resourceId: adjustment.id, entityType: 'InventoryAdjustment', entityId: adjustment.id,
    entityCode: adjustment.adjustmentNumber, description: `Adjustment ${adjustment.adjustmentNumber} diposting.`,
    afterData: { status: 'POSTED', journalEntryId: journal.journal.id, totalPostedValue: posted.totalPostedValue },
  } });
  return posted;
}

/**
 * Super Admin emergency/direct stock correction.
 *
 * The document deliberately bypasses maker-checker approval, but still uses the
 * authoritative adjustment posting flow so balances, FIFO layers, mutations,
 * audit logs, and accounting journals remain synchronized.
 */
export async function directAdjustStock(
  userId: string,
  inventoryItemId: string,
  input: DirectStockAdjustmentInput,
) {
  const [actor, candidate] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } }),
    prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      select: { branchId: true, branch: { select: { isActive: true } } },
    }),
  ]);
  if (!actor?.isActive || actor.role !== Role.SUPER_ADMIN) {
    throw errors.forbidden('Perubahan stok langsung hanya dapat dilakukan oleh Super Admin.');
  }
  if (!candidate) throw errors.notFound('Item inventori tidak ditemukan.');
  if (!candidate.branch.isActive) {
    throw errors.unprocessable('BRANCH_INACTIVE', 'Stok tidak dapat diedit karena cabang sudah tidak aktif.');
  }

  await assertBranchAccess(userId, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_ADJUSTMENT_CREATE, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_ADJUSTMENT_POST, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_POST, candidate.branchId);

  const payloadHash = hash({ inventoryItemId, ...input });
  return prisma.$transaction(async (tx) => {
    const replay = await tx.inventoryAdjustment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: adjustmentInclude,
    });
    if (replay) {
      if (replay.payloadHash !== payloadHash) {
        throw errors.conflict('ADJUSTMENT_KEY_REUSED', 'Idempotency key digunakan untuk payload berbeda.');
      }
      return { adjustment: replay, idempotentReplay: true, direct: true };
    }

    const item = await tx.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: { masterProduct: true, branch: true },
    });
    if (!item) throw errors.notFound('Item inventori tidak ditemukan.');
    if (!item.branch.isActive) {
      throw errors.unprocessable('BRANCH_INACTIVE', 'Stok tidak dapat diedit karena cabang sudah tidak aktif.');
    }

    if (item.masterProduct.tracksBatch && !input.batchId) {
      throw errors.badRequest(
        'DIRECT_ADJUSTMENT_BATCH_REQUIRED',
        `Batch wajib dipilih untuk ${item.masterProduct.name}. Gunakan halaman Adjustment & Opname untuk memilih batch.`,
      );
    }

    const balances = await tx.inventoryBalance.findMany({
      where: { inventoryItemId },
      include: {
        stockLocation: { include: { warehouse: true } },
      },
      orderBy: [{ stockLocationId: 'asc' }, { batchKey: 'asc' }],
    });
    const activeBalance = balances.find((balance) => (
      balance.stockLocation.isActive
      && balance.stockLocation.warehouse.isActive
      && balance.stockLocation.warehouse.branchId === item.branchId
      && (!input.batchId || balance.batchId === input.batchId)
    ));
    const preferredLocationId = input.stockLocationId || item.stockLocationId || activeBalance?.stockLocationId;
    let location = preferredLocationId
      ? await tx.stockLocation.findUnique({ where: { id: preferredLocationId }, include: { warehouse: true } })
      : null;
    if (
      !location?.isActive
      || !location.warehouse.isActive
      || location.warehouse.branchId !== item.branchId
    ) {
      location = await tx.stockLocation.findFirst({
        where: {
          isActive: true,
          warehouse: { branchId: item.branchId, isActive: true },
        },
        include: { warehouse: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
    }
    if (!location) {
      throw errors.badRequest(
        'WAREHOUSE_REQUIRED',
        'Cabang belum memiliki warehouse dan lokasi stok aktif. Siapkan warehouse terlebih dahulu.',
      );
    }

    const mirrorQty = new Prisma.Decimal(item.stock);
    const balanceQty = balances.reduce(
      (sum, balance) => sum.add(balance.onHandQty),
      new Prisma.Decimal(0),
    );
    if (balances.length > 0 && !balanceQty.equals(mirrorQty)) {
      throw errors.conflict(
        'INVENTORY_RECONCILIATION_REQUIRED',
        `Saldo ledger (${balanceQty.toFixed(4)}) berbeda dari stok item (${mirrorQty.toFixed(4)}). Jalankan rekonsiliasi sebelum mengubah stok.`,
      );
    }

    const directUnitCost = new Prisma.Decimal(input.unitCost);
    let bootstrappedLegacyStock = false;
    if (balances.length === 0 && mirrorQty.greaterThan(0)) {
      const batchKey = input.batchId || 'NO_BATCH';
      const balance = await tx.inventoryBalance.create({
        data: {
          inventoryItemId: item.id,
          stockLocationId: location.id,
          masterProductId: item.masterProductId,
          branchId: item.branchId,
          batchId: input.batchId,
          batchKey,
          onHandQty: mirrorQty,
        },
      });
      await tx.inventoryCostLayer.create({
        data: {
          inventoryBalanceId: balance.id,
          batchId: input.batchId,
          sourceType: 'DIRECT_STOCK_BOOTSTRAP',
          sourceId: item.id,
          originalQty: mirrorQty,
          remainingQty: mirrorQty,
          unitCost: directUnitCost,
          currency: 'IDR',
          valuationStatus: InventoryValuationStatus.VALUED,
          receivedAt: new Date(),
        },
      });
      bootstrappedLegacyStock = true;
    }

    const locationBalanceIds = await tx.inventoryBalance.findMany({
      where: {
        inventoryItemId: item.id,
        stockLocationId: location.id,
        ...(input.batchId ? { batchId: input.batchId } : {}),
      },
      select: { id: true },
    });
    const valuedLegacyLayers = locationBalanceIds.length === 0
      ? { count: 0 }
      : await tx.inventoryCostLayer.updateMany({
        where: {
          inventoryBalanceId: { in: locationBalanceIds.map((balance) => balance.id) },
          valuationStatus: InventoryValuationStatus.PENDING_VALUATION,
          unitCost: null,
          isVoided: false,
        },
        data: {
          unitCost: directUnitCost,
          valuationStatus: InventoryValuationStatus.VALUED,
        },
      });

    if (item.stockLocationId !== location.id || item.warehouseId !== location.warehouseId) {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { warehouseId: location.warehouseId, stockLocationId: location.id },
      });
    }

    const adjustment = new Prisma.Decimal(input.adjustment);
    const normalized: CreateAdjustmentInput = {
      idempotencyKey: input.idempotencyKey,
      branchId: item.branchId,
      stockLocationId: location.id,
      reasonCode: input.reasonCode,
      description: input.notes,
      submit: true,
      lines: [{
        inventoryItemId: item.id,
        batchId: input.batchId,
        direction: adjustment.greaterThan(0) ? 'IN' : 'OUT',
        quantity: adjustment.abs().toFixed(4),
        unitCost: adjustment.greaterThan(0) ? directUnitCost.toFixed(4) : undefined,
        notes: input.notes,
      }],
    };
    const validated = await validateAdjustmentLines(tx, normalized);
    const now = new Date();
    const document = await tx.inventoryAdjustment.create({
      data: {
        adjustmentNumber: documentNumber('ADJ-DIRECT'),
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        branchId: item.branchId,
        stockLocationId: location.id,
        reasonCode: validated.reason.code,
        status: InventoryAdjustmentStatus.APPROVED,
        description: input.notes,
        totalEstimatedValue: validated.total,
        sourceType: 'SUPER_ADMIN_DIRECT',
        submittedAt: now,
        approvedAt: now,
        approvedBy: userId,
        createdBy: userId,
        lines: { create: validated.lines },
      },
      include: adjustmentInclude,
    });
    await tx.auditLog.create({ data: {
      userId,
      branchId: item.branchId,
      action: 'CREATE',
      module: 'INVENTORY',
      resource: 'InventoryAdjustment',
      resourceId: document.id,
      entityType: 'InventoryAdjustment',
      entityId: document.id,
      entityCode: document.adjustmentNumber,
      description: `Adjustment langsung ${document.adjustmentNumber} dibuat dan disetujui oleh Super Admin.`,
      afterData: {
        status: document.status,
        direct: true,
        adjustment: input.adjustment,
        unitCost: input.unitCost,
        stockLocationId: location.id,
        bootstrappedLegacyStock,
        valuedLegacyLayers: valuedLegacyLayers.count,
      },
    } });
    const posted = await postAdjustmentInTransaction(tx, document.id, userId);
    return { adjustment: posted, idempotentReplay: false, direct: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function postAdjustment(userId: string, adjustmentId: string) {
  const candidate = await prisma.inventoryAdjustment.findUnique({ where: { id: adjustmentId } });
  if (!candidate) throw errors.notFound('Adjustment tidak ditemukan.');
  await assertBranchAccess(userId, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_ADJUSTMENT_POST, candidate.branchId);
  return prisma.$transaction(
    (tx) => postAdjustmentInTransaction(tx, adjustmentId, userId),
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

export async function listAdjustmentReasons(userId: string) {
  await assertPermission(userId, PERMISSIONS.INVENTORY_ADJUSTMENT_READ);
  return prisma.inventoryAdjustmentReasonCode.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
}

export async function listAdjustments(userId: string, query: InventoryControlListQuery) {
  await assertPermission(userId, PERMISSIONS.INVENTORY_ADJUSTMENT_READ, query.branchId);
  const branches = await getAccessibleBranchIds(userId);
  const where: Prisma.InventoryAdjustmentWhereInput = {
    ...(query.branchId ? { branchId: query.branchId } : branches === null ? {} : { branchId: { in: branches } }),
    ...(query.status ? { status: query.status as InventoryAdjustmentStatus } : {}),
  };
  const [total, data] = await Promise.all([
    prisma.inventoryAdjustment.count({ where }),
    prisma.inventoryAdjustment.findMany({ where, include: adjustmentInclude, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
  ]);
  return { data, pagination: { ...query, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function startStockOpname(userId: string, input: StartStockOpnameInput) {
  await assertBranchAccess(userId, input.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_OPNAME_COUNT, input.branchId);
  return prisma.$transaction(async (tx) => {
    const location = await tx.stockLocation.findUnique({ where: { id: input.stockLocationId }, include: { warehouse: true } });
    if (!location?.isActive || location.warehouse.branchId !== input.branchId) throw errors.badRequest('STOCK_LOCATION_INVALID', 'Stock location tidak sesuai branch.');
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "stock_locations" WHERE "id" = ${location.id} FOR UPDATE`);
    const active = await tx.stockOpname.findFirst({ where: { stockLocationId: location.id, status: { in: ['COUNTING', 'PENDING_APPROVAL', 'APPROVED'] } } });
    if (active) throw errors.conflict('STOCK_OPNAME_ALREADY_ACTIVE', `Masih ada opname aktif ${active.opnameNumber}.`);
    const balances = await tx.inventoryBalance.findMany({
      where: { stockLocationId: location.id },
      include: { costLayers: { where: { remainingQty: { gt: 0 }, isVoided: false, unitCost: { not: null } } } },
      orderBy: [{ inventoryItemId: 'asc' }, { batchKey: 'asc' }],
    });
    if (balances.length === 0) throw errors.unprocessable('STOCK_OPNAME_EMPTY', 'Tidak ada inventory balance pada lokasi ini.');
    const lockToken = randomUUID();
    const snapshotAt = new Date();
    const opname = await tx.stockOpname.create({
      data: {
        opnameNumber: documentNumber('SO'), idempotencyKey: `STOCK-OPNAME-LOCK:${lockToken}`,
        payloadHash: hash({ branchId: input.branchId, stockLocationId: location.id, lockToken }),
        branchId: input.branchId, warehouseId: location.warehouseId, stockLocationId: location.id,
        status: 'COUNTING', reasonCode: 'STOCK_OPNAME', lockToken, notes: input.notes || '',
        countedAt: snapshotAt, snapshotAt, createdBy: userId, startedBy: userId,
        lines: { create: balances.map((balance, index) => {
          const value = money(balance.costLayers.reduce((sum, layer) => sum.add(layer.remainingQty.mul(layer.unitCost!)), new Prisma.Decimal(0)));
          const unitCost = balance.onHandQty.greaterThan(0) ? value.div(balance.onHandQty).toDecimalPlaces(4) : new Prisma.Decimal(0);
          return {
            lineNo: index + 1, inventoryItemId: balance.inventoryItemId, stockLocationId: location.id,
            inventoryBalanceId: balance.id, batchId: balance.batchId, batchKey: balance.batchKey,
            systemQty: balance.onHandQty, systemUnitCost: unitCost, systemValue: value,
            physicalQty: balance.onHandQty, differenceQty: 0,
          };
        }) },
      },
      include: opnameInclude,
    });
    await tx.auditLog.create({ data: {
      userId, branchId: input.branchId, action: 'CREATE', module: 'INVENTORY', resource: 'StockOpname',
      resourceId: opname.id, entityType: 'StockOpname', entityId: opname.id, entityCode: opname.opnameNumber,
      description: `Stock opname ${opname.opnameNumber} dimulai dan lokasi dikunci.`,
      afterData: { status: opname.status, stockLocationId: opname.stockLocationId, snapshotAt: opname.snapshotAt },
    } });
    return opname;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function countStockOpname(userId: string, opnameId: string, input: CountStockOpnameInput) {
  const candidate = await prisma.stockOpname.findUnique({ where: { id: opnameId } });
  if (!candidate) throw errors.notFound('Stock opname tidak ditemukan.');
  await assertBranchAccess(userId, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_OPNAME_COUNT, candidate.branchId);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "stock_opnames" WHERE "id" = ${opnameId} FOR UPDATE`);
    const opname = await tx.stockOpname.findUniqueOrThrow({ where: { id: opnameId }, include: opnameInclude });
    if (opname.status !== StockOpnameStatus.COUNTING) throw errors.conflict('STOCK_OPNAME_NOT_COUNTING', 'Stock opname tidak dalam tahap perhitungan.');
    const lineById = new Map(opname.lines.map((line) => [line.id, line]));
    if (new Set(input.lines.map((line) => line.lineId)).size !== input.lines.length) throw errors.badRequest('OPNAME_LINE_DUPLICATE', 'Baris opname tidak boleh duplikat.');
    for (const inputLine of input.lines) {
      const line = lineById.get(inputLine.lineId);
      if (!line) throw errors.badRequest('OPNAME_LINE_INVALID', 'Baris opname tidak ditemukan dalam dokumen.');
      const physical = new Prisma.Decimal(inputLine.physicalQty);
      const difference = physical.sub(line.systemQty);
      const resolution = difference.isZero()
        ? StockOpnameResolution.ACCEPTED
        : (inputLine.resolution as StockOpnameResolution | undefined) ?? StockOpnameResolution.PENDING;
      const resolvedCost = inputLine.resolvedUnitCost ? new Prisma.Decimal(inputLine.resolvedUnitCost) : line.systemUnitCost;
      if (difference.greaterThan(0) && !resolvedCost.greaterThan(0)) {
        throw errors.badRequest('OPNAME_UNIT_COST_REQUIRED', 'Unit cost wajib untuk selisih tambah yang belum memiliki nilai snapshot.');
      }
      if (resolution === StockOpnameResolution.RECOUNT && !inputLine.resolutionNote) {
        throw errors.badRequest('OPNAME_RECOUNT_NOTE_REQUIRED', 'Catatan wajib untuk permintaan hitung ulang.');
      }
      await tx.stockOpnameLine.update({ where: { id: line.id }, data: {
        physicalQty: physical, differenceQty: difference, resolvedUnitCost: resolvedCost,
        resolution, resolutionNote: inputLine.resolutionNote, countedBy: userId, countedAt: new Date(),
      } });
    }
    return tx.stockOpname.findUniqueOrThrow({ where: { id: opnameId }, include: opnameInclude });
  });
}

export async function submitStockOpname(userId: string, opnameId: string) {
  const candidate = await prisma.stockOpname.findUnique({ where: { id: opnameId } });
  if (!candidate) throw errors.notFound('Stock opname tidak ditemukan.');
  await assertBranchAccess(userId, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_OPNAME_COUNT, candidate.branchId);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "stock_opnames" WHERE "id" = ${opnameId} FOR UPDATE`);
    const opname = await tx.stockOpname.findUniqueOrThrow({ where: { id: opnameId }, include: opnameInclude });
    if (!opname.startedBy || !opname.stockLocationId) throw errors.conflict('STOCK_OPNAME_FLOW_INVALID', 'Dokumen bukan opname lock/snapshot.');
    if (opname.startedBy !== userId) throw errors.forbidden('Hanya maker opname yang dapat mengajukan hasil hitung.');
    if (opname.status !== StockOpnameStatus.COUNTING) throw errors.conflict('STOCK_OPNAME_STATUS_INVALID', 'Opname tidak dapat diajukan dari status ini.');
    if (opname.lines.some((line) => line.countedAt === null)) {
      throw errors.unprocessable('STOCK_OPNAME_INCOMPLETE', 'Semua baris opname wajib dihitung.');
    }
    if (opname.lines.some((line) => line.resolution === StockOpnameResolution.RECOUNT || (line.differenceQty && !line.differenceQty.isZero() && line.resolution !== StockOpnameResolution.ADJUST))) {
      throw errors.unprocessable('STOCK_OPNAME_RESOLUTION_INCOMPLETE', 'Semua selisih wajib diselesaikan sebagai ADJUST sebelum diajukan.');
    }
    const differences = opname.lines.filter((line) => line.differenceQty && !line.differenceQty.isZero());
    if (differences.length === 0) {
      return tx.stockOpname.update({ where: { id: opname.id }, data: { status: 'POSTED', submittedAt: new Date(), postedAt: new Date(), postedBy: userId }, include: opnameInclude });
    }
    const total = money(differences.reduce((sum, line) => sum.add(line.differenceQty!.abs().mul(line.resolvedUnitCost || line.systemUnitCost)), new Prisma.Decimal(0)));
    const adjustmentLines = differences.map((line, index) => ({
      lineNo: index + 1, inventoryItemId: line.inventoryItemId, batchId: line.batchId,
      direction: line.differenceQty!.greaterThan(0) ? 'IN' as const : 'OUT' as const, quantity: line.differenceQty!.abs(),
      unitCost: line.differenceQty!.greaterThan(0) ? (line.resolvedUnitCost || line.systemUnitCost) : null,
      estimatedValue: money(line.differenceQty!.abs().mul(line.resolvedUnitCost || line.systemUnitCost)),
      notes: line.resolutionNote,
    }));
    const adjustmentPayloadHash = hash(adjustmentLines.map((line) => ({
      inventoryItemId: line.inventoryItemId,
      batchId: line.batchId,
      direction: line.direction,
      quantity: line.quantity.toFixed(4),
      unitCost: line.unitCost?.toFixed(4) ?? null,
      notes: line.notes ?? null,
    })));
    let adjustment;
    if (opname.adjustmentId) {
      const existingAdjustment = await tx.inventoryAdjustment.findUniqueOrThrow({ where: { id: opname.adjustmentId } });
      if (existingAdjustment.status === 'POSTED') {
        throw errors.conflict('STOCK_OPNAME_ALREADY_POSTED', 'Adjustment opname sudah diposting dan tidak dapat diajukan ulang.');
      }
      await tx.inventoryAdjustmentLine.deleteMany({ where: { inventoryAdjustmentId: existingAdjustment.id } });
      adjustment = await tx.inventoryAdjustment.update({
        where: { id: existingAdjustment.id },
        data: {
          payloadHash: adjustmentPayloadHash,
          status: 'PENDING_APPROVAL',
          totalEstimatedValue: total,
          rejectionReason: null,
          submittedAt: new Date(),
          approvedAt: null,
          approvedBy: null,
          lines: { create: adjustmentLines },
        },
      });
    } else {
      adjustment = await tx.inventoryAdjustment.create({
        data: {
          adjustmentNumber: documentNumber('ADJ-SO'), idempotencyKey: `STOCK-OPNAME:${opname.id}`,
          payloadHash: adjustmentPayloadHash,
          branchId: opname.branchId, stockLocationId: opname.stockLocationId, reasonCode: 'STOCK_OPNAME',
          status: 'PENDING_APPROVAL', description: `Selisih ${opname.opnameNumber}`, totalEstimatedValue: total,
          sourceType: 'STOCK_OPNAME', sourceId: opname.id, stockOpnameId: opname.id, createdBy: opname.startedBy,
          submittedAt: new Date(), lines: { create: adjustmentLines },
        },
      });
    }
    const approval = await submitApprovalInTransaction(tx, {
      subjectType: 'STOCK_OPNAME', subjectId: opname.id, branchId: opname.branchId,
      makerId: opname.startedBy, amount: total, category: 'STOCK_OPNAME', transactionType: 'STOCK_OPNAME',
      metadata: { opnameNumber: opname.opnameNumber, adjustmentId: adjustment.id },
    });
    await tx.inventoryAdjustment.update({ where: { id: adjustment.id }, data: { approvalInstanceId: approval.id } });
    return tx.stockOpname.update({
      where: { id: opname.id },
      data: { status: 'PENDING_APPROVAL', submittedAt: new Date(), approvalInstanceId: approval.id, adjustmentId: adjustment.id },
      include: opnameInclude,
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function decideStockOpname(userId: string, opnameId: string, input: AdjustmentDecisionInput) {
  const candidate = await prisma.stockOpname.findUnique({ where: { id: opnameId } });
  if (!candidate) throw errors.notFound('Stock opname tidak ditemukan.');
  await assertBranchAccess(userId, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_OPNAME_APPROVE, candidate.branchId);
  return prisma.$transaction(async (tx) => {
    const approval = await decideApprovalInTransaction(tx, {
      subjectType: 'STOCK_OPNAME', subjectId: opnameId, actorUserId: userId,
      decision: input.decision, note: input.note,
    });
    const opname = await tx.stockOpname.update({
      where: { id: opnameId },
      data: input.decision === 'REJECT'
        ? { status: 'COUNTING', rejectionReason: input.note }
        : approval.status === 'APPROVED'
          ? { status: 'APPROVED', approvedBy: userId, approvedAt: new Date(), rejectionReason: null }
          : { status: 'PENDING_APPROVAL' },
      include: opnameInclude,
    });
    if (opname.adjustmentId) await tx.inventoryAdjustment.update({
      where: { id: opname.adjustmentId },
      data: input.decision === 'REJECT'
        ? { status: 'REJECTED', rejectionReason: input.note }
        : approval.status === 'APPROVED'
          ? { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() }
          : { status: 'PENDING_APPROVAL' },
    });
    return opname;
  });
}

export async function postStockOpname(userId: string, opnameId: string) {
  const candidate = await prisma.stockOpname.findUnique({ where: { id: opnameId } });
  if (!candidate) throw errors.notFound('Stock opname tidak ditemukan.');
  await assertBranchAccess(userId, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_OPNAME_POST, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_ADJUSTMENT_POST, candidate.branchId);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "stock_opnames" WHERE "id" = ${opnameId} FOR UPDATE`);
    const opname = await tx.stockOpname.findUniqueOrThrow({ where: { id: opnameId } });
    if (opname.status === StockOpnameStatus.POSTED) return tx.stockOpname.findUniqueOrThrow({ where: { id: opnameId }, include: opnameInclude });
    if (opname.status !== StockOpnameStatus.APPROVED || !opname.adjustmentId) throw errors.conflict('STOCK_OPNAME_NOT_APPROVED', 'Stock opname belum disetujui penuh.');
    await postAdjustmentInTransaction(tx, opname.adjustmentId, userId, opname.id);
    return tx.stockOpname.update({ where: { id: opname.id }, data: { status: 'POSTED', postedBy: userId, postedAt: new Date() }, include: opnameInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

export async function cancelStockOpname(userId: string, opnameId: string, note: string) {
  const candidate = await prisma.stockOpname.findUnique({ where: { id: opnameId } });
  if (!candidate) throw errors.notFound('Stock opname tidak ditemukan.');
  await assertBranchAccess(userId, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.INVENTORY_OPNAME_COUNT, candidate.branchId);
  if (candidate.status === StockOpnameStatus.POSTED) throw errors.conflict('STOCK_OPNAME_IMMUTABLE', 'Stock opname yang sudah diposting tidak dapat dibatalkan.');
  return prisma.$transaction(async (tx) => {
    if (candidate.approvalInstanceId) await tx.approvalInstance.updateMany({
      where: { id: candidate.approvalInstanceId, status: 'PENDING' },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    if (candidate.adjustmentId) await tx.inventoryAdjustment.updateMany({ where: { id: candidate.adjustmentId, status: { not: 'POSTED' } }, data: { status: 'CANCELLED' } });
    return tx.stockOpname.update({ where: { id: opnameId }, data: { status: 'CANCELLED', rejectionReason: note, cancelledBy: userId, cancelledAt: new Date() }, include: opnameInclude });
  });
}

export async function listStockOpnames(userId: string, query: InventoryControlListQuery) {
  await assertPermission(userId, PERMISSIONS.INVENTORY_OPNAME_READ, query.branchId);
  const branches = await getAccessibleBranchIds(userId);
  const where: Prisma.StockOpnameWhereInput = {
    ...(query.branchId ? { branchId: query.branchId } : branches === null ? {} : { branchId: { in: branches } }),
    ...(query.status ? { status: query.status as StockOpnameStatus } : {}),
  };
  const [total, data] = await Promise.all([
    prisma.stockOpname.count({ where }),
    prisma.stockOpname.findMany({ where, include: opnameInclude, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
  ]);
  return { data, pagination: { ...query, total, totalPages: Math.ceil(total / query.limit) } };
}
