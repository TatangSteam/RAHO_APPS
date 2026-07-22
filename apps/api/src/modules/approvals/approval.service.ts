import { ApprovalDecisionType, ApprovalInstanceStatus, Prisma } from '@prisma/client';
import { errors } from '@middleware/errorHandler';
import {
  decideApprovalInTransaction as decideWorkflowApproval,
  startApprovalInTransaction,
  type ApprovalTx,
} from '@modules/workflow/approval.service';

export type { ApprovalTx };

export interface SubmitApprovalInput {
  subjectType: string;
  subjectId: string;
  branchId: string;
  makerId: string;
  amount: Prisma.Decimal | string | number;
  category?: string | null;
  transactionType?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function submitApprovalInTransaction(tx: ApprovalTx, input: SubmitApprovalInput) {
  const subjectType = input.subjectType.trim().toUpperCase();
  const result = await startApprovalInTransaction({
    module: subjectType,
    entityType: subjectType,
    entityId: input.subjectId,
    branchId: input.branchId,
    makerUserId: input.makerId,
    amount: input.amount,
    category: input.category || undefined,
    transactionType: (input.transactionType || subjectType).toUpperCase(),
    payload: {
      subjectId: input.subjectId,
      amount: new Prisma.Decimal(input.amount).toFixed(2),
      category: input.category || null,
      transactionType: input.transactionType || subjectType,
      metadata: input.metadata || null,
    },
  }, tx);
  return result.instance;
}

export async function decideApprovalInTransaction(
  tx: ApprovalTx,
  input: { subjectType: string; subjectId: string; actorUserId: string; decision: 'APPROVE' | 'REJECT'; note: string },
) {
  const subjectType = input.subjectType.trim().toUpperCase();
  const instance = await tx.approvalInstance.findFirst({
    where: {
      entityType: subjectType,
      entityId: input.subjectId,
      status: ApprovalInstanceStatus.PENDING,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!instance) throw errors.conflict('APPROVAL_NOT_SUBMITTED', 'Dokumen belum diajukan atau approval sudah selesai.');
  const result = await decideWorkflowApproval({
    instanceId: instance.id,
    actorUserId: input.actorUserId,
    decision: input.decision === 'APPROVE' ? ApprovalDecisionType.APPROVE : ApprovalDecisionType.REJECT,
    note: input.note,
  }, tx);
  return result.instance;
}
