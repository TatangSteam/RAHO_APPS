import {
  AuditAction,
  IntegrationEventStatus,
  MaterialUsageStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { issueInventoryInTransaction } from '@modules/inventory/services/inventory-ledger.service';
import { resolveSessionMaterialRecommendations } from '@modules/inventory/services/treatment-bom.service';
import {
  createTreatmentCompletedEventInTransaction,
  postTreatmentCompletionRevenueInTransaction,
} from '@modules/revenue/revenue.service';
import { logAudit } from '@utils/auditLog';
import {
  buildTreatmentCompletedEventPayload,
  TREATMENT_COMPLETED_EVENT_TYPE,
  TREATMENT_COMPLETED_EVENT_VERSION,
} from '../events/treatment-completed.event';
import { requiresMaterialDeviationReason } from './material-usage.helpers';

const MAX_COMPLETION_ATTEMPTS = 3;

function isRetryableTransactionError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : String(error);
  return code === 'P2002' || code === 'P2034' || /40001|40P01|serialization|deadlock/i.test(message);
}

async function withCompletionRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_COMPLETION_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === MAX_COMPLETION_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 15 * attempt));
    }
  }
  throw lastError;
}

type EvaluationSnapshot = {
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  generalNotes?: string | null;
} | null;

export class SessionCompletionService {
  private hasDoctorEvaluation(evaluation: EvaluationSnapshot): boolean {
    if (!evaluation) return false;
    return [
      evaluation.subjective,
      evaluation.objective,
      evaluation.assessment,
      evaluation.plan,
      evaluation.generalNotes,
    ].some((value) => typeof value === 'string' && value.trim().length > 0);
  }

