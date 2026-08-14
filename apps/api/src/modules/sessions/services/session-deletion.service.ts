import {
  AuditAction,
  PackageStatus,
  Prisma,
  StockMutationType,
  TreatmentCompletionStatus,
} from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { syncMemberVoucherUsageCount } from './voucher-usage-counter';
import { cleanupDeletedSessionFiles } from './session-file-cleanup';

type StockRollbackMutation = {
  inventoryItemId: string;
  stockBefore: unknown;
  stockAfter: unknown;
};

const MAX_DELETION_ATTEMPTS = 3;

function isRetryableTransactionError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';
  const message = error instanceof Error ? error.message : String(error);
  return code === 'P2034' || /40001|40P01|serialization|deadlock/i.test(message);
}

async function withDeletionRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_DELETION_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === MAX_DELETION_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 15 * attempt));
    }
  }
  throw lastError;
}

export class SessionDeletionService {
  private groupNetUsedQuantities(mutations: StockRollbackMutation[]) {
    return mutations.reduce<Map<string, number>>((grouped, mutation) => {
      const stockBefore = Number(mutation.stockBefore);
      const stockAfter = Number(mutation.stockAfter);
      const netUsedQuantity = stockBefore - stockAfter;
      if (!Number.isFinite(netUsedQuantity) || netUsedQuantity === 0) return grouped;

      grouped.set(
        mutation.inventoryItemId,
        (grouped.get(mutation.inventoryItemId) || 0) + netUsedQuantity
      );
      return grouped;
    }, new Map<string, number>());
  }

  private async releasePackageUsage(
    tx: Prisma.TransactionClient,
    memberPackageId: string,
  ) {
    const released = await tx.memberPackage.updateMany({
      where: { id: memberPackageId, usedSessions: { gt: 0 } },
      data: { usedSessions: { decrement: 1 } },
    });

    const memberPackage = await tx.memberPackage.findUnique({
      where: { id: memberPackageId },
      select: { status: true, usedSessions: true, totalSessions: true },
    });

    if (
      memberPackage?.status === PackageStatus.EXPIRED &&
      memberPackage.usedSessions < memberPackage.totalSessions
    ) {
      await tx.memberPackage.update({
        where: { id: memberPackageId },
        data: { status: PackageStatus.ACTIVE, expiredAt: null },
      });
    }

    return released.count > 0;
  }

