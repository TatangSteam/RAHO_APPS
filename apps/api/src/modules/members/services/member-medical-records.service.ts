// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateDiagnosisCode } from '../../../utils/codeGenerator';
import { AuditAction, Role } from '@prisma/client';

/**
 * Service for managing member medical records (diagnoses, therapy plans, infusions)
 */
export class MemberMedicalRecordsService {
  /**
   * Send notification to member
   */
  async sendNotification(memberId: string, title: string, message: string, _userId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    await prisma.notification.create({
      data: {
        userId: member.userId,
        type: 'INFO',
        title,
        body: message,
        status: 'UNREAD',
      },
    });

    return { message: 'Notifikasi berhasil dikirim' };
  }

  /**
   * Get member diagnoses
   * Only returns original diagnoses (encounterId = null), not session copies
   */
  async getMemberDiagnoses(memberId: string) {
    // Verify member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Get only original diagnoses (not session copies)
    // Original diagnoses have encounterId = null
    // Session copies have encounterId set and diagnosisCode starting with "DXS-"
    const diagnoses = await prisma.diagnosis.findMany({
      where: {
        memberId,
        encounterId: null, // Only original diagnoses, not session copies
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return diagnoses;
  }

  /**
   * Create member diagnosis
   * 
   * IMPORTANT: Diagnoses are created directly linked to member (not encounter).
   * A member can have multiple diagnoses. Diagnoses are NOT tied to encounters
   * to allow flexibility - member can have diagnoses before having any active package.
   */
  async createMemberDiagnosis(memberId: string, data: any, userId: string) {
    // Verify member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        registrationBranch: true,
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Verify doctor exists and is active
    const doctor = await prisma.user.findUnique({
      where: { id: data.doktorPemeriksa },
      include: {
        branch: true,
      },
    });

    if (!doctor || doctor.role !== Role.DOCTOR || !doctor.isActive) {
      throw { status: 403, code: 'INVALID_DOCTOR', message: 'Dokter tidak valid atau tidak aktif' };
    }

    // Generate diagnosis code
    const branchCode = member.registrationBranch.branchCode;
    const prefix = `DX-${branchCode}-`;
    const lastDiagnosis = await prisma.diagnosis.findFirst({
      where: { diagnosisCode: { startsWith: prefix } },
      orderBy: { diagnosisCode: 'desc' },
    });
    
    const sequence = lastDiagnosis 
      ? parseInt(lastDiagnosis.diagnosisCode.split('-').pop() || '0') + 1 
      : 1;
    
    const diagnosisCode = generateDiagnosisCode(branchCode, sequence);

    // Create diagnosis linked directly to member (NOT to encounter)
    // This allows member to have multiple diagnoses
    const diagnosis = await prisma.diagnosis.create({
      data: {
        diagnosisCode,
        memberId, // Direct link to member
        encounterId: null, // NOT linked to encounter - diagnoses are standalone
        doktorPemeriksa: data.doktorPemeriksa,
        diagnosa: data.diagnosa,
        kategoriDiagnosa: data.kategoriDiagnosa || null,
        icdPrimer: data.icdPrimer || null,
        icdSekunder: data.icdSekunder || null,
        icdTersier: data.icdTersier || null,
        keluhanRiwayatSekarang: data.keluhanRiwayatSekarang || null,
        riwayatPenyakitTerdahulu: data.riwayatPenyakitTerdahulu || null,
        riwayatSosialKebiasaan: data.riwayatSosialKebiasaan || null,
        riwayatPengobatan: data.riwayatPengobatan || null,
        pemeriksaanFisik: data.pemeriksaanFisik || null,
        pemeriksaanTambahan: data.pemeriksaanTambahan || null,
      },
    });

    // Log audit
    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'Diagnosis',
      resourceId: diagnosis.id,
      meta: { memberId, diagnosisCode },
    });

    return diagnosis;
  }

  /**
   * Get member therapy plans
   * Returns therapy plans with usage information and session counts
   */
  async getMemberTherapyPlans(memberId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    const therapyPlans = await prisma.therapyPlan.findMany({
      where: {
        memberId,
      },
      include: {
        session: {
          select: {
            id: true,
            sessionCode: true,
            treatmentDate: true,
            infusKe: true,
            branchId: true,
            branch: {
              select: {
                name: true,
                branchCode: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate session counts for each therapy plan
    const plansWithCounts = await Promise.all(
      therapyPlans.map(async (plan) => {
        let sessionInfo = null;

        if (plan.session) {
          // Get total sessions count (global) up to this session
          const totalSessionsCount = await prisma.treatmentSession.count({
            where: {
              encounter: {
                memberId,
                memberPackage: {
                  packageType: 'BASIC',
                },
              },
              infusKe: {
                lte: plan.session.infusKe,
              },
            },
          });

          // Get branch-specific sessions count up to this session
          const branchSessionsCount = await prisma.treatmentSession.count({
            where: {
              encounter: {
                memberId,
                branchId: plan.session.branchId,
                memberPackage: {
                  packageType: 'BASIC',
                },
              },
              infusKe: {
                lte: plan.session.infusKe,
              },
            },
          });

          sessionInfo = {
            id: plan.session.id,
            sessionCode: plan.session.sessionCode,
            treatmentDate: plan.session.treatmentDate,
            infusKe: plan.session.infusKe,
            branchName: plan.session.branch.name,
            branchCode: plan.session.branch.branchCode,
            // Session counts
            totalSessionsCount, // Terapi ke-X (global)
            branchSessionsCount, // Terapi ke-X di cabang ini
          };
        }

        return {
          id: plan.id,
          planCode: plan.planCode,
          keterangan: plan.keterangan,
          ifa250: plan.ifa250 ? Number(plan.ifa250) : null,
          ifa500: plan.ifa500 ? Number(plan.ifa500) : null,
          hho: plan.hho ? Number(plan.hho) : null,
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
          isUsed: !!plan.treatmentSessionId,
          usedInSession: sessionInfo,
          createdAt: plan.createdAt.toISOString(),
        };
      })
    );

    return plansWithCounts;
  }

  /**
   * Create member therapy plan
   * Generates unique code with branch and member info: TP-MBR-{BranchCode}-{MemberNo}-{BranchSeq}-{TotalSeq}
   * Example: TP-MBR-PST-0005-00002-00003
   * - TP-MBR: Therapy Plan Member
   * - PST: Branch Code
   * - 0005: Member Number
   * - 00002: Therapy #2 at this branch
   * - 00003: Therapy #3 total (global)
   */
  async createMemberTherapyPlan(memberId: string, data: any, userId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        registrationBranch: true,
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Get user's branch (for branch-specific sequence)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { branch: true },
    });

    if (!user || !user.branch) {
      throw { status: 400, code: 'BRANCH_REQUIRED', message: 'User harus memiliki branch' };
    }

    const branchCode = user.branch.branchCode;

    // Calculate total therapy count (global across all branches)
    const totalTherapyCount = await prisma.therapyPlan.count({
      where: {
        memberId,
        treatmentSessionId: { not: null }, // Only count used therapy plans
      },
    });
    const totalSequence = totalTherapyCount + 1;

    // Calculate branch-specific therapy count
    const branchTherapyCount = await prisma.therapyPlan.count({
      where: {
        memberId,
        treatmentSessionId: { not: null },
        session: {
          is: {
            branchId: user.branchId,
          },
        },
      },
    });
    const branchSequence = branchTherapyCount + 1;

    // Extract member number (remove 'M' prefix if exists)
    const memberNoStr = member.memberNo.replace(/^M/, '');

    // Generate therapy plan code
    // Format: TP-MBR-{BranchCode}-{MemberNo}-{BranchSeq}-{TotalSeq}
    const planCode = `TP-MBR-${branchCode}-${memberNoStr.padStart(4, '0')}-${String(branchSequence).padStart(5, '0')}-${String(totalSequence).padStart(5, '0')}`;

    const therapyPlan = await prisma.therapyPlan.create({
      data: {
        planCode,
        member: { connect: { id: memberId } },
        keterangan: data.keterangan || null,
        ifa250: data.ifa250 || null,
        ifa500: data.ifa500 || null,
        hho: data.hho || null,
        h2: data.h2 || null,
        no: data.no || null,
        gaso: data.gaso || null,
        o2: data.o2 || null,
        o3: data.o3 || null,
        edta: data.edta || null,
        mb: data.mb || null,
        h2s: data.h2s || null,
        kcl: data.kcl || null,
        jmlNb: data.jmlNb || null,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'TherapyPlan',
      resourceId: therapyPlan.id,
      meta: { 
        memberId, 
        planCode, 
        memberNo: member.memberNo,
        branchCode,
        branchSequence,
        totalSequence,
      },
    });

    return {
      id: therapyPlan.id,
      planCode: therapyPlan.planCode,
      message: 'Therapy plan berhasil dibuat',
    };
  }

  /**
   * Get member infusions
   */
  async getMemberInfusions(memberId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    const infusions = await prisma.infusionExecution.findMany({
      where: {
        session: {
          encounter: {
            memberId,
          },
        },
      },
      include: {
        session: {
          select: {
            id: true,
            sessionCode: true,
            treatmentDate: true,
            encounter: {
              select: {
                member: {
                  select: {
                    user: {
                      select: {
                        profile: {
                          select: {
                            fullName: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return infusions.map((infusion) => ({
      id: infusion.id,
      treatmentSessionId: infusion.treatmentSessionId,
      sessionCode: infusion.session.sessionCode,
      memberName: infusion.session.encounter.member.user.profile?.fullName || '',
      treatmentDate: infusion.session.treatmentDate.toISOString(),
      ifa250: infusion.ifa250 ? Number(infusion.ifa250) : null,
      ifa500: infusion.ifa500 ? Number(infusion.ifa500) : null,
      hho: infusion.hho ? Number(infusion.hho) : null,
      h2: infusion.h2 ? Number(infusion.h2) : null,
      no: infusion.no ? Number(infusion.no) : null,
      gaso: infusion.gaso ? Number(infusion.gaso) : null,
      o2: infusion.o2 ? Number(infusion.o2) : null,
      o3: infusion.o3 ? Number(infusion.o3) : null,
      edta: infusion.edta ? Number(infusion.edta) : null,
      mb: infusion.mb ? Number(infusion.mb) : null,
      h2s: infusion.h2s ? Number(infusion.h2s) : null,
      kcl: infusion.kcl ? Number(infusion.kcl) : null,
      jmlNb: infusion.jmlNb ? Number(infusion.jmlNb) : null,
      deviationNotes: infusion.deviationNotes,
      bottleType: infusion.bottleType,
      jenisCairan: infusion.jenisCairan,
      volumeCarrier: infusion.volumeCarrier ? Number(infusion.volumeCarrier) : null,
      jumlahJarum: infusion.jumlahJarum,
      tanggalProduksi: infusion.tanggalProduksi?.toISOString() || null,
      createdAt: infusion.createdAt.toISOString(),
      updatedAt: infusion.updatedAt.toISOString(),
    }));
  }
}