  async completeSession(sessionId: string, userId: string) {
    const scope = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      select: { branchId: true },
    });
    if (!scope) throw errors.notFound('Sesi tidak ditemukan.');
    await assertBranchAccess(userId, scope.branchId);
    await assertPermission(userId, PERMISSIONS.TREATMENT_MATERIAL_CONSUME, scope.branchId);

    const result = await withCompletionRetry(() => prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "treatment_sessions" WHERE "id" = ${sessionId} FOR UPDATE
      `);
      const session = await tx.treatmentSession.findUnique({
        where: { id: sessionId },
        include: {
          encounter: { select: { memberId: true, memberPackageId: true } },
          therapyPlan: true,
          vitalSigns: true,
          infusion: true,
          materials: { include: { inventoryItem: { include: { masterProduct: true } } } },
          evaluation: true,
        },
      });
      if (!session) throw errors.notFound('Sesi tidak ditemukan.');
      if (session.isCompleted) {
        const [existingEvent, existingRevenueEvent] = await Promise.all([
          tx.integrationEvent.findUnique({
            where: { eventType_aggregateId: { eventType: TREATMENT_COMPLETED_EVENT_TYPE, aggregateId: session.id } },
          }),
          tx.domainEvent.findUnique({ where: { eventKey: `TREATMENT_COMPLETED:${session.id}` } }),
        ]);
        if (!existingEvent || !existingRevenueEvent) {
          throw errors.conflict(
            'SESSION_COMPLETION_EVENT_MISSING',
            'Sesi sudah selesai tetapi kontrak event inventory atau deferred revenue tidak lengkap.',
          );
        }
        return {
          sessionId: session.id,
          sessionCode: session.sessionCode,
          isCompleted: true,
          completedAt: session.completedAt,
          materialPostingId: session.materialPostingId,
          completionJournalEntryId: session.completionJournalEntryId,
          recognizedRevenue: session.recognizedRevenue,
          hppAmount: session.hppAmount,
          grossProfit: session.grossProfit,
          eventId: existingEvent.id,
          eventStatus: existingEvent.status,
          domainEventId: existingRevenueEvent.id,
          idempotentReplay: true,
          message: 'Sesi terapi sudah diselesaikan.',
        };
      }

      const errorsList: string[] = [];
      const hasVitalBefore = session.vitalSigns.some((vital) => vital.waktuCatat === 'SEBELUM');
      const hasVitalAfter = session.vitalSigns.some((vital) => vital.waktuCatat === 'SESUDAH');
      if (!session.therapyPlan) errorsList.push('Therapy plan belum dibuat');
      if (!hasVitalBefore) errorsList.push('Tanda vital SEBELUM belum diisi');
      if (!session.infusion) errorsList.push('Infus aktual belum dibuat');
      if (session.materials.length === 0) errorsList.push('Pemakaian bahan belum diisi (WAJIB)');
      if (!hasVitalAfter) errorsList.push('Tanda vital SESUDAH belum diisi');
      if (!this.hasDoctorEvaluation(session.evaluation)) errorsList.push('Evaluasi dokter belum dibuat');

      const recommendations = await resolveSessionMaterialRecommendations(session.id, tx);
      if (recommendations.hasActiveBom) {
        for (const recommendation of recommendations.items.filter((item) => item.isRequired)) {
          const usage = session.materials.find(
            (material) => material.inventoryItem.masterProductId === recommendation.masterProductId,
          );
          if (!usage) {
            errorsList.push(`Material wajib BOM belum dicatat: ${recommendation.productName}`);
            continue;
          }
          const deviationRequired = requiresMaterialDeviationReason(
            usage.quantity,
            new Prisma.Decimal(recommendation.recommendedQuantity),
            new Prisma.Decimal(recommendation.tolerancePercent),
            true,
          );
          if (deviationRequired && !usage.deviationReason) {
            errorsList.push(`Alasan deviasi belum diisi: ${recommendation.productName}`);
          }
        }
      }
      if (errorsList.length > 0) {
        throw {
          status: 422,
          code: 'INCOMPLETE_SESSION',
          message: 'Sesi belum lengkap',
          errors: errorsList,
        };
      }

      const completedAt = new Date();
      const draftMaterials = session.materials.filter((material) => material.status === MaterialUsageStatus.DRAFT);
      let materialPostingId: string | null = null;
      if (draftMaterials.length > 0) {
        materialPostingId = await issueInventoryInTransaction(userId, {
          idempotencyKey: `TREATMENT-MATERIAL-${session.id}`,
          branchId: session.branchId,
          sourceType: 'TREATMENT_SESSION',
          sourceId: session.id,
          sourceNumber: session.sessionCode,
          reasonCode: 'TREATMENT_MATERIAL_USAGE',
          occurredAt: completedAt,
          costCenterCode: session.branchId,
          lines: draftMaterials.map((material) => ({
            inventoryItemId: material.inventoryItemId,
            stockLocationId: material.inventoryItem.stockLocationId ?? undefined,
            quantity: material.baseQuantity.toFixed(4),
          })),
        }, tx);

        const mutations = await tx.stockMutation.findMany({
          where: { inventoryPostingId: materialPostingId },
          select: { inventoryItemId: true, actualCost: true, quantity: true },
        });
        const mutationByItem = new Map(mutations.map((mutation) => [mutation.inventoryItemId, mutation]));
        for (const material of draftMaterials) {
          const mutation = mutationByItem.get(material.inventoryItemId);
          if (!mutation?.actualCost) throw errors.conflict('MATERIAL_COST_MISSING', 'Actual cost FIFO material tidak ditemukan.');
          await tx.materialUsage.update({
            where: { id: material.id },
            data: {
              status: MaterialUsageStatus.CONSUMED,
              inventoryPostingId: materialPostingId,
              actualUnitCost: mutation.actualCost.div(mutation.quantity).toDecimalPlaces(4),
              totalActualCost: mutation.actualCost,
              consumedAt: completedAt,
            },
          });
        }
      }

      const materialRows = await tx.materialUsage.findMany({
        where: { treatmentSessionId: session.id },
        include: { inventoryItem: { include: { masterProduct: true } } },
        orderBy: { id: 'asc' },
      });
      const materialPosting = materialPostingId
        ? await tx.inventoryPosting.findUniqueOrThrow({ where: { id: materialPostingId } })
        : null;
      const totalActualMaterialCost = materialRows.reduce(
        (sum, material) => sum.add(material.totalActualCost ?? 0),
        new Prisma.Decimal(0),
      );

      const revenueEvent = await createTreatmentCompletedEventInTransaction({
        sessionId: session.id,
        sessionCode: session.sessionCode,
        branchId: session.branchId,
        memberId: session.encounter.memberId,
        treatmentDate: session.treatmentDate,
        completedAt,
        packageIds: [session.encounter.memberPackageId, session.boosterPackageId]
          .filter((value): value is string => Boolean(value)),
      }, tx);

      const finance = await postTreatmentCompletionRevenueInTransaction({
        actorUserId: userId,
        eventId: revenueEvent.event.id,
        sessionId: session.id,
        sessionCode: session.sessionCode,
        branchId: session.branchId,
        completedAt,
        hppAmount: totalActualMaterialCost,
        inventoryPostingId: materialPostingId,
      }, tx);

      await tx.treatmentSession.update({
        where: { id: session.id },
        data: {
          isCompleted: true,
          completedAt,
          completedBy: userId,
          materialPostingId,
          completionJournalEntryId: finance.journal.id,
          recognizedRevenue: finance.recognizedRevenue,
          hppAmount: finance.hppAmount,
          grossProfit: finance.grossProfit,
        },
      });

      const payload = buildTreatmentCompletedEventPayload({
        occurredAt: completedAt.toISOString(),
        session: {
          id: session.id,
          sessionCode: session.sessionCode,
          treatmentDate: session.treatmentDate.toISOString(),
          completedAt: completedAt.toISOString(),
          branchId: session.branchId,
          memberId: session.encounter.memberId,
          memberPackageId: session.encounter.memberPackageId,
          boosterPackageId: session.boosterPackageId,
        },
        inventory: {
          postingId: materialPosting?.id ?? null,
          postingNumber: materialPosting?.postingNumber ?? null,
          totalActualMaterialCost: totalActualMaterialCost.toFixed(4),
          materials: materialRows.map((material) => ({
            materialUsageId: material.id,
            inventoryItemId: material.inventoryItemId,
            masterProductId: material.inventoryItem.masterProductId,
            productName: material.inventoryItem.masterProduct.name,
            actualUsageQuantity: material.quantity.toFixed(4),
            usageUnit: material.unit,
            consumedBaseQuantity: material.baseQuantity.toFixed(4),
            baseUnit: material.inventoryItem.masterProduct.baseUnit,
            recommendedQuantity: material.recommendedQuantity?.toFixed(4) ?? null,
            deviationReason: material.deviationReason,
            deviationNotes: material.deviationNotes,
            actualUnitCost: material.actualUnitCost?.toFixed(4) ?? null,
            totalActualCost: material.totalActualCost?.toFixed(4) ?? null,
          })),
        },
        finance: {
          revenueRecognitionStatus: 'POSTED',
          recognizedRevenue: finance.recognizedRevenue.toFixed(2),
          hppAmount: finance.hppAmount.toFixed(2),
          grossProfit: finance.grossProfit.toFixed(2),
          journalEntryId: finance.journal.id,
        },
      });
      const event = await tx.integrationEvent.create({
        data: {
          eventType: TREATMENT_COMPLETED_EVENT_TYPE,
          eventVersion: TREATMENT_COMPLETED_EVENT_VERSION,
          aggregateType: 'TreatmentSession',
          aggregateId: session.id,
          branchId: session.branchId,
          payload: payload as unknown as Prisma.InputJsonValue,
          status: IntegrationEventStatus.PROCESSED,
          occurredAt: completedAt,
          processedAt: completedAt,
          attempts: 1,
        },
      });
      return {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        isCompleted: true,
        completedAt,
        materialPostingId,
        totalActualMaterialCost,
        completionJournalEntryId: finance.journal.id,
        recognizedRevenue: finance.recognizedRevenue,
        hppAmount: finance.hppAmount,
        grossProfit: finance.grossProfit,
        eventId: event.id,
        eventStatus: event.status,
        domainEventId: revenueEvent.event.id,
        idempotentReplay: false,
        message: 'Sesi terapi berhasil diselesaikan',
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

    await logAudit({
      userId,
      branchId: scope.branchId,
      action: AuditAction.UPDATE,
      resource: 'TreatmentSession',
      resourceId: sessionId,
      afterData: {
        action: 'COMPLETE_SESSION',
        materialPostingId: result.materialPostingId,
        eventId: result.eventId,
        eventStatus: result.eventStatus,
        domainEventId: result.domainEventId,
        completionJournalEntryId: result.completionJournalEntryId,
        recognizedRevenue: result.recognizedRevenue,
        hppAmount: result.hppAmount,
        grossProfit: result.grossProfit,
        revenueRecognitionStatus: 'POSTED',
      },
    });
    return result;
  }

  async saveProgress(sessionId: string, userId: string) {
    const session = await prisma.treatmentSession.findUnique({ where: { id: sessionId } });
    if (!session) throw errors.notFound('Sesi tidak ditemukan.');
    if (session.isCompleted) throw errors.conflict('SESSION_ALREADY_COMPLETED', 'Sesi sudah diselesaikan, tidak bisa disimpan lagi.');
    await logAudit({
      userId,
      branchId: session.branchId,
      action: AuditAction.UPDATE,
      resource: 'TreatmentSession',
      resourceId: sessionId,
      afterData: { action: 'SAVE_PROGRESS' },
    });
    return { sessionId: session.id, sessionCode: session.sessionCode, message: 'Progress berhasil disimpan' };
  }

  async getSessionProgress(sessionId: string) {
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      include: {
        encounter: { include: { diagnoses: true } },
        therapyPlan: true,
        vitalSigns: true,
        boosterPackage: true,
        infusion: true,
        materials: true,
        photo: true,
        evaluation: true,
      },
    });
    if (!session) throw errors.notFound('Sesi tidak ditemukan.');
    const diagnosis = session.encounter.diagnoses[0];
    const hasVitalBefore = session.vitalSigns.some((vital) => vital.waktuCatat === 'SEBELUM');
    const hasVitalAfter = session.vitalSigns.some((vital) => vital.waktuCatat === 'SESUDAH');
    const steps = {
      step1_diagnosis: Boolean(diagnosis),
      step2_therapyPlan: Boolean(session.therapyPlan),
      step3_vitalBefore: hasVitalBefore,
      step4_infusion: Boolean(session.infusion),
      step5_materials: session.materials.length > 0,
      step6_photo: Boolean(session.photo),
      step7_vitalAfter: hasVitalAfter,
      step8_evaluation: this.hasDoctorEvaluation(session.evaluation),
    };
    const requiredSteps = [
      steps.step2_therapyPlan,
      steps.step3_vitalBefore,
      steps.step4_infusion,
      steps.step5_materials,
      steps.step7_vitalAfter,
      steps.step8_evaluation,
    ];
    const completedRequired = requiredSteps.filter(Boolean).length;
    const totalRequired = requiredSteps.length;
    return {
      sessionId: session.id,
      sessionCode: session.sessionCode,
      isCompleted: session.isCompleted,
      steps,
      progress: {
        completedRequired,
        totalRequired,
        percentage: Math.round((completedRequired / totalRequired) * 100),
        canComplete: completedRequired === totalRequired,
      },
    };
  }
}
