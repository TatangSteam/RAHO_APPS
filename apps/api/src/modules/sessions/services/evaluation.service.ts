import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateEvaluationCode } from '../../../utils/codeGenerator';
import type { CreateEvaluationInput } from '../sessions.schema';
import { AuditAction, Role } from '@prisma/client';
import { assertSessionEditWindow } from './session-edit-window';

const OPERATIONAL_FIELDS = ['keluhan', 'rekomendasi'] as const;
const DOCTOR_FIELDS = ['subjective', 'objective', 'assessment', 'plan', 'generalNotes'] as const;
const SOAP_MANAGER_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_MANAGER];

function providedFields(data: Partial<CreateEvaluationInput>, fields: readonly string[]) {
  return fields.filter((field) => data[field as keyof CreateEvaluationInput] !== undefined);
}

export class EvaluationService {
  private async assertEditor(sessionId: string, data: Partial<CreateEvaluationInput>, userId: string) {
    const [session, actor] = await Promise.all([
      prisma.treatmentSession.findUnique({
        where: { id: sessionId },
        include: {
          sessionDoctors: { select: { doctorId: true } },
          sessionNurses: { select: { nurseId: true } },
        },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ]);
    if (!session) throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    if (!actor) throw { status: 403, code: 'FORBIDDEN', message: 'Pengguna tidak valid.' };

    const operationalChanges = providedFields(data, OPERATIONAL_FIELDS);
    const doctorChanges = providedFields(data, DOCTOR_FIELDS);
    if (SOAP_MANAGER_ROLES.includes(actor.role)) return session;

    if (actor.role === Role.ADMIN_CABANG) {
      if (doctorChanges.length > 0) {
        throw {
          status: 403,
          code: 'FIELD_NOT_OWNED',
          message: 'Evaluasi SOAP hanya dapat diedit oleh dokter, Admin Manager, atau Super Admin.',
        };
      }
      return session;
    }

    if (actor.role === Role.DOCTOR) {
      const assigned = session.doctorId === userId
        || session.sessionDoctors.some((item) => item.doctorId === userId);
      if (!assigned) throw { status: 403, code: 'SESSION_NOT_ASSIGNED', message: 'Dokter hanya dapat mengedit sesi yang ditugaskan kepadanya.' };
      if (operationalChanges.length > 0) {
        throw { status: 403, code: 'FIELD_NOT_OWNED', message: 'Keluhan dan rekomendasi operasional diisi oleh MSO atau Nakes.' };
      }
      return session;
    }

    if (actor.role === Role.ADMIN_LAYANAN || actor.role === Role.NURSE) {
      const assigned = actor.role === Role.ADMIN_LAYANAN
        ? session.adminLayananId === userId
        : session.nurseId === userId || session.sessionNurses.some((item) => item.nurseId === userId);
      if (!assigned) throw { status: 403, code: 'SESSION_NOT_ASSIGNED', message: 'Anda hanya dapat mengedit sesi yang ditugaskan kepada Anda.' };
      return session;
    }

    throw { status: 403, code: 'FORBIDDEN', message: 'Anda tidak memiliki akses untuk mengedit bagian sesi ini.' };
  }

  async createEvaluation(sessionId: string, data: CreateEvaluationInput, userId: string) {
    const authorizedSession = await this.assertEditor(sessionId, data, userId);
    assertSessionEditWindow(authorizedSession);

    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      include: {
        emrNotes: true,
        branch: true,
      },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    const branchCode = session.branch.branchCode;
    const stored = await prisma.$transaction(async (tx) => {
      // Step 8 and Step 9 share one DoctorEvaluation row. Serialize saves per
      // branch so stale clients and concurrent sessions cannot create duplicate
      // rows or reuse the same human-readable evaluation code.
      const lockKey = `doctor-evaluation:${authorizedSession.branchId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const existing = await tx.doctorEvaluation.findUnique({
        where: { treatmentSessionId: sessionId },
      });
      const evaluationData = {
        keluhan: data.keluhan,
        rekomendasi: data.rekomendasi,
        subjective: data.subjective,
        objective: data.objective,
        assessment: data.assessment,
        plan: data.plan,
        generalNotes: data.generalNotes,
        writtenBy: userId,
      };

      if (existing) {
        const evaluation = await tx.doctorEvaluation.update({
          where: { treatmentSessionId: sessionId },
          data: evaluationData,
        });
        return { evaluation, previous: existing, action: AuditAction.UPDATE };
      }

      const prefix = `EVL-${branchCode}-`;
      const lastEvaluation = await tx.doctorEvaluation.findFirst({
        where: { evaluationCode: { startsWith: prefix } },
        orderBy: { evaluationCode: 'desc' },
      });
      const sequence = lastEvaluation
        ? parseInt(lastEvaluation.evaluationCode.split('-').pop() || '0') + 1
        : 1;
      const evaluationCode = generateEvaluationCode(branchCode, sequence);
      const evaluation = await tx.doctorEvaluation.create({
        data: {
          evaluationCode,
          treatmentSessionId: sessionId,
          ...evaluationData,
        },
      });
      return { evaluation, previous: null, action: AuditAction.CREATE };
    });

    await logAudit({
      userId,
      branchId: authorizedSession.branchId,
      action: stored.action,
      resource: 'DoctorEvaluation',
      resourceId: stored.evaluation.id,
      beforeData: stored.previous,
      afterData: stored.evaluation,
      meta: {
        evaluationCode: stored.evaluation.evaluationCode,
        sessionId,
        changedFields: Object.keys(data),
      },
    });

    return stored.evaluation;
  }

  async updateEvaluation(sessionId: string, data: Partial<CreateEvaluationInput>, userId: string) {
    const session = await this.assertEditor(sessionId, data, userId);
    const evaluation = await prisma.doctorEvaluation.findUnique({
      where: { treatmentSessionId: sessionId },
    });

    if (!evaluation) {
      throw {
        status: 404,
        code: 'EVALUATION_NOT_FOUND',
        message: 'Evaluasi dokter tidak ditemukan',
      };
    }
    assertSessionEditWindow(session);

    const updated = await prisma.doctorEvaluation.update({
      where: { treatmentSessionId: sessionId },
      data: {
        keluhan: data.keluhan,
        rekomendasi: data.rekomendasi,
        subjective: data.subjective,
        objective: data.objective,
        assessment: data.assessment,
        plan: data.plan,
        generalNotes: data.generalNotes,
        writtenBy: userId,
      },
    });

    await logAudit({
      userId,
      branchId: session.branchId,
      action: AuditAction.UPDATE,
      resource: 'DoctorEvaluation',
      resourceId: evaluation.id,
      beforeData: evaluation,
      afterData: updated,
      meta: { sessionId, changedFields: Object.keys(data) },
    });

    return updated;
  }

  async getEvaluation(sessionId: string) {
    const evaluation = await prisma.doctorEvaluation.findUnique({
      where: { treatmentSessionId: sessionId },
    });

    return evaluation;
  }
}
