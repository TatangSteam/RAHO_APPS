/**
 * Service for bulk editing therapy plan sets.
 * Allows editing multiple plans in a set at once, creating a new set version.
 */

import { prisma } from '@/lib/prisma';
import { normalizeIfaSubstances, type TherapyPlanSubstance } from '@/utils/therapyPlanSubstances';

interface EditPlanInput {
  planNumber: number;
  keterangan?: string;
  ifa250?: number | null;
  ifa500?: number | null;
  hho?: number | null;
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

interface BulkEditSetInput {
  plans: EditPlanInput[];
}

function padSequence(value: number, size = 2) {
  return String(value).padStart(size, '0');
}

function createPlanCodeFromSet(setCode: string, planNumber: number) {
  return `${setCode.replace(/^TPS-/, 'TP-')}-${padSequence(planNumber)}`;
}

export class MemberTherapyPlanSetEditService {
  async bulkEditTherapyPlanSet(setId: string, input: BulkEditSetInput) {
    // 1. Get the original set and its plans
    const originalSet = await prisma.therapyPlanSet.findUnique({
      where: { id: setId },
      include: {
        plans: {
          orderBy: [{ planNumber: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!originalSet) {
      throw { status: 404, code: 'THERAPY_PLAN_SET_NOT_FOUND', message: 'Therapy plan set tidak ditemukan' };
    }

    if (originalSet.status === 'SUPERSEDED') {
      throw {
        status: 400,
        code: 'THERAPY_PLAN_SET_SUPERSEDED',
        message: 'Set ini sudah superseded, tidak dapat diedit',
      };
    }

    // 2. Check if any plan in the set has been used
    const usedPlans = originalSet.plans.filter((p) => p.treatmentSessionId);
    if (usedPlans.length > 0) {
      throw {
        status: 400,
        code: 'THERAPY_PLAN_IN_USE',
        message: `${usedPlans.length} plan dalam set ini sudah digunakan, tidak dapat diedit. Buat set baru sebagai gantinya.`,
      };
    }

    // 3. Validate input plans
    const planEditsMap = new Map<number, EditPlanInput>();
    input.plans.forEach((planInput) => {
      // Validate mutual exclusivity
      if (planInput.ifa250 && planInput.ifa500) {
        throw {
          status: 400,
          code: 'IFA_MUTUAL_EXCLUSIVE',
          message: `Plan #${planInput.planNumber}: IFA 250ml dan IFA 500ml tidak boleh diisi bersamaan`,
        };
      }

      // Validate at least one dose
      const hasDose =
        planInput.ifa250 ||
        planInput.ifa500 ||
        planInput.hho ||
        planInput.h2 ||
        planInput.no ||
        planInput.gaso ||
        planInput.o2 ||
        planInput.o3 ||
        planInput.edta ||
        planInput.mb ||
        planInput.h2s ||
        planInput.kcl ||
        planInput.jmlNb;

      if (!hasDose) {
        throw {
          status: 400,
          code: 'NO_DOSE_PROVIDED',
          message: `Plan #${planInput.planNumber}: Minimal satu field dosis harus diisi`,
        };
      }

      planEditsMap.set(planInput.planNumber, planInput);
    });

    // 4. Create new set version
    const newVersion = originalSet.version + 1;
    const baseSetCode = originalSet.setCode.replace(/-V\d+$/i, '');
    const newSetCode = `${baseSetCode}-V${newVersion}`;

    const result = await prisma.$transaction(async (tx) => {
      // Create new set
      const newSet = await tx.therapyPlanSet.create({
        data: {
          memberId: originalSet.memberId,
          setCode: newSetCode,
          name: originalSet.name,
          version: newVersion,
          status: 'ACTIVE',
          createdBy: originalSet.createdBy,
        },
      });

      const copiedPlans = [];

      // Copy all plans with edits applied
      for (const oldPlan of originalSet.plans) {
        const planNumber = oldPlan.planNumber || 1;
        const editInput = planEditsMap.get(planNumber);
        const hasEdit = !!editInput;

        // Prepare IFA substance data
        const ifaSubstanceData =
          hasEdit && editInput.ifaSubstances !== undefined
            ? normalizeIfaSubstances(editInput.ifaSubstances, Boolean(editInput.ifa250 && editInput.ifa250 > 0))
            : {
                ifaSubstances: oldPlan.ifaSubstances,
                ifaSubstanceTotalMl: oldPlan.ifaSubstanceTotalMl,
              };

        const copiedPlan = await tx.therapyPlan.create({
          data: {
            planCode: createPlanCodeFromSet(newSetCode, planNumber),
            member: { connect: { id: originalSet.memberId } },
            therapyPlanSet: { connect: { id: newSet.id } },
            planNumber,
            keterangan: hasEdit && editInput.keterangan !== undefined ? editInput.keterangan : oldPlan.keterangan,
            ifa250: hasEdit && editInput.ifa250 !== undefined ? editInput.ifa250 : oldPlan.ifa250,
            ifa500: hasEdit && editInput.ifa500 !== undefined ? editInput.ifa500 : oldPlan.ifa500,
            hho: hasEdit && editInput.hho !== undefined ? editInput.hho : oldPlan.hho,
            h2: hasEdit && editInput.h2 !== undefined ? editInput.h2 : oldPlan.h2,
            no: hasEdit && editInput.no !== undefined ? editInput.no : oldPlan.no,
            gaso: hasEdit && editInput.gaso !== undefined ? editInput.gaso : oldPlan.gaso,
            o2: hasEdit && editInput.o2 !== undefined ? editInput.o2 : oldPlan.o2,
            o3: hasEdit && editInput.o3 !== undefined ? editInput.o3 : oldPlan.o3,
            edta: hasEdit && editInput.edta !== undefined ? editInput.edta : oldPlan.edta,
            mb: hasEdit && editInput.mb !== undefined ? editInput.mb : oldPlan.mb,
            h2s: hasEdit && editInput.h2s !== undefined ? editInput.h2s : oldPlan.h2s,
            kcl: hasEdit && editInput.kcl !== undefined ? editInput.kcl : oldPlan.kcl,
            jmlNb: hasEdit && editInput.jmlNb !== undefined ? editInput.jmlNb : oldPlan.jmlNb,
            ...ifaSubstanceData,
            version: newVersion,
          } as any,
        });

        copiedPlans.push({ oldPlan, copiedPlan, edited: hasEdit });
      }

      // Mark old set as SUPERSEDED
      await tx.therapyPlanSet.update({
        where: { id: originalSet.id },
        data: {
          status: 'SUPERSEDED',
          supersededById: newSet.id,
        },
      });

      // Update old plans with supersededById
      for (const pair of copiedPlans) {
        await tx.therapyPlan.update({
          where: { id: pair.oldPlan.id },
          data: {
            supersededById: pair.copiedPlan.id,
            supersededAt: new Date(),
          },
        });
      }

      return { newSet, copiedPlans };
    });

    const editedCount = result.copiedPlans.filter((p) => p.edited).length;

    return {
      success: true,
      message: `Set therapy plan berhasil dibuat versi ${result.newSet.version}. ${editedCount} plan diedit.`,
      data: {
        setId: result.newSet.id,
        setCode: result.newSet.setCode,
        version: result.newSet.version,
        totalPlans: result.copiedPlans.length,
        editedPlans: editedCount,
        originalSetId: originalSet.id,
        createdAt: result.newSet.createdAt.toISOString(),
      },
    };
  }
}
