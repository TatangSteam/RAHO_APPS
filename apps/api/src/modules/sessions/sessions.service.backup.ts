import { prisma } from '../../lib/prisma';
import { logAudit } from '../../utils/auditLog';
import {
  generateEncounterCode,
  generateSessionCode,
} from '../../utils/codeGenerator';
import type {
  CreateSessionInput,
  CreateDiagnosisInput,
  CreateTherapyPlanInput,
  CreateVitalSignInput,
  CreateInfusionInput,
  CreateMaterialUsageInput,
  CreateEvaluationInput,
} from './sessions.schema';
import { Role, AuditAction, PackageStatus, EncounterStatus } from '@prisma/client';

// Import modular services
import { DiagnosisService } from './services/diagnosis.service';
import { TherapyPlanService } from './services/therapy-plan.service';
import { VitalSignsService } from './services/vital-signs.service';
import { InfusionService } from './services/infusion.service';
import { MaterialUsageService } from './services/material-usage.service';
import { EvaluationService } from './services/evaluation.service';
import { SessionCompletionService } from './services/session-completion.service';
import { BoosterService } from './services/booster.service';
import { PhotoService } from './services/photo.service';

export class SessionsService {
  // Initialize modular services
  private diagnosisService: DiagnosisService;
  private therapyPlanService: TherapyPlanService;
  private vitalSignsService: VitalSignsService;
  private infusionService: InfusionService;
  private materialUsageService: MaterialUsageService;
  private evaluationService: EvaluationService;
  private completionService: SessionCompletionService;
  private boosterService: BoosterService;
  private photoService: PhotoService;

  constructor() {
    this.diagnosisService = new DiagnosisService();
    this.therapyPlanService = new TherapyPlanService();
    this.vitalSignsService = new VitalSignsService();
    this.infusionService = new InfusionService();
    this.materialUsageService = new MaterialUsageService();
    this.evaluationService = new EvaluationService();
    this.completionService = new SessionCompletionService();
    this.boosterService = new BoosterService();
    this.photoService = new PhotoService();
  }
  // ============================================================
  // CREATE SESSION
  // ============================================================

