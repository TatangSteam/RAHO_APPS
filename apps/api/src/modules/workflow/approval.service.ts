import { createHash } from 'crypto';
import {
  ApprovalDecisionType,
  ApprovalInstanceStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import {
  assertBranchAccess,
  assertPermission,
  getAccessibleBranchIds,
  hasPermission,
} from '@modules/iam/authorization.service';
import { PERMISSIONS, type PermissionCode } from '@modules/iam/permission-catalog';
import { logAudit } from '@utils/auditLog';
import type { ApprovalInboxQuery, CreateApprovalRuleInput } from './approval.schema';

export type ApprovalTx = Prisma.TransactionClient;
const json = (value: unknown) => value as Prisma.InputJsonValue;

export interface StartApprovalInput {
  module: string;
  entityType: string;
  entityId: string;
  entityNumber?: string;
  branchId: string;
  makerUserId: string;
  amount?: Prisma.Decimal.Value;
  category?: string;
  transactionType: string;
  payload: unknown;
}

function payloadHash(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function ruleSpecificity(rule: { branchScopeKey: string; categoryKey: string; transactionType: string }, input: StartApprovalInput) {
  return Number(rule.branchScopeKey === input.branchId) * 4
    + Number(rule.categoryKey === (input.category || '*').toUpperCase()) * 2
    + Number(rule.transactionType === input.transactionType.toUpperCase());
}

export function chooseApprovalRule<T extends { branchScopeKey: string; categoryKey: string; transactionType: string; priority: number }>(candidates: T[], input: StartApprovalInput) {
  return [...candidates].sort((a, b) => ruleSpecificity(b, input) - ruleSpecificity(a, input) || b.priority - a.priority)[0];
}

export async function startApprovalInTransaction(input: StartApprovalInput, tx: ApprovalTx) {
  const hash = payloadHash(input.payload);
  const previous = await tx.approvalInstance.findMany({ where: { entityType: input.entityType, entityId: input.entityId }, include: { rule: { include: { steps: true } }, decisions: true }, orderBy: { createdAt: 'desc' } });
  const existing = previous[0];
  if (existing && existing.status !== ApprovalInstanceStatus.REJECTED && existing.status !== ApprovalInstanceStatus.CANCELLED) {
    if (existing.payloadHash !== hash) throw errors.conflict('APPROVAL_ENTITY_CHANGED', 'Dokumen berubah setelah approval dibuat.');
    return { instance: existing, idempotentReplay: true };
  }
  const entityKey = `${input.entityType.toUpperCase()}:${input.entityId}:${previous.length + 1}`;
  const amount = new Prisma.Decimal(input.amount || 0).toDecimalPlaces(2);
  const module = input.module.toUpperCase();
  const transactionType = input.transactionType.toUpperCase();
  const category = (input.category || '*').toUpperCase();
  const candidates = await tx.approvalRule.findMany({
    where: {
      module,
      isActive: true,
      transactionType: { in: [transactionType, '*'] },
      branchScopeKey: { in: [input.branchId, 'GLOBAL'] },
      categoryKey: { in: [category, '*'] },
      minAmount: { lte: amount },
      OR: [{ maxAmount: null }, { maxAmount: { gte: amount } }],
    },
    include: { steps: { orderBy: { stepNo: 'asc' } } },
    orderBy: { priority: 'desc' },
  });
  const rule = chooseApprovalRule(candidates, input);
  if (!rule?.steps.length) throw errors.unprocessable('APPROVAL_RULE_NOT_FOUND', `Approval rule ${module}/${transactionType} tidak ditemukan.`);
  if (rule.steps.some((step, index) => step.stepNo !== index + 1)) {
    throw errors.conflict('APPROVAL_RULE_STEPS_INVALID', 'Nomor tahapan approval rule tidak berurutan.');
  }
  const instance = await tx.approvalInstance.create({
    data: {
      entityKey, module, entityType: input.entityType, entityId: input.entityId,
      entityNumber: input.entityNumber, branchId: input.branchId, makerUserId: input.makerUserId,
      amount, category: input.category, transactionType, approvalRuleId: rule.id, payloadHash: hash,
      ruleSnapshot: json({
        ruleCode: rule.ruleCode, name: rule.name, priority: rule.priority,
        steps: rule.steps.map((step) => ({ stepNo: step.stepNo, name: step.name, permissionCode: step.permissionCode, requiredApprovals: step.requiredApprovals })),
      }),
      auditLogs: { create: { action: 'SUBMITTED', actorUserId: input.makerUserId, afterStatus: ApprovalInstanceStatus.PENDING, stepNo: 1, metadata: json({ amount: amount.toFixed(2), category: input.category || null }) } },
    },
    include: { rule: { include: { steps: { orderBy: { stepNo: 'asc' } } } }, decisions: true },
  });
  return { instance, idempotentReplay: false };
}

export async function decideApprovalInTransaction(input: {
  instanceId: string;
  actorUserId: string;
  decision: ApprovalDecisionType;
  note?: string;
}, tx: ApprovalTx) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "approval_instances" WHERE "id" = ${input.instanceId} FOR UPDATE`);
  const instance = await tx.approvalInstance.findUnique({
    where: { id: input.instanceId },
    include: { rule: { include: { steps: { orderBy: { stepNo: 'asc' } } } }, decisions: true },
  });
  if (!instance) throw errors.notFound('Approval instance tidak ditemukan.');
  if (instance.status !== ApprovalInstanceStatus.PENDING) {
    throw errors.conflict('APPROVAL_ALREADY_DECIDED', `Approval sudah berstatus ${instance.status}.`);
  }
  if (instance.makerUserId === input.actorUserId) throw errors.forbidden('Maker tidak boleh memutuskan dokumennya sendiri.');
  if (instance.decisions.some((decision) => decision.approverUserId === input.actorUserId)) {
    throw errors.forbidden('Approver yang sama tidak boleh mengambil lebih dari satu keputusan pada workflow yang sama.');
  }
  const step = instance.rule.steps.find((candidate) => candidate.stepNo === instance.currentStep);
  if (!step) throw errors.conflict('APPROVAL_STEP_NOT_FOUND', 'Tahap approval aktif tidak ditemukan.');
  await assertBranchAccess(input.actorUserId, instance.branchId);
  await assertPermission(input.actorUserId, step.permissionCode as PermissionCode, instance.branchId);
  if (input.decision === ApprovalDecisionType.REJECT && !input.note?.trim()) {
    throw errors.badRequest('APPROVAL_REJECTION_NOTE_REQUIRED', 'Alasan penolakan wajib diisi.');
  }
  const decidedAt = new Date();
  await tx.approvalDecision.create({ data: {
    approvalInstanceId: instance.id, stepNo: step.stepNo, decision: input.decision,
    approverUserId: input.actorUserId, permissionCode: step.permissionCode, note: input.note, decidedAt,
  } });
  if (input.decision === ApprovalDecisionType.REJECT) {
    const rejected = await tx.approvalInstance.update({ where: { id: instance.id }, data: { status: ApprovalInstanceStatus.REJECTED, rejectedAt: decidedAt, completedAt: decidedAt } });
    await tx.approvalAuditLog.create({ data: { approvalInstanceId: instance.id, action: 'REJECTED', actorUserId: input.actorUserId, stepNo: step.stepNo, beforeStatus: instance.status, afterStatus: rejected.status, metadata: json({ note: input.note }) } });
    return { instance: rejected, isFinal: true, approved: false };
  }
  const approvalsAtStep = instance.decisions.filter((decision) => decision.stepNo === step.stepNo && decision.decision === ApprovalDecisionType.APPROVE).length + 1;
  if (approvalsAtStep < step.requiredApprovals) {
    await tx.approvalAuditLog.create({ data: { approvalInstanceId: instance.id, action: 'STEP_APPROVED', actorUserId: input.actorUserId, stepNo: step.stepNo, beforeStatus: instance.status, afterStatus: instance.status, metadata: json({ approvalsAtStep, requiredApprovals: step.requiredApprovals }) } });
    return { instance, isFinal: false, approved: false };
  }
  const finalStep = step.stepNo === instance.rule.steps.length;
  const updated = await tx.approvalInstance.update({
    where: { id: instance.id },
    data: finalStep
      ? { status: ApprovalInstanceStatus.APPROVED, completedAt: decidedAt }
      : { currentStep: step.stepNo + 1 },
  });
  await tx.approvalAuditLog.create({ data: { approvalInstanceId: instance.id, action: finalStep ? 'APPROVED' : 'STEP_ADVANCED', actorUserId: input.actorUserId, stepNo: step.stepNo, beforeStatus: instance.status, afterStatus: updated.status, metadata: json({ nextStep: finalStep ? null : step.stepNo + 1, note: input.note || null }) } });
  return { instance: updated, isFinal: finalStep, approved: finalStep };
}

export async function createApprovalRule(actorUserId: string, input: CreateApprovalRuleInput) {
  await assertPermission(actorUserId, PERMISSIONS.WORKFLOW_RULE_MANAGE, input.branchId);
  if (input.branchId) await assertBranchAccess(actorUserId, input.branchId);
  const knownPermissions = await prisma.permission.count({ where: { code: { in: input.steps.map((step) => step.permissionCode) } } });
  if (knownPermissions !== new Set(input.steps.map((step) => step.permissionCode)).size) {
    throw errors.badRequest('APPROVAL_PERMISSION_INVALID', 'Salah satu permission approver tidak terdaftar.');
  }
  const rule = await prisma.approvalRule.create({ data: {
    ruleCode: input.ruleCode, name: input.name, module: input.module,
    transactionType: input.transactionType, branchScopeKey: input.branchId || 'GLOBAL',
    categoryKey: input.category?.toUpperCase() || '*', minAmount: input.minAmount,
    maxAmount: input.maxAmount, priority: input.priority, createdBy: actorUserId,
    steps: { create: input.steps.map((step, index) => ({
      stepNo: index + 1,
      name: step.name,
      permissionCode: step.permissionCode,
      requiredApprovals: step.requiredApprovals ?? 1,
    })) },
  }, include: { steps: { orderBy: { stepNo: 'asc' } } } });
  await logAudit({ userId: actorUserId, branchId: input.branchId, action: 'CREATE', resource: 'ApprovalRule', resourceId: rule.id, entityCode: rule.ruleCode, afterData: { module: rule.module, transactionType: rule.transactionType, minAmount: rule.minAmount, maxAmount: rule.maxAmount, priority: rule.priority, steps: rule.steps } });
  return rule;
}

export async function listApprovalRules(actorUserId: string) {
  await assertPermission(actorUserId, PERMISSIONS.WORKFLOW_APPROVAL_READ);
  return prisma.approvalRule.findMany({ include: { steps: { orderBy: { stepNo: 'asc' } } }, orderBy: [{ module: 'asc' }, { priority: 'desc' }] });
}

export async function listApprovalInbox(actorUserId: string, query: ApprovalInboxQuery) {
  await assertPermission(actorUserId, PERMISSIONS.WORKFLOW_APPROVAL_READ, query.branchId);
  if (query.branchId) await assertBranchAccess(actorUserId, query.branchId);
  const accessible = await getAccessibleBranchIds(actorUserId);
  const where: Prisma.ApprovalInstanceWhereInput = {
    status: query.status,
    ...(query.module ? { module: query.module.toUpperCase() } : {}),
    ...(query.branchId ? { branchId: query.branchId } : accessible === null ? {} : { branchId: { in: accessible } }),
  };
  const candidates = await prisma.approvalInstance.findMany({ where, include: { rule: { include: { steps: true } }, decisions: true, auditLogs: { orderBy: { createdAt: 'asc' } } }, orderBy: { submittedAt: 'asc' }, take: query.limit * 3 });
  const visible = [];
  for (const instance of candidates) {
    const step = instance.rule.steps.find((candidate) => candidate.stepNo === instance.currentStep);
    if (query.status !== 'PENDING' || (step && await hasPermission(actorUserId, step.permissionCode as PermissionCode, instance.branchId))) visible.push(instance);
    if (visible.length >= query.limit) break;
  }
  return { data: visible, meta: { page: query.page, limit: query.limit } };
}
