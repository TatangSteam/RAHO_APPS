import { AuditAction, PackageStatus, StockMutationType } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { syncMemberVoucherUsageCount } from './voucher-usage-counter';

type StockRollbackMutation = {
  inventoryItemId: string;
  quantity: unknown;
};

export class SessionDeletionService {
  private groupUsedQuantities(mutations: StockRollbackMutation[]) {
    return mutations.reduce<Map<string, number>>((grouped, mutation) => {
      const quantity = Number(mutation.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) return grouped;

      grouped.set(
        mutation.inventoryItemId,
        (grouped.get(mutation.inventoryItemId) || 0) + quantity
      );
      return grouped;
    }, new Map<string, number>());
  }

  private async releasePackageUsage(tx: any, memberPackage: any) {
    const usedSessions = Math.max(0, memberPackage.usedSessions - 1);
    await tx.memberPackage.update({
      where: { id: memberPackage.id },
      data: {
        usedSessions,
        status:
          memberPackage.status === PackageStatus.EXPIRED &&
          usedSessions < memberPackage.totalSessions
            ? PackageStatus.ACTIVE
            : memberPackage.status,
        expiredAt:
          memberPackage.status === PackageStatus.EXPIRED &&
          usedSessions < memberPackage.totalSessions
            ? null
            : memberPackage.expiredAt,
      },
    });
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

    const usedMutations = await prisma.stockMutation.findMany({
      where: {
        type: StockMutationType.USED,
        OR: stockReferenceFilters,
      },
      select: {
        inventoryItemId: true,
        quantity: true,
      },
    });

    const rollbackQuantities = this.groupUsedQuantities(usedMutations);

    const result = await prisma.$transaction(async (tx) => {
      let restoredStockItems = 0;

      for (const [inventoryItemId, quantity] of rollbackQuantities.entries()) {
        const inventoryItem = await tx.inventoryItem.findUnique({
          where: { id: inventoryItemId },
          select: { id: true, stock: true },
        });

        if (!inventoryItem) continue;

        const stockBefore = Number(inventoryItem.stock);
        const stockAfter = stockBefore + quantity;

        await tx.inventoryItem.update({
          where: { id: inventoryItemId },
          data: { stock: stockAfter },
        });

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
      }

      await this.releasePackageUsage(tx, session.encounter.memberPackage);
      if (session.boosterPackage) {
        await this.releasePackageUsage(tx, session.boosterPackage);
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

      return { restoredStockItems };
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
        rolledBackStockMutations: usedMutations.length,
      },
    });

    return {
      sessionId,
      sessionCode: session.sessionCode,
      restoredStockItems: result.restoredStockItems,
      message: 'Sesi terapi berhasil dihapus',
    };
  }
}
