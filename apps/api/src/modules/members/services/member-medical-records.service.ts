// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateDiagnosisCode, generateEncounterCode } from '../../../utils/codeGenerator';
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
   */
  async getMemberDiagnoses(memberId: string) {
    // Verify member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Get all diagnoses for this member
    const diagnoses = await prisma.diagnosis.findMany({
      where: {
        memberId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return diagnoses;
  }

  /**
   * Create member diagnosis
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

    // Try to find active package and encounter (optional)
    const activePackage = await prisma.memberPackage.findFirst({
      where: {
        memberId,
        status: 'ACTIVE',
        packageType: 'BASIC',
      },
      include: {
        branch: true,
      },
      orderBy: {
        activatedAt: 'desc',
      },
    });

    let encounterId: string | undefined = undefined;

    // If member has active package, try to link to encounter
    if (activePackage && doctor.branch) {
      // Check if encounter already exists for this package
      let encounter = await prisma.encounter.findFirst({
        where: {
          memberPackageId: activePackage.id,
          status: 'ONGOING',
        },
      });

      // If no encounter, create one
      if (!encounter) {
        const encounterCode = generateEncounterCode(activePackage.branch.branchCode);
        encounter = await prisma.encounter.create({
          data: {
            encounterCode,
            memberId,
            branchId: activePackage.branchId,
            memberPackageId: activePackage.id,
            adminLayananId: userId,
            doctorId: doctor.id,
            nurseId: doctor.id, // Temporary - should be actual nurse
            status: 'ONGOING',
          },
        });
      }

      // Check if diagnosis already exists for this encounter
      const existingDiagnosis = await prisma.diagnosis.findUnique({
        where: { encounterId: encounter.id },
      });

      if (existingDiagnosis) {
        throw { status: 409, code: 'DIAGNOSIS_EXISTS', message: 'Diagnosa sudah ada untuk encounter ini' };
      }

      encounterId = encounter.id;
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

    // Create diagnosis (with or without encounter)
    const diagnosis = await prisma.diagnosis.create({
      data: {
        diagnosisCode,
        memberId, // Direct link to member
        encounterId, // Optional - only if encounter exists
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
      meta: { memberId, encounterId },
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
          ifa: plan.ifa ? Number(plan.ifa) : null,
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
        memberId,
        keterangan: data.keterangan || null,
        ifa: data.ifa || null,
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
      ifa: infusion.ifa ? Number(infusion.ifa) : null,
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
