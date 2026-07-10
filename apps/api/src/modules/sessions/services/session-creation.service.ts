// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateEncounterCode, generateSessionCode } from '../../../utils/codeGenerator';
import type { CreateSessionInput } from '../sessions.schema';
import { Role, AuditAction, PackageStatus, EncounterStatus } from '@prisma/client';
import {
  DEBT_PACKAGE_STATUSES,
  getDebtSessionAllowance,
  getSessionPackageAvailability,
} from './session-creation.helpers';
import { syncMemberVoucherUsageCount } from './voucher-usage-counter';

/**
 * Service for session creation
 */
export class SessionCreationService {
  /**
   * Create a new treatment session
   * Supports role-based auto-fill for DOCTOR and NURSE roles
   */
  async createSession(data: CreateSessionInput, branchId: string, userId: string, userRole?: string) {
    // 0. Auto-fill doctorId or nurseId based on user role
    const sessionData = await this.autoFillStaffIds(data, userId, userRole);

    // 1. Validate member access
    await this.validateMemberAccess(sessionData.memberId, branchId);

    // 2. Validate member package
    const memberPackage = await this.validateMemberPackage(
      sessionData.memberPackageId,
      sessionData.memberId,
      branchId
    );

    // 3. Validate doctor
    await this.validateDoctor(sessionData.doctorId);

    // 4. Validate nurse
    await this.validateNurse(sessionData.nurseId);

    // 5. Validate admin layanan
    await this.validateAdminLayanan(sessionData.adminLayananId);

    // 6. Validate diagnosis exists
    await this.validateDiagnosisExists(sessionData.memberId);

    // 7. Validate booster package if provided
    if (sessionData.boosterPackageId) {
      await this.validateBoosterPackage(sessionData.boosterPackageId, branchId);
    }

    // 8. Validate infus set stock availability
    await this.validateInfusSetStock(branchId);

    // 9. Get branch for code generation
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan' };
    }

    // 10. Calculate infusKe (global and branch-specific) - either manual or automatic
    let globalInfusKe: number;
    let branchInfusKe: number;
    
    if (sessionData.useManualNumbering && sessionData.manualInfusKe && sessionData.manualBranchInfusKe) {
      // MANUAL MODE: Use user-provided infusKe for both global and branch
      globalInfusKe = sessionData.manualInfusKe;
      branchInfusKe = sessionData.manualBranchInfusKe;
      console.log(
        `✍️ [SESSION-NUMBER] Manual mode - User set Global: ${globalInfusKe}, Branch: ${branchInfusKe}`
      );
      
      // Validate that neither manual number is already used in its scope.
      await Promise.all([
        this.validateManualInfusKe(sessionData.memberId, globalInfusKe),
        this.validateManualBranchInfusKe(sessionData.memberId, branchId, branchInfusKe),
      ]);
    } else {
      // AUTOMATIC MODE: Calculate based on existing sessions
      const calculated = await this.calculateInfusKe(sessionData.memberId, branchId);
      globalInfusKe = calculated.globalInfusKe;
      branchInfusKe = calculated.branchInfusKe;
      console.log(
        `🤖 [SESSION-NUMBER] Auto mode - Calculated infusKe - Global: ${globalInfusKe}, Branch: ${branchInfusKe}`
      );
    }

    // 11. Validate or auto-select therapy plan after session number is known.
    const selectedTherapyPlan = await this.resolveTherapyPlanForSession(
      sessionData.therapyPlanId,
      sessionData.memberId,
      globalInfusKe
    );
    sessionData.therapyPlanId = selectedTherapyPlan.id;

    // 12. Create session in transaction
    const result = await this.createSessionTransaction(
      sessionData,
      branchId,
      branch,
      globalInfusKe,
      branchInfusKe,
      memberPackage
    );