  async deleteSession(sessionId: string, deletedBy: string) {
    const result = await withDeletionRetry(() => prisma.$transaction(async (tx) => {
      // Lock before reading any package or inventory state. Concurrent booster,
      // infusion, or session edits must finish before this snapshot is built.
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "treatment_sessions"
        WHERE "id" = ${sessionId}
        FOR UPDATE
      `);

      const session = await tx.treatmentSession.findUnique({
        where: { id: sessionId },
        include: {
          encounter: {
            include: {
              member: {
                include: {
                  user: { include: { profile: true } },
                },
              },
              memberPackage: true,
            },
          },
          boosterPackage: true,
          branch: true,
          infusion: { select: { id: true } },
          materials: { select: { id: true } },
          therapyPlan: { select: { id: true, planCode: true } },
          photo: { select: { fileUrl: true } },
          supportingPhotos: { select: { fileUrl: true } },
        },
      });

      if (!session) {
        throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
      }
      if (session.isCompleted || session.completionStatus !== TreatmentCompletionStatus.IN_PROGRESS) {
        throw {
          status: 409,
          code: 'POSTED_SESSION_IMMUTABLE',
          message: 'Sesi yang sudah diposting tidak dapat dihapus. Gunakan workflow pembatalan completion untuk membuat reversal.',
        };
      }

      const materialUsageIds = session.materials.map((material) => material.id);
      const stockReferenceFilters = [
        { referenceType: 'TreatmentSession', referenceId: sessionId },
        ...(session.infusion
          ? [{ referenceType: 'InfusionExecution', referenceId: session.infusion.id }]
          : []),
        ...(materialUsageIds.length > 0
          ? [{ referenceType: 'MaterialUsage', referenceId: { in: materialUsageIds } }]
          : []),
      ];
      const stockMutations = await tx.stockMutation.findMany({
        where: { OR: stockReferenceFilters },
        select: {
          inventoryItemId: true,
          stockBefore: true,
          stockAfter: true,
        },
      });

      // Revert the net stock impact, not merely every USED row. Therapy-plan edits can
      // create ADJUSTMENT rows that already returned part of the original usage.
      const rollbackQuantities = this.groupNetUsedQuantities(stockMutations);
      let restoredStockItems = 0;
      let restoredStockQuantity = 0;

      for (const [inventoryItemId, quantity] of rollbackQuantities.entries()) {
        if (quantity <= 0) continue;

        const inventoryItem = await tx.inventoryItem.update({
          where: { id: inventoryItemId },
          data: { stock: { increment: quantity } },
          select: { stock: true },
        });
        const stockAfter = Number(inventoryItem.stock);
        const stockBefore = stockAfter - quantity;

        await tx.stockMutation.create({
          data: {
            inventoryItemId,
            type: StockMutationType.ADJUSTMENT,
            quantity,
            stockBefore,
            stockAfter,
            referenceType: 'TreatmentSession',
            referenceId: sessionId,
            notes: `Rollback stok karena sesi ${session.sessionCode} dihapus`,
            createdBy: deletedBy,
          },
        });

        restoredStockItems += 1;
        restoredStockQuantity += quantity;
      }

      const basicVoucherRestored = session.encounter.memberPackage
        ? await this.releasePackageUsage(tx, session.encounter.memberPackage.id)
        : false;
      let boosterVoucherRestored = false;
      if (session.boosterPackage) {
        boosterVoucherRestored = await this.releasePackageUsage(tx, session.boosterPackage.id);
      }

      const evaluations = await tx.doctorEvaluation.findMany({
        where: { treatmentSessionId: sessionId },
        select: { id: true },
      });
      const evaluationIds = evaluations.map((evaluation) => evaluation.id);

      if (evaluationIds.length > 0) {
        await tx.doctorEvaluationHistory.deleteMany({
          where: { evaluationId: { in: evaluationIds } },
        });
      }

      await tx.vitalSign.deleteMany({ where: { treatmentSessionId: sessionId } });
      await tx.materialUsage.deleteMany({ where: { treatmentSessionId: sessionId } });
      await tx.infusionExecution.deleteMany({ where: { treatmentSessionId: sessionId } });
      await tx.sessionPhoto.deleteMany({ where: { treatmentSessionId: sessionId } });
      await tx.sessionSupportingPhoto.deleteMany({ where: { treatmentSessionId: sessionId } });
      await tx.eMRNote.deleteMany({ where: { treatmentSessionId: sessionId } });
      await tx.doctorEvaluation.deleteMany({ where: { treatmentSessionId: sessionId } });
      await tx.sessionDoctor.deleteMany({ where: { sessionId } });
      await tx.sessionNurse.deleteMany({ where: { sessionId } });
      await tx.therapyPlan.updateMany({
        where: { treatmentSessionId: sessionId },
        data: { treatmentSessionId: null },
      });

      await tx.treatmentSession.delete({ where: { id: sessionId } });
      await syncMemberVoucherUsageCount(tx, session.encounter.memberId);

      return {
        session: {
          sessionCode: session.sessionCode,
          branchId: session.branchId,
          branchName: session.branch.name,
          memberId: session.encounter.memberId,
          memberName: session.encounter.member.user.profile?.fullName,
          treatmentDate: session.treatmentDate,
          isCompleted: session.isCompleted,
          therapyPlanId: session.therapyPlan?.id,
          hadBooster: Boolean(session.boosterPackage),
        },
        fileUrls: [
          session.photo?.fileUrl,
          ...session.supportingPhotos.map((photo) => photo.fileUrl),
        ],
        restoredStockItems,
        restoredStockQuantity,
        basicVoucherRestored,
        boosterVoucherRestored,
        rolledBackStockMutations: stockMutations.length,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

    // Storage is not transactional with PostgreSQL. Clean files only after the DB
    // commit so a storage outage cannot leave live DB records pointing to missing files.
    const fileCleanup = await cleanupDeletedSessionFiles(result.fileUrls);

    await logAudit({
      userId: deletedBy,
      branchId: result.session.branchId,
      action: AuditAction.DELETE,
      resource: 'TreatmentSession',
      resourceId: sessionId,
      entityCode: result.session.sessionCode,
      description: `Hapus sesi terapi ${result.session.sessionCode}`,
      beforeData: {
        sessionId,
        sessionCode: result.session.sessionCode,
        branchId: result.session.branchId,
        branchName: result.session.branchName,
        memberId: result.session.memberId,
        memberName: result.session.memberName,
        treatmentDate: result.session.treatmentDate,
        isCompleted: result.session.isCompleted,
        therapyPlanId: result.session.therapyPlanId,
      },
      meta: {
        action: 'DELETE_THERAPY_SESSION',
        restoredStockItems: result.restoredStockItems,
        restoredStockQuantity: result.restoredStockQuantity,
        restoredBasicVoucher: result.basicVoucherRestored,
        restoredBoosterVoucher: result.boosterVoucherRestored,
        rolledBackStockMutations: result.rolledBackStockMutations,
        sessionFilesFound: fileCleanup.requested,
        localSessionFilesDeleted: fileCleanup.localDeleted,
        failedSessionFileCleanups: fileCleanup.failedUrls.length,
      },
    });

    return {
      sessionId,
      sessionCode: result.session.sessionCode,
      restoredStockItems: result.restoredStockItems,
      restoredStockQuantity: result.restoredStockQuantity,
      restoredVouchers: {
        basic: 1,
        booster: result.session.hadBooster ? 1 : 0,
      },
      message: 'Sesi terapi berhasil dihapus dan seluruh voucher serta stoknya dikembalikan',
    };
  }
}
