import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { createTreatmentCompletedEventInTransaction } from '@modules/revenue/revenue.service';

export class SessionCompletionService {
  private hasDoctorEvaluation(evaluation: any): boolean {
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
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      include: {
        therapyPlan: true,
        vitalSigns: true,
        infusion: true,
        materials: true,
        photo: true,
        evaluation: true,
        encounter: { select: { memberId: true, memberPackageId: true } },
      },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    if (session.isCompleted) {
      throw {
        status: 409,
        code: 'SESSION_ALREADY_COMPLETED',
        message: 'Sesi sudah diselesaikan',
      };
    }

    // Validate all REQUIRED steps
    const hasVitalBefore = session.vitalSigns.some((v) => v.waktuCatat === 'SEBELUM');
    const hasVitalAfter = session.vitalSigns.some((v) => v.waktuCatat === 'SESUDAH');

    const errors: string[] = [];

    if (!session.therapyPlan) {
      errors.push('Therapy plan belum dibuat');
    }

    if (!hasVitalBefore) {
      errors.push('Tanda vital SEBELUM belum diisi');
    }

    if (!session.infusion) {
      errors.push('Infus aktual belum dibuat');
    }

    // IMPORTANT: Materials are now REQUIRED
    if (!session.materials || session.materials.length === 0) {
      errors.push('Pemakaian bahan belum diisi (WAJIB)');
    }

    if (!hasVitalAfter) {
      errors.push('Tanda vital SESUDAH belum diisi');
    }

    if (!this.hasDoctorEvaluation(session.evaluation)) {
      errors.push('Evaluasi dokter belum dibuat');
    }

    // Optional steps (not blocking completion):
    // - Photo (step 6)

    if (errors.length > 0) {
      throw {
        status: 422,
        code: 'INCOMPLETE_SESSION',
        message: 'Sesi belum lengkap',
        errors,
      };
    }

    // Completion flag and outbox event are committed atomically. Revenue remains
    // deferred; Sprint 8 consumes the event together with FIFO/HPP posting.
    const completion = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "treatment_sessions" WHERE "id" = ${sessionId} FOR UPDATE`);
      const locked = await tx.treatmentSession.findUnique({ where: { id: sessionId } });
      if (!locked) throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
      if (locked.isCompleted) throw { status: 409, code: 'SESSION_ALREADY_COMPLETED', message: 'Sesi sudah diselesaikan' };
      const updatedSession = await tx.treatmentSession.update({ where: { id: sessionId }, data: { isCompleted: true } });
      const completedAt = new Date();
      const emitted = await createTreatmentCompletedEventInTransaction({
        sessionId: session.id,
        sessionCode: session.sessionCode,
        branchId: session.branchId,
        memberId: session.encounter.memberId,
        treatmentDate: session.treatmentDate,
        completedAt,
        packageIds: [session.encounter.memberPackageId, session.boosterPackageId].filter((value): value is string => Boolean(value)),
      }, tx);
      await tx.auditLog.create({ data: { userId, branchId: session.branchId, action: AuditAction.UPDATE, module: 'TREATMENT', resource: 'TreatmentSession', resourceId: session.id, entityType: 'TreatmentSession', entityId: session.id, entityCode: session.sessionCode, description: `Sesi ${session.sessionCode} selesai dan event TREATMENT_COMPLETED dibuat.`, afterData: { isCompleted: true, domainEventId: emitted.event.id } } });
      return { updatedSession, emitted };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      sessionId: completion.updatedSession.id,
      sessionCode: completion.updatedSession.sessionCode,
      isCompleted: completion.updatedSession.isCompleted,
      event: { id: completion.emitted.event.id, eventType: completion.emitted.event.eventType, status: completion.emitted.event.status },
      message: 'Sesi terapi berhasil diselesaikan',
    };
  }

  async saveProgress(sessionId: string, userId: string) {
    // Just check if session exists
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    if (session.isCompleted) {
      throw {
        status: 409,
        code: 'SESSION_ALREADY_COMPLETED',
        message: 'Sesi sudah diselesaikan, tidak bisa disimpan lagi',
      };
    }

    // No validation - just save progress
    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'TreatmentSession',
      resourceId: sessionId,
      meta: { action: 'SAVE_PROGRESS' },
    });

    return {
      sessionId: session.id,
      sessionCode: session.sessionCode,
      message: 'Progress berhasil disimpan',
    };
  }

  async getSessionProgress(sessionId: string) {
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      include: {
        encounter: {
          include: {
            diagnoses: true,
          },
        },
        therapyPlan: true,
        vitalSigns: true,
        boosterPackage: true,
        infusion: true,
        materials: true,
        photo: true,
        evaluation: true,
      },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    const diagnosis = session.encounter.diagnoses[0];
    const hasVitalBefore = session.vitalSigns.some((v) => v.waktuCatat === 'SEBELUM');
    const hasVitalAfter = session.vitalSigns.some((v) => v.waktuCatat === 'SESUDAH');

    const steps = {
      step1_diagnosis: !!diagnosis,
      step2_therapyPlan: !!session.therapyPlan,
      step3_vitalBefore: hasVitalBefore,
      step4_infusion: !!session.infusion,
      step5_materials: session.materials.length > 0, // REQUIRED
      step6_photo: !!session.photo, // Optional
      step7_vitalAfter: hasVitalAfter,
      step8_evaluation: this.hasDoctorEvaluation(session.evaluation),
    };

    const requiredSteps = [
      steps.step2_therapyPlan,
      steps.step3_vitalBefore,
      steps.step4_infusion,
      steps.step5_materials, // REQUIRED
      steps.step7_vitalAfter,
      steps.step8_evaluation,
    ];

    const completedRequired = requiredSteps.filter(Boolean).length;
    const totalRequired = requiredSteps.length;
    const canComplete = completedRequired === totalRequired;

    return {
      sessionId: session.id,
      sessionCode: session.sessionCode,
      isCompleted: session.isCompleted,
      steps,
      progress: {
        completedRequired,
        totalRequired,
        percentage: Math.round((completedRequired / totalRequired) * 100),
        canComplete,
      },
    };
  }
}