    // 13. Audit log
    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'TreatmentSession',
      resourceId: result.session.id,
      branchId,
      meta: {
        sessionCode: result.session.sessionCode,
        infusKe: result.session.infusKe,
        globalInfusKe: globalInfusKe,
        branchInfusKe: branchInfusKe,
        branchName: branch.name,
        createdByRole: userRole,
        packageStatusAtCreation: memberPackage.status,
        isDebtSession: memberPackage.status !== PackageStatus.ACTIVE,
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
      message:
        memberPackage.status === PackageStatus.ACTIVE
          ? 'Sesi terapi berhasil dibuat'
          : 'Sesi terapi berhasil dibuat sebagai utang',
    };
  }

  async getSuggestedSessionNumbers(memberId: string, branchId: string) {
    await this.validateMemberAccess(memberId, branchId);
    return this.calculateInfusKe(memberId, branchId);
  }

  /**
   * Auto-fill doctorId or nurseId based on user role
   * - If user is DOCTOR: auto-fill doctorId with userId
   * - If user is NURSE: auto-fill nurseId with userId
   * - If user is ADMIN_LAYANAN: use provided doctorId and nurseId
   */
  private async autoFillStaffIds(
    data: CreateSessionInput,
    userId: string,
    userRole?: string
  ): Promise<CreateSessionInput> {
    const sessionData = { ...data };

    if (userRole === Role.DOCTOR) {
      // Doctor creates session: auto-fill doctorId
      sessionData.doctorId = userId;
      console.log(`🩺 [AUTO-FILL] Doctor role detected, auto-filled doctorId: ${userId}`);
    } else if (userRole === Role.NURSE) {
      // Nurse creates session: auto-fill nurseId
      sessionData.nurseId = userId;
      console.log(`💉 [AUTO-FILL] Nurse role detected, auto-filled nurseId: ${userId}`);
    }

    // Validate that both doctorId and nurseId are present after auto-fill
    if (!sessionData.doctorId) {
      throw {
        status: 400,
        code: 'DOCTOR_REQUIRED',
        message: 'Doctor harus dipilih atau diisi',
      };
    }

    if (!sessionData.nurseId) {
      throw {
        status: 400,
        code: 'NURSE_REQUIRED',
        message: 'Nurse harus dipilih atau diisi',
      };
    }

    return sessionData;
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
  private async validateMemberPackage(memberPackageId: string, memberId: string, branchId: string) {
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

    if (memberPackage.memberId !== memberId) {
      throw {
        status: 403,
        code: 'PACKAGE_MEMBER_MISMATCH',
        message: 'Paket tidak terdaftar untuk member ini',
      };
    }

    const availability = getSessionPackageAvailability(memberPackage);

    if (availability.mode === 'ACTIVE') {
      return memberPackage;
    }

    const outstandingDebtSessions = await this.countOutstandingDebtSessions(memberPackage.memberId);
    getDebtSessionAllowance(availability.remainingSessions, outstandingDebtSessions);

    return memberPackage;
  }

  private async countOutstandingDebtSessions(memberId: string) {
    return prisma.treatmentSession.count({
      where: {
        encounter: {
          memberId,
          memberPackage: {
            status: { in: DEBT_PACKAGE_STATUSES },
          },
        },
      },
    });
  }

  /**
   * Validate doctor
   * ADMIN_CABANG can also act as doctor
   */
  private async validateDoctor(doctorId: string) {
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId },
    });

    // Allow both DOCTOR and ADMIN_CABANG to be assigned as doctor
    const allowedRoles = [Role.DOCTOR, Role.ADMIN_CABANG];
    
    if (!doctor || !allowedRoles.includes(doctor.role as Role) || !doctor.isActive) {
      throw {
        status: 403,
        code: 'INVALID_DOCTOR',
        message: 'Dokter tidak valid atau tidak aktif. Hanya DOCTOR atau ADMIN_CABANG yang dapat di-assign sebagai dokter.',
      };
    }

    return doctor;
  }

  /**
   * Validate nurse
   * ADMIN_CABANG can also act as nurse
   */
  private async validateNurse(nurseId: string) {
    const nurse = await prisma.user.findUnique({
      where: { id: nurseId },
    });

    // Allow both NURSE and ADMIN_CABANG to be assigned as nurse
    const allowedRoles = [Role.NURSE, Role.ADMIN_CABANG];
    
    if (!nurse || !allowedRoles.includes(nurse.role as Role) || !nurse.isActive) {
      throw {
        status: 403,
        code: 'INVALID_NURSE',
        message: 'Nakes tidak valid atau tidak aktif. Hanya NURSE atau ADMIN_CABANG yang dapat di-assign sebagai nakes.',
      };
    }

    return nurse;
  }

  /**
   * Validate admin layanan or admin cabang
   * Both ADMIN_LAYANAN and ADMIN_CABANG can create sessions
   */
  private async validateAdminLayanan(adminLayananId: string) {
    const admin = await prisma.user.findUnique({
      where: { id: adminLayananId },
    });

    // Allow both ADMIN_LAYANAN and ADMIN_CABANG to create sessions
    const allowedRoles = [Role.ADMIN_LAYANAN, Role.ADMIN_CABANG];
    
    if (!admin || !allowedRoles.includes(admin.role as Role) || !admin.isActive) {
      throw {
        status: 403,
        code: 'INVALID_ADMIN',
        message: 'Admin tidak valid atau tidak aktif. Hanya ADMIN_LAYANAN atau ADMIN_CABANG yang dapat membuat sesi.',
      };
    }

    return admin;
  }

  /**
   * Validate diagnosis exists for member
   * IMPORTANT: Member must have at least one diagnosis before creating therapy session
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
          'Member belum memiliki diagnosa. Diagnosa wajib dibuat terlebih dahulu sebelum membuat sesi terapi. Silakan buat diagnosa di menu Member Detail.',
      };
    }

    return existingDiagnoses;
  }

  /**
   * Resolve therapy plan for this session.
   *
   * planNumber is the plan's order inside a therapy-plan set, while infusKe is
   * the member's global session number. They normally progress together, but
   * they can differ when a member's session history starts with a manual number.
   */
  private async resolveTherapyPlanForSession(therapyPlanId: string | undefined, memberId: string, infusKe: number) {
    if (therapyPlanId) {
      return this.validateTherapyPlan(therapyPlanId, memberId);
    }

    const therapyPlan = await prisma.therapyPlan.findFirst({
      where: {
        memberId,
        treatmentSessionId: null,
        supersededById: null,
        therapyPlanSet: {
          status: 'ACTIVE',
        },
      },
      include: {
        therapyPlanSet: true,
      },
      orderBy: [
        { planNumber: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    if (!therapyPlan) {
      throw {
        status: 422,
        code: 'THERAPY_PLAN_AUTO_SELECT_FAILED',
        message: `Tidak ada therapy plan aktif yang belum digunakan untuk sesi Terapi #${infusKe}. Tambahkan therapy plan baru terlebih dahulu.`,
      };
    }

    return therapyPlan;
  }

  /**
   * Validate therapy plan
   * IMPORTANT: Therapy plan must be created fresh for each session
   * Cannot reuse therapy plan from previous sessions
   */
  private async validateTherapyPlan(therapyPlanId: string, memberId: string) {
    const therapyPlan = await prisma.therapyPlan.findUnique({
      where: { id: therapyPlanId },
      include: { therapyPlanSet: true },
    });

    if (!therapyPlan) {
      throw {
        status: 404,
        code: 'THERAPY_PLAN_NOT_FOUND',
        message: 'Therapy plan tidak ditemukan. Silakan buat therapy plan baru untuk sesi ini.',
      };
    }

    if (therapyPlan.memberId && therapyPlan.memberId !== memberId) {
      throw {
        status: 403,
        code: 'THERAPY_PLAN_MISMATCH',
        message: 'Therapy plan bukan milik member ini',
      };
    }

    if (therapyPlan.therapyPlanSet?.status === 'SUPERSEDED') {
      throw {
        status: 422,
        code: 'THERAPY_PLAN_SET_SUPERSEDED',
        message: 'Therapy plan ini berasal dari set lama. Gunakan set aktif terbaru.',
      };
    }

    // CRITICAL: Therapy plan must be fresh (not used in any session)
    // Each session requires a new therapy plan
    if (therapyPlan.treatmentSessionId) {
      throw {
        status: 422,
        code: 'THERAPY_PLAN_ALREADY_USED',
        message: 'Therapy plan sudah digunakan di sesi lain. Setiap sesi terapi memerlukan therapy plan baru. Silakan buat therapy plan baru untuk sesi ini.',
      };
    }

    // CRITICAL: Therapy plan must not be superseded (must be current version)
    // Only the latest version can be used
    if (therapyPlan.supersededById) {
      throw {
        status: 422,
        code: 'THERAPY_PLAN_SUPERSEDED',
        message: 'Therapy plan ini adalah versi lama yang sudah di-supersede. Hanya versi terbaru yang dapat digunakan untuk sesi terapi. Silakan pilih therapy plan versi terbaru.',
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
   * Validate infus set stock availability
   * IMPORTANT: "Infus Set + Pelengkap" (PRD-INF-SET-002) is mandatory for every therapy session
   * Session cannot be created if stock is not available
   */
  private async validateInfusSetStock(branchId: string) {
    // Find the "Infus Set + Pelengkap" product (SKU: PRD-INF-SET-002)
    const infusSetProduct = await prisma.masterProduct.findFirst({
      where: {
        sku: 'PRD-INF-SET-002', // Only "Infus Set + Pelengkap"
      },
    });

    if (!infusSetProduct) {
      throw {
        status: 422,
        code: 'INFUS_SET_NOT_CONFIGURED',
        message: 'Produk "Infus Set + Pelengkap" (PRD-INF-SET-002) belum dikonfigurasi di sistem. Hubungi administrator.',
      };
    }

    // Check inventory stock for this branch
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: {
        branchId,
        masterProductId: infusSetProduct.id,
      },
    });

    if (!inventoryItem) {
      throw {
        status: 422,
        code: 'INFUS_SET_NOT_IN_INVENTORY',
        message: `Produk "${infusSetProduct.name}" belum tersedia di inventory cabang ini. Silakan request stok terlebih dahulu.`,
      };
    }

    const currentStock = Number(inventoryItem.stock);
    if (currentStock < 1) {
      throw {
        status: 422,
        code: 'INFUS_SET_OUT_OF_STOCK',
        message: `Stok "${infusSetProduct.name}" habis (tersisa: ${currentStock}). Tidak dapat membuat sesi terapi. Silakan request stok terlebih dahulu.`,
      };
    }

    console.log(`✅ [INFUS SET] Stock available: ${currentStock} ${infusSetProduct.unit || 'piece'} of "${infusSetProduct.name}"`);
    
    return { infusSetProduct, inventoryItem };
  }

  /**
   * Validate manual infusKe - ensure it's not already used
   */
  private async validateManualInfusKe(memberId: string, infusKe: number) {
    const existingSession = await prisma.treatmentSession.findFirst({
      where: {
        encounter: { memberId },
        infusKe: infusKe,
      },
      select: {
        sessionCode: true,
        treatmentDate: true,
      },
    });

    if (existingSession) {
      throw {
        status: 422,
        code: 'INFUS_KE_ALREADY_USED',
        message: `Nomor sesi ${infusKe} sudah digunakan untuk sesi ${existingSession.sessionCode} pada ${new Date(existingSession.treatmentDate).toLocaleDateString('id-ID')}. Silakan pilih nomor lain.`,
      };
    }
  }

  /**
   * Validate a manual branch session number within one member and branch.
   */
  private async validateManualBranchInfusKe(
    memberId: string,
    branchId: string,
    branchInfusKe: number
  ) {
    const existingSession = await prisma.treatmentSession.findFirst({
      where: {
        branchId,
        branchInfusKe,
        encounter: { memberId },
      },
      select: {
        sessionCode: true,
        treatmentDate: true,
      },
    });

    if (existingSession) {
      throw {
        status: 422,
        code: 'BRANCH_INFUS_KE_ALREADY_USED',
        message: `Nomor sesi cabang ${branchInfusKe} sudah digunakan untuk sesi ${existingSession.sessionCode} pada ${new Date(existingSession.treatmentDate).toLocaleDateString('id-ID')}. Silakan pilih nomor lain.`,
      };
    }
  }

  /**
   * Calculate global and branch-specific infusKe
   * Only counts sessions from BASIC packages
   */
  private async calculateInfusKe(memberId: string, branchId: string) {
    const [latestGlobalSession, latestBranchSession] = await Promise.all([
      // Highest global number for this member across all branches.
      prisma.treatmentSession.findFirst({
        where: {
          encounter: {
            memberId,
            memberPackage: {
              packageType: 'BASIC',
            },
          },
        },
        select: { infusKe: true },
        orderBy: { infusKe: 'desc' },
      }),
      // Highest persisted branch number so a manual starting number continues.
      prisma.treatmentSession.findFirst({
        where: {
          branchId,
          encounter: {
            memberId,
            memberPackage: {
              packageType: 'BASIC',
            },
          },
        },
        select: { branchInfusKe: true },
        orderBy: { branchInfusKe: 'desc' },
      }),
    ]);

    const globalInfusKe = latestGlobalSession ? latestGlobalSession.infusKe + 1 : 1;
    const branchInfusKe = latestBranchSession ? latestBranchSession.branchInfusKe + 1 : 1;

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
    branchInfusKe: number,
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
          branchInfusKe,
          pelaksanaan: data.pelaksanaan,
          treatmentDate: new Date(data.treatmentDate),
          adminLayananId: data.adminLayananId,
          doctorId: data.doctorId, // Primary doctor
          nurseId: data.nurseId,   // Primary nurse
          boosterPackageId: data.boosterPackageId,
          isCompleted: false,
        },
      });

      // Add primary doctor to session_doctors
      await tx.sessionDoctor.create({
        data: {
          sessionId: session.id,
          doctorId: data.doctorId,
          isPrimary: true,
        },
      });

      // Add additional doctors if provided
      if (data.additionalDoctorIds && data.additionalDoctorIds.length > 0) {
        await tx.sessionDoctor.createMany({
          data: data.additionalDoctorIds.map((doctorId) => ({
            sessionId: session.id,
            doctorId,
            isPrimary: false,
          })),
        });
      }

      // Add primary nurse to session_nurses
      await tx.sessionNurse.create({
        data: {
          sessionId: session.id,
          nurseId: data.nurseId,
          isPrimary: true,
        },
      });

      // Add additional nurses if provided
      if (data.additionalNurseIds && data.additionalNurseIds.length > 0) {
        await tx.sessionNurse.createMany({
          data: data.additionalNurseIds.map((nurseId) => ({
            sessionId: session.id,
            nurseId,
            isPrimary: false,
          })),
        });
      }

      // Link therapy plan to session
      await tx.therapyPlan.update({
        where: { id: data.therapyPlanId },
        data: { treatmentSessionId: session.id },
      });

      // Update member package used sessions
      const updatedPackage = await tx.memberPackage.update({
        where: { id: data.memberPackageId },
        data: { usedSessions: { increment: 1 } },
      });

      // Check if all sessions are used - auto expire only packages that are already active.
      // Pending packages can still be verified after debt sessions have been created.
      if (
        memberPackage.status === PackageStatus.ACTIVE &&
        updatedPackage.usedSessions >= updatedPackage.totalSessions
      ) {
        await tx.memberPackage.update({
          where: { id: data.memberPackageId },
          data: { 
            status: 'EXPIRED',
            expiredAt: new Date(),
          },
        });
      }

      // Update booster package if provided
      if (data.boosterPackageId) {
        const updatedBooster = await tx.memberPackage.update({
          where: { id: data.boosterPackageId },
          data: { usedSessions: { increment: 1 } },
        });

        // Check if all booster sessions are used - auto expire booster package
        if (updatedBooster.usedSessions >= updatedBooster.totalSessions) {
          await tx.memberPackage.update({
            where: { id: data.boosterPackageId },
            data: { 
              status: 'EXPIRED',
              expiredAt: new Date(),
            },
          });
        }
      }

      // Count vouchers only when they are actually used in a session.
      await syncMemberVoucherUsageCount(tx, data.memberId);

      return { session, encounter };
    });
  }
}
