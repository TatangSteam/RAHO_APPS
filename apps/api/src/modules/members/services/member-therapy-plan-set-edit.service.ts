/**
 * Service for bulk editing therapy plan sets.
 * Allows editing multiple plans in a set at once, creating a new set version.
 */

import { prisma } from '../../../lib/prisma';
import { normalizeIfaSubstances, type TherapyPlanSubstance } from '../../../utils/therapyPlanSubstances';
import { syncSessionInfusionToTherapyPlan } from '../../sessions/services/infusion-material-sync.service';
import { Prisma, type TherapyPlan } from '@prisma/client';

interface EditPlanInput {
  planNumber: number;
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

export interface BulkEditSetInput {
  newSetName?: string; // Optional: Custom set name (only for authorized users)
  retainedPlanNumbers?: number[];
  plans: EditPlanInput[];
}

interface BulkEditSetOptions {
  editableTreatmentSessionId?: string;
  updatedBy?: string;
}

function padSequence(value: number, size = 2) {
  return String(value).padStart(size, '0');
}

function createPlanCodeFromSet(setCode: string, planNumber: number) {
  return `${setCode.replace(/^TPS-/, 'TP-')}-${padSequence(planNumber)}`;
}

/**
 * Generate a new name for the edited set with current date
 * Format: "Set #[number] - [current date]"
 * Example: "Set #1 - 20 Jun"
 * 
 * IMPORTANT: When editing, the set NUMBER must stay the same, only date changes.
 * The set number comes from the original name, NOT from the setCode sequence.
 */
function generateEditedSetName(originalName: string | null, setCode: string): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short'
  });

  let setNumber: number | null = null;

  // ALWAYS try to extract set number from original name first
  if (originalName) {
    // Try to extract number from name like "Set #1 - 19 Jun" or "Set#1-20 jun v1"
    const nameMatch = originalName.match(/Set\s*#?(\d+)/i);
    if (nameMatch) {
      setNumber = parseInt(nameMatch[1], 10);
      // Use the extracted number and return immediately to preserve original set number
      return `Set #${setNumber} - ${dateStr}`;
    }
  }

  // Only if original name doesn't exist or doesn't contain set number,
  // extract from setCode as fallback (e.g., "TPS-PST-MBR-PST-0008-003" -> 3)
  const codeMatch = setCode.match(/(\d+)$/);
  if (codeMatch) {
    setNumber = parseInt(codeMatch[1], 10);
    return `Set #${setNumber} - ${dateStr}`;
  }

  // Fallback if no number found anywhere
  return `Set ${dateStr}`;
}

