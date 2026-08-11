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

type StockRollbackMutation = {
  inventoryItemId: string;
  stockBefore: unknown;
  stockAfter: unknown;
};

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
    const session = await prisma.treatmentSession.findUnique({
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

    const stockMutations = await prisma.stockMutation.findMany({
      where: {
        OR: stockReferenceFilters,
      },
      select: {
        inventoryItemId: true,
        stockBefore: true,
        stockAfter: true,
      },
    });

    // Revert the net stock impact, not merely every USED row. Therapy-plan edits can
    // create ADJUSTMENT rows that already returned part of the original usage.
    const rollbackQuantities = this.groupNetUsedQuantities(stockMutations);

    const result = await prisma.$transaction(async (tx) => {
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

      const basicVoucherRestored = await this.releasePackageUsage(
        tx,
        session.encounter.memberPackage.id,
      );
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
        restoredStockItems,
        restoredStockQuantity,
        basicVoucherRestored,
        boosterVoucherRestored,
      };
    });

    await logAudit({
      userId: deletedBy,
      branchId: session.branchId,
      action: AuditAction.DELETE,
      resource: 'TreatmentSession',
      resourceId: sessionId,
      entityCode: session.sessionCode,
      description: `Hapus sesi terapi ${session.sessionCode}`,
      beforeData: {
        sessionId,
        sessionCode: session.sessionCode,
        branchId: session.branchId,
        branchName: session.branch.name,
        memberId: session.encounter.memberId,
        memberName: session.encounter.member.user.profile?.fullName,
        treatmentDate: session.treatmentDate,
        isCompleted: session.isCompleted,
        therapyPlanId: session.therapyPlan?.id,
      },
      meta: {
        action: 'DELETE_THERAPY_SESSION',
        restoredStockItems: result.restoredStockItems,
        restoredStockQuantity: result.restoredStockQuantity,
        restoredBasicVoucher: result.basicVoucherRestored,
        restoredBoosterVoucher: result.boosterVoucherRestored,
        rolledBackStockMutations: stockMutations.length,
      },
    });

    return {
      sessionId,
      sessionCode: session.sessionCode,
      restoredStockItems: result.restoredStockItems,
      restoredStockQuantity: result.restoredStockQuantity,
      restoredVouchers: {
        basic: 1,
        booster: session.boosterPackage ? 1 : 0,
      },
      message: 'Sesi terapi berhasil dihapus dan seluruh voucher serta stoknya dikembalikan',
    };
  }
}