  async createSession(data: CreateSessionInput, branchId: string, userId: string) {
    // 1. Validate member access
    const member = await prisma.member.findUnique({
      where: { id: data.memberId },
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

    // 2. Validate member package
    const memberPackage = await prisma.memberPackage.findUnique({
      where: { id: data.memberPackageId },
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

    // 3. Validate doctor
    const doctor = await prisma.user.findUnique({
      where: { id: data.doctorId },
    });

    if (!doctor || doctor.role !== Role.DOCTOR || !doctor.isActive) {
      throw {
        status: 403,
        code: 'INVALID_DOCTOR',
        message: 'Dokter tidak valid atau tidak aktif',
      };
    }

    // 5. Validate nurse
    const nurse = await prisma.user.findUnique({
      where: { id: data.nurseId },
    });

    if (!nurse || nurse.role !== Role.NURSE || !nurse.isActive) {
      throw {
        status: 403,
        code: 'INVALID_NURSE',
        message: 'Nakes tidak valid atau tidak aktif',
      };
    }

    // 6. VALIDATE DIAGNOSIS EXISTS - REQUIRED
    const existingDiagnoses = await prisma.diagnosis.findMany({
      where: {
        memberId: data.memberId,
      },
    });

    if (existingDiagnoses.length === 0) {
      throw {
        status: 422,
        code: 'DIAGNOSIS_REQUIRED',
        message: 'Member harus memiliki diagnosa sebelum membuat sesi terapi. Silakan buat diagnosa terlebih dahulu.',
      };
    }

    // 7. VALIDATE THERAPY PLAN EXISTS
    const therapyPlan = await prisma.therapyPlan.findUnique({
      where: { id: data.therapyPlanId },
    });

    if (!therapyPlan) {
      throw {
        status: 404,
        code: 'THERAPY_PLAN_NOT_FOUND',
        message: 'Therapy plan tidak ditemukan',
      };
    }

    // Check if therapy plan belongs to this member (if memberId is set)
    // Note: memberId might be null for old therapy plans
    if (therapyPlan.memberId && therapyPlan.memberId !== data.memberId) {
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

    // 8. Validate booster package if provided
    if (data.boosterPackageId) {
      const boosterPackage = await prisma.memberPackage.findUnique({
        where: { id: data.boosterPackageId },
      });

      if (!boosterPackage) {
        throw { status: 404, code: 'BOOSTER_PACKAGE_NOT_FOUND', message: 'Paket booster tidak ditemukan' };
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
    }

    // 9. Get branch for code generation
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan' };
    }

    // 10. Calculate infusKe (global across all branches) and infusKe per branch
    // Get all sessions for this member across all branches
    const allMemberSessions = await prisma.treatmentSession.findMany({
      where: {
        encounter: {
          memberId: data.memberId,
        },
      },
      orderBy: { infusKe: 'desc' },
      take: 1,
    });

    // Get sessions for this member in current branch only
    const branchSessions = await prisma.treatmentSession.findMany({
      where: {
        encounter: {
          memberId: data.memberId,
          branchId: branchId,
        },
      },
      orderBy: { infusKe: 'desc' },
      take: 1,
    });

    // Global infusKe (continues across branches)
    const globalInfusKe = allMemberSessions.length > 0 ? allMemberSessions[0].infusKe + 1 : 1;
    
    // Branch-specific infusKe (resets per branch)
    const branchInfusKe = branchSessions.length > 0 ? branchSessions[0].infusKe + 1 : 1;

    // 11. Create session in transaction
    const result = await prisma.$transaction(async (tx) => {
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

      // Use global infusKe (continues across branches)
      const infusKe = globalInfusKe;

      // Generate session code with global infusKe
      const sessionCode = generateSessionCode(branch.branchCode, infusKe);

      // Create treatment session
      const session = await tx.treatmentSession.create({
        data: {
          sessionCode,
          encounterId: encounter.id,
          branchId,
          infusKe, // Global infusKe that continues across branches
          pelaksanaan: data.pelaksanaan,
          treatmentDate: new Date(data.treatmentDate),
          adminLayananId: data.adminLayananId,
          doctorId: data.doctorId,
          nurseId: data.nurseId,
          boosterPackageId: data.boosterPackageId,
          isCompleted: false,
        },
      });

      // Link therapy plan to session (NEW)
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
      infusKe: result.session.infusKe, // Global infusKe
      branchInfusKe: branchInfusKe, // Branch-specific infusKe
      branchName: branch.name,
      infusNote: branchInfusKe === 1 
        ? `Infus ke-${globalInfusKe} (Infus pertama di ${branch.name})`
        : `Infus ke-${globalInfusKe} (Infus ke-${branchInfusKe} di ${branch.name})`,
      message: 'Sesi terapi berhasil dibuat',
    };
  }

  // ============================================================
  // GET SESSION DETAIL
  // ============================================================

  async getSessionById(sessionId: string) {
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      include: {
        encounter: {
          include: {
            member: {
              include: {
                user: { include: { profile: true } },
              },
            },
            diagnoses: true,
          },
        },
        adminLayanan: { include: { profile: true } },
        doctor: { include: { profile: true } },
        nurse: { include: { profile: true } },
        boosterPackage: true,
        therapyPlan: true,
        vitalSigns: true,
        infusion: true,
        materials: {
          include: {
            inventoryItem: {
              include: { masterProduct: true },
            },
          },
        },
        photo: true,
        evaluation: true,
      },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    // Calculate branch-specific infusKe
    const branchSessions = await prisma.treatmentSession.findMany({
      where: {
        encounter: {
          memberId: session.encounter.memberId,
          branchId: session.branchId,
        },
        infusKe: {
          lte: session.infusKe, // Count sessions up to current session
        },
      },
      orderBy: { infusKe: 'asc' },
    });

    const branchInfusKe = branchSessions.length;

    // Get branch info
    const branch = await prisma.branch.findUnique({
      where: { id: session.branchId },
    });

    // Calculate step completion
    const diagnosis = session.encounter.diagnoses[0];
    const steps = {
      step1_diagnosis: !!diagnosis,
      step2_therapyPlan: !!session.therapyPlan,
      step3_vitalBefore: session.vitalSigns.some((v) => v.waktuCatat === 'SEBELUM'),
      step4_infusion: !!session.infusion,
      step5_materials: session.materials.length > 0,
      step6_photo: !!session.photo,
      step7_vitalAfter: session.vitalSigns.some((v) => v.waktuCatat === 'SESUDAH'),
      step8_evaluation: !!session.evaluation,
    };

    return {
      session: {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        encounterId: session.encounterId,
        encounterCode: session.encounter.encounterCode,
        infusKe: session.infusKe, // Global infusKe
        branchInfusKe: branchInfusKe, // Branch-specific infusKe
        branchName: branch?.name || 'Unknown',
        infusNote: branchInfusKe === 1 
          ? `Infus ke-${session.infusKe} (Infus pertama di ${branch?.name || 'cabang ini'})`
          : `Infus ke-${session.infusKe} (Infus ke-${branchInfusKe} di ${branch?.name || 'cabang ini'})`,
        pelaksanaan: session.pelaksanaan,
        treatmentDate: session.treatmentDate.toISOString(),
        isCompleted: session.isCompleted,
        member: {
          memberId: session.encounter.member.id,
          memberNo: session.encounter.member.memberNo,
          fullName: session.encounter.member.user.profile?.fullName || '',
        },
        adminLayanan: {
          userId: session.adminLayanan.id,
          fullName: session.adminLayanan.profile?.fullName || '',
        },
        doctor: {
          userId: session.doctor.id,
          fullName: session.doctor.profile?.fullName || '',
        },
        nurse: {
          userId: session.nurse.id,
          fullName: session.nurse.profile?.fullName || '',
        },
        boosterPackage: session.boosterPackage
          ? {
              packageId: session.boosterPackage.id,
              packageCode: session.boosterPackage.packageCode,
              boosterType: session.boosterType,
            }
          : null,
      },
      diagnosis,
      therapyPlan: session.therapyPlan,
      vitalSigns: session.vitalSigns,
      infusion: session.infusion,
      materials: session.materials,
      photo: session.photo,
      evaluation: session.evaluation,
      steps,
    };
  }

  // ============================================================
  // GET ALL SESSIONS (with optional filters)
  // ============================================================

  async getAllSessions(params: { memberId?: string; page?: number; limit?: number }) {
    const { memberId, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (memberId) {
      where.encounter = {
        memberId,
      };
    }

    const sessions = await prisma.treatmentSession.findMany({
      where,
      skip,
      take: limit,
      orderBy: { treatmentDate: 'desc' },
      include: {
        encounter: {
          include: {
            member: {
              include: {
                user: { include: { profile: true } },
              },
            },
            diagnoses: true,
          },
        },
        adminLayanan: { include: { profile: true } },
        doctor: { include: { profile: true } },
        nurse: { include: { profile: true } },
        boosterPackage: true,
        therapyPlan: true,
        vitalSigns: true,
        infusion: true,
        materials: {
          include: {
            inventoryItem: {
              include: { masterProduct: true },
            },
          },
        },
        photo: true,
        evaluation: true,
      },
    });

    // Format sessions to match frontend expectations
    const formattedSessions = sessions.map((session) => {
      const diagnosis = session.encounter.diagnoses[0];

      return {
        session: {
          sessionId: session.id,
          sessionCode: session.sessionCode,
          encounterId: session.encounterId,
          encounterCode: session.encounter.encounterCode,
          infusKe: session.infusKe,
          pelaksanaan: session.pelaksanaan,
          treatmentDate: session.treatmentDate.toISOString(),
          isCompleted: session.isCompleted,
          member: {
            memberId: session.encounter.member.id,
            memberNo: session.encounter.member.memberNo,
            fullName: session.encounter.member.user.profile?.fullName || '',
          },
          adminLayanan: {
            userId: session.adminLayanan.id,
            fullName: session.adminLayanan.profile?.fullName || '',
          },
          doctor: {
            userId: session.doctor.id,
            fullName: session.doctor.profile?.fullName || '',
          },
          nurse: {
            userId: session.nurse.id,
            fullName: session.nurse.profile?.fullName || '',
          },
          boosterPackage: session.boosterPackage
            ? {
                packageId: session.boosterPackage.id,
                packageCode: session.boosterPackage.packageCode,
                boosterType: session.boosterType,
              }
            : null,
        },
        diagnosis,
        therapyPlan: session.therapyPlan,
        vitalSigns: session.vitalSigns,
        infusion: session.infusion,
        materials: session.materials,
        photo: session.photo,
        evaluation: session.evaluation,
      };
    });

    return formattedSessions;
  }

  // ============================================================
  // STEP 1: CREATE DIAGNOSIS
  // ============================================================

  async createDiagnosis(encounterId: string, data: CreateDiagnosisInput, userId: string) {
    return this.diagnosisService.createDiagnosis(encounterId, data, userId);
  }

  async getDiagnosisByEncounter(encounterId: string) {
    return this.diagnosisService.getDiagnosisByEncounter(encounterId);
  }

  // ============================================================
  // STEP 2: CREATE THERAPY PLAN
  // ============================================================

  async createTherapyPlan(sessionId: string, data: CreateTherapyPlanInput, userId: string) {
    return this.therapyPlanService.createTherapyPlan(sessionId, data, userId);
  }

  // ============================================================
  // STEP 4: UPDATE BOOSTER TYPE (Conditional)
  // ============================================================

  async updateBoosterType(sessionId: string, boosterType: string, userId: string, branchId: string) {
    return this.boosterService.updateBoosterType(sessionId, boosterType, userId, branchId);
  }

  async getBoosterStockAvailability(branchId: string) {
    return this.boosterService.getBoosterStockAvailability(branchId);
  }

  // ============================================================
  // STEP 3 & 8: CREATE/UPDATE VITAL SIGN
  // ============================================================

  async upsertVitalSign(sessionId: string, data: CreateVitalSignInput, userId: string) {
    return this.vitalSignsService.upsertVitalSign(sessionId, data, userId);
  }

  // ============================================================
  // STEP 4: CREATE INFUSION EXECUTION
  // ============================================================

  async createInfusion(sessionId: string, data: CreateInfusionInput, userId: string, branchId: string) {
    return this.infusionService.createInfusion(sessionId, data, userId, branchId);
  }

  // ============================================================
  // GET THERAPY PLAN
  // ============================================================

  async getTherapyPlan(sessionId: string) {
    return this.therapyPlanService.getTherapyPlan(sessionId);
  }

  // ============================================================
  // GET VITAL SIGNS
  // ============================================================

  async getVitalSigns(sessionId: string) {
    return this.vitalSignsService.getVitalSigns(sessionId);
  }

  // ============================================================
  // GET INFUSION
  // ============================================================

  async getInfusion(sessionId: string) {
    return this.infusionService.getInfusion(sessionId);
  }

  // ============================================================
  // STEP 5: MATERIAL USAGE
  // ============================================================

  async createMaterialUsage(sessionId: string, data: CreateMaterialUsageInput, userId: string, branchId: string) {
    return this.materialUsageService.createMaterialUsage(sessionId, data, userId, branchId);
  }

  async getMaterialUsages(sessionId: string) {
    return this.materialUsageService.getMaterialUsages(sessionId);
  }

  // ============================================================
  // STEP 8: DOCTOR EVALUATION
  // ============================================================

  async createEvaluation(sessionId: string, data: CreateEvaluationInput, userId: string) {
    return this.evaluationService.createEvaluation(sessionId, data, userId);
  }

  async updateEvaluation(sessionId: string, data: Partial<CreateEvaluationInput>, userId: string) {
    return this.evaluationService.updateEvaluation(sessionId, data, userId);
  }

  async getEvaluation(sessionId: string) {
    return this.evaluationService.getEvaluation(sessionId);
  }

  // ============================================================
  // COMPLETE SESSION
  // ============================================================

  async completeSession(sessionId: string, userId: string) {
    return this.completionService.completeSession(sessionId, userId);
  }

  // ============================================================
  // NEW: SAVE PROGRESS & GET PROGRESS
  // ============================================================

  async saveProgress(sessionId: string, userId: string) {
    return this.completionService.saveProgress(sessionId, userId);
  }

  async getSessionProgress(sessionId: string) {
    return this.completionService.getSessionProgress(sessionId);
  }

  // ============================================================
  // STEP 7: PHOTO UPLOAD
  // ============================================================

  async uploadPhoto(sessionId: string, file: Express.Multer.File, uploadedBy: string) {
    return this.photoService.uploadPhoto(sessionId, file, uploadedBy);
  }

  async deletePhoto(sessionId: string) {
    return this.photoService.deletePhoto(sessionId);
  }

  async getPhoto(sessionId: string) {
    return this.photoService.getPhoto(sessionId);
  }
}
