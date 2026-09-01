import { AuditAction, Prisma, Role, TreatmentCompletionStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { deleteFileByUrl } from '../../../config/minio';
import { logAudit } from '../../../utils/auditLog';
import { releaseAddOnStockInTransaction } from '../../packages/services/add-on-inventory.service';
import { SessionDeletionService } from '../../sessions/services/session-deletion.service';

export const MEMBER_DESTRUCTION_CONFIRMATION = 'DESTRUCTION MEMBER';

type DestructionBlocker = {
  code: string;
  message: string;
  count: number;
};

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
};

function blocker(code: string, message: string, count: number): DestructionBlocker | null {
  return count > 0 ? { code, message, count } : null;
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

export class MemberDestructionService {
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
    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    const sessions = await prisma.treatmentSession.findMany({
      where: { encounter: { memberId } },
      select: { id: true, isCompleted: true, completionStatus: true },
    });
    const sessionIds = sessions.map((session) => session.id);

    const [
      packages,
      paidPackages,
      invoices,
      finalizedInvoices,
      invoicePayments,
      diagnoses,
      therapyPlans,
      labResults,
      documents,
      addOns,
      postedAddOns,
      nonTherapyPurchases,
      paidNonTherapyPurchases,
      revenueRecognitions,
      deferredRevenueMovements,
      homecareUsages,
      homecareMultiBagUsages,
    ] = await Promise.all([
      prisma.memberPackage.count({ where: { memberId } }),
      prisma.memberPackage.count({
        where: {
          memberId,
          OR: [
            { totalVerifiedPaid: { gt: 0 } },
            { paidAt: { not: null } },
            { verifiedAt: { not: null } },
            { refundedAt: { not: null } },
          ],
        },
      }),
      prisma.invoice.count({ where: { memberId } }),
      prisma.invoice.count({
        where: { memberId, status: { notIn: ['DRAFT', 'PENDING_PAYMENT'] } },
      }),
      prisma.invoicePayment.count({ where: { invoice: { memberId } } }),
      prisma.diagnosis.count({ where: { memberId } }),
      prisma.therapyPlan.count({ where: { memberId } }),
      prisma.labResult.count({ where: { memberId } }),
      prisma.memberDocument.count({ where: { memberId } }),
      prisma.memberAddOn.count({ where: { memberId } }),
      prisma.memberAddOn.count({
        where: {
          memberId,
          OR: [
            { inventoryPostingId: { not: null } },
            { paidAt: { not: null } },
            { verifiedAt: { not: null } },
          ],
        },
      }),
      prisma.memberNonTherapyPurchase.count({ where: { memberId } }),
      prisma.memberNonTherapyPurchase.count({
        where: { memberId, OR: [{ paidAt: { not: null } }, { verifiedAt: { not: null } }] },
      }),
      prisma.revenueRecognition.count({ where: { memberPackage: { memberId } } }),
      prisma.deferredRevenueMovement.count({ where: { memberPackage: { memberId } } }),
      sessionIds.length > 0
        ? prisma.homecareBagUsage.count({ where: { treatmentSessionId: { in: sessionIds } } })
        : Promise.resolve(0),
      sessionIds.length > 0
        ? prisma.homecareMultiBagUsage.count({ where: { treatmentSessionId: { in: sessionIds } } })
        : Promise.resolve(0),
    ]);

    const finalizedSessions = sessions.filter(
      (session) => session.isCompleted || session.completionStatus !== TreatmentCompletionStatus.IN_PROGRESS,
    ).length;
    const blockers = [
      member.isEmployee || member.user.role !== Role.MEMBER
        ? {
            code: 'STAFF_MEMBER_ACCOUNT',
            message: 'Member ini terhubung ke akun staff/employee dan tidak boleh dihapus melalui fitur ini.',
            count: 1,
          }
        : null,
      blocker(
        'FINALIZED_SESSION_EXISTS',
        'Ada sesi terapi yang sudah selesai/diposting. Gunakan pembatalan sesi dan reversal terlebih dahulu.',
        finalizedSessions,
      ),
      blocker(
        'PAID_PACKAGE_EXISTS',
        'Ada paket yang sudah dibayar, diverifikasi, atau direfund.',
        paidPackages,
      ),
      blocker(
        'FINALIZED_INVOICE_EXISTS',
        'Ada invoice dengan status final. Hanya invoice draft/pending yang dapat dihapus.',
        finalizedInvoices,
      ),
      blocker(
        'VERIFIED_PAYMENT_EXISTS',
        'Ada pembayaran invoice. Riwayat keuangan yang sudah tercatat tidak boleh dihapus.',
        invoicePayments,
      ),
      blocker(
        'REVENUE_LEDGER_EXISTS',
        'Ada pengakuan atau pergerakan pendapatan yang sudah tercatat.',
        revenueRecognitions + deferredRevenueMovements,
      ),
      blocker(
        'POSTED_ADD_ON_EXISTS',
        'Ada add-on yang sudah dibayar atau diposting ke inventory.',
        postedAddOns,
      ),
      blocker(
        'PAID_NON_THERAPY_EXISTS',
        'Ada pembelian non-terapi yang sudah dibayar atau diverifikasi.',
        paidNonTherapyPurchases,
      ),
      blocker(
        'HOMECARE_USAGE_EXISTS',
        'Ada pemakaian tas homecare yang terkait dengan sesi member.',
        homecareUsages + homecareMultiBagUsages,
      ),
    ].filter((item): item is DestructionBlocker => item !== null);

    return {
      member: {
        id: member.id,
        memberNo: member.memberNo,
        fullName: member.user.profile?.fullName || member.memberNo,
      },
      allowed: blockers.length === 0,
      confirmationPhrase: MEMBER_DESTRUCTION_CONFIRMATION,
      blockers,
      counts: {
        sessions: sessions.length,
        packages,
        invoices,
        diagnoses,
        therapyPlans,
        labResults,
        documents,
        addOns,
        nonTherapyPurchases,
      },
    };
  }

  async destroy(memberId: string, input: DestructionInput, actorUserId: string) {
    const preview = await this.preview(memberId);
    if (input.confirmation !== MEMBER_DESTRUCTION_CONFIRMATION || input.memberNo !== preview.member.memberNo) {
      throw {
        status: 400,
        code: 'MEMBER_DESTRUCTION_CONFIRMATION_INVALID',
        message: 'Frasa konfirmasi atau nomor member tidak sesuai.',
      };
    }
    if (!preview.allowed) {
      throw {
        status: 409,
        code: 'MEMBER_DESTRUCTION_BLOCKED',
        message: 'Destruction Member diblokir karena masih ada data final/immutable.',
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
    if (!fileSnapshot) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    const draftSessions = await prisma.treatmentSession.findMany({
      where: { encounter: { memberId } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const session of draftSessions) {
      await this.sessionDeletionService.deleteSession(session.id, actorUserId);
    }

    const deleted = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "members" WHERE "id" = ${memberId} FOR UPDATE
      `);
      const remainingSessions = await tx.treatmentSession.count({
        where: { encounter: { memberId } },
      });
      const paymentCount = await tx.invoicePayment.count({ where: { invoice: { memberId } } });
      const ledgerCount = (await tx.revenueRecognition.count({ where: { memberPackage: { memberId } } }))
        + (await tx.deferredRevenueMovement.count({ where: { memberPackage: { memberId } } }));
      const immutableCommerceCount =
        (await tx.memberPackage.count({
          where: {
            memberId,
            OR: [
              { totalVerifiedPaid: { gt: 0 } },
              { paidAt: { not: null } },
              { verifiedAt: { not: null } },
              { refundedAt: { not: null } },
            ],
          },
        }))
        + (await tx.invoice.count({
          where: { memberId, status: { notIn: ['DRAFT', 'PENDING_PAYMENT'] } },
        }))
        + (await tx.memberAddOn.count({
          where: {
            memberId,
            OR: [
              { inventoryPostingId: { not: null } },
              { paidAt: { not: null } },
              { verifiedAt: { not: null } },
            ],
          },
        }))
        + (await tx.memberNonTherapyPurchase.count({
          where: { memberId, OR: [{ paidAt: { not: null } }, { verifiedAt: { not: null } }] },
        }));
      if (remainingSessions > 0 || paymentCount > 0 || ledgerCount > 0 || immutableCommerceCount > 0) {
        throw {
          status: 409,
          code: 'MEMBER_DESTRUCTION_STATE_CHANGED',
          message: 'Data member berubah saat proses berjalan. Muat ulang preview sebelum mencoba lagi.',
        };
      }

      const addOns = await tx.memberAddOn.findMany({ where: { memberId }, select: { id: true } });
      for (const addOn of addOns) {
        await releaseAddOnStockInTransaction(
          addOn.id,
          actorUserId,
          'DESTRUCTION_MEMBER',
          tx,
        );
      }
      if (addOns.length > 0) {
        await tx.addOnStockReservation.deleteMany({
          where: { memberAddOnId: { in: addOns.map((item) => item.id) } },
        });
      }

      const socialRequests = await tx.socialProgramRequest.findMany({
        where: { memberId },
        select: { id: true, approvalInstanceId: true },
      });
      const approvalInstanceIds = socialRequests
        .map((request) => request.approvalInstanceId)
        .filter((id): id is string => Boolean(id));

      await tx.whatsAppDelivery.deleteMany({ where: { memberId } });
      await tx.diagnosis.deleteMany({ where: { memberId } });
      await tx.labResult.deleteMany({ where: { memberId } });
      await tx.memberDocument.deleteMany({ where: { memberId } });

      const planSets = await tx.therapyPlanSet.findMany({ where: { memberId }, select: { id: true } });
      const planSetIds = planSets.map((set) => set.id);
      const plans = await tx.therapyPlan.findMany({
        where: planSetIds.length > 0
          ? { OR: [{ memberId }, { therapyPlanSetId: { in: planSetIds } }] }
          : { memberId },
        select: { id: true },
      });
      const planIds = plans.map((plan) => plan.id);
      if (planIds.length > 0) {
        await tx.therapyPlan.updateMany({
          where: { supersededById: { in: planIds } },
          data: { supersededById: null },
        });
        await tx.therapyPlan.deleteMany({ where: { id: { in: planIds } } });
      }
      if (planSetIds.length > 0) {
        await tx.therapyPlanSet.updateMany({
          where: { supersededById: { in: planSetIds } },
          data: { supersededById: null },
        });
        await tx.therapyPlanSet.deleteMany({ where: { id: { in: planSetIds } } });
      }

      await tx.encounter.deleteMany({ where: { memberId } });
      await tx.referralIncentiveRecord.deleteMany({ where: { memberId } });
      await tx.invoice.deleteMany({ where: { memberId } });
      await tx.memberNonTherapyPurchase.deleteMany({ where: { memberId } });
      await tx.memberAddOn.deleteMany({ where: { memberId } });

      const packages = await tx.memberPackage.findMany({ where: { memberId }, select: { id: true } });
      const packageIds = packages.map((pkg) => pkg.id);
      if (packageIds.length > 0) {
        await tx.memberPackage.updateMany({
          where: { upgradedFromId: { in: packageIds } },
          data: { upgradedFromId: null },
        });
        await tx.packageRevenueContract.deleteMany({ where: { memberPackageId: { in: packageIds } } });
        await tx.packageBenefitValuation.deleteMany({ where: { memberPackageId: { in: packageIds } } });
        await tx.memberPackage.deleteMany({ where: { id: { in: packageIds } } });
      }

      if (approvalInstanceIds.length > 0) {
        await tx.socialProgramRequest.updateMany({
          where: { id: { in: socialRequests.map((request) => request.id) } },
          data: { approvalInstanceId: null },
        });
      }
      await tx.socialProgramRequest.deleteMany({ where: { memberId } });
      if (approvalInstanceIds.length > 0) {
        await tx.approvalDecision.deleteMany({ where: { approvalInstanceId: { in: approvalInstanceIds } } });
        await tx.approvalAuditLog.deleteMany({ where: { approvalInstanceId: { in: approvalInstanceIds } } });
        await tx.approvalInstance.deleteMany({ where: { id: { in: approvalInstanceIds } } });
      }

      await tx.memberCommunicationConsent.deleteMany({ where: { memberId } });
      await tx.branchMemberAccess.deleteMany({ where: { memberId } });
      await tx.chatMessage.deleteMany({
        where: { OR: [{ chatRoom: { memberId } }, { senderId: fileSnapshot.userId }] },
      });
      await tx.chatRoom.deleteMany({ where: { memberId } });
      await tx.zohoMappingReview.deleteMany({ where: { entityType: 'MEMBER', localEntityId: memberId } });
      await tx.zohoEntityMapping.deleteMany({ where: { entityType: 'MEMBER', localEntityId: memberId } });
      await tx.integrationEvent.deleteMany({ where: { aggregateType: 'Member', aggregateId: memberId } });
      await tx.member.delete({ where: { id: memberId } });
      await tx.notification.deleteMany({ where: { userId: fileSnapshot.userId } });
      await tx.userProfile.deleteMany({ where: { userId: fileSnapshot.userId } });
      await tx.user.delete({ where: { id: fileSnapshot.userId } });

      return {
        sessions: draftSessions.length,
        packages: packageIds.length,
        invoices: preview.counts.invoices,
        documents: preview.counts.documents,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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
      entityCode: preview.member.memberNo,
      description: `Destruction Member ${preview.member.memberNo}`,
      beforeData: { memberNo: preview.member.memberNo, fullName: preview.member.fullName },
      meta: { action: 'DESTRUCTION_MEMBER', deleted, files },
    });

    return {
      message: 'Destruction Member berhasil. Seluruh data member yang dapat dihapus telah dihapus permanen.',
      memberId,
      memberNo: preview.member.memberNo,
      deleted,
      files,
    };
  }
}