export class MemberTherapyPlanSetEditService {
  async deleteTherapyPlanSet(memberId: string, setId: string) {
    const set = await prisma.therapyPlanSet.findUnique({
      where: { id: setId },
      include: {
        plans: {
          select: {
            id: true,
            planCode: true,
            planNumber: true,
            treatmentSessionId: true,
            supersededById: true,
            _count: {
              select: {
                infusions: true,
              },
            },
          },
        },
        supersedes: {
          select: { id: true },
        },
      },
    });

    if (!set || set.memberId !== memberId) {
      throw { status: 404, code: 'THERAPY_PLAN_SET_NOT_FOUND', message: 'Set therapy plan tidak ditemukan' };
    }

    if (set.supersededById || set.supersedes.length > 0) {
      throw {
        status: 409,
        code: 'THERAPY_PLAN_SET_HAS_HISTORY',
        message: 'Set therapy plan yang memiliki riwayat versi tidak dapat dihapus',
      };
    }

    const usedPlan = set.plans.find((plan) => plan.treatmentSessionId || plan._count.infusions > 0);
    if (usedPlan) {
      throw {
        status: 409,
        code: 'THERAPY_PLAN_SET_IN_USE',
        message: `Terapi #${usedPlan.planNumber || usedPlan.planCode} sudah digunakan dalam sesi dan tidak dapat dihapus`,
      };
    }

    const planIds = set.plans.map((plan) => plan.id);
    if (planIds.length > 0) {
      const supersedingPlanCount = await prisma.therapyPlan.count({
        where: {
          supersededById: { in: planIds },
        },
      });

      if (supersedingPlanCount > 0 || set.plans.some((plan) => plan.supersededById)) {
        throw {
          status: 409,
          code: 'THERAPY_PLAN_SET_HAS_HISTORY',
          message: 'Set therapy plan yang memiliki riwayat versi tidak dapat dihapus',
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.therapyPlan.deleteMany({
        where: {
          therapyPlanSetId: setId,
          memberId,
        },
      });

      await tx.therapyPlanSet.delete({
        where: { id: setId },
      });
    });

    return {
      message: 'Set therapy plan berhasil dihapus',
      data: {
        setId,
        deletedPlans: set.plans.length,
      },
    };
  }

  async bulkEditTherapyPlanSet(
    setId: string,
    input: BulkEditSetInput,
    options: BulkEditSetOptions = {}
  ) {
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

    // 2. Identify used plans (plans that have been used in sessions)
    const editableSessionPlan = options.editableTreatmentSessionId
      ? originalSet.plans.find(
          (plan) => plan.treatmentSessionId === options.editableTreatmentSessionId
        )
      : null;

    if (options.editableTreatmentSessionId && !editableSessionPlan) {
      throw {
        status: 400,
        code: 'SESSION_THERAPY_PLAN_NOT_IN_SET',
        message: 'Therapy plan sesi tidak ditemukan pada set yang akan diedit',
      };
    }

    const usedPlans = originalSet.plans.filter(
      (plan) =>
        plan.treatmentSessionId &&
        plan.treatmentSessionId !== options.editableTreatmentSessionId
    );
    const usedPlanNumbers = new Set(usedPlans.map((p) => p.planNumber || 0));
    const originalPlanNumbers = originalSet.plans
      .map((plan) => plan.planNumber || 0)
      .filter((planNumber) => planNumber > 0);
    const existingPlanNumbers = new Set(originalPlanNumbers);

    // 3. Validate input plans and check for edits to locked plans
    const planEditsMap = new Map<number, EditPlanInput>();
    const attemptedLockedEdits: number[] = [];
    
    input.plans.forEach((planInput) => {
      if (!Number.isInteger(planInput.planNumber) || planInput.planNumber < 1) {
        throw {
          status: 400,
          code: 'INVALID_PLAN_NUMBER',
          message: 'Nomor terapi harus berupa angka positif',
        };
      }

      // Check if trying to edit a locked (used) plan
      if (usedPlanNumbers.has(planInput.planNumber)) {
        attemptedLockedEdits.push(planInput.planNumber);
        return; // Skip this plan, don't add to edits
      }

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
        planInput.hhoKonsentrat ||
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

    // If there were attempts to edit locked plans, throw error
    if (attemptedLockedEdits.length > 0) {
      throw {
        status: 400,
        code: 'LOCKED_PLAN_EDIT_ATTEMPT',
        message: `Plan ${attemptedLockedEdits.join(', ')} sudah digunakan dalam sesi dan tidak dapat diedit (terkunci).`,
      };
    }

    const retainedPlanNumbers = input.retainedPlanNumbers
      ? [...new Set(input.retainedPlanNumbers)].sort((a, b) => a - b)
      : [...new Set([...originalPlanNumbers, ...planEditsMap.keys()])].sort((a, b) => a - b);
    const retainedPlanNumberSet = new Set(retainedPlanNumbers);

    if (retainedPlanNumbers.length === 0) {
      throw {
        status: 400,
        code: 'NO_RETAINED_PLANS',
        message: 'Minimal satu terapi harus tersisa dalam set',
      };
    }

    if (retainedPlanNumbers.length > 50) {
      throw {
        status: 400,
        code: 'TOO_MANY_RETAINED_PLANS',
        message: 'Maksimal 50 terapi dalam satu set',
      };
    }

    const editedButRemovedPlanNumbers = [...planEditsMap.keys()].filter(
      (planNumber) => !retainedPlanNumberSet.has(planNumber)
    );
    if (editedButRemovedPlanNumbers.length > 0) {
      throw {
        status: 400,
        code: 'EDITED_PLAN_NOT_RETAINED',
        message: `Terapi #${editedButRemovedPlanNumbers.join(', #')} diedit tetapi tidak termasuk dalam set yang disimpan`,
      };
    }

    const retainedNewPlanNumbersWithoutData = retainedPlanNumbers.filter(
      (planNumber) => !existingPlanNumbers.has(planNumber) && !planEditsMap.has(planNumber)
    );
    if (retainedNewPlanNumbersWithoutData.length > 0) {
      throw {
        status: 400,
        code: 'NEW_PLAN_DATA_REQUIRED',
        message: `Data terapi #${retainedNewPlanNumbersWithoutData.join(', #')} belum lengkap`,
      };
    }

    const removedOriginalPlanNumbers = originalPlanNumbers.filter(
      (planNumber) => !retainedPlanNumberSet.has(planNumber)
    );
    const removedLockedPlanNumbers = removedOriginalPlanNumbers.filter((planNumber) =>
      usedPlanNumbers.has(planNumber)
    );
    if (removedLockedPlanNumbers.length > 0) {
      throw {
        status: 400,
        code: 'LOCKED_PLAN_REMOVE_ATTEMPT',
        message: `Terapi #${removedLockedPlanNumbers.join(', #')} sudah digunakan dalam sesi dan tidak dapat dihapus`,
      };
    }

    if (
      editableSessionPlan?.planNumber &&
      !retainedPlanNumberSet.has(editableSessionPlan.planNumber)
    ) {
      throw {
        status: 400,
        code: 'SESSION_PLAN_REMOVE_ATTEMPT',
        message: `Terapi #${editableSessionPlan.planNumber} sedang digunakan sesi ini dan tidak dapat dihapus`,
      };
    }

    const addedPlanNumbers = retainedPlanNumbers.filter(
      (planNumber) => !existingPlanNumbers.has(planNumber)
    );
    const hasPlanStructureChange =
      removedOriginalPlanNumbers.length > 0 || addedPlanNumbers.length > 0;
    const setNameChanged =
      input.newSetName !== undefined && input.newSetName !== originalSet.name;

    // If no edits remain after filtering locked plans and nothing else changed
    if (planEditsMap.size === 0 && !hasPlanStructureChange && !setNameChanged) {
      throw {
        status: 400,
        code: 'NO_VALID_EDITS',
        message: 'Tidak ada perubahan therapy plan set yang dapat disimpan.',
      };
    }

    // 4. Create new set version
    const newVersion = originalSet.version + 1;
    const baseSetCode = originalSet.setCode.replace(/-V\d+$/i, '');
    const newSetCode = `${baseSetCode}-V${newVersion}`;

    const result = await prisma.$transaction(async (tx) => {
      // Determine set name: use custom name if provided, otherwise auto-generate
      const setName = input.newSetName || generateEditedSetName(originalSet.name, baseSetCode);
      
      // Create new set with updated name containing current date
      const newSet = await tx.therapyPlanSet.create({
        data: {
          memberId: originalSet.memberId,
          setCode: newSetCode,
          name: setName,
          version: newVersion,
          status: 'ACTIVE',
          createdBy: originalSet.createdBy,
        },
      });

      const copiedPlans: Array<{
        oldPlan: TherapyPlan | null;
        copiedPlan: TherapyPlan;
        edited: boolean;
      }> = [];
      const newPlanInputs: EditPlanInput[] = [];

      // Identify new plans (plans that don't exist in original set)
      retainedPlanNumbers.forEach((planNumber) => {
        const planInput = planEditsMap.get(planNumber);
        if (planInput && !existingPlanNumbers.has(planNumber)) {
          newPlanInputs.push(planInput);
        }
      });

      // Copy retained existing plans with edits applied
      for (const oldPlan of originalSet.plans) {
        const planNumber = oldPlan.planNumber || 1;
        if (!retainedPlanNumberSet.has(planNumber)) {
          continue;
        }

        const editInput = planEditsMap.get(planNumber);
        const hasEdit = !!editInput;

        // Prepare IFA substance data
        const ifaSubstanceData =
          hasEdit && editInput.ifaSubstances !== undefined
            ? normalizeIfaSubstances(editInput.ifaSubstances, Boolean(editInput.ifa250 && editInput.ifa250 > 0))
            : {
                ifaSubstances: oldPlan.ifaSubstances,
                ifaSubstanceTotalMl: oldPlan.ifaSubstanceTotalMl,
                noInIfa: oldPlan.noInIfa,
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
            hhoKonsentrat: hasEdit && editInput.hhoKonsentrat !== undefined ? editInput.hhoKonsentrat : oldPlan.hhoKonsentrat,
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
            ifaSubstances: ifaSubstanceData.ifaSubstances === null
              ? Prisma.JsonNull
              : ifaSubstanceData.ifaSubstances as Prisma.InputJsonValue,
            ifaSubstanceTotalMl: ifaSubstanceData.ifaSubstanceTotalMl,
            noInIfa: ifaSubstanceData.noInIfa,
            version: newVersion,
          },
        });

        copiedPlans.push({ oldPlan, copiedPlan, edited: hasEdit });
      }

      // Create new plans (plans that didn't exist in original set)
      for (const newPlanInput of newPlanInputs) {
        const planNumber = newPlanInput.planNumber;
        
        // Prepare IFA substance data for new plan
        const ifaSubstanceData = newPlanInput.ifaSubstances !== undefined
          ? normalizeIfaSubstances(newPlanInput.ifaSubstances, Boolean(newPlanInput.ifa250 && newPlanInput.ifa250 > 0))
          : { ifaSubstances: null, ifaSubstanceTotalMl: null, noInIfa: null };

        const newPlan = await tx.therapyPlan.create({
          data: {
            planCode: createPlanCodeFromSet(newSetCode, planNumber),
            member: { connect: { id: originalSet.memberId } },
            therapyPlanSet: { connect: { id: newSet.id } },
            planNumber,
            keterangan: newPlanInput.keterangan || '',
            ifa250: newPlanInput.ifa250,
            ifa500: newPlanInput.ifa500,
            hho: newPlanInput.hho,
            hhoKonsentrat: newPlanInput.hhoKonsentrat,
            h2: newPlanInput.h2,
            no: newPlanInput.no,
            gaso: newPlanInput.gaso,
            o2: newPlanInput.o2,
            o3: newPlanInput.o3,
            edta: newPlanInput.edta,
            mb: newPlanInput.mb,
            h2s: newPlanInput.h2s,
            kcl: newPlanInput.kcl,
            jmlNb: newPlanInput.jmlNb,
            ifaSubstances: ifaSubstanceData.ifaSubstances
              ? ifaSubstanceData.ifaSubstances as unknown as Prisma.InputJsonValue
              : Prisma.JsonNull,
            ifaSubstanceTotalMl: ifaSubstanceData.ifaSubstanceTotalMl,
            noInIfa: ifaSubstanceData.noInIfa,
            version: newVersion,
          },
        });

        // Add to copiedPlans as edited (new plans are always "edited")
        copiedPlans.push({ oldPlan: null, copiedPlan: newPlan, edited: true });
      }

      // Mark old set as SUPERSEDED
      await tx.therapyPlanSet.update({
        where: { id: originalSet.id },
        data: {
          status: 'SUPERSEDED',
          supersededById: newSet.id,
        },
      });

      // Update old plans with supersededById (skip new plans that don't have oldPlan)
      for (const pair of copiedPlans) {
        if (pair.oldPlan) {
          await tx.therapyPlan.update({
            where: { id: pair.oldPlan.id },
            data: {
              supersededById: pair.copiedPlan.id,
              supersededAt: new Date(),
            },
          });
        }
      }

      let sessionTherapyPlanId: string | null = null;

      for (const pair of copiedPlans) {
        if (!pair.oldPlan?.treatmentSessionId) {
          continue;
        }

        await tx.therapyPlan.update({
          where: { id: pair.oldPlan.id },
          data: { treatmentSessionId: null },
        });

        await tx.therapyPlan.update({
          where: { id: pair.copiedPlan.id },
          data: { treatmentSessionId: pair.oldPlan.treatmentSessionId },
        });

        await tx.infusionExecution.updateMany({
          where: { treatmentSessionId: pair.oldPlan.treatmentSessionId },
          data: { therapyPlanId: pair.copiedPlan.id },
        });

        if (pair.oldPlan.treatmentSessionId === options.editableTreatmentSessionId) {
          sessionTherapyPlanId = pair.copiedPlan.id;
          if (options.updatedBy) {
            await syncSessionInfusionToTherapyPlan(tx, {
              sessionId: pair.oldPlan.treatmentSessionId,
              therapyPlan: pair.copiedPlan,
              userId: options.updatedBy,
            });
          }
        }
      }

      if (editableSessionPlan && options.editableTreatmentSessionId && !sessionTherapyPlanId) {
        throw {
          status: 500,
          code: 'SESSION_THERAPY_PLAN_COPY_MISSING',
          message: 'Gagal membuat versi baru therapy plan sesi',
        };
      }

      return { newSet, copiedPlans, sessionTherapyPlanId };
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
        sessionTherapyPlanId: result.sessionTherapyPlanId,
        createdAt: result.newSet.createdAt.toISOString(),
      },
    };
  }
}
