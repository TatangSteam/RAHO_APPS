/**
 * Service for set-level therapy plan versioning.
 * Editing one row creates a new set version and copies every row in the set.
 */

import { prisma } from '@/lib/prisma';
import { normalizeIfaSubstances, type TherapyPlanSubstance } from '@/utils/therapyPlanSubstances';
import { Prisma } from '@prisma/client';

export interface EditTherapyPlanInput {
  keterangan?: string;
  ifa250?: number | null;
  ifa500?: number | null;
  hho?: number | null;
  hhoKonsentrat?: number | null;
  h2?: number | null;
  no?: number | null;
  gaso?: number | null;
  o2?: number | null;
  o3?: number | null;
  edta?: number | null;
  mb?: number | null;
  h2s?: number | null;
  kcl?: number | null;
  jmlNb?: number | null;
  ifaSubstances?: TherapyPlanSubstance[] | null;
  ifaSubstanceTotalMl?: number | null;
}

function padSequence(value: number, size = 2) {
  return String(value).padStart(size, '0');
}

function createPlanCodeFromSet(setCode: string, planNumber: number) {
  return `${setCode.replace(/^TPS-/, 'TP-')}-${padSequence(planNumber)}`;
}

export class MemberTherapyPlanEditService {
  async editTherapyPlan(therapyPlanId: string, input: EditTherapyPlanInput) {
    const originalPlan = await prisma.therapyPlan.findUnique({
      where: { id: therapyPlanId },
      include: {
        therapyPlanSet: true,
        member: {
          include: {
            registrationBranch: {
              select: { branchCode: true },
            },
          },
        },
      },
    });

    if (!originalPlan) {
      throw { status: 404, code: 'THERAPY_PLAN_NOT_FOUND', message: 'Therapy plan tidak ditemukan' };
    }

    if (originalPlan.treatmentSessionId) {
      throw {
        status: 400,
        code: 'THERAPY_PLAN_IN_USE',
        message: 'Therapy plan sudah digunakan dalam sesi treatment, tidak dapat diedit. Buat versi set baru dari plan yang belum digunakan.',
      };
    }

    if (originalPlan.supersededById || originalPlan.therapyPlanSet?.status === 'SUPERSEDED') {
      throw {
        status: 400,
        code: 'THERAPY_PLAN_EDIT_HISTORY',
        message: 'Therapy plan ini merupakan history edit, tidak dapat diedit lagi',
      };
    }

    if (input.ifa250 && input.ifa500) {
      throw {
        status: 400,
        code: 'IFA_MUTUAL_EXCLUSIVE',
        message: 'IFA 250ml dan IFA 500ml tidak boleh diisi bersamaan',
      };
    }

    const hasDose =
      input.ifa250 ||
      input.ifa500 ||
      input.hho ||
      input.hhoKonsentrat ||
      input.h2 ||
      input.no ||
      input.gaso ||
      input.o2 ||
      input.o3 ||
      input.edta ||
      input.mb ||
      input.h2s ||
      input.kcl ||
      input.jmlNb;

    if (!hasDose) {
      throw { status: 400, code: 'NO_DOSE_PROVIDED', message: 'Minimal satu field dosis harus diisi' };
    }

    const originalSet = originalPlan.therapyPlanSet;
    const plansInSet = originalSet
      ? await prisma.therapyPlan.findMany({
          where: { therapyPlanSetId: originalSet.id },
          orderBy: [{ planNumber: 'asc' }, { createdAt: 'asc' }],
        })
      : [originalPlan];

    const baseSetCode = originalSet?.setCode || originalPlan.planCode.replace(/-\d+$/i, '');
    const newVersion = (originalSet?.version || originalPlan.version || 1) + 1;
    const newSetCode = `${baseSetCode.replace(/-V\d+$/i, '')}-V${newVersion}`;

    const result = await prisma.$transaction(async (tx) => {
      const newSet = await tx.therapyPlanSet.create({
        data: {
          memberId: originalPlan.memberId!,
          setCode: newSetCode,
          name: originalSet?.name || null,
          version: newVersion,
          status: 'ACTIVE',
          createdBy: originalSet?.createdBy || null,
        },
      });

      const copiedPlans = [];

      for (const oldPlan of plansInSet) {
        const isEditedPlan = oldPlan.id === therapyPlanId;
        const planNumber = oldPlan.planNumber || copiedPlans.length + 1;
        const ifaSubstanceData =
          isEditedPlan && input.ifaSubstances !== undefined
            ? normalizeIfaSubstances(input.ifaSubstances, Boolean(input.ifa250 && input.ifa250 > 0))
            : {
                ifaSubstances: oldPlan.ifaSubstances,
                ifaSubstanceTotalMl: oldPlan.ifaSubstanceTotalMl,
                noInIfa: oldPlan.noInIfa,
              };

        const copiedPlan = await tx.therapyPlan.create({
          data: {
            planCode: createPlanCodeFromSet(newSetCode, planNumber),
            member: oldPlan.memberId ? { connect: { id: oldPlan.memberId } } : undefined,
            therapyPlanSet: { connect: { id: newSet.id } },
            planNumber,
            keterangan: isEditedPlan && input.keterangan !== undefined ? input.keterangan : oldPlan.keterangan,
            ifa250: isEditedPlan && input.ifa250 !== undefined ? input.ifa250 : oldPlan.ifa250,
            ifa500: isEditedPlan && input.ifa500 !== undefined ? input.ifa500 : oldPlan.ifa500,
            hho: isEditedPlan && input.hho !== undefined ? input.hho : oldPlan.hho,
            hhoKonsentrat: isEditedPlan && input.hhoKonsentrat !== undefined ? input.hhoKonsentrat : oldPlan.hhoKonsentrat,
            h2: isEditedPlan && input.h2 !== undefined ? input.h2 : oldPlan.h2,
            no: isEditedPlan && input.no !== undefined ? input.no : oldPlan.no,
            gaso: isEditedPlan && input.gaso !== undefined ? input.gaso : oldPlan.gaso,
            o2: isEditedPlan && input.o2 !== undefined ? input.o2 : oldPlan.o2,
            o3: isEditedPlan && input.o3 !== undefined ? input.o3 : oldPlan.o3,
            edta: isEditedPlan && input.edta !== undefined ? input.edta : oldPlan.edta,
            mb: isEditedPlan && input.mb !== undefined ? input.mb : oldPlan.mb,
            h2s: isEditedPlan && input.h2s !== undefined ? input.h2s : oldPlan.h2s,
            kcl: isEditedPlan && input.kcl !== undefined ? input.kcl : oldPlan.kcl,
            jmlNb: isEditedPlan && input.jmlNb !== undefined ? input.jmlNb : oldPlan.jmlNb,
            ifaSubstances: ifaSubstanceData.ifaSubstances === null
              ? Prisma.JsonNull
              : ifaSubstanceData.ifaSubstances as Prisma.InputJsonValue,
            ifaSubstanceTotalMl: ifaSubstanceData.ifaSubstanceTotalMl,
            noInIfa: ifaSubstanceData.noInIfa,
            version: newVersion,
          },
        });

        copiedPlans.push({ oldPlan, copiedPlan });
      }

      if (originalSet) {
        await tx.therapyPlanSet.update({
          where: { id: originalSet.id },
          data: {
            status: 'SUPERSEDED',
            supersededById: newSet.id,
          },
        });
      }

      for (const pair of copiedPlans) {
        await tx.therapyPlan.update({
          where: { id: pair.oldPlan.id },
          data: {
            supersededById: pair.copiedPlan.id,
            supersededAt: new Date(),
          },
        });
      }

      const editedNewPlan = copiedPlans.find((pair) => pair.oldPlan.id === therapyPlanId)?.copiedPlan;
      return { newSet, copiedPlans, editedNewPlan };
    });

    return {
      success: true,
      message: `Set therapy plan berhasil dibuat versi ${result.newSet.version}`,
      data: {
        setId: result.newSet.id,
        setCode: result.newSet.setCode,
        version: result.newSet.version,
        editedPlanId: result.editedNewPlan?.id,
        copiedPlans: result.copiedPlans.length,
        originalPlanId: therapyPlanId,
        originalSetId: originalSet?.id || null,
        createdAt: result.newSet.createdAt.toISOString(),
      },
    };
  }

