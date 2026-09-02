import { AuditAction, Prisma, Role, TreatmentCompletionStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { deleteFileByUrl } from '../../../config/minio';
import { logAudit } from '../../../utils/auditLog';
import {
  releaseAddOnStockInTransaction,
  returnAddOnStockInTransaction,
} from '../../packages/services/add-on-inventory.service';
import { SessionCompletionService } from '../../sessions/services/session-completion.service';
import { SessionDeletionService } from '../../sessions/services/session-deletion.service';

export const MEMBER_DESTRUCTION_CONFIRMATION = 'DESTRUCTION MEMBER';

type DestructionBlocker = { code: string; message: string; count: number };

export type MemberDestructionPreview = {
  member: { id: string; memberNo: string; fullName: string };
  allowed: boolean;
  confirmationPhrase: typeof MEMBER_DESTRUCTION_CONFIRMATION;
  blockers: DestructionBlocker[];
  counts: {
    sessions: number;
    packages: number;
    invoices: number;
    diagnoses: number;
    therapyPlans: number;
    labResults: number;
    documents: number;
    addOns: number;
    nonTherapyPurchases: number;
  };
};

type DestructionInput = {
  confirmation: string;
  memberNo: string;
  deleteFinancialAndInventory: true;
};

type Tx = Prisma.TransactionClient;

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function deleteFiles(fileUrls: Array<string | null | undefined>) {
  const uniqueUrls = [...new Set(fileUrls.filter((url): url is string => Boolean(url)))];
  const results = await Promise.allSettled(uniqueUrls.map((url) => deleteFileByUrl(url)));
  return {
    requested: uniqueUrls.length,
    deleted: results.filter((result) => result.status === 'fulfilled' && result.value).length,
    failed: results.filter(
      (result) => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value),
    ).length,
  };
}

async function expandJournalIds(tx: Tx, seedIds: string[]): Promise<string[]> {
  const ids = new Set(seedIds);
  let changed = true;
  while (changed && ids.size > 0) {
    changed = false;
    const rows = await tx.journalEntry.findMany({
      where: { OR: [{ id: { in: [...ids] } }, { reversedByEntryId: { in: [...ids] } }] },
      select: { id: true, reversedByEntryId: true },
    });
    for (const row of rows) {
      for (const id of [row.id, row.reversedByEntryId]) {
        if (id && !ids.has(id)) {
          ids.add(id);
          changed = true;
        }
      }
    }
  }
  return [...ids];
}

async function deleteJournalGraph(tx: Tx, seedIds: string[]): Promise<number> {
  const journalIds = await expandJournalIds(tx, uniqueIds(seedIds));
  if (journalIds.length === 0) return 0;
  await tx.deferredRevenueMovement.deleteMany({ where: { journalEntryId: { in: journalIds } } });
  await tx.revenueRecognition.deleteMany({ where: { journalEntryId: { in: journalIds } } });
  await tx.cashBankTransaction.deleteMany({ where: { journalEntryId: { in: journalIds } } });
  await tx.journalEntry.updateMany({
    where: { reversedByEntryId: { in: journalIds } }, data: { reversedByEntryId: null },
  });
  await tx.journalSourceLink.deleteMany({ where: { journalEntryId: { in: journalIds } } });
  await tx.journalLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
  return (await tx.journalEntry.deleteMany({ where: { id: { in: journalIds } } })).count;
}

async function expandInventoryPostingIds(tx: Tx, seedIds: string[]): Promise<string[]> {
  const ids = new Set(seedIds);
  let changed = true;
  while (changed && ids.size > 0) {
    changed = false;
    const rows = await tx.inventoryPosting.findMany({
      where: { OR: [{ id: { in: [...ids] } }, { reversalOfId: { in: [...ids] } }] },
      select: { id: true, reversalOfId: true },
    });
    for (const row of rows) {
      for (const id of [row.id, row.reversalOfId]) {
        if (id && !ids.has(id)) {
          ids.add(id);
          changed = true;
        }
      }
    }
  }
  return [...ids];
}

