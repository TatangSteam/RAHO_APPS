/**
 * Service for bulk therapy plan creation
 */

import { prisma } from '@/lib/prisma';

interface BulkTherapyPlanInput {
  keterangan: string;
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

interface BulkCreateTherapyPlansInput {
  therapyPlans: BulkTherapyPlanInput[];
}

export class MemberTherapyPlanBulkService {
  /**
   * Get member active package summary for bulk creation
   * NOTE: Package is now OPTIONAL - members can create therapy plans without packages
   */
  async getMemberPackageSummary(memberId: string) {
    // Get member with basic info
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        registrationBranch: {
          select: {
            branchCode: true,
          },
        },
        user: {
          include: {
            profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw {
        status: 404,
        code: 'MEMBER_NOT_FOUND',
        message: 'Member tidak ditemukan',
      };
    }

    // Find active member package (OPTIONAL - may not exist)
    const memberPackage = await prisma.memberPackage.findFirst({
      where: {
        memberId,
        status: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // If no package, return basic info with unlimited creation
    if (!memberPackage) {
      console.log('ℹ️ Member has no active package - unlimited therapy plan creation allowed');
      return {
        member: {
          id: member.id,
          memberNo: member.memberNo,
          fullName: member.user.profile?.fullName || 'N/A',
        },
        package: null, // No package
        therapyPlans: {
          existing: 0,
          canCreate: 999, // Unlimited (represented as large number)
          maxRecommended: 999,
        },
      };
    }

    // Count ALL therapy plans for debugging
    const allTherapyPlansCount = await prisma.therapyPlan.count({
      where: { memberId },
    });

    // Count UNUSED therapy plans for this member
    // (Therapy plans that haven't been used in a session yet)
    const unusedTherapyPlansCount = await prisma.therapyPlan.count({
      where: {
        memberId,
        treatmentSessionId: null, // Not used in any session yet
      },
    });

    console.log('📊 Therapy Plans Count:');
    console.log('  All therapy plans:', allTherapyPlansCount);
    console.log('  Unused (treatmentSessionId = null):', unusedTherapyPlansCount);
    console.log('  Used (treatmentSessionId != null):', allTherapyPlansCount - unusedTherapyPlansCount);

    // Calculate available slots
    const sessionsRemaining = memberPackage.totalSessions - memberPackage.usedSessions;
    const sessionsTotal = memberPackage.totalSessions;
    const sessionsUsed = memberPackage.usedSessions;

    // Calculate how many more therapy plans can be created
    // NOTE: This is now just for INFORMATION, not enforced
    const therapyPlansCanCreate = Math.max(0, sessionsRemaining - unusedTherapyPlansCount);

    console.log('🔍 Package Summary Debug (FIXED VERSION):');
    console.log('  Member ID:', memberId);
    console.log('  Package ID:', memberPackage.id);
    console.log('  Package Type:', memberPackage.packageType);
    console.log('  Total Sessions:', sessionsTotal);
    console.log('  Used Sessions:', sessionsUsed);
    console.log('  Sessions Remaining:', sessionsRemaining);
    console.log('  Unused Therapy Plans Count:', unusedTherapyPlansCount);
    console.log('  Can Create (recommendation):', therapyPlansCanCreate);
    console.log('  Formula:', `Math.max(0, ${sessionsRemaining} - ${unusedTherapyPlansCount}) = ${therapyPlansCanCreate}`);

    return {
      member: {
        id: member.id,
        memberNo: member.memberNo,
        fullName: member.user.profile?.fullName || 'N/A',
      },
      package: {
        id: memberPackage.id,
        packageName: memberPackage.packageType,
        vouchersTotal: sessionsTotal,
        vouchersUsed: sessionsUsed,
        vouchersRemaining: sessionsRemaining,
        status: memberPackage.status,
      },
      therapyPlans: {
        existing: unusedTherapyPlansCount, // Show unused plans (the ones that matter)
        canCreate: therapyPlansCanCreate, // Recommendation only, not enforced
        maxRecommended: sessionsRemaining, // Can't create more than remaining sessions
      },
    };
  }

  /**
   * Validate bulk therapy plan creation
   * NOTE: Voucher validation is now REMOVED - users can create unlimited therapy plans
   */
  private async validateBulkCreation(
    memberId: string,
    therapyPlansCount: number
  ): Promise<{ isValid: boolean; error?: string; packageInfo?: Awaited<ReturnType<typeof this.getMemberPackageSummary>> }> {
    // Get package summary (optional - member may not have package)
    let packageInfo: Awaited<ReturnType<typeof this.getMemberPackageSummary>>;
    try {
      packageInfo = await this.getMemberPackageSummary(memberId);
    } catch (error: any) {
      // If no package, that's OK - allow creation anyway
      console.log('⚠️ No package found, but allowing therapy plan creation');
      return {
        isValid: true,
      };
    }

    // NO VALIDATION - just return success
    // Package info is for display purposes only
    console.log(`✅ Validation passed - creating ${therapyPlansCount} therapy plans (no voucher limit)`);

    return {
      isValid: true,
      packageInfo,
    };
  }

  /**
   * Validate individual therapy plan data
   */
  private validateTherapyPlanData(
    plan: BulkTherapyPlanInput,
    index: number
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if at least one dose field is filled
    const hasDose =
      plan.ifa250 ||
      plan.ifa500 ||
      plan.hho ||
      plan.h2 ||
      plan.no ||
      plan.gaso ||
      plan.o2 ||
      plan.o3 ||
      plan.edta ||
      plan.mb ||
      plan.h2s ||
      plan.kcl ||
      plan.jmlNb;

    if (!hasDose) {
      errors.push(
        `Row ${index + 1}: Minimal satu field dosis harus diisi`
      );
    }

    // Check IFA mutual exclusivity
    if (plan.ifa250 && plan.ifa500) {
      errors.push(
        `Row ${index + 1}: IFA 250ml dan IFA 500ml tidak boleh diisi bersamaan`
      );
    }

    // Validate numeric values
    const numericFields = [
      'ifa250',
      'ifa500',
      'hho',
      'h2',
      'no',
      'gaso',
      'o2',
      'o3',
      'edta',
      'mb',
      'h2s',
      'kcl',
      'jmlNb',
    ] as const;

    for (const field of numericFields) {
      const value = plan[field];
      if (value !== null && value !== undefined) {
        if (typeof value !== 'number' || value < 0) {
          errors.push(
            `Row ${index + 1}: ${field} harus berupa angka >= 0`
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Bulk create therapy plans
   */
  async bulkCreateTherapyPlans(
    memberId: string,
    input: BulkCreateTherapyPlansInput
  ) {
    const { therapyPlans } = input;

    // Validate therapy plans count
    if (!therapyPlans || therapyPlans.length === 0) {
      throw {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'Therapy plans array tidak boleh kosong',
      };
    }

    if (therapyPlans.length > 50) {
      throw {
        status: 400,
        code: 'TOO_MANY_PLANS',
        message: 'Maksimal 50 therapy plans dapat dibuat sekaligus',
      };
    }

    // Validate bulk creation
    const validation = await this.validateBulkCreation(
      memberId,
      therapyPlans.length
    );

    if (!validation.isValid) {
      throw {
        status: 400,
        code: 'VALIDATION_FAILED',
        message: validation.error,
      };
    }

    // Validate each therapy plan
    const allErrors: string[] = [];
    therapyPlans.forEach((plan, index) => {
      const planValidation = this.validateTherapyPlanData(plan, index);
      if (!planValidation.isValid) {
        allErrors.push(...planValidation.errors);
      }
    });

    if (allErrors.length > 0) {
      throw {
        status: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validasi gagal',
        errors: allErrors,
      };
    }

    // Get member to generate plan codes
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        memberNo: true,
        registrationBranch: {
          select: {
            branchCode: true,
          },
        },
      },
    });

    if (!member) {
      throw {
        status: 404,
        code: 'MEMBER_NOT_FOUND',
        message: 'Member tidak ditemukan',
      };
    }

    // Create all therapy plans in a transaction
    const createdPlans = await prisma.$transaction(
      therapyPlans.map((plan, index) => {
        // Generate unique plan code using timestamp and index
        const timestamp = Date.now();
        const planCode = `TPL-${member.registrationBranch.branchCode}-${timestamp}-${index}`;

        return prisma.therapyPlan.create({
          data: {
            planCode,
            memberId,
            keterangan: plan.keterangan,
            ifa250: plan.ifa250,
            ifa500: plan.ifa500,
            hho: plan.hho,
            h2: plan.h2,
            no: plan.no,
            gaso: plan.gaso,
            o2: plan.o2,
            o3: plan.o3,
            edta: plan.edta,
            mb: plan.mb,
            h2s: plan.h2s,
            kcl: plan.kcl,
            jmlNb: plan.jmlNb,
          },
        });
      })
    );

    return {
      success: true,
      message: `Berhasil membuat ${createdPlans.length} therapy plans`,
      data: {
        created: createdPlans.length,
        therapyPlans: createdPlans.map((plan) => ({
          id: plan.id,
          planCode: plan.planCode,
          keterangan: plan.keterangan,
          createdAt: plan.createdAt.toISOString(),
        })),
      },
    };
  }
}