  async getTherapyPlanHistory(therapyPlanId: string) {
    const plan = await prisma.therapyPlan.findUnique({
      where: { id: therapyPlanId },
      include: { therapyPlanSet: true },
    });

    if (!plan) {
      throw { status: 404, code: 'THERAPY_PLAN_NOT_FOUND', message: 'Therapy plan tidak ditemukan' };
    }

    if (plan.therapyPlanSetId && plan.therapyPlanSet) {
      const baseSetCode = plan.therapyPlanSet.setCode.replace(/-V\d+$/i, '');
      const setVersions = await prisma.therapyPlanSet.findMany({
        where: {
          memberId: plan.memberId!,
          setCode: { startsWith: baseSetCode },
        },
        include: {
          plans: {
            orderBy: [{ planNumber: 'asc' }, { createdAt: 'asc' }],
          },
        },
        orderBy: { version: 'desc' },
      });

      return {
        success: true,
        data: {
          currentVersion: setVersions[0] || plan.therapyPlanSet,
          versions: setVersions,
          totalVersions: setVersions.length,
        },
      };
    }

    const allPlans = await prisma.therapyPlan.findMany({
      where: {
        OR: [
          { supersededById: plan.id },
          { id: plan.id },
          ...(plan.supersededById ? [{ id: plan.supersededById }] : []),
        ],
      },
      orderBy: { version: 'desc' },
    });

    return {
      success: true,
      data: {
        currentVersion: allPlans[0] || plan,
        versions: allPlans,
        totalVersions: allPlans.length,
      },
    };
  }
}
