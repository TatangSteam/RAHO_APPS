import { createHash, randomUUID } from 'crypto';
import {
  ApprovalDecisionType,
  IntegrationEventStatus,
  Prisma,
  PurchaseOrderStatus,
  PurchaseRequestStatus,
  SupplierStatus,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission, getAccessibleBranchIds, hasPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { postPurchasingDerivedJournal } from '@modules/accounting/accounting.service';
import { receivePurchasedInventoryInTransaction } from '@modules/inventory/services/inventory-ledger.service';
import { logAudit } from '@utils/auditLog';
import {
  assertBilledQuantityWithinReceived,
  buildPurchasingJournal,
  exactCurrency,
  purchaseOrderStatus,
  supplierInvoiceStatus,
} from './purchasing.helpers';
import type {
  ApprovePurchaseRequestInput, CreateGoodsReceiptInput, CreatePurchaseOrderInput, CreatePurchaseRequestInput,
  CreateSupplierInput, CreateSupplierInvoiceInput, CreateSupplierPaymentInput,
  CreateSupplierPaymentRefundInput, UpdateSupplierInput,
} from './purchasing.schema';
import { decideApprovalInTransaction, startApprovalInTransaction } from '@modules/workflow/approval.service';
import { isAutonomousFinanceUser } from '@modules/iam/finance-policy';
import { enqueueContactSafely } from '@modules/zoho/zoho.contact.service';
import {
  buildIssuedPurchaseOrderSnapshot,
  enqueuePurchaseOrderCancelledTx,
  enqueuePurchaseOrderIssuedTx,
} from '@modules/zoho/zoho.purchase-order.service';
import {
  buildSupplierInvoiceSnapshot,
  enqueueSupplierInvoicePostedTx,
} from '@modules/zoho/zoho.bill.service';
import {
  buildSupplierPaymentSnapshot,
  buildSupplierPaymentRefundSnapshot,
  enqueueSupplierPaymentPostedTx,
  enqueueSupplierPaymentRefundedTx,
} from '@modules/zoho/zoho.vendor-payment.service';

type Tx = Prisma.TransactionClient;
const MAX_TRANSACTION_ATTEMPTS = 3;
const id = (prefix: string) => `${prefix}/${new Date().getUTCFullYear()}/${randomUUID().slice(0, 8).toUpperCase()}`;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const serialized = (input: Record<string, unknown>) => hash(input);

function isRetryableTransactionError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : String(error);
  return code === 'P2002' || code === 'P2034' || /40001|40P01|serialization|deadlock|write conflict/i.test(message);
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

function supplierPaymentReplayResult<T extends { supplierInvoice: { status: string; balanceAmount: Prisma.Decimal } }>(replay: T) {
  const { supplierInvoice, ...supplierPayment } = replay;
  return {
    supplierPayment,
    invoiceStatus: supplierInvoice.status,
    balanceAmount: supplierInvoice.balanceAmount.toFixed(2),
    idempotentReplay: true,
  };
}

async function readableBranches(userId: string, permission: string) {
  const accessible = await getAccessibleBranchIds(userId);
  const candidates = accessible === null
    ? (await prisma.branch.findMany({ where: { isActive: true }, select: { id: true } })).map((row) => row.id)
    : accessible;
  return (await Promise.all(candidates.map(async (branchId) =>
    (await hasPermission(userId, permission as any, branchId)) ? branchId : null
  ))).filter((value): value is string => Boolean(value));
}

export async function createSupplier(userId: string, input: CreateSupplierInput) {
  await assertPermission(userId, PERMISSIONS.SUPPLIER_MANAGE);
  const supplier = await prisma.supplier.create({ data: {
    code: input.code.toUpperCase(), name: input.name, taxId: input.taxId, contactName: input.contactName,
    phone: input.phone, email: input.email, address: input.address, paymentTermsDays: input.paymentTermsDays, createdBy: userId,
  } });
  await logAudit({ userId, action: 'CREATE', resource: 'Supplier', resourceId: supplier.id, entityCode: supplier.code, afterData: supplier });
  await enqueueContactSafely('SUPPLIER', supplier.id);
  return supplier;
}

export async function updateSupplier(userId: string, supplierId: string, input: UpdateSupplierInput) {
  await assertPermission(userId, PERMISSIONS.SUPPLIER_MANAGE);
  const before = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!before) throw errors.notFound('Supplier tidak ditemukan.');
  const supplier = await prisma.supplier.update({ where: { id: supplierId }, data: { ...input, code: input.code?.toUpperCase() } });
  await logAudit({ userId, action: 'UPDATE', resource: 'Supplier', resourceId: supplier.id, entityCode: supplier.code, beforeData: before, afterData: supplier });
  await enqueueContactSafely('SUPPLIER', supplier.id);
  return supplier;
}

export async function listSuppliers(userId: string) {
  await assertPermission(userId, PERMISSIONS.SUPPLIER_READ);
  return prisma.supplier.findMany({ orderBy: { name: 'asc' } });
}

export async function createPurchaseRequest(userId: string, input: CreatePurchaseRequestInput) {
  await assertBranchAccess(userId, input.branchId);
  await assertPermission(userId, PERMISSIONS.PURCHASE_REQUEST_CREATE, input.branchId);
  const payloadHash = serialized({ ...input, requestDate: input.requestDate.toISOString(), requiredDate: input.requiredDate?.toISOString() });
  const replay = await prisma.purchaseRequest.findUnique({ where: { postingKey: input.postingKey }, include: { items: true } });
  if (replay) {
    if (replay.payloadHash !== payloadHash) throw errors.conflict('PURCHASE_REQUEST_KEY_REUSED', 'Posting key PR digunakan untuk payload berbeda.');
    return { purchaseRequest: replay, idempotentReplay: true };
  }
  const productIds = input.items.map((line) => line.masterProductId);
  if (new Set(productIds).size !== productIds.length) throw errors.badRequest('PURCHASE_REQUEST_PRODUCT_DUPLICATE', 'Product PR tidak boleh duplikat.');
  const activeCount = await prisma.masterProduct.count({ where: { id: { in: productIds }, isActive: true } });
  if (activeCount !== productIds.length) throw errors.badRequest('PURCHASE_REQUEST_PRODUCT_INVALID', 'Salah satu product PR tidak aktif atau tidak ditemukan.');
  const purchaseRequest = await prisma.purchaseRequest.create({
    data: {
      requestNumber: id('PR'), postingKey: input.postingKey, payloadHash, branchId: input.branchId,
      requestDate: input.requestDate, requiredDate: input.requiredDate, description: input.description, createdBy: userId,
      items: { create: input.items.map((line, index) => ({ lineNo: index + 1, masterProductId: line.masterProductId, description: line.description, requestedQty: line.requestedQty, estimatedUnitCost: line.estimatedUnitCost })) },
    }, include: { items: true },
  });
  await logAudit({ userId, branchId: input.branchId, action: 'CREATE', resource: 'PurchaseRequest', resourceId: purchaseRequest.id, entityCode: purchaseRequest.requestNumber, afterData: { status: purchaseRequest.status, itemCount: purchaseRequest.items.length } });
  return { purchaseRequest, idempotentReplay: false };
}

