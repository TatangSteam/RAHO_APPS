// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateEncounterCode, generateSessionCode } from '../../../utils/codeGenerator';
import type { CreateSessionInput } from '../sessions.schema';
import { Role, AuditAction, PackageStatus, EncounterStatus } from '@prisma/client';

/**
 * Service for session creation
 */
export class SessionCreationService {
  /**
   * Create a new treatment session
   */
  async createSession(data: CreateSessionInput, branchId: string, userId: string) {
    // 1. Validate member access
    await this.validateMemberAccess(data.memberId, branchId);

    // 2. Validate member package
    const memberPackage = await this.validateMemberPackage(data.memberPackageId, branchId);

    // 3. Validate doctor
    await this.validateDoctor(data.doctorId);

    // 4. Validate nurse
    await this.validateNurse(data.nurseId);

    // 5. Validate diagnosis exists
    await this.validateDiagnosisExists(data.memberId);

    // 6. Validate therapy plan
    await this.validateTherapyPlan(data.therapyPlanId, data.memberId);

    // 7. Validate booster package if provided
    if (data.boosterPackageId) {
      await this.validateBoosterPackage(data.boosterPackageId, branchId);
    }

    // 8. Get branch for code generation
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan' };
    }

    // 9. Calculate infusKe (global and branch-specific)
    const { globalInfusKe, branchInfusKe } = await this.calculateInfusKe(data.memberId, branchId);

    // 10. Create session in transaction
    const result = await this.createSessionTransaction(
      data,
      branchId,
      branch,
      globalInfusKe,
      memberPackage
    );