async function deleteInventoryGraph(
  tx: Tx,
  seedPostingIds: string[],
  sourceIds: string[],
): Promise<{ postings: number; mutations: number }> {
  const inventoryPostingIds = await expandInventoryPostingIds(tx, uniqueIds(seedPostingIds));
  const allocationIds = inventoryPostingIds.length > 0
    ? (await tx.inventoryCostAllocation.findMany({
        where: { postingId: { in: inventoryPostingIds } }, select: { id: true },
      })).map((item) => item.id)
    : [];
  if (allocationIds.length > 0) {
    await tx.inventoryCostAllocation.updateMany({
      where: { reversalOfId: { in: allocationIds } }, data: { reversalOfId: null },
    });
    await tx.inventoryCostAllocation.deleteMany({ where: { id: { in: allocationIds } } });
  }

  const mutationOr: Prisma.StockMutationWhereInput[] = [
    ...(inventoryPostingIds.length > 0 ? [{ inventoryPostingId: { in: inventoryPostingIds } }] : []),
    ...(sourceIds.length > 0 ? [{ referenceId: { in: sourceIds } }] : []),
  ];
  const mutations = mutationOr.length > 0
    ? (await tx.stockMutation.deleteMany({ where: { OR: mutationOr } })).count
    : 0;
  if (inventoryPostingIds.length === 0) return { postings: 0, mutations };

  await tx.inventoryPosting.updateMany({
    where: { reversalOfId: { in: inventoryPostingIds } }, data: { reversalOfId: null },
  });
  const postings = (await tx.inventoryPosting.deleteMany({
    where: { id: { in: inventoryPostingIds } },
  })).count;
  return { postings, mutations };
}

export class MemberDestructionService {
  private readonly sessionCompletionService = new SessionCompletionService();
  private readonly sessionDeletionService = new SessionDeletionService();