async function loadPr(idValue: string) {
  const row = await prisma.purchaseRequest.findUnique({ where: { id: idValue }, include: { items: true } });
  if (!row) throw errors.notFound('Purchase Request tidak ditemukan.');
  return row;
}

export async function submitPurchaseRequest(userId: string, requestId: string) {
  const row = await loadPr(requestId);
  await assertBranchAccess(userId, row.branchId); await assertPermission(userId, PERMISSIONS.PURCHASE_REQUEST_CREATE, row.branchId);
  if (row.createdBy !== userId) throw errors.forbidden('Hanya maker yang dapat mengajukan PR.');
  if (row.status !== PurchaseRequestStatus.DRAFT && row.status !== PurchaseRequestStatus.REJECTED) throw errors.conflict('PURCHASE_REQUEST_STATUS_INVALID', 'PR tidak dapat diajukan dari status ini.');
  const autonomousFinance = await isAutonomousFinanceUser(userId);
  const result = await prisma.$transaction(async (tx) => {
    const submittedAt = new Date();
    if (autonomousFinance) {
      for (const item of row.items) {
        await tx.purchaseRequestItem.update({
          where: { id: item.id },
          data: { approvedQty: item.requestedQty },
        });
      }
      const approved = await tx.purchaseRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          submittedAt,
          rejectionReason: null,
          approvalNote: 'Disetujui otomatis oleh kebijakan Finance autonomous.',
          reviewedBy: userId,
          reviewedAt: submittedAt,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          branchId: row.branchId,
          action: 'STATUS_CHANGE',
          module: 'PURCHASING',
          resource: 'PurchaseRequest',
          resourceId: row.id,
          entityType: 'PurchaseRequest',
          entityId: row.id,
          entityCode: row.requestNumber,
          description: `PR ${row.requestNumber} disetujui otomatis oleh Finance.`,
          beforeData: { status: row.status },
          afterData: { status: 'APPROVED', policy: 'FINANCE_AUTONOMOUS' },
        },
      });
      return approved;
    }
    const submitted = await tx.purchaseRequest.update({ where: { id: requestId }, data: { status: 'SUBMITTED', submittedAt, rejectionReason: null } });
    const amount = row.items.reduce((sum, line) => sum.add(line.requestedQty.mul(line.estimatedUnitCost)), new Prisma.Decimal(0)).toDecimalPlaces(2);
    await startApprovalInTransaction({
      module: 'PURCHASE_REQUEST', entityType: 'PurchaseRequest', entityId: row.id, entityNumber: row.requestNumber,
      branchId: row.branchId, makerUserId: row.createdBy, amount, transactionType: 'PURCHASE_REQUEST',
      payload: { id: row.id, amount: amount.toFixed(2), items: row.items.map((line) => ({ id: line.id, quantity: line.requestedQty.toFixed(4), unitCost: line.estimatedUnitCost.toFixed(4) })), submittedAt: submittedAt.toISOString() },
    }, tx);
    return submitted;
  });
  await logAudit({ userId, branchId: row.branchId, action: 'STATUS_CHANGE', resource: 'PurchaseRequest', resourceId: row.id, entityCode: row.requestNumber, beforeData: { status: row.status }, afterData: { status: result.status } });
  return result;
}

