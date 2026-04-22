import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateTherapyPlanCode } from '../../../utils/codeGenerator';
import type { CreateTherapyPlanInput } from '../sessions.schema';
import { AuditAction } from '@prisma/client';

export class TherapyPlanService {
  async createTherapyPlan(sessionId: string, data: CreateTherapyPlanInput, userId: string) {
    // Check if therapy plan already exists
    const existing = await prisma.therapyPlan.findUnique({
      where: { treatmentSessionId: sessionId },
    });

    if (existing) {
      throw {
        status: 409,
        code: 'THERAPY_PLAN_EXISTS',
        message: 'Terapi plan untuk sesi ini sudah ada',
      };
    }

    // Check if session exists
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      include: {
        encounter: {
          include: { diagnoses: true },
        },
        branch: true,
      },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    // No strict prerequisite - diagnosis is optional for pending sessions
    // if (!session.encounter.diagnoses || session.encounter.diagnoses.length === 0) {
    //   throw {
    //     status: 422,
    //     code: 'DIAGNOSIS_REQUIRED',
    //     message: 'Diagnosa harus dibuat terlebih dahulu',
    //   };
    // }

    // Generate therapy plan code with sequence
    const branchCode = session.branch.branchCode;
    const prefix = `TP-${branchCode}-`;
    const lastPlan = await prisma.therapyPlan.findFirst({
      where: { planCode: { startsWith: prefix } },
      orderBy: { planCode: 'desc' },
    });
    
    const sequence = lastPlan 
      ? parseInt(lastPlan.planCode.split('-').pop() || '0') + 1 
      : 1;
    
    const planCode = generateTherapyPlanCode(branchCode, sequence);

    const therapyPlan = await prisma.therapyPlan.create({
      data: {
        planCode,
        treatmentSessionId: sessionId,
        ...data,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'TherapyPlan',
      resourceId: therapyPlan.id,
      meta: { planCode, sessionId },
    });

    return therapyPlan;
  }

  async getTherapyPlan(sessionId: string) {
    const therapyPlan = await prisma.therapyPlan.findUnique({
      where: { treatmentSessionId: sessionId },
    });

    return therapyPlan;
  }
}
