import {
  AuditAction,
  IntegrationEventStatus,
  MaterialUsageStatus,
  PackageStatus,
  PackageType,
  Prisma,
  TreatmentCompletionStatus,
  TreatmentRevenueSourceType,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import {
  issueInventoryInTransaction,
  reverseInventoryPostingInTransaction,
} from '@modules/inventory/services/inventory-ledger.service';
import { resolveSessionMaterialRecommendations } from '@modules/inventory/services/treatment-bom.service';
import {
  createTreatmentCompletedEventInTransaction,
  LEGACY_REVENUE_FLOW_VERSION,
  postTreatmentCompletionFinancialsInTransaction,
  reverseTreatmentCompletionFinancialsInTransaction,
} from '@modules/revenue/revenue.service';
import { logAudit } from '@utils/auditLog';
import {
  buildTreatmentCompletedEventPayload,
  TREATMENT_COMPLETED_EVENT_TYPE,
  TREATMENT_COMPLETED_EVENT_VERSION,
} from '../events/treatment-completed.event';
import { createInventorySyncEventInTransaction } from '@modules/zoho/zoho.inventory-outbox';
import {
  TREATMENT_INVENTORY_CONSUMED_EVENT,
  TREATMENT_INVENTORY_REVERSED_EVENT,
} from '@modules/zoho/zoho.inventory-adjustment.policy';
import {
  selectTreatmentPackageUsageIds,
  selectTreatmentRevenueSource,
} from './treatment-revenue-source';
import {
  calculatePhysicalAvailableBaseQuantity,
  requiresMaterialDeviationReason,
} from './material-usage.helpers';
import type { CancelSessionCompletionInput } from '../sessions.schema';

const MAX_COMPLETION_ATTEMPTS = 3;
const LEGACY_COMPLETION_FLOW_VERSION = 1;

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

type ReversiblePackageUsage = {
  id: string;
  usedSessions: number;
  totalSessions: number;
  status: PackageStatus;
  expiredAt: Date | null;
};

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
          materials: {
            include: {
              inventoryItem: {
                include: {
                  masterProduct: true,
                  balances: true,
                },
              },
            },
          },
          evaluation: true,
        },
      });
      if (!session) throw errors.notFound('Sesi tidak ditemukan.');
      const isLegacySession = session.completionFlowVersion === LEGACY_COMPLETION_FLOW_VERSION;
      if (session.completionStatus === TreatmentCompletionStatus.CANCELLED) {
        throw errors.conflict('SESSION_COMPLETION_CANCELLED', 'Completion sesi ini sudah dibatalkan dan tidak dapat diposting ulang.');
      }
      if (session.isCompleted) {
        const replayPackageId = session.revenuePackageId
          || session.boosterPackageId
          || session.encounter.memberPackageId;
        const [existingEvent, existingRevenueEvent, replayPackage] = await Promise.all([
          tx.integrationEvent.findUnique({
            where: { eventType_aggregateId: { eventType: TREATMENT_COMPLETED_EVENT_TYPE, aggregateId: session.id } },
          }),
          tx.domainEvent.findUnique({ where: { eventKey: `TREATMENT_COMPLETED:${session.id}` } }),
          tx.memberPackage.findUnique({
            where: { id: replayPackageId },
            select: { revenueFlowVersion: true },
          }),
        ]);
        const isLegacyCompletion = isLegacySession
          || replayPackage?.revenueFlowVersion === LEGACY_REVENUE_FLOW_VERSION;
        if ((!existingEvent || !existingRevenueEvent) && !isLegacyCompletion) {
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
          journalEntryId: session.completionJournalEntryId,
          recognizedRevenue: session.recognizedRevenue,
          materialCost: session.materialCost,
          grossProfit: session.grossProfit,
          eventId: existingEvent?.id ?? null,
          eventStatus: existingEvent?.status ?? null,
          domainEventId: existingRevenueEvent?.id ?? null,
          revenueCompatibilityMode: isLegacyCompletion ? 'LEGACY' : 'CURRENT',
          idempotentReplay: true,
          message: isLegacyCompletion
            ? 'Sesi terapi lama sudah diselesaikan dan tetap menggunakan alur legacy.'
            : 'Sesi terapi sudah diselesaikan.',
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

      for (const material of session.materials.filter((row) => row.status === MaterialUsageStatus.DRAFT)) {
        const physicalAvailable = calculatePhysicalAvailableBaseQuantity(material.inventoryItem.balances);
        if (physicalAvailable.lessThan(material.baseQuantity)) {
          throw errors.unprocessable(
            'INSUFFICIENT_AVAILABLE_STOCK',
            `Stok ${material.inventoryItem.masterProduct.name} kurang ${material.baseQuantity.sub(physicalAvailable).toFixed(4)} ${material.inventoryItem.masterProduct.baseUnit}. Lakukan penerimaan stok terlebih dahulu.`,
          );
        }
      }

      const recommendations = await resolveSessionMaterialRecommendations(session.id, tx);
      if (!isLegacySession && recommendations.hasActiveBom) {
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
      const legacyConsumedMaterials = draftMaterials.filter(
        (material) => material.baseQuantity.lessThanOrEqualTo(0),
      );
      const postableDraftMaterials = draftMaterials.filter(
        (material) => material.baseQuantity.greaterThan(0),
      );
      let materialPostingId: string | null = null;
      if (legacyConsumedMaterials.length > 0) {
        await tx.materialUsage.updateMany({
          where: { id: { in: legacyConsumedMaterials.map((material) => material.id) } },
          data: {
            status: MaterialUsageStatus.CONSUMED,
            consumedAt: completedAt,
            isLegacyConsumption: true,
            actualUnitCost: new Prisma.Decimal(0),
            totalActualCost: new Prisma.Decimal(0),
          },
        });
      }
      if (postableDraftMaterials.length > 0) {
        materialPostingId = await issueInventoryInTransaction(userId, {
          idempotencyKey: `TREATMENT-MATERIAL-${session.id}`,
          branchId: session.branchId,
          sourceType: 'TREATMENT_SESSION',
          sourceId: session.id,
          sourceNumber: session.sessionCode,
          reasonCode: 'TREATMENT_MATERIAL_USAGE',
          occurredAt: completedAt,
          costCenterCode: session.branchId,
          lines: postableDraftMaterials.map((material) => ({
            inventoryItemId: material.inventoryItemId,
            stockLocationId: material.inventoryItem.stockLocationId ?? undefined,
            quantity: material.baseQuantity.toFixed(4),
          })),
        }, tx, { allowUnvaluedQuantity: true });

        const mutations = await tx.stockMutation.findMany({
          where: { inventoryPostingId: materialPostingId },
          select: { inventoryItemId: true, actualCost: true, quantity: true },
        });
        const mutationByItem = new Map(mutations.map((mutation) => [mutation.inventoryItemId, mutation]));
        for (const material of postableDraftMaterials) {
          const mutation = mutationByItem.get(material.inventoryItemId);
          if (!mutation) throw errors.conflict('MATERIAL_MUTATION_MISSING', 'Mutasi quantity material tidak ditemukan.');
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

      if (isLegacySession) {
        const zero = new Prisma.Decimal(0);
        await tx.treatmentSession.update({
          where: { id: session.id },
          data: {
            isCompleted: true,
            completionStatus: TreatmentCompletionStatus.COMPLETED,
            completedAt,
            completedBy: userId,
            materialPostingId,
            completionJournalEntryId: null,
            recognizedRevenue: zero,
            materialCost: totalActualMaterialCost,
            grossProfit: zero,
          },
        });
        return {
          sessionId: session.id,
          sessionCode: session.sessionCode,
          isCompleted: true,
          completedAt,
          materialPostingId,
          totalActualMaterialCost,
          eventId: null,
          eventStatus: null,
          domainEventId: null,
          journalEntryId: null,
          recognizedRevenue: zero,
          materialCost: totalActualMaterialCost,
          grossProfit: zero,
          revenueCompatibilityMode: 'LEGACY' as const,
          idempotentReplay: false,
          message: 'Sesi terapi lama berhasil diselesaikan dengan flow legacy.',
        };
      }

      const selectedRevenueSource = selectTreatmentRevenueSource(
        session.encounter.memberPackageId,
        session.boosterPackageId,
      );
      const revenuePackageId = selectedRevenueSource.revenuePackageId;
      const revenueSourceType = selectedRevenueSource.revenueSourceType === 'BASIC_WITH_BOOSTER'
        ? TreatmentRevenueSourceType.BASIC_WITH_BOOSTER
        : TreatmentRevenueSourceType.BASIC;
      const revenuePackages = await tx.memberPackage.findMany({
        where: { id: { in: selectedRevenueSource.revenuePackageIds } },
        select: { id: true, memberId: true, packageType: true },
      });
      if (
        revenuePackages.length !== selectedRevenueSource.revenuePackageIds.length
        || revenuePackages.some((pkg) => pkg.memberId !== session.encounter.memberId)
      ) {
        throw errors.unprocessable(
          'TREATMENT_REVENUE_PACKAGE_INVALID',
          'Paket Basic/Booster sumber omzet tidak ditemukan atau bukan milik member sesi.',
        );
      }
      const basicPackage = revenuePackages.find((pkg) => pkg.id === session.encounter.memberPackageId);
      const boosterPackage = session.boosterPackageId
        ? revenuePackages.find((pkg) => pkg.id === session.boosterPackageId)
        : null;
      if (
        basicPackage?.packageType !== PackageType.BASIC
        || (session.boosterPackageId && boosterPackage?.packageType !== PackageType.BOOSTER)
      ) {
        throw errors.unprocessable(
          'TREATMENT_REVENUE_SOURCE_MISMATCH',
          'Sumber omzet wajib menggunakan paket Basic, ditambah paket Booster bila dipakai.',
        );
      }
      await tx.treatmentSession.update({
        where: { id: session.id },
        data: { revenueSourceType, revenuePackageId },
      });

      const revenueEvent = await createTreatmentCompletedEventInTransaction({
        sessionId: session.id,
        sessionCode: session.sessionCode,
        branchId: session.branchId,
        memberId: session.encounter.memberId,
        treatmentDate: session.treatmentDate,
        completedAt,
        packageIds: selectedRevenueSource.revenuePackageIds,
      }, tx);

      const finance = await postTreatmentCompletionFinancialsInTransaction({
        actorUserId: userId,
        eventId: revenueEvent.event.id,
        inventoryPostingId: materialPostingId,
        materialCost: totalActualMaterialCost,
        occurredAt: completedAt,
      }, tx);

      await tx.treatmentSession.update({
        where: { id: session.id },
        data: {
          isCompleted: true,
          completionStatus: TreatmentCompletionStatus.COMPLETED,
          completedAt,
          completedBy: userId,
          materialPostingId,
          completionJournalEntryId: finance.journalEntryId,
          recognizedRevenue: finance.recognizedRevenue,
          materialCost: finance.materialCost,
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
          revenueSourceType,
          revenuePackageId,
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
          materialCost: finance.materialCost.toFixed(2),
          hppAmount: finance.materialCost.toFixed(2),
          grossProfit: finance.grossProfit.toFixed(2),
          journalEntryId: finance.journalEntryId,
          recognitions: finance.recognitions,
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
          status: IntegrationEventStatus.PENDING,
          occurredAt: completedAt,
        },
      });
      await createInventorySyncEventInTransaction(tx, {
        eventType: TREATMENT_INVENTORY_CONSUMED_EVENT,
        aggregateType: 'TreatmentSessionInventory',
        aggregateId: session.id,
        occurredAt: completedAt,
        snapshot: {
          sourceType: 'TREATMENT_COMPLETION',
          localEntityId: session.id,
          externalKey: `RAHO-TREATMENT-${session.sessionCode}`,
          branchId: session.branchId,
          occurredAt: completedAt.toISOString(),
          postingReference: materialPosting?.postingNumber ?? null,
          reason: 'Treatment material consumption',
          lines: materialRows
            .filter((material) => material.baseQuantity.greaterThan(0))
            .map((material) => ({
              inventoryItemId: material.inventoryItemId,
              sku: material.inventoryItem.masterProduct.sku,
              stockLocationId: material.inventoryItem.stockLocationId,
              quantityAdjusted: material.baseQuantity.negated().toFixed(4),
              unitRate: material.actualUnitCost?.toFixed(4) ?? null,
              value: material.totalActualCost?.negated().toFixed(4) ?? null,
            })),
        },
      });
      return {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        isCompleted: true,
        completedAt,
        materialPostingId,
        totalActualMaterialCost,
        eventId: event.id,
        eventStatus: event.status,
        domainEventId: revenueEvent.event.id,
        journalEntryId: finance.journalEntryId,
        recognizedRevenue: finance.recognizedRevenue,
        materialCost: finance.materialCost,
        grossProfit: finance.grossProfit,
        revenueCompatibilityMode: finance.revenueCompatibilityMode,
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
        journalEntryId: result.journalEntryId,
        recognizedRevenue: result.recognizedRevenue,
        materialCost: result.materialCost,
        grossProfit: result.grossProfit,
        revenueCompatibilityMode: result.revenueCompatibilityMode,
        revenueRecognitionStatus: result.revenueCompatibilityMode === 'LEGACY'
          ? 'LEGACY_NOT_APPLICABLE'
          : 'POSTED',
      },
    });
    return result;
  }

  async cancelCompletion(sessionId: string, userId: string, input: CancelSessionCompletionInput) {
    const scope = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      select: { branchId: true },
    });
    if (!scope) throw errors.notFound('Sesi tidak ditemukan.');
    await assertBranchAccess(userId, scope.branchId);
    await assertPermission(userId, PERMISSIONS.TREATMENT_COMPLETION_REVERSE, scope.branchId);

    return withCompletionRetry(() => prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "treatment_sessions" WHERE "id" = ${sessionId} FOR UPDATE
      `);
      const session = await tx.treatmentSession.findUnique({
        where: { id: sessionId },
        include: { encounter: { select: { memberPackageId: true } } },
      });
      if (!session) throw errors.notFound('Sesi tidak ditemukan.');
      const cancellationKey = `TREATMENT-CANCEL:${session.id}:${input.idempotencyKey}`;
      if (session.completionStatus === TreatmentCompletionStatus.CANCELLED) {
        if (session.cancellationIdempotencyKey !== cancellationKey) {
          throw errors.conflict(
            'SESSION_CANCELLATION_ALREADY_POSTED',
            'Completion sudah dibatalkan dengan idempotency key berbeda.',
          );
        }
        return {
          sessionId: session.id,
          sessionCode: session.sessionCode,
          completionStatus: session.completionStatus,
          inventoryReversalPostingId: session.materialReversalPostingId,
          cancellationJournalEntryId: session.cancellationJournalEntryId,
          idempotentReplay: true,
          message: 'Pembatalan completion sudah diproses.',
        };
      }
      if (session.completionStatus !== TreatmentCompletionStatus.COMPLETED || !session.isCompleted) {
        throw errors.conflict('SESSION_NOT_COMPLETED', 'Hanya sesi yang sudah selesai yang dapat dibatalkan melalui reversal.');
      }
      if (session.completionFlowVersion !== LEGACY_COMPLETION_FLOW_VERSION
        && !session.completionJournalEntryId
        && (session.recognizedRevenue.greaterThan(0) || session.materialCost.greaterThan(0))) {
        throw errors.conflict('TREATMENT_COMPLETION_JOURNAL_MISSING', 'Jurnal completion tidak ditemukan. Pembatalan dihentikan untuk menjaga integritas ledger.');
      }

      const cancelledAt = new Date();
      let inventoryReversalPostingId: string | null = null;
      if (session.materialPostingId) {
        inventoryReversalPostingId = await reverseInventoryPostingInTransaction(userId, session.materialPostingId, {
          idempotencyKey: cancellationKey,
          reasonCode: 'TREATMENT_COMPLETION_CANCELLED',
          occurredAt: cancelledAt,
        }, tx);
        await tx.materialUsage.updateMany({
          where: { treatmentSessionId: session.id, status: MaterialUsageStatus.CONSUMED },
          data: { status: MaterialUsageStatus.REVERSED },
        });
      }

      const financeReversal = session.completionJournalEntryId
        ? await reverseTreatmentCompletionFinancialsInTransaction({
            actorUserId: userId,
            sessionId: session.id,
            sessionCode: session.sessionCode,
            branchId: session.branchId,
            originalJournalEntryId: session.completionJournalEntryId,
            reason: input.reason,
            occurredAt: cancelledAt,
          }, tx)
        : null;

      // Usage counters follow the Basic and optional Booster reserved when the
      // session was created. revenuePackageId is intentionally only the Basic
      // accounting source, so it must not hide the Booster during reversal.
      const packageIds = selectTreatmentPackageUsageIds(
        session.encounter.memberPackageId,
        session.boosterPackageId,
      );
      const packages = await tx.$queryRaw<ReversiblePackageUsage[]>(Prisma.sql`
        SELECT "id", "usedSessions", "totalSessions", "status", "expiredAt"
        FROM "member_packages"
        WHERE "id" IN (${Prisma.join(packageIds)})
        ORDER BY "id"
        FOR UPDATE
      `);
      for (const memberPackage of packages) {
        const usedSessions = Math.max(0, memberPackage.usedSessions - 1);
        const reactivate = memberPackage.status === PackageStatus.EXPIRED
          && usedSessions < memberPackage.totalSessions;
        await tx.memberPackage.update({
          where: { id: memberPackage.id },
          data: {
            usedSessions,
            status: reactivate ? PackageStatus.ACTIVE : memberPackage.status,
            expiredAt: reactivate ? null : memberPackage.expiredAt,
          },
        });
      }

      const cancellationEvent = await tx.integrationEvent.create({
        data: {
          eventType: 'TREATMENT_COMPLETION_CANCELLED',
          eventVersion: 1,
          aggregateType: 'TreatmentSession',
          aggregateId: session.id,
          branchId: session.branchId,
          status: IntegrationEventStatus.PENDING,
          occurredAt: cancelledAt,
          payload: {
            sessionId: session.id,
            sessionCode: session.sessionCode,
            reason: input.reason,
            originalInventoryPostingId: session.materialPostingId,
            inventoryReversalPostingId,
            originalJournalEntryId: session.completionJournalEntryId,
            cancellationJournalEntryId: financeReversal?.journalEntryId ?? null,
            releasedRevenue: financeReversal?.releasedRevenue.toFixed(2) ?? '0.00',
          },
        },
      });
      const consumedInventoryEvent = await tx.integrationEvent.findUnique({
        where: {
          eventType_aggregateId: {
            eventType: TREATMENT_INVENTORY_CONSUMED_EVENT,
            aggregateId: session.id,
          },
        },
      });
      if (consumedInventoryEvent) {
        const consumed = consumedInventoryEvent.payload as unknown as {
          lines?: Array<{
            inventoryItemId: string;
            sku: string | null;
            stockLocationId: string | null;
            quantityAdjusted: string;
            unitRate: string | null;
            value: string | null;
          }>;
          postingReference?: string | null;
        };
        await createInventorySyncEventInTransaction(tx, {
          eventType: TREATMENT_INVENTORY_REVERSED_EVENT,
          aggregateType: 'TreatmentSessionInventoryReversal',
          aggregateId: `${session.id}:REVERSAL`,
          occurredAt: cancelledAt,
          snapshot: {
            sourceType: 'TREATMENT_CANCELLATION',
            localEntityId: `${session.id}:REVERSAL`,
            externalKey: `RAHO-TREATMENT-REV-${session.sessionCode}`,
            branchId: session.branchId,
            occurredAt: cancelledAt.toISOString(),
            postingReference: inventoryReversalPostingId || consumed.postingReference || null,
            reason: 'Treatment completion cancellation',
            lines: (consumed.lines || []).map((line) => ({
              ...line,
              quantityAdjusted: new Prisma.Decimal(line.quantityAdjusted).negated().toFixed(4),
              value: line.value == null
                ? null
                : new Prisma.Decimal(line.value).negated().toFixed(4),
            })),
          },
        });
      }
      await tx.treatmentSession.update({
        where: { id: session.id },
        data: {
          completionStatus: TreatmentCompletionStatus.CANCELLED,
          cancelledAt,
          cancelledBy: userId,
          cancellationIdempotencyKey: cancellationKey,
          cancellationReason: input.reason,
          materialReversalPostingId: inventoryReversalPostingId,
          cancellationJournalEntryId: financeReversal?.journalEntryId ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          branchId: session.branchId,
          action: AuditAction.UPDATE,
          module: 'TREATMENT',
          resource: 'TreatmentSession',
          resourceId: session.id,
          entityType: 'TreatmentSession',
          entityId: session.id,
          entityCode: session.sessionCode,
          description: `Completion treatment ${session.sessionCode} dibatalkan melalui reversal.`,
          beforeData: {
            completionStatus: session.completionStatus,
            materialPostingId: session.materialPostingId,
            completionJournalEntryId: session.completionJournalEntryId,
          },
          afterData: {
            completionStatus: TreatmentCompletionStatus.CANCELLED,
            inventoryReversalPostingId,
            cancellationJournalEntryId: financeReversal?.journalEntryId ?? null,
            cancellationEventId: cancellationEvent.id,
            reason: input.reason,
          },
        },
      });
      return {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        completionStatus: TreatmentCompletionStatus.CANCELLED,
        inventoryReversalPostingId,
        cancellationJournalEntryId: financeReversal?.journalEntryId ?? null,
        releasedRevenue: financeReversal?.releasedRevenue ?? new Prisma.Decimal(0),
        eventId: cancellationEvent.id,
        idempotentReplay: false,
        message: 'Completion sesi berhasil dibatalkan dan seluruh posting telah dibalik.',
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
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