  async preview(memberId: string): Promise<MemberDestructionPreview> {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        memberNo: true,
        isEmployee: true,
        user: { select: { role: true, profile: { select: { fullName: true } } } },
      },
    });
    if (!member) throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };

    const [sessions, packages, invoices, diagnoses, therapyPlans, labResults, documents, addOns, nonTherapyPurchases] = await Promise.all([
      prisma.treatmentSession.count({ where: { encounter: { memberId } } }),
      prisma.memberPackage.count({ where: { memberId } }),
      prisma.invoice.count({ where: { memberId } }),
      prisma.diagnosis.count({ where: { memberId } }),
      prisma.therapyPlan.count({ where: { memberId } }),
      prisma.labResult.count({ where: { memberId } }),
      prisma.memberDocument.count({ where: { memberId } }),
      prisma.memberAddOn.count({ where: { memberId } }),
      prisma.memberNonTherapyPurchase.count({ where: { memberId } }),
    ]);
    const blockers: DestructionBlocker[] = (member.isEmployee || member.user.role !== Role.MEMBER)
      ? [{
          code: 'STAFF_MEMBER_ACCOUNT',
          message: 'Member ini terhubung ke akun staff/employee dan tidak boleh dihapus melalui fitur ini.',
          count: 1,
        }]
      : [];
    return {
      member: {
        id: member.id,
        memberNo: member.memberNo,
        fullName: member.user.profile?.fullName || member.memberNo,
      },
      allowed: blockers.length === 0,
      confirmationPhrase: MEMBER_DESTRUCTION_CONFIRMATION,
      blockers,
      counts: { sessions, packages, invoices, diagnoses, therapyPlans, labResults, documents, addOns, nonTherapyPurchases },
    };
  }

  private async prepareAndDeleteSessions(memberId: string, actorUserId: string) {
    const sessions = await prisma.treatmentSession.findMany({
      where: { encounter: { memberId } },
      select: {
        id: true,
        isCompleted: true,
        completionStatus: true,
        materialPostingId: true,
        materialReversalPostingId: true,
        completionJournalEntryId: true,
        cancellationJournalEntryId: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const journalIds = new Set<string>();
    const inventoryPostingIds = new Set<string>();

    for (const session of sessions) {
      uniqueIds([session.completionJournalEntryId, session.cancellationJournalEntryId]).forEach((id) => journalIds.add(id));
      uniqueIds([session.materialPostingId, session.materialReversalPostingId]).forEach((id) => inventoryPostingIds.add(id));

      const needsReversal = session.isCompleted
        || session.completionStatus === TreatmentCompletionStatus.COMPLETED
        || session.completionStatus === TreatmentCompletionStatus.CANCELLED;
      if (needsReversal) {
        const reversed = await this.sessionCompletionService.cancelCompletion(session.id, actorUserId, {
          idempotencyKey: `MEMBER-DESTRUCTION-${memberId}-${session.id}`,
          reason: 'Hard destruction member oleh Super Admin',
          reopenForEditing: true,
        });
        if (reversed.inventoryReversalPostingId) inventoryPostingIds.add(reversed.inventoryReversalPostingId);
        if (reversed.cancellationJournalEntryId) journalIds.add(reversed.cancellationJournalEntryId);
      } else if (session.completionStatus !== TreatmentCompletionStatus.IN_PROGRESS) {
        await prisma.treatmentSession.update({
          where: { id: session.id },
          data: { isCompleted: false, completionStatus: TreatmentCompletionStatus.IN_PROGRESS },
        });
      }

      const sessionFinance = await prisma.$transaction(async (tx) => {
        const recognitions = await tx.revenueRecognition.findMany({
          where: { treatmentSessionId: session.id },
          select: { journalEntryId: true, domainEventId: true },
        });
        const movements = await tx.deferredRevenueMovement.findMany({
          where: { treatmentSessionId: session.id }, select: { journalEntryId: true },
        });
        const usageIds = (await tx.homecareBagUsage.findMany({
          where: { treatmentSessionId: session.id }, select: { id: true },
        })).map((item) => item.id);
        if (usageIds.length > 0) {
          await tx.homecareBagUsageItem.deleteMany({ where: { usageId: { in: usageIds } } });
        }
        await tx.homecareBagUsage.deleteMany({ where: { treatmentSessionId: session.id } });
        await tx.homecareMultiBagUsage.deleteMany({ where: { treatmentSessionId: session.id } });
        await tx.whatsAppDelivery.deleteMany({ where: { treatmentSessionId: session.id } });
        await tx.revenueRecognition.deleteMany({ where: { treatmentSessionId: session.id } });
        await tx.deferredRevenueMovement.deleteMany({ where: { treatmentSessionId: session.id } });
        await tx.domainEvent.deleteMany({
          where: {
            OR: [
              { treatmentSessionId: session.id },
              { id: { in: recognitions.map((item) => item.domainEventId) } },
            ],
          },
        });
        return uniqueIds([
          ...recognitions.map((item) => item.journalEntryId),
          ...movements.map((item) => item.journalEntryId),
        ]);
      });
      sessionFinance.forEach((id) => journalIds.add(id));
      await this.sessionDeletionService.deleteSession(session.id, actorUserId);
    }

    return {
      sessionIds: sessions.map((session) => session.id),
      journalIds: [...journalIds],
      inventoryPostingIds: [...inventoryPostingIds],
    };
  }

  async destroy(memberId: string, input: DestructionInput, actorUserId: string) {
    const preview = await this.preview(memberId);
    if (
      input.confirmation !== MEMBER_DESTRUCTION_CONFIRMATION
      || input.memberNo !== preview.member.memberNo
      || input.deleteFinancialAndInventory !== true
    ) {
      throw {
        status: 400,
        code: 'MEMBER_DESTRUCTION_CONFIRMATION_INVALID',
        message: 'Konfirmasi hard destruction atau nomor member tidak sesuai.',
      };
    }
    if (!preview.allowed) {
      throw {
        status: 409,
        code: 'MEMBER_DESTRUCTION_BLOCKED',
        message: 'Akun staff/employee tidak dapat dihancurkan melalui Destruction Member.',
        details: preview.blockers,
      };
    }

    const fileSnapshot = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        registrationBranchId: true,
        userId: true,
        user: { select: { profile: { select: { avatarUrl: true } } } },
        documents: { select: { fileUrl: true } },
        labResults: { select: { fileUrl: true } },
        memberPackages: { select: { paymentProofUrl: true, refundProofUrl: true } },
        memberAddOns: { select: { paymentProofUrl: true } },
        nonTherapyPurchases: { select: { paymentProofUrl: true } },
      },
    });
    if (!fileSnapshot) throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };

    const preparedSessions = await this.prepareAndDeleteSessions(memberId, actorUserId);
    const deleted = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "members" WHERE "id" = ${memberId} FOR UPDATE`);
      if (await tx.member.count({ where: { id: memberId } }) !== 1) {
        throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
      }

      const packageIds = (await tx.memberPackage.findMany({ where: { memberId }, select: { id: true } })).map((item) => item.id);
      const addOns = await tx.memberAddOn.findMany({ where: { memberId }, select: { id: true, inventoryPostingId: true } });
      const addOnIds = addOns.map((item) => item.id);
      const nonTherapyPurchaseIds = (await tx.memberNonTherapyPurchase.findMany({ where: { memberId }, select: { id: true } })).map((item) => item.id);
      const invoices = await tx.invoice.findMany({
        where: { memberId }, select: { id: true, payments: { select: { id: true } } },
      });
      const invoiceIds = invoices.map((item) => item.id);
      const paymentIds = invoices.flatMap((item) => item.payments.map((payment) => payment.id));
      const refunds = paymentIds.length > 0
        ? await tx.invoicePaymentRefund.findMany({
            where: { invoicePaymentId: { in: paymentIds } },
            select: { id: true, journalEntryId: true, cashBankTransactionId: true },
          })
        : [];
      const refundIds = refunds.map((item) => item.id);
      const sourceIds = uniqueIds([
        memberId,
        ...preparedSessions.sessionIds,
        ...packageIds,
        ...addOnIds,
        ...nonTherapyPurchaseIds,
        ...invoiceIds,
        ...paymentIds,
        ...refundIds,
      ]);

      for (const addOn of addOns) {
        if (addOn.inventoryPostingId) {
          await returnAddOnStockInTransaction(addOn.id, actorUserId, 'Hard destruction member oleh Super Admin', new Date(), tx);
        }
        await releaseAddOnStockInTransaction(addOn.id, actorUserId, 'MEMBER_HARD_DESTRUCTION', tx);
      }

      const revenueRecognitions = packageIds.length > 0
        ? await tx.revenueRecognition.findMany({
            where: { memberPackageId: { in: packageIds } },
            select: { journalEntryId: true, domainEventId: true },
          })
        : [];
      const deferredMovements = packageIds.length > 0
        ? await tx.deferredRevenueMovement.findMany({
            where: { memberPackageId: { in: packageIds } }, select: { journalEntryId: true },
          })
        : [];
      const cashOr: Prisma.CashBankTransactionWhereInput[] = [
        ...(paymentIds.length > 0 ? [{ invoicePaymentId: { in: paymentIds } }] : []),
        ...(sourceIds.length > 0 ? [{ sourceId: { in: sourceIds } }] : []),
        ...(refunds.length > 0 ? [{ id: { in: refunds.map((item) => item.cashBankTransactionId) } }] : []),
      ];
      const cashTransactions = cashOr.length > 0
        ? await tx.cashBankTransaction.findMany({ where: { OR: cashOr }, select: { id: true, journalEntryId: true } })
        : [];
      const sourceJournals = sourceIds.length > 0
        ? await tx.journalSourceLink.findMany({ where: { sourceId: { in: sourceIds } }, select: { journalEntryId: true } })
        : [];
      const journalIds = uniqueIds([
        ...preparedSessions.journalIds,
        ...refunds.map((item) => item.journalEntryId),
        ...revenueRecognitions.map((item) => item.journalEntryId),
        ...deferredMovements.map((item) => item.journalEntryId),
        ...cashTransactions.map((item) => item.journalEntryId),
        ...sourceJournals.map((item) => item.journalEntryId),
      ]);

      const knownPostingIds = uniqueIds([
        ...preparedSessions.inventoryPostingIds,
        ...addOns.map((item) => item.inventoryPostingId),
      ]);
      const postingOr: Prisma.InventoryPostingWhereInput[] = [
        ...(sourceIds.length > 0 ? [{ sourceId: { in: sourceIds } }] : []),
        ...(knownPostingIds.length > 0 ? [{ id: { in: knownPostingIds } }] : []),
      ];
      const sourcePostings = postingOr.length > 0
        ? await tx.inventoryPosting.findMany({ where: { OR: postingOr }, select: { id: true } })
        : [];
      const inventoryPostingIds = uniqueIds([
        ...knownPostingIds,
        ...sourcePostings.map((item) => item.id),
      ]);

      await tx.integrationEvent.deleteMany({
        where: {
          OR: [
            { aggregateId: { in: sourceIds } },
            ...preparedSessions.sessionIds.map((sessionId) => ({ aggregateId: { startsWith: sessionId } })),
          ],
        },
      });
      await tx.zohoMappingReview.deleteMany({ where: { localEntityId: { in: sourceIds } } });
      await tx.zohoEntityMapping.deleteMany({ where: { localEntityId: { in: sourceIds } } });
      await tx.auditLog.deleteMany({
        where: { OR: [{ resourceId: { in: sourceIds } }, { entityId: { in: sourceIds } }] },
      });

      await tx.revenueRecognition.deleteMany({ where: { memberPackageId: { in: packageIds } } });
      await tx.deferredRevenueMovement.deleteMany({ where: { memberPackageId: { in: packageIds } } });
      await tx.domainEvent.deleteMany({ where: { id: { in: revenueRecognitions.map((item) => item.domainEventId) } } });
      await tx.invoicePaymentRefund.deleteMany({ where: { id: { in: refundIds } } });
      await tx.cashBankTransaction.deleteMany({ where: { id: { in: cashTransactions.map((item) => item.id) } } });
      await tx.invoice.deleteMany({ where: { memberId } });

      await tx.addOnStockReservation.deleteMany({ where: { memberAddOnId: { in: addOnIds } } });
      await tx.memberAddOn.deleteMany({ where: { memberId } });
      await tx.memberNonTherapyPurchase.deleteMany({ where: { memberId } });
      await tx.referralIncentiveRecord.deleteMany({ where: { memberId } });
      if (packageIds.length > 0) {
        await tx.memberPackage.updateMany({ where: { upgradedFromId: { in: packageIds } }, data: { upgradedFromId: null } });
        await tx.packageRevenueContract.deleteMany({ where: { memberPackageId: { in: packageIds } } });
        await tx.packageBenefitValuation.deleteMany({ where: { memberPackageId: { in: packageIds } } });
        await tx.memberPackage.deleteMany({ where: { id: { in: packageIds } } });
      }

      const socialRequests = await tx.socialProgramRequest.findMany({
        where: { memberId }, select: { id: true, approvalInstanceId: true },
      });
      const approvalInstanceIds = uniqueIds(socialRequests.map((item) => item.approvalInstanceId));
      await tx.socialProgramRequest.updateMany({ where: { memberId }, data: { approvalInstanceId: null } });
      await tx.socialProgramRequest.deleteMany({ where: { memberId } });
      await tx.approvalDecision.deleteMany({ where: { approvalInstanceId: { in: approvalInstanceIds } } });
      await tx.approvalAuditLog.deleteMany({ where: { approvalInstanceId: { in: approvalInstanceIds } } });
      await tx.approvalInstance.deleteMany({ where: { id: { in: approvalInstanceIds } } });

      await tx.whatsAppDelivery.deleteMany({ where: { memberId } });
      await tx.diagnosis.deleteMany({ where: { memberId } });
      await tx.labResult.deleteMany({ where: { memberId } });
      await tx.memberDocument.deleteMany({ where: { memberId } });
      const planSetIds = (await tx.therapyPlanSet.findMany({ where: { memberId }, select: { id: true } })).map((item) => item.id);
      const planIds = (await tx.therapyPlan.findMany({
        where: planSetIds.length > 0 ? { OR: [{ memberId }, { therapyPlanSetId: { in: planSetIds } }] } : { memberId },
        select: { id: true },
      })).map((item) => item.id);
      await tx.therapyPlan.updateMany({ where: { supersededById: { in: planIds } }, data: { supersededById: null } });
      await tx.therapyPlan.deleteMany({ where: { id: { in: planIds } } });
      await tx.therapyPlanSet.updateMany({ where: { supersededById: { in: planSetIds } }, data: { supersededById: null } });
      await tx.therapyPlanSet.deleteMany({ where: { id: { in: planSetIds } } });

      await tx.encounter.deleteMany({ where: { memberId } });
      await tx.memberCommunicationConsent.deleteMany({ where: { memberId } });
      await tx.branchMemberAccess.deleteMany({ where: { memberId } });
      await tx.chatMessage.deleteMany({ where: { OR: [{ chatRoom: { memberId } }, { senderId: fileSnapshot.userId }] } });
      await tx.chatRoom.deleteMany({ where: { memberId } });
      await tx.campaignVoucher.updateMany({
        where: { recipientMemberId: memberId },
        data: {
          recipientMemberId: null,
          recipientNameSnapshot: null,
          recipientNikHash: null,
          recipientDateOfBirth: null,
          nikLast4: null,
        },
      });

      const inventory = await deleteInventoryGraph(tx, inventoryPostingIds, sourceIds);
      const journals = await deleteJournalGraph(tx, journalIds);
      await tx.member.delete({ where: { id: memberId } });
      await tx.notification.deleteMany({ where: { userId: fileSnapshot.userId } });
      await tx.userProfile.deleteMany({ where: { userId: fileSnapshot.userId } });
      await tx.user.delete({ where: { id: fileSnapshot.userId } });

      return {
        sessions: preparedSessions.sessionIds.length,
        packages: packageIds.length,
        invoices: invoiceIds.length,
        payments: paymentIds.length,
        refunds: refundIds.length,
        addOns: addOnIds.length,
        nonTherapyPurchases: nonTherapyPurchaseIds.length,
        journals,
        inventoryPostings: inventory.postings,
        stockMutations: inventory.mutations,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 120_000,
    });

    const files = await deleteFiles([
      fileSnapshot.user.profile?.avatarUrl,
      ...fileSnapshot.documents.map((item) => item.fileUrl),
      ...fileSnapshot.labResults.map((item) => item.fileUrl),
      ...fileSnapshot.memberPackages.flatMap((item) => [item.paymentProofUrl, item.refundProofUrl]),
      ...fileSnapshot.memberAddOns.map((item) => item.paymentProofUrl),
      ...fileSnapshot.nonTherapyPurchases.map((item) => item.paymentProofUrl),
    ]);
    await logAudit({
      userId: actorUserId,
      branchId: fileSnapshot.registrationBranchId,
      action: AuditAction.DELETE,
      resource: 'Member',
      resourceId: memberId,
      description: 'Hard destruction member selesai',
      meta: { action: 'MEMBER_HARD_DESTRUCTION', deleted, files },
    });
    return {
      message: 'Destruction Member berhasil. Data member, keuangan, dan inventory terkait telah dihapus permanen.',
      memberId,
      deleted,
      files,
    };
  }
}
