import { createHash, randomUUID } from 'crypto';
import { ApprovalDecisionType, Prisma, PurchaseRequestStatus, SupplierStatus } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission, getAccessibleBranchIds, hasPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { postPurchasingDerivedJournal } from '@modules/accounting/accounting.service';
import { receivePurchasedInventoryInTransaction } from '@modules/inventory/services/inventory-ledger.service';
import { logAudit } from '@utils/auditLog';
import { buildPurchasingJournal, exactCurrency, purchaseOrderStatus, supplierInvoiceStatus } from './purchasing.helpers';
import type {
  ApprovePurchaseRequestInput, CreateGoodsReceiptInput, CreatePurchaseOrderInput, CreatePurchaseRequestInput,
  CreateSupplierInput, CreateSupplierInvoiceInput, CreateSupplierPaymentInput, UpdateSupplierInput,
} from './purchasing.schema';
import { decideApprovalInTransaction, startApprovalInTransaction } from '@modules/workflow/approval.service';

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
  return supplier;
}

export async function updateSupplier(userId: string, supplierId: string, input: UpdateSupplierInput) {
  await assertPermission(userId, PERMISSIONS.SUPPLIER_MANAGE);
  const before = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!before) throw errors.notFound('Supplier tidak ditemukan.');
  const supplier = await prisma.supplier.update({ where: { id: supplierId }, data: { ...input, code: input.code?.toUpperCase() } });
  await logAudit({ userId, action: 'UPDATE', resource: 'Supplier', resourceId: supplier.id, entityCode: supplier.code, beforeData: before, afterData: supplier });
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
  const result = await prisma.$transaction(async (tx) => {
    const submittedAt = new Date();
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
  if (row.createdBy === userId) throw errors.forbidden('Maker tidak boleh menyetujui PR sendiri.');
  if (row.status !== PurchaseRequestStatus.SUBMITTED) throw errors.conflict('PURCHASE_REQUEST_NOT_SUBMITTED', 'PR belum diajukan.');
  const approved = new Map(input.items.map((line) => [line.itemId, new Prisma.Decimal(line.approvedQty)]));
  if (approved.size !== row.items.length || row.items.some((line) => !approved.has(line.id))) throw errors.badRequest('PURCHASE_REQUEST_APPROVAL_LINES_INVALID', 'Semua baris PR wajib diputuskan tepat satu kali.');
  for (const line of row.items) {
    const qty = approved.get(line.id)!;
    if (qty.isNegative() || qty.greaterThan(line.requestedQty)) throw errors.unprocessable('PURCHASE_REQUEST_APPROVED_QTY_INVALID', 'Approved quantity harus 0 sampai requested quantity.');
  }
  if (![...approved.values()].some((qty) => qty.greaterThan(0))) throw errors.unprocessable('PURCHASE_REQUEST_EMPTY_APPROVAL', 'Minimal satu baris harus disetujui.');
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
  if (pr.status !== PurchaseRequestStatus.APPROVED) throw errors.conflict('PURCHASE_REQUEST_NOT_APPROVED', 'PR belum disetujui atau sudah dikonversi.');
  const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier || supplier.status !== SupplierStatus.ACTIVE) throw errors.badRequest('SUPPLIER_NOT_ACTIVE', 'Supplier tidak aktif atau tidak ditemukan.');
  const payloadHash = serialized({ ...input, orderDate: input.orderDate.toISOString(), expectedDate: input.expectedDate?.toISOString() });
  const replay = await prisma.purchaseOrder.findUnique({ where: { postingKey: input.postingKey }, include: { items: true } });
  if (replay) {
    if (replay.payloadHash !== payloadHash) throw errors.conflict('PURCHASE_ORDER_KEY_REUSED', 'Posting key PO digunakan untuk payload berbeda.');
    return { purchaseOrder: replay, idempotentReplay: true };
  }
  const products = await prisma.masterProduct.findMany({ where: { id: { in: pr.items.map((line) => line.masterProductId) } } });
  const byId = new Map(products.map((product) => [product.id, product]));
  const approved = pr.items.filter((line) => line.approvedQty?.greaterThan(0));
  const lines = approved.map((line, index) => {
    const product = byId.get(line.masterProductId)!;
    const lineTotal = exactCurrency(line.approvedQty!.mul(line.estimatedUnitCost), `Nilai baris ${index + 1}`);
    return { lineNo: index + 1, masterProductId: line.masterProductId, skuSnapshot: product.sku, nameSnapshot: product.name, uomSnapshot: product.baseUnit, orderedQty: line.approvedQty!, unitPrice: line.estimatedUnitCost, lineTotal };
  });
  const totalAmount = lines.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
  return prisma.$transaction(async (tx) => {
    const purchaseOrder = await tx.purchaseOrder.create({ data: { poNumber: id('PO'), postingKey: input.postingKey, payloadHash, purchaseRequestId: pr.id, supplierId: supplier.id, branchId: pr.branchId, orderDate: input.orderDate, expectedDate: input.expectedDate, totalAmount, notes: input.notes, createdBy: userId, items: { create: lines } }, include: { items: true, supplier: true } });
    await tx.purchaseRequest.update({ where: { id: pr.id }, data: { status: 'CONVERTED', convertedAt: new Date() } });
    await tx.auditLog.create({ data: { userId, branchId: pr.branchId, action: 'CREATE', module: 'PURCHASING', resource: 'PurchaseOrder', resourceId: purchaseOrder.id, entityType: 'PurchaseOrder', entityId: purchaseOrder.id, entityCode: purchaseOrder.poNumber, description: `PO ${purchaseOrder.poNumber} diterbitkan.`, afterData: { totalAmount: totalAmount.toFixed(2), supplierId: supplier.id } } });
    return { purchaseOrder, idempotentReplay: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
  const po = await prisma.purchaseOrder.findUnique({ where: { id: input.purchaseOrderId }, include: { supplier: true } });
  if (!po) throw errors.notFound('Purchase Order tidak ditemukan.');
  await assertBranchAccess(userId, po.branchId); await assertPermission(userId, PERMISSIONS.AP_INVOICE_POST, po.branchId);
  const payloadHash = serialized({ ...input, invoiceDate: input.invoiceDate.toISOString(), dueDate: input.dueDate.toISOString() });
  const replay = await prisma.supplierInvoice.findUnique({ where: { postingKey: input.postingKey }, include: { journalEntry: true } });
  if (replay) { if (replay.payloadHash !== payloadHash) throw errors.conflict('SUPPLIER_INVOICE_KEY_REUSED', 'Posting key invoice supplier digunakan untuk payload berbeda.'); return { supplierInvoice: replay, idempotentReplay: true }; }
  return withTransactionRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "purchase_orders" WHERE "id" = ${po.id} FOR UPDATE`);
    const concurrentReplay = await tx.supplierInvoice.findUnique({ where: { postingKey: input.postingKey }, include: { journalEntry: true } });
    if (concurrentReplay) {
      if (concurrentReplay.payloadHash !== payloadHash) throw errors.conflict('SUPPLIER_INVOICE_KEY_REUSED', 'Posting key invoice supplier digunakan untuk payload berbeda.');
      return { supplierInvoice: concurrentReplay, idempotentReplay: true };
    }
    const [receipt, invoiced, accounts] = await Promise.all([
      tx.goodsReceipt.aggregate({ where: { purchaseOrderId: po.id }, _sum: { totalValue: true } }),
      tx.supplierInvoice.aggregate({ where: { purchaseOrderId: po.id }, _sum: { amount: true } }),
      tx.account.findMany({ where: { code: { in: ['2110', '2100'] }, isActive: true, allowPosting: true } }),
    ]);
    const amount = new Prisma.Decimal(input.amount); const available = (receipt._sum.totalValue || new Prisma.Decimal(0)).sub(invoiced._sum.amount || 0);
    if (!amount.greaterThan(0) || amount.greaterThan(available)) throw errors.unprocessable('SUPPLIER_INVOICE_EXCEEDS_RECEIPT', 'Invoice supplier melebihi nilai Goods Receipt yang belum ditagihkan.');
    const accountByCode = new Map(accounts.map((account) => [account.code, account]));
    if (!accountByCode.has('2110') || !accountByCode.has('2100')) throw errors.unprocessable('AP_ACCOUNT_MAPPING_MISSING', 'Account GRNI 2110 atau AP 2100 belum dikonfigurasi.');
    const invoiceId = randomUUID(); const invoiceNumber = id('SI');
    const posted = await postPurchasingDerivedJournal({ postingKey: `SUPPLIER_INVOICE:${invoiceId}`, transactionDate: input.invoiceDate, branchId: po.branchId, actorUserId: userId, description: `Supplier Invoice ${input.supplierInvoiceNumber}`, lines: buildPurchasingJournal('SUPPLIER_INVOICE', amount), sourceLinks: [{ sourceType: 'SUPPLIER_INVOICE', sourceId: invoiceId, sourceNumber: invoiceNumber }], metadata: { purchaseOrderId: po.id, supplierId: po.supplierId } }, tx);
    const supplierInvoice = await tx.supplierInvoice.create({ data: { id: invoiceId, invoiceNumber, supplierInvoiceNumber: input.supplierInvoiceNumber, postingKey: input.postingKey, payloadHash, purchaseOrderId: po.id, supplierId: po.supplierId, branchId: po.branchId, invoiceDate: input.invoiceDate, dueDate: input.dueDate, amount, balanceAmount: amount, grniAccountId: accountByCode.get('2110')!.id, apAccountId: accountByCode.get('2100')!.id, journalEntryId: posted.journal.id, evidenceReference: input.evidenceReference, createdBy: userId }, include: { journalEntry: true, supplier: true } });
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
    const invoice = await tx.supplierInvoice.findUnique({ where: { id: supplierInvoiceId }, include: { apAccount: true } });
    const cash = await tx.cashBankAccount.findUnique({ where: { id: input.cashBankAccountId }, include: { coaAccount: true } });
    if (!invoice) throw errors.notFound('Supplier invoice tidak ditemukan.');
    if (!cash?.isActive || cash.branchId !== invoice.branchId || !cash.coaAccount.allowPosting) throw errors.badRequest('SUPPLIER_PAYMENT_CASH_INVALID', 'Akun kas/bank tidak aktif atau tidak sesuai branch.');
    const amount = new Prisma.Decimal(input.amount);
    if (!amount.greaterThan(0) || amount.greaterThan(invoice.balanceAmount)) throw errors.unprocessable('SUPPLIER_PAYMENT_EXCEEDS_BALANCE', 'Pembayaran melebihi saldo AP invoice.');
    const paymentId = randomUUID(); const paymentNumber = id('SP');
    const posted = await postPurchasingDerivedJournal({ postingKey: `SUPPLIER_PAYMENT:${paymentId}`, transactionDate: input.paymentDate, branchId: invoice.branchId, actorUserId: userId, description: `Pembayaran ${invoice.invoiceNumber}`, lines: buildPurchasingJournal('SUPPLIER_PAYMENT', amount, cash.coaAccount.code), sourceLinks: [{ sourceType: 'SUPPLIER_PAYMENT', sourceId: paymentId, sourceNumber: paymentNumber }], metadata: { supplierInvoiceId: invoice.id, cashBankAccountId: cash.id } }, tx);
    const cashTransaction = await tx.cashBankTransaction.create({ data: { transactionNumber: `CBP/${paymentId}`, postingKey: `SUPPLIER_PAYMENT:${paymentId}`, cashBankAccountId: cash.id, branchId: invoice.branchId, transactionDate: input.paymentDate, type: 'PAYMENT', amount, sourceType: 'SUPPLIER_PAYMENT', sourceId: paymentId, sourceNumber: paymentNumber, journalEntryId: posted.journal.id, description: `Pembayaran supplier ${invoice.invoiceNumber}`, createdBy: userId } });
    const balanceAmount = invoice.balanceAmount.sub(amount); const paidAmount = invoice.paidAmount.add(amount);
    const supplierPayment = await tx.supplierPayment.create({ data: { id: paymentId, paymentNumber, postingKey: input.postingKey, payloadHash, supplierInvoiceId: invoice.id, cashBankAccountId: cash.id, branchId: invoice.branchId, paymentDate: input.paymentDate, amount, paymentReference: input.paymentReference, journalEntryId: posted.journal.id, cashBankTransactionId: cashTransaction.id, createdBy: userId }, include: { journalEntry: true, cashBankTransaction: true } });
    await tx.supplierInvoice.update({ where: { id: invoice.id }, data: { paidAmount, balanceAmount, status: supplierInvoiceStatus(balanceAmount, paidAmount) } });
    await tx.auditLog.create({ data: { userId, branchId: invoice.branchId, action: 'CREATE', module: 'ACCOUNTS_PAYABLE', resource: 'SupplierPayment', resourceId: paymentId, entityType: 'SupplierPayment', entityId: paymentId, entityCode: paymentNumber, description: `Pembayaran supplier ${paymentNumber} diposting.`, afterData: { amount: amount.toFixed(2), balanceAmount: balanceAmount.toFixed(2), journalEntryId: posted.journal.id, cashBankTransactionId: cashTransaction.id } } });
    return { supplierPayment, invoiceStatus: supplierInvoiceStatus(balanceAmount, paidAmount), balanceAmount: balanceAmount.toFixed(2), idempotentReplay: false };
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
  return prisma.purchaseOrder.findMany({ where: { branchId: branchId || { in: branches } }, include: { supplier: true, items: true, goodsReceipts: true, invoices: true }, orderBy: { createdAt: 'desc' } });
}

export async function listAccountsPayable(userId: string, branchId?: string) {
  const branches = await readableBranches(userId, PERMISSIONS.AP_READ);
  if (branchId && !branches.includes(branchId)) throw errors.forbidden('Tidak memiliki akses AP cabang ini.');
  return prisma.supplierInvoice.findMany({ where: { branchId: branchId || { in: branches } }, include: { supplier: true, purchaseOrder: { select: { poNumber: true } }, journalEntry: { select: { journalNumber: true } }, payments: { orderBy: { paymentDate: 'asc' } } }, orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }] });
}
