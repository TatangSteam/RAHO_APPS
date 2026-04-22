import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateEvaluationCode } from '../../../utils/codeGenerator';
import type { CreateEvaluationInput } from '../sessions.schema';
import { AuditAction } from '@prisma/client';

export class EvaluationService {
  async createEvaluation(sessionId: string, data: CreateEvaluationInput, userId: string) {
    // Check if evaluation already exists
    const existing = await prisma.doctorEvaluation.findUnique({
      where: { treatmentSessionId: sessionId },
    });

    if (existing) {
      throw {
        status: 409,
        code: 'EVALUATION_EXISTS',
        message: 'Evaluasi dokter untuk sesi ini sudah ada',
      };
    }

    // Check if session exists
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

    // Relaxed validation - allow evaluation without EMR notes for pending sessions
    // if (session.emrNotes.length === 0) {
    //   throw {
    //     status: 422,
    //     code: 'EMR_NOTES_REQUIRED',
    //     message: 'Catatan EMR harus dibuat terlebih dahulu',
    //   };
    // }

    // Generate evaluation code with sequence
    const branchCode = session.branch.branchCode;
    const prefix = `EVL-${branchCode}-`;
    const lastEvaluation = await prisma.doctorEvaluation.findFirst({
      where: { evaluationCode: { startsWith: prefix } },
      orderBy: { evaluationCode: 'desc' },
    });
    
    const sequence = lastEvaluation 
      ? parseInt(lastEvaluation.evaluationCode.split('-').pop() || '0') + 1 
      : 1;
    
    const evaluationCode = generateEvaluationCode(branchCode, sequence);

    const evaluation = await prisma.doctorEvaluation.create({
      data: {
        evaluationCode,
        treatmentSessionId: sessionId,
        subjective: data.subjective,
        objective: data.objective,
        assessment: data.assessment,
        plan: data.plan,
        generalNotes: data.generalNotes,
        writtenBy: data.writtenBy,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'DoctorEvaluation',
      resourceId: evaluation.id,
      meta: { evaluationCode, sessionId },
    });

    return evaluation;
  }

  async updateEvaluation(sessionId: string, data: Partial<CreateEvaluationInput>, userId: string) {
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

    const updated = await prisma.doctorEvaluation.update({
      where: { treatmentSessionId: sessionId },
      data: {
        subjective: data.subjective,
        objective: data.objective,
        assessment: data.assessment,
        plan: data.plan,
        generalNotes: data.generalNotes,
        writtenBy: data.writtenBy,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'DoctorEvaluation',
      resourceId: evaluation.id,
      meta: { sessionId },
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