export async function approvePurchaseRequest(userId: string, requestId: string, input: ApprovePurchaseRequestInput) {
  const row = await loadPr(requestId);
  await assertBranchAccess(userId, row.branchId); await assertPermission(userId, PERMISSIONS.PURCHASE_REQUEST_APPROVE, row.branchId);
  const autonomousFinance = await isAutonomousFinanceUser(userId);
  if (row.createdBy === userId && !autonomousFinance) throw errors.forbidden('Maker tidak boleh menyetujui PR sendiri.');
  if (row.status !== PurchaseRequestStatus.SUBMITTED) throw errors.conflict('PURCHASE_REQUEST_NOT_SUBMITTED', 'PR belum diajukan.');
  const approved = new Map(input.items.map((line) => [line.itemId, new Prisma.Decimal(line.approvedQty)]));
  if (approved.size !== row.items.length || row.items.some((line) => !approved.has(line.id))) throw errors.badRequest('PURCHASE_REQUEST_APPROVAL_LINES_INVALID', 'Semua baris PR wajib diputuskan tepat satu kali.');
  for (const line of row.items) {
    const qty = approved.get(line.id)!;
    if (qty.isNegative() || qty.greaterThan(line.requestedQty)) throw errors.unprocessable('PURCHASE_REQUEST_APPROVED_QTY_INVALID', 'Approved quantity harus 0 sampai requested quantity.');
  }
  if (![...approved.values()].some((qty) => qty.greaterThan(0))) throw errors.unprocessable('PURCHASE_REQUEST_EMPTY_APPROVAL', 'Minimal satu baris harus disetujui.');
  if (autonomousFinance) {
    return prisma.$transaction(async (tx) => {
      for (const line of row.items) {
        await tx.purchaseRequestItem.update({
          where: { id: line.id },
          data: { approvedQty: approved.get(line.id)! },
        });
      }
      const pendingApproval = await tx.approvalInstance.findFirst({
        where: { entityType: 'PurchaseRequest', entityId: requestId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
      if (pendingApproval) {
        await tx.approvalInstance.update({
          where: { id: pendingApproval.id },
          data: { status: 'CANCELLED', completedAt: new Date() },
        });
        await tx.approvalAuditLog.create({
          data: {
            approvalInstanceId: pendingApproval.id,
            action: 'CANCELLED_BY_FINANCE_AUTONOMOUS',
            actorUserId: userId,
            beforeStatus: 'PENDING',
            afterStatus: 'CANCELLED',
            metadata: { reason: 'Finance autonomous policy finalized the legacy submitted PR.' },
          },
        });
      }
      const result = await tx.purchaseRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvalNote: input.note || 'Difinalisasi oleh kebijakan Finance autonomous.',
          reviewedBy: userId,
          reviewedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          branchId: row.branchId,
          action: 'STATUS_CHANGE',
          module: 'PURCHASING',
          resource: 'PurchaseRequest',
          resourceId: row.id,
          entityType: 'PurchaseRequest',
          entityId: row.id,
          entityCode: row.requestNumber,
          description: `PR ${row.requestNumber} difinalisasi oleh Finance.`,
          beforeData: { status: row.status },
          afterData: { status: 'APPROVED', policy: 'FINANCE_AUTONOMOUS' },
        },
      });
      return result;
    });
  }
  return prisma.$transaction(async (tx) => {
    const approval = await tx.approvalInstance.findFirst({ where: { entityType: 'PurchaseRequest', entityId: requestId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    if (!approval) throw errors.conflict('PURCHASE_REQUEST_APPROVAL_MISSING', 'Approval PR belum dibuat; submit ulang dokumen.');
    const decision = await decideApprovalInTransaction({ instanceId: approval.id, actorUserId: userId, decision: ApprovalDecisionType.APPROVE, note: input.note }, tx);
    if (!decision.approved) return { ...row, approvalStatus: decision.instance.status, approvalStep: decision.instance.currentStep };
    for (const line of row.items) await tx.purchaseRequestItem.update({ where: { id: line.id }, data: { approvedQty: approved.get(line.id)! } });
    const result = await tx.purchaseRequest.update({ where: { id: requestId }, data: { status: 'APPROVED', approvalNote: input.note, reviewedBy: userId, reviewedAt: new Date() } });
    await tx.auditLog.create({ data: { userId, branchId: row.branchId, action: 'STATUS_CHANGE', module: 'PURCHASING', resource: 'PurchaseRequest', resourceId: row.id, entityType: 'PurchaseRequest', entityId: row.id, entityCode: row.requestNumber, description: `PR ${row.requestNumber} disetujui.`, afterData: { status: 'APPROVED', approvalNote: input.note || null } } });
    return result;
  });
}

export async function rejectPurchaseRequest(userId: string, requestId: string, reason: string) {
  const row = await loadPr(requestId);
  await assertBranchAccess(userId, row.branchId); await assertPermission(userId, PERMISSIONS.PURCHASE_REQUEST_APPROVE, row.branchId);
  if (row.createdBy === userId) throw errors.forbidden('Maker tidak boleh menolak PR sendiri.');
  if (row.status !== PurchaseRequestStatus.SUBMITTED) throw errors.conflict('PURCHASE_REQUEST_NOT_SUBMITTED', 'PR belum diajukan.');
  const result = await prisma.$transaction(async (tx) => {
    const approval = await tx.approvalInstance.findFirst({ where: { entityType: 'PurchaseRequest', entityId: requestId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    if (!approval) throw errors.conflict('PURCHASE_REQUEST_APPROVAL_MISSING', 'Approval PR belum dibuat; submit ulang dokumen.');
    await decideApprovalInTransaction({ instanceId: approval.id, actorUserId: userId, decision: ApprovalDecisionType.REJECT, note: reason }, tx);
    return tx.purchaseRequest.update({ where: { id: requestId }, data: { status: 'REJECTED', rejectionReason: reason, reviewedBy: userId, reviewedAt: new Date() } });
  });
  await logAudit({ userId, branchId: row.branchId, action: 'STATUS_CHANGE', resource: 'PurchaseRequest', resourceId: row.id, entityCode: row.requestNumber, afterData: { status: result.status, reason } });
  return result;
}

export async function createPurchaseOrder(userId: string, input: CreatePurchaseOrderInput) {
  const pr = await loadPr(input.purchaseRequestId);
  await assertBranchAccess(userId, pr.branchId); await assertPermission(userId, PERMISSIONS.PURCHASE_ORDER_CREATE, pr.branchId);
  const payloadHash = serialized({ ...input, orderDate: input.orderDate.toISOString(), expectedDate: input.expectedDate?.toISOString() });
  const replay = await prisma.purchaseOrder.findUnique({
    where: { postingKey: input.postingKey },
    include: { items: true, supplier: true, branch: true },
  });
  if (replay) {
    if (replay.payloadHash !== payloadHash) throw errors.conflict('PURCHASE_ORDER_KEY_REUSED', 'Posting key PO digunakan untuk payload berbeda.');
    return { purchaseOrder: replay, idempotentReplay: true };
  }
  if (pr.status !== PurchaseRequestStatus.APPROVED) throw errors.conflict('PURCHASE_REQUEST_NOT_APPROVED', 'PR belum disetujui atau sudah dikonversi.');
  const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier || supplier.status !== SupplierStatus.ACTIVE) throw errors.badRequest('SUPPLIER_NOT_ACTIVE', 'Supplier tidak aktif atau tidak ditemukan.');
  const [products, uoms] = await Promise.all([
    prisma.masterProduct.findMany({
      where: { id: { in: pr.items.map((line) => line.masterProductId) } },
    }),
    prisma.unitOfMeasure.findMany({ where: { isActive: true } }),
  ]);
  const byId = new Map(products.map((product) => [product.id, product]));
  const approved = pr.items.filter((line) => line.approvedQty?.greaterThan(0));
  const lines = approved.map((line, index) => {
    const product = byId.get(line.masterProductId)!;
    const lineTotal = exactCurrency(line.approvedQty!.mul(line.estimatedUnitCost), `Nilai baris ${index + 1}`);
    const fallbackUoms = uoms.filter((uom) =>
      uom.code.toLowerCase() === product.baseUnit.toLowerCase()
      || uom.name.toLowerCase() === product.baseUnit.toLowerCase());
    return {
      lineNo: index + 1,
      masterProductId: line.masterProductId,
      uomId: product.baseUomId || (fallbackUoms.length === 1 ? fallbackUoms[0].id : null),
      skuSnapshot: product.sku,
      nameSnapshot: product.name,
      uomSnapshot: product.baseUnit,
      orderedQty: line.approvedQty!,
      unitPrice: line.estimatedUnitCost,
      lineTotal,
      notes: line.description,
    };
  });
  const totalAmount = lines.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
  return withTransactionRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "purchase_requests" WHERE "id" = ${pr.id} FOR UPDATE
    `);
    const concurrentReplay = await tx.purchaseOrder.findUnique({
      where: { postingKey: input.postingKey },
      include: { items: true, supplier: true, branch: true },
    });
    if (concurrentReplay) {
      if (concurrentReplay.payloadHash !== payloadHash) {
        throw errors.conflict(
          'PURCHASE_ORDER_KEY_REUSED',
          'Posting key PO digunakan untuk payload berbeda.',
        );
      }
      return { purchaseOrder: concurrentReplay, idempotentReplay: true };
    }
    const lockedRequest = await tx.purchaseRequest.findUnique({
      where: { id: pr.id },
      select: { status: true },
    });
    if (lockedRequest?.status !== PurchaseRequestStatus.APPROVED) {
      throw errors.conflict(
        'PURCHASE_REQUEST_NOT_APPROVED',
        'PR belum disetujui atau sudah dikonversi.',
      );
    }
    const issuedAt = new Date();
    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        poNumber: id('PO'),
        postingKey: input.postingKey,
        payloadHash,
        purchaseRequestId: pr.id,
        supplierId: supplier.id,
        branchId: pr.branchId,
        orderDate: input.orderDate,
        expectedDate: input.expectedDate,
        totalAmount,
        notes: input.notes,
        createdBy: userId,
        issuedAt,
        items: { create: lines },
      },
      include: { items: true, supplier: true, branch: true },
    });
    await tx.purchaseRequest.update({
      where: { id: pr.id },
      data: { status: 'CONVERTED', convertedAt: issuedAt },
    });
    await enqueuePurchaseOrderIssuedTx(
      tx,
      buildIssuedPurchaseOrderSnapshot(purchaseOrder),
      issuedAt,
    );
    await tx.auditLog.create({
      data: {
        userId,
        branchId: pr.branchId,
        action: 'CREATE',
        module: 'PURCHASING',
        resource: 'PurchaseOrder',
        resourceId: purchaseOrder.id,
        entityType: 'PurchaseOrder',
        entityId: purchaseOrder.id,
        entityCode: purchaseOrder.poNumber,
        description: `PO ${purchaseOrder.poNumber} diterbitkan.`,
        afterData: {
          totalAmount: totalAmount.toFixed(2),
          supplierId: supplier.id,
          zohoEventType: 'PO_ISSUED',
        },
      },
    });
    return { purchaseOrder, idempotentReplay: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function cancelPurchaseOrder(
  userId: string,
  purchaseOrderId: string,
  reason: string,
) {
  const scope = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: { branchId: true },
  });
  if (!scope) throw errors.notFound('Purchase Order tidak ditemukan.');
  await assertBranchAccess(userId, scope.branchId);
  await assertPermission(userId, PERMISSIONS.PURCHASE_ORDER_CREATE, scope.branchId);
  return withTransactionRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "purchase_orders" WHERE "id" = ${purchaseOrderId} FOR UPDATE
    `);
    const purchaseOrder = await tx.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        items: { select: { receivedQty: true } },
        invoices: { select: { id: true } },
      },
    });
    if (!purchaseOrder) throw errors.notFound('Purchase Order tidak ditemukan.');
    if (purchaseOrder.status === PurchaseOrderStatus.CANCELLED) {
      return { purchaseOrder, idempotentReplay: true };
    }
    if (
      purchaseOrder.status !== PurchaseOrderStatus.ISSUED
      || purchaseOrder.items.some((line) => line.receivedQty.greaterThan(0))
      || purchaseOrder.invoices.length > 0
    ) {
      throw errors.conflict(
        'PURCHASE_ORDER_CANNOT_CANCEL',
        'Hanya PO issued yang belum diterima dan belum ditagihkan yang dapat dibatalkan.',
      );
    }
    const cancelledAt = new Date();
    const updated = await tx.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: { status: PurchaseOrderStatus.CANCELLED },
    });
    await tx.integrationEvent.updateMany({
      where: {
        eventType: 'PO_ISSUED',
        aggregateId: purchaseOrder.id,
        status: {
          in: [
            IntegrationEventStatus.PENDING,
            IntegrationEventStatus.FAILED,
            IntegrationEventStatus.DEAD_LETTER,
            IntegrationEventStatus.DRY_RUN,
          ],
        },
      },
      data: {
        status: IntegrationEventStatus.IGNORED,
        ignoredAt: cancelledAt,
        ignoredById: userId,
        ignoreReason: `PO dibatalkan sebelum sinkronisasi: ${reason}`.slice(0, 500),
        lockedBy: null,
        leaseUntil: null,
      },
    });
    await enqueuePurchaseOrderCancelledTx(tx, {
      purchaseOrderId: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      branchId: purchaseOrder.branchId,
      reason,
      cancelledAt,
    });
    await tx.auditLog.create({
      data: {
        userId,
        branchId: purchaseOrder.branchId,
        action: 'STATUS_CHANGE',
        module: 'PURCHASING',
        resource: 'PurchaseOrder',
        resourceId: purchaseOrder.id,
        entityType: 'PurchaseOrder',
        entityId: purchaseOrder.id,
        entityCode: purchaseOrder.poNumber,
        description: `PO ${purchaseOrder.poNumber} dibatalkan.`,
        beforeData: { status: purchaseOrder.status },
        afterData: {
          status: PurchaseOrderStatus.CANCELLED,
          reason,
          zohoEventType: 'PO_CANCELLED',
        },
      },
    });
    return { purchaseOrder: updated, idempotentReplay: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function postGoodsReceipt(userId: string, purchaseOrderId: string, input: CreateGoodsReceiptInput) {
  const scope = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, select: { branchId: true } });
  if (!scope) throw errors.notFound('Purchase Order tidak ditemukan.');
  await assertBranchAccess(userId, scope.branchId); await assertPermission(userId, PERMISSIONS.GOODS_RECEIPT_POST, scope.branchId);
  const payloadHash = serialized({ purchaseOrderId, ...input, receiptDate: input.receiptDate.toISOString() });
  const replay = await prisma.goodsReceipt.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { lines: true, journalEntry: true } });
  if (replay) {
    if (replay.payloadHash !== payloadHash) throw errors.conflict('GOODS_RECEIPT_KEY_REUSED', 'Idempotency key receipt digunakan untuk payload berbeda.');
    return { goodsReceipt: replay, idempotentReplay: true };
  }
  return withTransactionRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "purchase_orders" WHERE "id" = ${purchaseOrderId} FOR UPDATE`);
    const concurrentReplay = await tx.goodsReceipt.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { lines: true, journalEntry: true } });
    if (concurrentReplay) {
      if (concurrentReplay.payloadHash !== payloadHash) throw errors.conflict('GOODS_RECEIPT_KEY_REUSED', 'Idempotency key receipt digunakan untuk payload berbeda.');
      return { goodsReceipt: concurrentReplay, idempotentReplay: true };
    }
    const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { items: true } });
    if (!po || ['CLOSED', 'CANCELLED'].includes(po.status)) throw errors.conflict('PURCHASE_ORDER_NOT_RECEIVABLE', 'PO tidak dapat diterima.');
    const lineIds = input.lines.map((line) => line.purchaseOrderItemId);
    if (new Set(lineIds).size !== lineIds.length) throw errors.badRequest('GOODS_RECEIPT_LINE_DUPLICATE', 'Baris PO tidak boleh duplikat.');
    const poItems = new Map(po.items.map((line) => [line.id, line]));
    const inventoryRows = await tx.inventoryItem.findMany({ where: { id: { in: input.lines.map((line) => line.inventoryItemId) } }, select: { id: true, branchId: true, masterProductId: true } });
    const inventoryById = new Map(inventoryRows.map((row) => [row.id, row]));
    const values = input.lines.map((line, index) => {
      const poLine = poItems.get(line.purchaseOrderItemId);
      if (!poLine) throw errors.badRequest('GOODS_RECEIPT_PO_LINE_INVALID', 'Baris receipt bukan milik PO.');
      const inventoryItem = inventoryById.get(line.inventoryItemId);
      if (!inventoryItem || inventoryItem.branchId !== po.branchId || inventoryItem.masterProductId !== poLine.masterProductId) {
        throw errors.badRequest('GOODS_RECEIPT_INVENTORY_ITEM_INVALID', 'Inventory item harus sesuai product dan branch pada baris PO.');
      }
      const qty = new Prisma.Decimal(line.quantity);
      if (!qty.greaterThan(0) || poLine.receivedQty.add(qty).greaterThan(poLine.orderedQty)) throw errors.unprocessable('GOODS_RECEIPT_QTY_EXCEEDED', 'Receipt melebihi sisa quantity PO.');
      return { input: line, poLine, qty, lineValue: exactCurrency(qty.mul(poLine.unitPrice), `Nilai receipt ${index + 1}`) };
    });
    const totalValue = values.reduce((sum, line) => sum.add(line.lineValue), new Prisma.Decimal(0));
    const totalQuantity = values.reduce((sum, line) => sum.add(line.qty), new Prisma.Decimal(0));
    const receiptId = randomUUID(); const receiptNumber = id('GR');
    const posted = await postPurchasingDerivedJournal({ postingKey: `GOODS_RECEIPT:${receiptId}`, transactionDate: input.receiptDate, branchId: po.branchId, actorUserId: userId, description: `Goods Receipt ${receiptNumber}`, lines: buildPurchasingJournal('GOODS_RECEIPT', totalValue), sourceLinks: [{ sourceType: 'GOODS_RECEIPT', sourceId: receiptId, sourceNumber: receiptNumber }], metadata: { purchaseOrderId: po.id } }, tx);
    await tx.goodsReceipt.create({ data: { id: receiptId, receiptNumber, idempotencyKey: input.idempotencyKey, payloadHash, purchaseOrderId: po.id, branchId: po.branchId, receiptDate: input.receiptDate, totalQuantity, totalValue, journalEntryId: posted.journal.id, evidenceReference: input.evidenceReference, createdBy: userId } });
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      const inventory = await receivePurchasedInventoryInTransaction(userId, { idempotencyKey: `GOODS_RECEIPT:${receiptId}:${index + 1}`, inventoryItemId: value.input.inventoryItemId, branchId: po.branchId, stockLocationId: value.input.stockLocationId, quantity: value.qty.toFixed(4), unitCost: value.poLine.unitPrice.toFixed(4), currency: 'IDR', sourceType: 'GOODS_RECEIPT', sourceId: receiptId, sourceNumber: receiptNumber, reasonCode: 'PURCHASE_RECEIPT', occurredAt: input.receiptDate, batch: value.input.batchNumber ? { batchNumber: value.input.batchNumber, manufactureDate: value.input.manufactureDate, expiryDate: value.input.expiryDate } : undefined }, tx);
      await tx.goodsReceiptLine.create({ data: { goodsReceiptId: receiptId, purchaseOrderItemId: value.poLine.id, lineNo: index + 1, inventoryItemId: value.input.inventoryItemId, stockLocationId: value.input.stockLocationId, quantity: value.qty, unitCost: value.poLine.unitPrice, lineValue: value.lineValue, batchNumber: value.input.batchNumber, manufactureDate: value.input.manufactureDate, expiryDate: value.input.expiryDate, inventoryPostingId: inventory.id } });
      await tx.purchaseOrderItem.update({ where: { id: value.poLine.id }, data: { receivedQty: { increment: value.qty } } });
    }
    const aggregate = await tx.purchaseOrderItem.aggregate({ where: { purchaseOrderId: po.id }, _sum: { orderedQty: true, receivedQty: true } });
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: purchaseOrderStatus(aggregate._sum.orderedQty!, aggregate._sum.receivedQty!) } });
    await tx.auditLog.create({ data: { userId, branchId: po.branchId, action: 'CREATE', module: 'PURCHASING', resource: 'GoodsReceipt', resourceId: receiptId, entityType: 'GoodsReceipt', entityId: receiptId, entityCode: receiptNumber, description: `Goods Receipt ${receiptNumber} diposting.`, afterData: { purchaseOrderId: po.id, totalValue: totalValue.toFixed(2), journalEntryId: posted.journal.id } } });
    return { goodsReceipt: await tx.goodsReceipt.findUniqueOrThrow({ where: { id: receiptId }, include: { lines: true, journalEntry: true } }), idempotentReplay: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function postSupplierInvoice(userId: string, input: CreateSupplierInvoiceInput) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: input.purchaseOrderId },
    include: { supplier: true },
  });
  if (!po) throw errors.notFound('Purchase Order tidak ditemukan.');
  await assertBranchAccess(userId, po.branchId); await assertPermission(userId, PERMISSIONS.AP_INVOICE_POST, po.branchId);
  const payloadHash = serialized({
    ...input,
    invoiceDate: input.invoiceDate.toISOString(),
    dueDate: input.dueDate.toISOString(),
    lines: input.lines
      ? [...input.lines].sort((left, right) =>
        left.purchaseOrderItemId.localeCompare(right.purchaseOrderItemId))
      : undefined,
  });
  const replay = await prisma.supplierInvoice.findUnique({
    where: { postingKey: input.postingKey },
    include: { journalEntry: true, lines: true },
  });
  if (replay) { if (replay.payloadHash !== payloadHash) throw errors.conflict('SUPPLIER_INVOICE_KEY_REUSED', 'Posting key invoice supplier digunakan untuk payload berbeda.'); return { supplierInvoice: replay, idempotentReplay: true }; }
  return withTransactionRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "purchase_orders" WHERE "id" = ${po.id} FOR UPDATE`);
    const concurrentReplay = await tx.supplierInvoice.findUnique({
      where: { postingKey: input.postingKey },
      include: { journalEntry: true, lines: true },
    });
    if (concurrentReplay) {
      if (concurrentReplay.payloadHash !== payloadHash) throw errors.conflict('SUPPLIER_INVOICE_KEY_REUSED', 'Posting key invoice supplier digunakan untuk payload berbeda.');
      return { supplierInvoice: concurrentReplay, idempotentReplay: true };
    }
    const lockedPurchaseOrder = await tx.purchaseOrder.findUnique({
      where: { id: po.id },
      include: {
        supplier: true,
        branch: true,
        items: { orderBy: { lineNo: 'asc' } },
      },
    });
    if (!lockedPurchaseOrder) throw errors.notFound('Purchase Order tidak ditemukan.');
    const [receipt, invoiced, accounts, billedByItem] = await Promise.all([
      tx.goodsReceipt.aggregate({ where: { purchaseOrderId: po.id }, _sum: { totalValue: true } }),
      tx.supplierInvoice.aggregate({ where: { purchaseOrderId: po.id }, _sum: { amount: true } }),
      tx.account.findMany({ where: { code: { in: ['2110', '2100'] }, isActive: true, allowPosting: true } }),
      tx.supplierInvoiceLine.groupBy({
        by: ['purchaseOrderItemId'],
        where: { supplierInvoice: { purchaseOrderId: po.id } },
        _sum: { billedQty: true },
      }),
    ]);
    const amount = new Prisma.Decimal(input.amount); const available = (receipt._sum.totalValue || new Prisma.Decimal(0)).sub(invoiced._sum.amount || 0);
    if (!amount.greaterThan(0) || amount.greaterThan(available)) throw errors.unprocessable('SUPPLIER_INVOICE_EXCEEDS_RECEIPT', 'Invoice supplier melebihi nilai Goods Receipt yang belum ditagihkan.');
    const orderItemById = new Map(lockedPurchaseOrder.items.map((line) => [line.id, line]));
    const billedQtyByItem = new Map(billedByItem.map((line) => [
      line.purchaseOrderItemId,
      line._sum.billedQty || new Prisma.Decimal(0),
    ]));
    const requestedIds = input.lines?.map((line) => line.purchaseOrderItemId) || [];
    if (new Set(requestedIds).size !== requestedIds.length) {
      throw errors.badRequest(
        'SUPPLIER_INVOICE_LINE_DUPLICATE',
        'Satu baris PO tidak boleh ditagihkan dua kali dalam invoice yang sama.',
      );
    }
    const invoiceLines = (input.lines || []).map((line, index) => {
      const orderItem = orderItemById.get(line.purchaseOrderItemId);
      if (!orderItem) {
        throw errors.badRequest(
          'SUPPLIER_INVOICE_PO_LINE_INVALID',
          'Satu atau lebih baris invoice bukan milik Purchase Order.',
        );
      }
      const previouslyBilled = billedQtyByItem.get(orderItem.id) || new Prisma.Decimal(0);
      const { requested: billedQty } = assertBilledQuantityWithinReceived(
        orderItem.receivedQty,
        previouslyBilled,
        line.billedQty,
        orderItem.nameSnapshot,
      );
      const lineTotal = exactCurrency(
        billedQty.mul(orderItem.unitPrice),
        `Nilai supplier invoice baris ${index + 1}`,
      );
      return {
        lineNo: index + 1,
        purchaseOrderItemId: orderItem.id,
        descriptionSnapshot: orderItem.nameSnapshot,
        billedQty,
        unitPrice: orderItem.unitPrice,
        lineTotal,
      };
    });
    if (invoiceLines.length) {
      const allocatedAmount = invoiceLines.reduce(
        (sum, line) => sum.add(line.lineTotal),
        new Prisma.Decimal(0),
      );
      if (!allocatedAmount.equals(amount)) {
        throw errors.unprocessable(
          'SUPPLIER_INVOICE_LINE_TOTAL_MISMATCH',
          `Total alokasi baris ${allocatedAmount.toFixed(2)} tidak sama dengan amount invoice ${amount.toFixed(2)}.`,
        );
      }
    }
    const accountByCode = new Map(accounts.map((account) => [account.code, account]));
    if (!accountByCode.has('2110') || !accountByCode.has('2100')) throw errors.unprocessable('AP_ACCOUNT_MAPPING_MISSING', 'Account GRNI 2110 atau AP 2100 belum dikonfigurasi.');
    const invoiceId = randomUUID(); const invoiceNumber = id('SI');
    const posted = await postPurchasingDerivedJournal({ postingKey: `SUPPLIER_INVOICE:${invoiceId}`, transactionDate: input.invoiceDate, branchId: po.branchId, actorUserId: userId, description: `Supplier Invoice ${input.supplierInvoiceNumber}`, lines: buildPurchasingJournal('SUPPLIER_INVOICE', amount), sourceLinks: [{ sourceType: 'SUPPLIER_INVOICE', sourceId: invoiceId, sourceNumber: invoiceNumber }], metadata: { purchaseOrderId: po.id, supplierId: po.supplierId } }, tx);
    const supplierInvoice = await tx.supplierInvoice.create({
      data: {
        id: invoiceId,
        invoiceNumber,
        supplierInvoiceNumber: input.supplierInvoiceNumber,
        postingKey: input.postingKey,
        payloadHash,
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        branchId: po.branchId,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate,
        amount,
        balanceAmount: amount,
        grniAccountId: accountByCode.get('2110')!.id,
        apAccountId: accountByCode.get('2100')!.id,
        journalEntryId: posted.journal.id,
        evidenceReference: input.evidenceReference,
        createdBy: userId,
        lines: invoiceLines.length ? { create: invoiceLines } : undefined,
      },
      include: {
        journalEntry: true,
        supplier: true,
        branch: true,
        purchaseOrder: true,
        lines: { include: { purchaseOrderItem: true } },
      },
    });
    await enqueueSupplierInvoicePostedTx(
      tx,
      buildSupplierInvoiceSnapshot(supplierInvoice),
      supplierInvoice.postedAt,
    );
    await tx.auditLog.create({ data: { userId, branchId: po.branchId, action: 'CREATE', module: 'ACCOUNTS_PAYABLE', resource: 'SupplierInvoice', resourceId: supplierInvoice.id, entityType: 'SupplierInvoice', entityId: supplierInvoice.id, entityCode: supplierInvoice.invoiceNumber, description: `Supplier invoice ${supplierInvoice.invoiceNumber} diposting.`, afterData: { amount: amount.toFixed(2), journalEntryId: posted.journal.id } } });
    return { supplierInvoice, idempotentReplay: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function paySupplierInvoice(userId: string, supplierInvoiceId: string, input: CreateSupplierPaymentInput) {
  const scope = await prisma.supplierInvoice.findUnique({ where: { id: supplierInvoiceId }, select: { branchId: true } });
  if (!scope) throw errors.notFound('Supplier invoice tidak ditemukan.');
  await assertBranchAccess(userId, scope.branchId); await assertPermission(userId, PERMISSIONS.AP_PAY, scope.branchId);
  const payloadHash = serialized({ supplierInvoiceId, ...input, paymentDate: input.paymentDate.toISOString() });
  const replay = await prisma.supplierPayment.findUnique({ where: { postingKey: input.postingKey }, include: { journalEntry: true, cashBankTransaction: true, supplierInvoice: { select: { status: true, balanceAmount: true } } } });
  if (replay) { if (replay.payloadHash !== payloadHash) throw errors.conflict('SUPPLIER_PAYMENT_KEY_REUSED', 'Posting key payment supplier digunakan untuk payload berbeda.'); return supplierPaymentReplayResult(replay); }
  return withTransactionRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "supplier_invoices" WHERE "id" = ${supplierInvoiceId} FOR UPDATE`);
    const concurrentReplay = await tx.supplierPayment.findUnique({ where: { postingKey: input.postingKey }, include: { journalEntry: true, cashBankTransaction: true, supplierInvoice: { select: { status: true, balanceAmount: true } } } });
    if (concurrentReplay) {
      if (concurrentReplay.payloadHash !== payloadHash) throw errors.conflict('SUPPLIER_PAYMENT_KEY_REUSED', 'Posting key payment supplier digunakan untuk payload berbeda.');
      return supplierPaymentReplayResult(concurrentReplay);
    }
    const invoice = await tx.supplierInvoice.findUnique({
      where: { id: supplierInvoiceId },
      include: { apAccount: true, supplier: true, branch: true },
    });
    const cash = await tx.cashBankAccount.findUnique({ where: { id: input.cashBankAccountId }, include: { coaAccount: true } });
    if (!invoice) throw errors.notFound('Supplier invoice tidak ditemukan.');
    if (!cash?.isActive || cash.branchId !== invoice.branchId || !cash.coaAccount.allowPosting) throw errors.badRequest('SUPPLIER_PAYMENT_CASH_INVALID', 'Akun kas/bank tidak aktif atau tidak sesuai branch.');
    const amount = new Prisma.Decimal(input.amount);
    if (!amount.greaterThan(0) || amount.greaterThan(invoice.balanceAmount)) throw errors.unprocessable('SUPPLIER_PAYMENT_EXCEEDS_BALANCE', 'Pembayaran melebihi saldo AP invoice.');
    const paymentId = randomUUID(); const paymentNumber = id('SP');
    const posted = await postPurchasingDerivedJournal({ postingKey: `SUPPLIER_PAYMENT:${paymentId}`, transactionDate: input.paymentDate, branchId: invoice.branchId, actorUserId: userId, description: `Pembayaran ${invoice.invoiceNumber}`, lines: buildPurchasingJournal('SUPPLIER_PAYMENT', amount, cash.coaAccount.code), sourceLinks: [{ sourceType: 'SUPPLIER_PAYMENT', sourceId: paymentId, sourceNumber: paymentNumber }], metadata: { supplierInvoiceId: invoice.id, cashBankAccountId: cash.id } }, tx);
    const cashTransaction = await tx.cashBankTransaction.create({ data: { transactionNumber: `CBP/${paymentId}`, postingKey: `SUPPLIER_PAYMENT:${paymentId}`, cashBankAccountId: cash.id, branchId: invoice.branchId, transactionDate: input.paymentDate, type: 'PAYMENT', amount, sourceType: 'SUPPLIER_PAYMENT', sourceId: paymentId, sourceNumber: paymentNumber, journalEntryId: posted.journal.id, description: `Pembayaran supplier ${invoice.invoiceNumber}`, createdBy: userId } });
    const balanceAmount = invoice.balanceAmount.sub(amount); const paidAmount = invoice.paidAmount.add(amount);
    const supplierPayment = await tx.supplierPayment.create({
      data: { id: paymentId, paymentNumber, postingKey: input.postingKey, payloadHash, supplierInvoiceId: invoice.id, cashBankAccountId: cash.id, branchId: invoice.branchId, paymentDate: input.paymentDate, amount, paymentReference: input.paymentReference, journalEntryId: posted.journal.id, cashBankTransactionId: cashTransaction.id, createdBy: userId },
      include: {
        journalEntry: true,
        cashBankTransaction: true,
        cashBankAccount: true,
        supplierInvoice: { include: { supplier: true, branch: true } },
      },
    });
    await tx.supplierInvoice.update({ where: { id: invoice.id }, data: { paidAmount, balanceAmount, status: supplierInvoiceStatus(balanceAmount, paidAmount) } });
    await enqueueSupplierPaymentPostedTx(
      tx,
      buildSupplierPaymentSnapshot(supplierPayment, invoice.balanceAmount, balanceAmount),
      supplierPayment.postedAt,
    );
    await tx.auditLog.create({ data: { userId, branchId: invoice.branchId, action: 'CREATE', module: 'ACCOUNTS_PAYABLE', resource: 'SupplierPayment', resourceId: paymentId, entityType: 'SupplierPayment', entityId: paymentId, entityCode: paymentNumber, description: `Pembayaran supplier ${paymentNumber} diposting.`, afterData: { amount: amount.toFixed(2), balanceAmount: balanceAmount.toFixed(2), journalEntryId: posted.journal.id, cashBankTransactionId: cashTransaction.id } } });
    return { supplierPayment, invoiceStatus: supplierInvoiceStatus(balanceAmount, paidAmount), balanceAmount: balanceAmount.toFixed(2), idempotentReplay: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function refundSupplierPayment(
  userId: string,
  supplierPaymentId: string,
  input: CreateSupplierPaymentRefundInput,
) {
  const scope = await prisma.supplierPayment.findUnique({
    where: { id: supplierPaymentId },
    select: { branchId: true },
  });
  if (!scope) throw errors.notFound('Pembayaran supplier tidak ditemukan.');
  await assertBranchAccess(userId, scope.branchId);
  await assertPermission(userId, PERMISSIONS.AP_PAY, scope.branchId);
  const payloadHash = serialized({
    supplierPaymentId,
    ...input,
    refundDate: input.refundDate.toISOString(),
  });
  const replay = await prisma.supplierPaymentRefund.findUnique({
    where: { postingKey: input.postingKey },
  });
  if (replay) {
    if (replay.payloadHash !== payloadHash) {
      throw errors.conflict(
        'SUPPLIER_PAYMENT_REFUND_KEY_REUSED',
        'Posting key refund supplier digunakan untuk payload berbeda.',
      );
    }
    return { supplierPaymentRefund: replay, idempotentReplay: true };
  }
  return withTransactionRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "supplier_payments"
      WHERE "id" = ${supplierPaymentId}
      FOR UPDATE
    `);
    const concurrentReplay = await tx.supplierPaymentRefund.findUnique({
      where: { postingKey: input.postingKey },
    });
    if (concurrentReplay) {
      if (concurrentReplay.payloadHash !== payloadHash) {
        throw errors.conflict(
          'SUPPLIER_PAYMENT_REFUND_KEY_REUSED',
          'Posting key refund supplier digunakan untuk payload berbeda.',
        );
      }
      return { supplierPaymentRefund: concurrentReplay, idempotentReplay: true };
    }
    const payment = await tx.supplierPayment.findUnique({
      where: { id: supplierPaymentId },
      include: {
        cashBankAccount: true,
        refunds: true,
        supplierInvoice: { include: { supplier: true, branch: true } },
      },
    });
    if (!payment) throw errors.notFound('Pembayaran supplier tidak ditemukan.');
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "supplier_invoices"
      WHERE "id" = ${payment.supplierInvoiceId}
      FOR UPDATE
    `);
    const account = await tx.cashBankAccount.findUnique({
      where: { id: input.cashBankAccountId },
      include: { coaAccount: true },
    });
    if (
      !account?.isActive
      || account.branchId !== payment.branchId
      || !account.coaAccount.allowPosting
    ) {
      throw errors.unprocessable(
        'SUPPLIER_PAYMENT_REFUND_CASH_INVALID',
        'Rekening refund tidak aktif, beda cabang, atau tidak dapat diposting.',
      );
    }
    const amount = exactCurrency(new Prisma.Decimal(input.amount), 'Nominal refund');
    const refundedBefore = payment.refunds.reduce(
      (sum, refund) => sum.add(refund.amount),
      new Prisma.Decimal(0),
    );
    const refundable = payment.amount.sub(refundedBefore);
    if (!amount.greaterThan(0) || amount.greaterThan(refundable)) {
      throw errors.unprocessable(
        'SUPPLIER_PAYMENT_REFUND_EXCEEDS_PAYMENT',
        `Refund melebihi sisa pembayaran supplier yang dapat direfund (${refundable.toFixed(2)}).`,
      );
    }
    const refundId = randomUUID();
    const refundNumber = id('SPR');
    const posted = await postPurchasingDerivedJournal({
      postingKey: `SUPPLIER_PAYMENT_REFUND:${refundId}`,
      transactionDate: input.refundDate,
      branchId: payment.branchId,
      actorUserId: userId,
      description: `Refund pembayaran ${payment.paymentNumber}`,
      lines: [
        { accountCode: account.coaAccount.code, debit: amount },
        { accountCode: '2100', credit: amount },
      ],
      sourceLinks: [{
        sourceType: 'SUPPLIER_PAYMENT_REFUND',
        sourceId: refundId,
        sourceNumber: refundNumber,
      }],
      metadata: {
        originalSupplierPaymentId: payment.id,
        supplierInvoiceId: payment.supplierInvoiceId,
        reason: input.reason,
      },
    }, tx);
    const cashTransaction = await tx.cashBankTransaction.create({
      data: {
        transactionNumber: `CBR/${refundId}`,
        postingKey: `SUPPLIER_PAYMENT_REFUND:${refundId}`,
        cashBankAccountId: account.id,
        branchId: payment.branchId,
        transactionDate: input.refundDate,
        type: 'RECEIPT',
        amount,
        sourceType: 'SUPPLIER_PAYMENT_REFUND',
        sourceId: refundId,
        sourceNumber: refundNumber,
        journalEntryId: posted.journal.id,
        description: `Refund supplier ${payment.paymentNumber}: ${input.reason}`,
        metadata: {
          originalSupplierPaymentId: payment.id,
          referenceNumber: input.referenceNumber || null,
        },
        createdBy: userId,
      },
    });
    const refund = await tx.supplierPaymentRefund.create({
      data: {
        id: refundId,
        refundNumber,
        postingKey: input.postingKey,
        payloadHash,
        supplierPaymentId: payment.id,
        supplierInvoiceId: payment.supplierInvoiceId,
        cashBankAccountId: account.id,
        branchId: payment.branchId,
        refundDate: input.refundDate,
        amount,
        reason: input.reason,
        referenceNumber: input.referenceNumber,
        journalEntryId: posted.journal.id,
        cashBankTransactionId: cashTransaction.id,
        createdBy: userId,
      },
    });
    const invoice = await tx.supplierInvoice.findUnique({
      where: { id: payment.supplierInvoiceId },
    });
    if (!invoice) throw errors.notFound('Supplier invoice tidak ditemukan.');
    const paidAmount = invoice.paidAmount.sub(amount);
    const balanceAmount = invoice.balanceAmount.add(amount);
    await tx.supplierInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount,
        balanceAmount,
        status: supplierInvoiceStatus(balanceAmount, paidAmount),
      },
    });
    await enqueueSupplierPaymentRefundedTx(
      tx,
      buildSupplierPaymentRefundSnapshot({
        refund,
        payment,
        remainingAppliedAmountAfterRefund: refundable.sub(amount),
      }),
      refund.postedAt,
    );
    await tx.auditLog.create({
      data: {
        userId,
        branchId: payment.branchId,
        action: 'CREATE',
        module: 'ACCOUNTS_PAYABLE',
        resource: 'SupplierPaymentRefund',
        resourceId: refund.id,
        entityType: 'SupplierPayment',
        entityId: payment.id,
        entityCode: refundNumber,
        description: `Refund pembayaran supplier ${refundNumber} diposting.`,
        afterData: {
          amount: amount.toFixed(2),
          originalSupplierPaymentId: payment.id,
          journalEntryId: posted.journal.id,
          cashBankTransactionId: cashTransaction.id,
        },
      },
    });
    return {
      supplierPaymentRefund: refund,
      invoiceStatus: supplierInvoiceStatus(balanceAmount, paidAmount),
      balanceAmount: balanceAmount.toFixed(2),
      idempotentReplay: false,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function listPurchaseRequests(userId: string, branchId?: string) {
  const branches = await readableBranches(userId, PERMISSIONS.PURCHASE_REQUEST_READ);
  if (branchId && !branches.includes(branchId)) throw errors.forbidden('Tidak memiliki akses PR cabang ini.');
  return prisma.purchaseRequest.findMany({ where: { branchId: branchId || { in: branches } }, include: { items: { include: { masterProduct: true } }, creator: { select: { email: true } }, reviewer: { select: { email: true } }, order: { select: { id: true, poNumber: true } } }, orderBy: { createdAt: 'desc' } });
}

export async function listPurchaseOrders(userId: string, branchId?: string) {
  const branches = await readableBranches(userId, PERMISSIONS.PURCHASE_ORDER_READ);
  if (branchId && !branches.includes(branchId)) throw errors.forbidden('Tidak memiliki akses PO cabang ini.');
  return prisma.purchaseOrder.findMany({
    where: { branchId: branchId || { in: branches } },
    include: {
      supplier: true,
      items: true,
      goodsReceipts: true,
      invoices: { include: { lines: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listAccountsPayable(userId: string, branchId?: string) {
  const branches = await readableBranches(userId, PERMISSIONS.AP_READ);
  if (branchId && !branches.includes(branchId)) throw errors.forbidden('Tidak memiliki akses AP cabang ini.');
  return prisma.supplierInvoice.findMany({ where: { branchId: branchId || { in: branches } }, include: { supplier: true, purchaseOrder: { select: { poNumber: true } }, journalEntry: { select: { journalNumber: true } }, lines: true, payments: { include: { refunds: { orderBy: { refundDate: 'asc' } } }, orderBy: { paymentDate: 'asc' } } }, orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }] });
}