    // 11. Audit log
    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'TreatmentSession',
      resourceId: result.session.id,
      meta: {
        sessionCode: result.session.sessionCode,
        infusKe: result.session.infusKe,
        globalInfusKe: globalInfusKe,
        branchInfusKe: branchInfusKe,
        branchName: branch.name,
      },
    });

    return {
      sessionId: result.session.id,
      sessionCode: result.session.sessionCode,
      encounterId: result.encounter.id,
      encounterCode: result.encounter.encounterCode,
      infusKe: result.session.infusKe,
      branchInfusKe: branchInfusKe,
      branchName: branch.name,
      infusNote:
        branchInfusKe === 1
          ? `Infus ke-${globalInfusKe} (Infus pertama di ${branch.name})`
          : `Infus ke-${globalInfusKe} (Infus ke-${branchInfusKe} di ${branch.name})`,
      message: 'Sesi terapi berhasil dibuat',
    };
  }

  /**
   * Validate member access to branch
   */
  private async validateMemberAccess(memberId: string, branchId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        registrationBranch: true,
        branchAccesses: true,
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    const hasAccess =
      member.registrationBranchId === branchId ||
      member.branchAccesses.some((access) => access.branchId === branchId);

    if (!hasAccess) {
      throw {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Member tidak memiliki akses ke cabang ini',
      };
    }

    return member;
  }

  /**
   * Validate member package
   */
  private async validateMemberPackage(memberPackageId: string, branchId: string) {
    const memberPackage = await prisma.memberPackage.findUnique({
      where: { id: memberPackageId },
    });

    if (!memberPackage) {
      throw { status: 404, code: 'PACKAGE_NOT_FOUND', message: 'Paket tidak ditemukan' };
    }

    if (memberPackage.branchId !== branchId) {
      throw {
        status: 403,
        code: 'PACKAGE_BRANCH_MISMATCH',
        message: 'Paket tidak terdaftar di cabang ini',
      };
    }

    if (memberPackage.status !== PackageStatus.ACTIVE) {
      throw {
        status: 422,
        code: 'PACKAGE_NOT_ACTIVE',
        message: 'Paket tidak aktif',
      };
    }

    const remainingSessions = memberPackage.totalSessions - memberPackage.usedSessions;
    if (remainingSessions <= 0) {
      throw {
        status: 422,
        code: 'PACKAGE_SESSIONS_EXHAUSTED',
        message: 'Sesi paket sudah habis',
      };
    }

    return memberPackage;
  }

  /**
   * Validate doctor
   */
  private async validateDoctor(doctorId: string) {
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId },
    });

    if (!doctor || doctor.role !== Role.DOCTOR || !doctor.isActive) {
      throw {
        status: 403,
        code: 'INVALID_DOCTOR',
        message: 'Dokter tidak valid atau tidak aktif',
      };
    }

    return doctor;
  }

  /**
   * Validate nurse
   */
  private async validateNurse(nurseId: string) {
    const nurse = await prisma.user.findUnique({
      where: { id: nurseId },
    });

    if (!nurse || nurse.role !== Role.NURSE || !nurse.isActive) {
      throw {
        status: 403,
        code: 'INVALID_NURSE',
        message: 'Nakes tidak valid atau tidak aktif',
      };
    }

    return nurse;
  }

  /**
   * Validate diagnosis exists for member
   */
  private async validateDiagnosisExists(memberId: string) {
    const existingDiagnoses = await prisma.diagnosis.findMany({
      where: { memberId },
    });

    if (existingDiagnoses.length === 0) {
      throw {
        status: 422,
        code: 'DIAGNOSIS_REQUIRED',
        message:
          'Member harus memiliki diagnosa sebelum membuat sesi terapi. Silakan buat diagnosa terlebih dahulu.',
      };
    }

    return existingDiagnoses;
  }

  /**
   * Validate therapy plan
   */
  private async validateTherapyPlan(therapyPlanId: string, memberId: string) {
    const therapyPlan = await prisma.therapyPlan.findUnique({
      where: { id: therapyPlanId },
    });

    if (!therapyPlan) {
      throw {
        status: 404,
        code: 'THERAPY_PLAN_NOT_FOUND',
        message: 'Therapy plan tidak ditemukan',
      };
    }

    if (therapyPlan.memberId && therapyPlan.memberId !== memberId) {
      throw {
        status: 403,
        code: 'THERAPY_PLAN_MISMATCH',
        message: 'Therapy plan bukan milik member ini',
      };
    }

    if (therapyPlan.treatmentSessionId) {
      throw {
        status: 422,
        code: 'THERAPY_PLAN_ALREADY_USED',
        message: 'Therapy plan sudah digunakan di sesi lain',
      };
    }

    return therapyPlan;
  }

  /**
   * Validate booster package
   */
  private async validateBoosterPackage(boosterPackageId: string, branchId: string) {
    const boosterPackage = await prisma.memberPackage.findUnique({
      where: { id: boosterPackageId },
    });

    if (!boosterPackage) {
      throw {
        status: 404,
        code: 'BOOSTER_PACKAGE_NOT_FOUND',
        message: 'Paket booster tidak ditemukan',
      };
    }

    if (boosterPackage.branchId !== branchId) {
      throw {
        status: 403,
        code: 'BOOSTER_BRANCH_MISMATCH',
        message: 'Paket booster tidak terdaftar di cabang ini',
      };
    }

    if (boosterPackage.packageType !== 'BOOSTER') {
      throw { status: 400, code: 'INVALID_BOOSTER_PACKAGE', message: 'Paket bukan tipe BOOSTER' };
    }

    if (boosterPackage.status !== PackageStatus.ACTIVE) {
      throw { status: 422, code: 'BOOSTER_NOT_ACTIVE', message: 'Paket booster tidak aktif' };
    }

    const boosterRemaining = boosterPackage.totalSessions - boosterPackage.usedSessions;
    if (boosterRemaining <= 0) {
      throw { status: 422, code: 'BOOSTER_EXHAUSTED', message: 'Sesi booster sudah habis' };
    }

    return boosterPackage;
  }

  /**
   * Calculate global and branch-specific infusKe
   */
  private async calculateInfusKe(memberId: string, branchId: string) {
    // Get all sessions for this member across all branches
    const allMemberSessions = await prisma.treatmentSession.findMany({
      where: {
        encounter: {
          memberId,
        },
      },
      orderBy: { infusKe: 'desc' },
      take: 1,
    });

    // Get sessions for this member in current branch only
    const branchSessions = await prisma.treatmentSession.findMany({
      where: {
        encounter: {
          memberId,
          branchId,
        },
      },
      orderBy: { infusKe: 'desc' },
      take: 1,
    });

    const globalInfusKe = allMemberSessions.length > 0 ? allMemberSessions[0].infusKe + 1 : 1;
    const branchInfusKe = branchSessions.length > 0 ? branchSessions[0].infusKe + 1 : 1;

    return { globalInfusKe, branchInfusKe };
  }

  /**
   * Create session in transaction
   */
  private async createSessionTransaction(
    data: CreateSessionInput,
    branchId: string,
    branch: any,
    globalInfusKe: number,
    memberPackage: any
  ) {
    return await prisma.$transaction(async (tx) => {
      // Find or create encounter
      let encounter = await tx.encounter.findFirst({
        where: {
          memberPackageId: data.memberPackageId,
          status: EncounterStatus.ONGOING,
        },
      });

      if (!encounter) {
        const encounterCode = generateEncounterCode(branch.branchCode);
        encounter = await tx.encounter.create({
          data: {
            encounterCode,
            memberId: data.memberId,
            branchId,
            memberPackageId: data.memberPackageId,
            adminLayananId: data.adminLayananId,
            doctorId: data.doctorId,
            nurseId: data.nurseId,
            status: EncounterStatus.ONGOING,
          },
        });
      }

      // Generate session code with global infusKe
      const sessionCode = generateSessionCode(branch.branchCode, globalInfusKe);

      // Create treatment session
      const session = await tx.treatmentSession.create({
        data: {
          sessionCode,
          encounterId: encounter.id,
          branchId,
          infusKe: globalInfusKe,
          pelaksanaan: data.pelaksanaan,
          treatmentDate: new Date(data.treatmentDate),
          adminLayananId: data.adminLayananId,
          doctorId: data.doctorId,
          nurseId: data.nurseId,
          boosterPackageId: data.boosterPackageId,
          isCompleted: false,
        },
      });

      // Link therapy plan to session
      await tx.therapyPlan.update({
        where: { id: data.therapyPlanId },
        data: { treatmentSessionId: session.id },
      });

      // Update member package used sessions
      await tx.memberPackage.update({
        where: { id: data.memberPackageId },
        data: { usedSessions: { increment: 1 } },
      });

      // Update member voucher count
      await tx.member.update({
        where: { id: data.memberId },
        data: { voucherCount: { decrement: 1 } },
      });

      // Update booster package if provided
      if (data.boosterPackageId) {
        await tx.memberPackage.update({
          where: { id: data.boosterPackageId },
          data: { usedSessions: { increment: 1 } },
        });
      }

      return { session, encounter };
    });
  }
}
