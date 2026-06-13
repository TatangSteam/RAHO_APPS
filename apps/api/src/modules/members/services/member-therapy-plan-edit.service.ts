/**
 * Service for editing therapy plans with versioning
 * When a therapy plan is edited, a new version is created and the old one is marked as superseded
 */

import { prisma } from '@/lib/prisma';

interface EditTherapyPlanInput {
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
}

export class MemberTherapyPlanEditService {
  /**
   * Edit therapy plan by creating a new version
   * Old version is marked as superseded, not deleted
   */
  async editTherapyPlan(therapyPlanId: string, input: EditTherapyPlanInput) {
    // Get the original therapy plan
    const originalPlan = await prisma.therapyPlan.findUnique({
      where: { id: therapyPlanId },
      include: {
        member: {
          include: {
            registrationBranch: {
              select: {
                branchCode: true,
              },
            },
          },
        },
      },
    });

    if (!originalPlan) {
      throw {
        status: 404,
        code: 'THERAPY_PLAN_NOT_FOUND',
        message: 'Therapy plan tidak ditemukan',
      };
    }

    // Cannot edit if already used in a session
    if (originalPlan.treatmentSessionId) {
      throw {
        status: 400,
        code: 'THERAPY_PLAN_IN_USE',
        message: 'Therapy plan sudah digunakan dalam sesi treatment, tidak dapat diedit',
      };
    }

    // Cannot edit if already superseded
    if (originalPlan.supersededById) {
      throw {
        status: 400,
        code: 'THERAPY_PLAN_ALREADY_SUPERSEDED',
        message: 'Therapy plan ini sudah di-supersede oleh versi yang lebih baru',
      };
    }

    // Validate IFA mutual exclusivity
    if (input.ifa250 && input.ifa500) {
      throw {
        status: 400,
        code: 'IFA_MUTUAL_EXCLUSIVE',
        message: 'IFA 250ml dan IFA 500ml tidak boleh diisi bersamaan',
      };
    }

    // Check if at least one dose field is filled
    const hasDose =
      input.ifa250 ||
      input.ifa500 ||
      input.hho ||
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
      throw {
        status: 400,
        code: 'NO_DOSE_PROVIDED',
        message: 'Minimal satu field dosis harus diisi',
      };
    }

    // Create new version in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate new plan code with incremented version
      const newVersion = originalPlan.version + 1;
      const timestamp = Date.now();
      const newPlanCode = `TPL-${originalPlan.member?.registrationBranch.branchCode}-${timestamp}-V${newVersion}`;

      // Create new therapy plan (new version)
      const newPlan = await tx.therapyPlan.create({
        data: {
          planCode: newPlanCode,
          memberId: originalPlan.memberId,
          keterangan: input.keterangan ?? originalPlan.keterangan,
          ifa250: input.ifa250 !== undefined ? input.ifa250 : originalPlan.ifa250,
          ifa500: input.ifa500 !== undefined ? input.ifa500 : originalPlan.ifa500,
          hho: input.hho !== undefined ? input.hho : originalPlan.hho,
          h2: input.h2 !== undefined ? input.h2 : originalPlan.h2,
          no: input.no !== undefined ? input.no : originalPlan.no,
          gaso: input.gaso !== undefined ? input.gaso : originalPlan.gaso,
          o2: input.o2 !== undefined ? input.o2 : originalPlan.o2,
          o3: input.o3 !== undefined ? input.o3 : originalPlan.o3,
          edta: input.edta !== undefined ? input.edta : originalPlan.edta,
          mb: input.mb !== undefined ? input.mb : originalPlan.mb,
          h2s: input.h2s !== undefined ? input.h2s : originalPlan.h2s,
          kcl: input.kcl !== undefined ? input.kcl : originalPlan.kcl,
          jmlNb: input.jmlNb !== undefined ? input.jmlNb : originalPlan.jmlNb,
          version: newVersion,
        },
      });

      // Mark original as superseded
      await tx.therapyPlan.update({
        where: { id: therapyPlanId },
        data: {
          supersededById: newPlan.id,
          supersededAt: new Date(),
        },
      });

      return newPlan;
    });

    console.log('✅ Therapy Plan Edited:');
    console.log('  Original ID:', therapyPlanId);
    console.log('  Original Version:', originalPlan.version);
    console.log('  New ID:', result.id);
    console.log('  New Version:', result.version);
    console.log('  New Plan Code:', result.planCode);

    return {
      success: true,
      message: `Therapy plan berhasil diedit (versi ${result.version})`,
      data: {
        id: result.id,
        planCode: result.planCode,
        version: result.version,
        keterangan: result.keterangan,
        originalPlanId: therapyPlanId,
        originalVersion: originalPlan.version,
        createdAt: result.createdAt.toISOString(),
      },
    };
  }

  /**
   * Get therapy plan history (all versions)
   */
  async getTherapyPlanHistory(therapyPlanId: string) {
    // Get the therapy plan
    const plan = await prisma.therapyPlan.findUnique({
      where: { id: therapyPlanId },
    });

    if (!plan) {
      throw {
        status: 404,
        code: 'THERAPY_PLAN_NOT_FOUND',
        message: 'Therapy plan tidak ditemukan',
      };
    }

    // Find all versions (walk backwards through supersedes chain)
    const versions: any[] = [];
    let currentPlan: any = plan;

    // Walk forward to find the latest version
    while (currentPlan.supersededById) {
      const nextPlan = await prisma.therapyPlan.findUnique({
        where: { id: currentPlan.supersededById },
      });
      if (!nextPlan) break;
      currentPlan = nextPlan;
    }

    // Now walk backwards to collect all versions
    versions.push(currentPlan);
    
    const allPlans = await prisma.therapyPlan.findMany({
      where: {
        OR: [
          { supersededById: currentPlan.id },
          { id: currentPlan.id },
        ],
      },
      orderBy: { version: 'desc' },
    });

    // Build version chain
    const versionChain: any[] = [];
    let current: any = allPlans.find((p) => !p.supersededById); // Latest version

    while (current) {
      versionChain.push(current);
      current = allPlans.find((p) => p.supersededById === current.id);
    }

    return {
      success: true,
      data: {
        currentVersion: versionChain[0],
        versions: versionChain,
        totalVersions: versionChain.length,
      },
    };
  }
}
