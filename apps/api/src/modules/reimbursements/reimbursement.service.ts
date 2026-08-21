import { createHash, randomUUID } from 'crypto';
import {
  AccountType,
  ApprovalDecisionType,
  Prisma,
  ReimbursementPaymentMethod,
  ReimbursementStatus,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import {
  assertBranchAccess,
  assertPermission,
  getAccessibleBranchIds,
  hasPermission,
} from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { decideApprovalInTransaction, startApprovalInTransaction } from '@modules/workflow/approval.service';
import { postJournal } from '@modules/accounting/accounting.service';
import { createNotification } from '@modules/notifications/notification.service';
import { extractKeyFromUrl, getPresignedUrl } from '@config/minio';
import { logAudit } from '@utils/auditLog';
import type {
  CreateReimbursementInput,
  ListReimbursementsQuery,
  PayReimbursementInput,
  ReimbursementDecisionInput,
  UpdateReimbursementInput,
} from './reimbursement.schema';

export type ReimbursementEvidence = {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
};

const includeReimbursement = {
  branch: { select: { id: true, branchCode: true, name: true } },
  claimant: { select: { id: true, email: true, staffCode: true, profile: { select: { fullName: true } } } },
  reviewer: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
  payer: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
  attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true, checksum: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
  approvalInstance: { include: { rule: { include: { steps: { orderBy: { stepNo: 'asc' as const } } } }, decisions: { orderBy: { decidedAt: 'asc' as const } }, auditLogs: { orderBy: { createdAt: 'asc' as const } } } },
  expenseAccount: { select: { code: true, name: true } },
  cashBankAccount: { select: { id: true, code: true, name: true, type: true } },
  journalEntry: { select: { id: true, journalNumber: true } },
  cashBankTransaction: { select: { id: true, transactionNumber: true } },
} satisfies Prisma.ReimbursementInclude;

type ReimbursementRow = Prisma.ReimbursementGetPayload<{ include: typeof includeReimbursement }>;

function hashPayload(input: Omit<CreateReimbursementInput, 'postingKey'>, checksums: string[]) {
  return createHash('sha256').update(JSON.stringify({
    ...input,
    expenseDate: input.expenseDate.toISOString(),
    attachmentChecksums: [...checksums].sort(),
  })).digest('hex');
}

function format(row: ReimbursementRow) {
  return {
    ...row,
    amount: row.amount.toFixed(2),
    attachments: row.attachments.map((attachment) => ({
      ...attachment,
      url: `/reimbursements/${row.id}/attachments/${attachment.id}`,
    })),
  };
}

function normalizeDestination<T extends { paymentMethod?: string; recipientBankName?: string; recipientAccountNumber?: string; recipientAccountHolder?: string }>(input: T) {
  return input.paymentMethod === ReimbursementPaymentMethod.CASH
    ? { ...input, recipientBankName: undefined, recipientAccountNumber: undefined, recipientAccountHolder: undefined }
    : input;
}

async function assertReadable(userId: string, row: { branchId: string; claimantUserId: string }) {
  if (row.claimantUserId === userId) return;
  await assertBranchAccess(userId, row.branchId);
  await assertPermission(userId, PERMISSIONS.REIMBURSEMENT_READ, row.branchId);
  const mayReview = await Promise.all([
    hasPermission(userId, PERMISSIONS.REIMBURSEMENT_VERIFY, row.branchId),
    hasPermission(userId, PERMISSIONS.REIMBURSEMENT_APPROVE, row.branchId),
    hasPermission(userId, PERMISSIONS.REIMBURSEMENT_HIGH_APPROVE, row.branchId),
    hasPermission(userId, PERMISSIONS.REIMBURSEMENT_PAY, row.branchId),
  ]);
  if (!mayReview.some(Boolean)) throw errors.forbidden('Anda hanya dapat melihat reimburse milik sendiri.');
}

async function findFormatted(id: string) {
  return format(await prisma.reimbursement.findUniqueOrThrow({ where: { id }, include: includeReimbursement }));
}

export async function createReimbursement(userId: string, rawInput: CreateReimbursementInput, evidence: ReimbursementEvidence[]) {
  const input = normalizeDestination(rawInput);
  await assertBranchAccess(userId, input.branchId);
  await assertPermission(userId, PERMISSIONS.REIMBURSEMENT_CREATE, input.branchId);
  if (evidence.length === 0) throw errors.unprocessable('REIMBURSEMENT_EVIDENCE_REQUIRED', 'Minimal satu foto bukti wajib diunggah.');

  const checksums = evidence.map((item) => item.checksum);
  if (new Set(checksums).size !== checksums.length) throw errors.badRequest('REIMBURSEMENT_DUPLICATE_FILE', 'Foto bukti yang sama tidak boleh diunggah dua kali.');
  const payloadHash = hashPayload(input, checksums);
  const replay = await prisma.reimbursement.findUnique({ where: { postingKey: input.postingKey }, include: includeReimbursement });
  if (replay) {
    if (replay.payloadHash !== payloadHash) throw errors.conflict('REIMBURSEMENT_KEY_REUSED', 'Posting key digunakan untuk pengajuan berbeda.');
    return { reimbursement: format(replay), idempotentReplay: true };
  }

  const duplicateEvidence = await prisma.reimbursementAttachment.findFirst({
    where: { checksum: { in: checksums }, reimbursement: { claimantUserId: userId, status: { notIn: ['CANCELLED', 'REJECTED'] } } },
    select: { reimbursement: { select: { reimbursementNumber: true } } },
  });
  if (duplicateEvidence) throw errors.conflict('REIMBURSEMENT_EVIDENCE_REUSED', `Foto bukti sudah digunakan pada ${duplicateEvidence.reimbursement.reimbursementNumber}.`);

  const branch = await prisma.branch.findUnique({ where: { id: input.branchId }, select: { branchCode: true } });
  if (!branch) throw errors.notFound('Cabang tidak ditemukan.');
  const created = await prisma.reimbursement.create({
    data: {
      reimbursementNumber: `RMB/${branch.branchCode}/${input.expenseDate.getUTCFullYear()}/${randomUUID().slice(0, 8).toUpperCase()}`,
      postingKey: input.postingKey,
      payloadHash,
      branchId: input.branchId,
      claimantUserId: userId,
      expenseDate: input.expenseDate,
      category: input.category,
      description: input.description,
      amount: new Prisma.Decimal(input.amount),
      paymentMethod: input.paymentMethod,
      recipientBankName: input.recipientBankName || null,
      recipientAccountNumber: input.recipientAccountNumber || null,
      recipientAccountHolder: input.recipientAccountHolder || null,
      attachments: { create: evidence },
    },
    include: includeReimbursement,
  });
  await logAudit({ userId, branchId: created.branchId, action: 'CREATE', module: 'REIMBURSEMENT', resource: 'Reimbursement', resourceId: created.id, entityCode: created.reimbursementNumber, afterData: { status: created.status, amount: created.amount, category: created.category, attachmentCount: created.attachments.length } });
  return { reimbursement: format(created), idempotentReplay: false };
}

export async function updateReimbursement(userId: string, id: string, rawInput: UpdateReimbursementInput, replacementEvidence: ReimbursementEvidence[]) {
  const current = await prisma.reimbursement.findUnique({ where: { id }, include: { attachments: true } });
  if (!current) throw errors.notFound('Reimburse tidak ditemukan.');
  await assertBranchAccess(userId, current.branchId);
  await assertPermission(userId, PERMISSIONS.REIMBURSEMENT_CREATE, current.branchId);
  if (current.claimantUserId !== userId) throw errors.forbidden('Hanya pengaju yang dapat memperbaiki reimburse.');
  if (current.status !== ReimbursementStatus.DRAFT
    && current.status !== ReimbursementStatus.REVISION_REQUIRED
    && current.status !== ReimbursementStatus.REJECTED) {
    throw errors.conflict('REIMBURSEMENT_EDIT_STATUS_INVALID', 'Reimburse yang sedang diproses atau sudah dibayar tidak dapat diubah.');
  }
  if (replacementEvidence.length) {
    const checksums = replacementEvidence.map((item) => item.checksum);
    if (new Set(checksums).size !== checksums.length) throw errors.badRequest('REIMBURSEMENT_DUPLICATE_FILE', 'Foto bukti yang sama tidak boleh diunggah dua kali.');
    const reused = await prisma.reimbursementAttachment.findFirst({
      where: {
        checksum: { in: checksums },
        reimbursementId: { not: id },
        reimbursement: { claimantUserId: userId, status: { notIn: ['CANCELLED', 'REJECTED'] } },
      },
      select: { reimbursement: { select: { reimbursementNumber: true } } },
    });
    if (reused) throw errors.conflict('REIMBURSEMENT_EVIDENCE_REUSED', `Foto bukti sudah digunakan pada ${reused.reimbursement.reimbursementNumber}.`);
  }
  const merged = normalizeDestination({
    branchId: current.branchId,
    expenseDate: rawInput.expenseDate || current.expenseDate,
    category: rawInput.category || current.category,
    description: rawInput.description || current.description,
    amount: rawInput.amount || current.amount.toFixed(2),
    paymentMethod: rawInput.paymentMethod || current.paymentMethod,
    recipientBankName: rawInput.recipientBankName ?? current.recipientBankName ?? undefined,
    recipientAccountNumber: rawInput.recipientAccountNumber ?? current.recipientAccountNumber ?? undefined,
    recipientAccountHolder: rawInput.recipientAccountHolder ?? current.recipientAccountHolder ?? undefined,
  });
  if (merged.paymentMethod === 'BANK_TRANSFER' && (!merged.recipientBankName || !merged.recipientAccountNumber || !merged.recipientAccountHolder)) {
    throw errors.badRequest('REIMBURSEMENT_BANK_DESTINATION_REQUIRED', 'Data rekening penerima wajib untuk transfer.');
  }
  const evidence = replacementEvidence.length ? replacementEvidence : current.attachments.map((item) => ({
    fileUrl: item.fileUrl, fileName: item.fileName, fileSize: item.fileSize, mimeType: item.mimeType, checksum: item.checksum,
  }));
  const payloadHash = hashPayload({ ...merged, postingKey: current.postingKey } as CreateReimbursementInput, evidence.map((item) => item.checksum));
  const updated = await prisma.$transaction(async (tx) => {
    if (replacementEvidence.length) await tx.reimbursementAttachment.deleteMany({ where: { reimbursementId: id } });
    return tx.reimbursement.update({
      where: { id },
      data: {
        expenseDate: merged.expenseDate,
        category: merged.category,
        description: merged.description,
        amount: new Prisma.Decimal(merged.amount),
        paymentMethod: merged.paymentMethod,
        recipientBankName: merged.recipientBankName || null,
        recipientAccountNumber: merged.recipientAccountNumber || null,
        recipientAccountHolder: merged.recipientAccountHolder || null,
        payloadHash,
        status: ReimbursementStatus.DRAFT,
        approvalInstanceId: null,
        rejectionReason: null,
        revisionNote: null,
        reviewedBy: null,
        reviewedAt: null,
        submittedAt: null,
        ...(replacementEvidence.length ? { attachments: { create: replacementEvidence } } : {}),
      },
      include: includeReimbursement,
    });
  });
  await logAudit({ userId, branchId: current.branchId, action: 'UPDATE', module: 'REIMBURSEMENT', resource: 'Reimbursement', resourceId: id, entityCode: current.reimbursementNumber, beforeData: { status: current.status, amount: current.amount }, afterData: { status: updated.status, amount: updated.amount, attachmentCount: updated.attachments.length } });
  return { reimbursement: format(updated), replacedFileUrls: replacementEvidence.length ? current.attachments.map((item) => item.fileUrl) : [] };
}

export async function submitReimbursement(userId: string, id: string) {
  const current = await prisma.reimbursement.findUnique({ where: { id }, include: { attachments: true } });
  if (!current) throw errors.notFound('Reimburse tidak ditemukan.');
  await assertBranchAccess(userId, current.branchId);
  await assertPermission(userId, PERMISSIONS.REIMBURSEMENT_CREATE, current.branchId);
  if (current.claimantUserId !== userId) throw errors.forbidden('Hanya pengaju yang dapat mengajukan reimburse.');
  if (current.status !== ReimbursementStatus.DRAFT) throw errors.conflict('REIMBURSEMENT_SUBMIT_STATUS_INVALID', 'Hanya draft yang dapat diajukan.');
  if (!current.attachments.length) throw errors.unprocessable('REIMBURSEMENT_EVIDENCE_REQUIRED', 'Minimal satu foto bukti wajib sebelum diajukan.');

  await prisma.$transaction(async (tx) => {
    const submittedAt = new Date();
    const started = await startApprovalInTransaction({
      module: 'REIMBURSEMENT', entityType: 'Reimbursement', entityId: current.id, entityNumber: current.reimbursementNumber,
      branchId: current.branchId, makerUserId: current.claimantUserId, amount: current.amount,
      category: current.category, transactionType: 'REIMBURSEMENT',
      payload: {
        id: current.id,
        amount: current.amount.toFixed(2),
        category: current.category,
        description: current.description,
        paymentMethod: current.paymentMethod,
        evidenceChecksums: current.attachments.map((item) => item.checksum).sort(),
      },
    }, tx);
    await tx.reimbursement.update({ where: { id }, data: { status: ReimbursementStatus.PENDING_APPROVAL, submittedAt, approvalInstanceId: started.instance.id } });
  });
  await logAudit({ userId, branchId: current.branchId, action: 'STATUS_CHANGE', module: 'REIMBURSEMENT', resource: 'Reimbursement', resourceId: id, entityCode: current.reimbursementNumber, beforeData: { status: current.status }, afterData: { status: 'PENDING_APPROVAL' } });
  return findFormatted(id);
}

export async function decideReimbursement(userId: string, id: string, input: ReimbursementDecisionInput) {
  const current = await prisma.reimbursement.findUnique({ where: { id } });
  if (!current) throw errors.notFound('Reimburse tidak ditemukan.');
  if (current.status !== ReimbursementStatus.PENDING_APPROVAL || !current.approvalInstanceId) throw errors.conflict('REIMBURSEMENT_NOT_PENDING', 'Reimburse tidak sedang menunggu approval.');
  const updated = await prisma.$transaction(async (tx) => {
    const decision = await decideApprovalInTransaction({
      instanceId: current.approvalInstanceId!,
      actorUserId: userId,
      decision: input.decision as ApprovalDecisionType,
      note: input.note,
    }, tx);
    if (input.decision === 'RETURN_FOR_REVISION') {
      return tx.reimbursement.update({ where: { id }, data: { status: ReimbursementStatus.REVISION_REQUIRED, revisionNote: input.note, reviewedBy: userId, reviewedAt: new Date() } });
    }
    if (input.decision === 'REJECT') {
      return tx.reimbursement.update({ where: { id }, data: { status: ReimbursementStatus.REJECTED, rejectionReason: input.note, reviewedBy: userId, reviewedAt: new Date() } });
    }
    if (decision.approved) {
      return tx.reimbursement.update({ where: { id }, data: { status: ReimbursementStatus.APPROVED, reviewedBy: userId, reviewedAt: new Date() } });
    }
    return current;
  });
  await logAudit({ userId, branchId: current.branchId, action: 'STATUS_CHANGE', module: 'REIMBURSEMENT', resource: 'Reimbursement', resourceId: id, entityCode: current.reimbursementNumber, beforeData: { status: current.status }, afterData: { status: updated.status, decision: input.decision, note: input.note || null } });
  return findFormatted(id);
}

export async function cancelReimbursement(userId: string, id: string) {
  const current = await prisma.reimbursement.findUnique({ where: { id } });
  if (!current) throw errors.notFound('Reimburse tidak ditemukan.');
  await assertBranchAccess(userId, current.branchId);
  if (current.claimantUserId !== userId) throw errors.forbidden('Hanya pengaju yang dapat membatalkan reimburse.');
  if (current.status !== ReimbursementStatus.DRAFT && current.status !== ReimbursementStatus.REVISION_REQUIRED) throw errors.conflict('REIMBURSEMENT_CANCEL_STATUS_INVALID', 'Reimburse pada status ini tidak dapat dibatalkan.');
  await prisma.reimbursement.update({ where: { id }, data: { status: ReimbursementStatus.CANCELLED } });
  await logAudit({ userId, branchId: current.branchId, action: 'STATUS_CHANGE', module: 'REIMBURSEMENT', resource: 'Reimbursement', resourceId: id, entityCode: current.reimbursementNumber, beforeData: { status: current.status }, afterData: { status: 'CANCELLED' } });
  return findFormatted(id);
}

export async function payReimbursement(userId: string, id: string, input: PayReimbursementInput) {
  const candidate = await prisma.reimbursement.findUnique({ where: { id }, select: { branchId: true } });
  if (!candidate) throw errors.notFound('Reimburse tidak ditemukan.');
  await assertBranchAccess(userId, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.REIMBURSEMENT_PAY, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.JOURNAL_POST, candidate.branchId);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "reimbursements" WHERE "id" = ${id} FOR UPDATE`);
    const reimbursement = await tx.reimbursement.findUnique({ where: { id } });
    if (!reimbursement) throw errors.notFound('Reimburse tidak ditemukan.');
    if (reimbursement.status === ReimbursementStatus.PAID) {
      return { reimbursement: format(await tx.reimbursement.findUniqueOrThrow({ where: { id }, include: includeReimbursement })), idempotentReplay: true };
    }
    if (reimbursement.status !== ReimbursementStatus.APPROVED) throw errors.conflict('REIMBURSEMENT_NOT_APPROVED', 'Reimburse belum disetujui.');
    const [expenseAccount, cashBank] = await Promise.all([
      tx.account.findUnique({ where: { code: input.expenseAccountCode.toUpperCase() } }),
      tx.cashBankAccount.findUnique({ where: { id: input.cashBankAccountId }, include: { coaAccount: true } }),
    ]);
    if (!expenseAccount?.isActive || !expenseAccount.allowPosting || expenseAccount.type !== AccountType.EXPENSE) throw errors.badRequest('REIMBURSEMENT_EXPENSE_ACCOUNT_INVALID', 'Akun beban tidak valid atau tidak menerima posting.');
    if (!cashBank?.isActive || cashBank.branchId !== reimbursement.branchId || !cashBank.coaAccount.allowPosting) throw errors.badRequest('REIMBURSEMENT_CASH_BANK_INVALID', 'Akun kas/bank tidak aktif atau bukan milik cabang reimburse.');
    if (cashBank.requiresReference && !input.paymentReference) throw errors.badRequest('REIMBURSEMENT_PAYMENT_REFERENCE_REQUIRED', 'Referensi pembayaran wajib untuk rekening ini.');

    const posted = await postJournal({
      postingKey: `REIMBURSEMENT:${reimbursement.id}`,
      transactionDate: input.paymentDate,
      branchId: reimbursement.branchId,
      actorUserId: userId,
      description: `Pembayaran ${reimbursement.reimbursementNumber}: ${reimbursement.description}`,
      lines: [
        { accountCode: expenseAccount.code, debit: reimbursement.amount },
        { accountCode: cashBank.coaAccount.code, credit: reimbursement.amount },
      ],
      sourceLinks: [{ sourceType: 'REIMBURSEMENT', sourceId: reimbursement.id, sourceNumber: reimbursement.reimbursementNumber }],
      metadata: { category: reimbursement.category, cashBankAccountId: cashBank.id, paymentReference: input.paymentReference || null },
    }, tx);
    const cashTransaction = await tx.cashBankTransaction.create({ data: {
      transactionNumber: `CBP/RMB/${reimbursement.id}`,
      postingKey: `REIMBURSEMENT:${reimbursement.id}`,
      cashBankAccountId: cashBank.id,
      branchId: reimbursement.branchId,
      transactionDate: input.paymentDate,
      type: 'PAYMENT',
      amount: reimbursement.amount,
      sourceType: 'REIMBURSEMENT',
      sourceId: reimbursement.id,
      sourceNumber: reimbursement.reimbursementNumber,
      journalEntryId: posted.journal.id,
      description: reimbursement.description,
      metadata: { paymentReference: input.paymentReference || null, paymentMethod: reimbursement.paymentMethod },
      createdBy: userId,
    } });
    const paidAt = new Date();
    await tx.reimbursement.update({ where: { id }, data: {
      status: ReimbursementStatus.PAID,
      expenseAccountId: expenseAccount.id,
      cashBankAccountId: cashBank.id,
      paymentReference: input.paymentReference || null,
      journalEntryId: posted.journal.id,
      cashBankTransactionId: cashTransaction.id,
      paidBy: userId,
      paidAt,
    } });
    await createNotification(tx, { userId: reimbursement.claimantUserId, title: 'Reimburse telah dibayar', body: `${reimbursement.reimbursementNumber} sebesar Rp ${reimbursement.amount.toFixed(2)} telah dibayar.`, deepLink: '/reimbursements' });
    await tx.auditLog.create({ data: { userId, branchId: reimbursement.branchId, action: 'STATUS_CHANGE', module: 'REIMBURSEMENT', resource: 'Reimbursement', resourceId: id, entityType: 'Reimbursement', entityId: id, entityCode: reimbursement.reimbursementNumber, description: `Reimburse ${reimbursement.reimbursementNumber} dibayar dan diposting.`, afterData: { status: 'PAID', journalEntryId: posted.journal.id, cashBankTransactionId: cashTransaction.id } as Prisma.InputJsonValue } });
    return { reimbursement: format(await tx.reimbursement.findUniqueOrThrow({ where: { id }, include: includeReimbursement })), journal: posted.journal, idempotentReplay: false };
  });
}

export async function listReimbursements(userId: string, query: ListReimbursementsQuery) {
  await assertPermission(userId, PERMISSIONS.REIMBURSEMENT_READ, query.branchId);
  if (query.branchId) await assertBranchAccess(userId, query.branchId);
  const accessible = await getAccessibleBranchIds(userId);
  const canSeeBranchClaims = (await Promise.all([
    hasPermission(userId, PERMISSIONS.REIMBURSEMENT_VERIFY, query.branchId),
    hasPermission(userId, PERMISSIONS.REIMBURSEMENT_APPROVE, query.branchId),
    hasPermission(userId, PERMISSIONS.REIMBURSEMENT_HIGH_APPROVE, query.branchId),
    hasPermission(userId, PERMISSIONS.REIMBURSEMENT_PAY, query.branchId),
  ])).some(Boolean);
  const rows = await prisma.reimbursement.findMany({
    where: {
      ...(query.status ? { status: query.status } : {}),
      ...(query.branchId ? { branchId: query.branchId } : accessible === null ? {} : { branchId: { in: accessible } }),
      ...(!canSeeBranchClaims ? { claimantUserId: userId } : {}),
    },
    include: includeReimbursement,
    orderBy: [{ createdAt: 'desc' }],
  });
  return rows.map(format);
}

export async function getReimbursement(userId: string, id: string) {
  const row = await prisma.reimbursement.findUnique({ where: { id }, include: includeReimbursement });
  if (!row) throw errors.notFound('Reimburse tidak ditemukan.');
  await assertReadable(userId, row);
  return format(row);
}

export async function getReimbursementAttachment(userId: string, id: string, attachmentId: string) {
  const reimbursement = await prisma.reimbursement.findUnique({ where: { id }, select: { branchId: true, claimantUserId: true } });
  if (!reimbursement) throw errors.notFound('Reimburse tidak ditemukan.');
  await assertReadable(userId, reimbursement);
  const attachment = await prisma.reimbursementAttachment.findFirst({ where: { id: attachmentId, reimbursementId: id } });
  if (!attachment) throw errors.notFound('Bukti reimburse tidak ditemukan.');
  return { url: await getPresignedUrl(extractKeyFromUrl(attachment.fileUrl), 300), expiresIn: 300 };
}
