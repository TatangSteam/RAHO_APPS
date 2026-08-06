import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateTherapyPlanCode } from '../../../utils/codeGenerator';
import { normalizeIfaSubstances } from '../../../utils/therapyPlanSubstances';
import type { CreateTherapyPlanInput } from '../sessions.schema';
import { AuditAction, Prisma } from '@prisma/client';
import { MemberTherapyPlanSetEditService } from '../../members/services/member-therapy-plan-set-edit.service';
import type { BulkEditSetInput } from '../../members/services/member-therapy-plan-set-edit.service';
import { syncSessionInfusionToTherapyPlan } from './infusion-material-sync.service';

export class TherapyPlanService {
  private therapyPlanSetEditService = new MemberTherapyPlanSetEditService();

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

    const { ifaSubstances, ifaSubstanceTotalMl: _ifaSubstanceTotalMl, ...therapyPlanData } = data;
    const normalizedIfaSubstances = normalizeIfaSubstances(
      ifaSubstances,
      Boolean(data.ifa250 && data.ifa250 > 0)
    );

    const therapyPlan = await prisma.therapyPlan.create({
      data: {
        planCode,
        treatmentSessionId: sessionId,
        ...therapyPlanData,
        ifaSubstances: normalizedIfaSubstances.ifaSubstances
          ? normalizedIfaSubstances.ifaSubstances as unknown as Prisma.InputJsonValue
          : Prisma.JsonNull,
        ifaSubstanceTotalMl: normalizedIfaSubstances.ifaSubstanceTotalMl,
        noInIfa: normalizedIfaSubstances.noInIfa,
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

  async getTherapyPlanSetForSession(sessionId: string) {
    const currentPlan = await prisma.therapyPlan.findUnique({
      where: { treatmentSessionId: sessionId },
      select: {
        id: true,
        therapyPlanSetId: true,
      },
    });

    if (!currentPlan) {
      return [];
    }

    const plans = await prisma.therapyPlan.findMany({
      where: currentPlan.therapyPlanSetId
        ? { therapyPlanSetId: currentPlan.therapyPlanSetId }
        : { id: currentPlan.id },
      include: {
        therapyPlanSet: {
          select: {
            id: true,
            name: true,
            setCode: true,
            version: true,
            status: true,
            supersededById: true,
          },
        },
        session: {
          select: {
            id: true,
            sessionCode: true,
            treatmentDate: true,
            infusKe: true,
            branchInfusKe: true,
            branch: {
              select: {
                name: true,
                branchCode: true,
              },
            },
          },
        },
      },
      orderBy: [{ planNumber: 'asc' }, { createdAt: 'asc' }],
    });

    return plans.map((plan) => ({
      id: plan.id,
      planCode: plan.planCode,
      planNumber: plan.planNumber,
      therapyPlanSetId: plan.therapyPlanSetId,
      setCode: plan.therapyPlanSet?.setCode || null,
      setName: plan.therapyPlanSet?.name || null,
      setVersion: plan.therapyPlanSet?.version || plan.version,
      setStatus:
        plan.therapyPlanSet?.status ||
        (plan.supersededById ? 'SUPERSEDED' : 'ACTIVE'),
      setSupersededById: plan.therapyPlanSet?.supersededById || null,
      keterangan: plan.keterangan,
      ifa250: plan.ifa250 ? Number(plan.ifa250) : null,
      ifa500: plan.ifa500 ? Number(plan.ifa500) : null,
      hho: plan.hho ? Number(plan.hho) : null,
      hhoKonsentrat: plan.hhoKonsentrat ? Number(plan.hhoKonsentrat) : null,
      h2: plan.h2 ? Number(plan.h2) : null,
      no: plan.no ? Number(plan.no) : null,
      gaso: plan.gaso ? Number(plan.gaso) : null,
      o2: plan.o2 ? Number(plan.o2) : null,
      o3: plan.o3 ? Number(plan.o3) : null,
      edta: plan.edta ? Number(plan.edta) : null,
      mb: plan.mb ? Number(plan.mb) : null,
      h2s: plan.h2s ? Number(plan.h2s) : null,
      kcl: plan.kcl ? Number(plan.kcl) : null,
      jmlNb: plan.jmlNb ? Number(plan.jmlNb) : null,
      ifaSubstances: plan.ifaSubstances || null,
      ifaSubstanceTotalMl: plan.ifaSubstanceTotalMl
        ? Number(plan.ifaSubstanceTotalMl)
        : null,
      version: plan.version,
      supersededById: plan.supersededById,
      supersededAt: plan.supersededAt?.toISOString() || null,
      isUsed: Boolean(plan.treatmentSessionId),
      usedInSession: plan.session
        ? {
            id: plan.session.id,
            sessionCode: plan.session.sessionCode,
            treatmentDate: plan.session.treatmentDate.toISOString(),
            infusKe: plan.session.infusKe,
            branchName: plan.session.branch.name,
            branchCode: plan.session.branch.branchCode,
            totalSessionsCount: plan.session.infusKe,
            branchSessionsCount: plan.session.branchInfusKe,
          }
        : undefined,
      createdAt: plan.createdAt.toISOString(),
    }));
  }

  async updateTherapyPlanSetForSession(
    sessionId: string,
    data: {
      newSetName?: string;
      sessionPlanNumber?: number;
      plans?: BulkEditSetInput['plans'];
    },
    userId: string
  ) {
    const therapyPlan = await prisma.therapyPlan.findUnique({
      where: { treatmentSessionId: sessionId },
      select: {
        id: true,
        planNumber: true,
        therapyPlanSetId: true,
        supersededById: true,
      },
    });

    if (!therapyPlan) {
      throw {
        status: 404,
        code: 'SESSION_THERAPY_PLAN_NOT_FOUND',
        message: 'Therapy plan untuk sesi ini tidak ditemukan',
      };
    }

    let editablePlan = therapyPlan;

    while (editablePlan.supersededById) {
      const nextPlan = await prisma.therapyPlan.findUnique({
        where: { id: editablePlan.supersededById },
        select: {
          id: true,
          planNumber: true,
          therapyPlanSetId: true,
          supersededById: true,
          treatmentSessionId: true,
          ifa250: true,
          ifa500: true,
          hho: true,
          hhoKonsentrat: true,
          h2: true,
          no: true,
          gaso: true,
          o2: true,
          o3: true,
          edta: true,
          mb: true,
          h2s: true,
          kcl: true,
          jmlNb: true,
          ifaSubstances: true,
        },
      });

      if (!nextPlan) {
        break;
      }

      if (
        nextPlan.treatmentSessionId &&
        nextPlan.treatmentSessionId !== sessionId
      ) {
        throw {
          status: 409,
          code: 'LATEST_THERAPY_PLAN_ALREADY_USED',
          message: 'Versi terbaru therapy plan sudah digunakan oleh sesi lain',
        };
      }

      editablePlan = nextPlan;
    }

    if (!editablePlan.therapyPlanSetId) {
      throw {
        status: 400,
        code: 'SESSION_THERAPY_PLAN_SET_REQUIRED',
        message: 'Therapy plan sesi ini tidak berada dalam sebuah set',
      };
    }

    let movedSessionPlanNumber: number | null = null;

    if (editablePlan.id !== therapyPlan.id) {
      await prisma.$transaction(async (tx) => {
        await tx.therapyPlan.update({
          where: { id: therapyPlan.id },
          data: { treatmentSessionId: null },
        });
        await tx.therapyPlan.update({
          where: { id: editablePlan.id },
          data: { treatmentSessionId: sessionId },
        });
        await tx.infusionExecution.updateMany({
          where: { treatmentSessionId: sessionId },
          data: { therapyPlanId: editablePlan.id },
        });
      });
    }

    if (
      data.sessionPlanNumber &&
      data.sessionPlanNumber !== editablePlan.planNumber
    ) {
      const targetPlan = await prisma.therapyPlan.findFirst({
        where: {
          therapyPlanSetId: editablePlan.therapyPlanSetId,
          planNumber: data.sessionPlanNumber,
        },
        select: {
          id: true,
          planNumber: true,
          therapyPlanSetId: true,
          supersededById: true,
          treatmentSessionId: true,
          ifa250: true,
          ifa500: true,
          hho: true,
          hhoKonsentrat: true,
          h2: true,
          no: true,
          gaso: true,
          o2: true,
          o3: true,
          edta: true,
          mb: true,
          h2s: true,
          kcl: true,
          jmlNb: true,
          ifaSubstances: true,
        },
      });

      if (!targetPlan) {
        throw {
          status: 404,
          code: 'SESSION_TARGET_THERAPY_PLAN_NOT_FOUND',
          message: `Terapi #${data.sessionPlanNumber} tidak ditemukan pada set therapy plan sesi ini`,
        };
      }

      if (
        targetPlan.treatmentSessionId &&
        targetPlan.treatmentSessionId !== sessionId
      ) {
        throw {
          status: 409,
          code: 'SESSION_TARGET_THERAPY_PLAN_USED',
          message: `Terapi #${data.sessionPlanNumber} sudah digunakan oleh sesi lain`,
        };
      }

      await prisma.$transaction(async (tx) => {
        await tx.therapyPlan.update({
          where: { id: editablePlan.id },
          data: { treatmentSessionId: null },
        });
        await tx.therapyPlan.update({
          where: { id: targetPlan.id },
          data: { treatmentSessionId: sessionId },
        });
        await tx.infusionExecution.updateMany({
          where: { treatmentSessionId: sessionId },
          data: { therapyPlanId: targetPlan.id },
        });
        await syncSessionInfusionToTherapyPlan(tx, {
          sessionId,
          therapyPlan: targetPlan,
          userId,
        });
      });

      editablePlan = targetPlan;
      movedSessionPlanNumber = targetPlan.planNumber;
    }

    const plans = data.plans || [];

    if (plans.length === 0) {
      if (!movedSessionPlanNumber) {
        throw {
          status: 400,
          code: 'NO_THERAPY_PLAN_CHANGES',
          message: 'Tidak ada perubahan therapy plan sesi',
        };
      }

      const [set, totalPlans] = await Promise.all([
        prisma.therapyPlanSet.findUnique({
          where: { id: editablePlan.therapyPlanSetId },
          select: { id: true, version: true },
        }),
        prisma.therapyPlan.count({
          where: { therapyPlanSetId: editablePlan.therapyPlanSetId },
        }),
      ]);

      await logAudit({
        userId,
        action: AuditAction.UPDATE,
        resource: 'TherapyPlan',
        resourceId: editablePlan.id,
        meta: {
          sessionId,
          therapyPlanSetId: editablePlan.therapyPlanSetId,
          sessionPlanNumber: movedSessionPlanNumber,
        },
      });

      return {
        success: true,
        message: `Sesi berhasil dipindahkan ke Terapi #${movedSessionPlanNumber}`,
        data: {
          setId: editablePlan.therapyPlanSetId,
          originalSetId: editablePlan.therapyPlanSetId,
          version: set?.version || 1,
          totalPlans,
          editedPlans: 0,
          sessionTherapyPlanId: editablePlan.id,
        },
      };
    }

    const result = await this.therapyPlanSetEditService.bulkEditTherapyPlanSet(
      editablePlan.therapyPlanSetId,
      { ...data, plans },
      { editableTreatmentSessionId: sessionId, updatedBy: userId }
    );

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'TherapyPlanSet',
      resourceId: result.data.setId,
      meta: {
        sessionId,
        originalSetId: result.data.originalSetId,
        version: result.data.version,
        editedPlans: result.data.editedPlans,
      },
    });

    return result;
  }
}
