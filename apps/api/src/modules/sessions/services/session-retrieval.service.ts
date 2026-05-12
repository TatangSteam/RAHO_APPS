// @ts-nocheck
import { prisma } from '../../../lib/prisma';

/**
 * Service for session retrieval
 */
export class SessionRetrievalService {
  /**
   * Get session by ID with all details
   */
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
        // Include multiple doctors and nurses
        sessionDoctors: {
          include: {
            doctor: { include: { profile: true } },
          },
          orderBy: { isPrimary: 'desc' }, // Primary first
        },
        sessionNurses: {
          include: {
            nurse: { include: { profile: true } },
          },
          orderBy: { isPrimary: 'desc' }, // Primary first
        },
      },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    // Calculate branch-specific infusKe
    const branchInfusKe = await this.calculateBranchInfusKe(
      session.encounter.memberId,
      session.branchId,
      session.infusKe
    );

    // Get branch info
    const branch = await prisma.branch.findUnique({
      where: { id: session.branchId },
    });

    // Calculate step completion
    const diagnosis = session.encounter.diagnoses[0];
    const steps = this.calculateStepCompletion(session, diagnosis);

    return {
      session: this.formatSessionData(session, branchInfusKe, branch),
      diagnosis,
      therapyPlan: session.therapyPlan,
      vitalSigns: session.vitalSigns,
      infusion: session.infusion,
      materials: session.materials,
      photo: session.photo,
      evaluation: session.evaluation,
      steps,
      // Include staff info
      doctors: session.sessionDoctors,
      nurses: session.sessionNurses,
    };
  }

  /**
   * Get all sessions with optional filters
   * Only shows sessions from BASIC packages (not BOOSTER)
   * 
   * Role-based filtering:
   * - SUPER_ADMIN, ADMIN_MANAGER: See all sessions from all branches
   * - ADMIN_CABANG, ADMIN_LAYANAN, DOCTOR, NURSE: See only sessions from their branch
   */
  async getAllSessions(params: { memberId?: string; branchId?: string; role?: string; page?: number; limit?: number }) {
    const { memberId, branchId, role, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      encounter: {
        memberPackage: {
          packageType: 'BASIC', // Only show BASIC packages, not BOOSTER
        },
      },
    };
    
    // Filter by memberId if provided
    if (memberId) {
      where.encounter.memberId = memberId;
    }

    // Role-based branch filtering
    // SUPER_ADMIN and ADMIN_MANAGER can see all branches
    // Other roles (ADMIN_CABANG, ADMIN_LAYANAN, DOCTOR, NURSE) only see their branch
    if (role && !['SUPER_ADMIN', 'ADMIN_MANAGER'].includes(role)) {
      if (branchId) {
        where.branchId = branchId;
      }
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
            memberPackage: true, // Include memberPackage to verify
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

    // Format sessions with branch info and session counts
    const formattedSessions = await Promise.all(
      sessions.map(async (session) => {
        const diagnosis = session.encounter.diagnoses[0];

        // Calculate branch-specific infusKe
        const branchInfusKe = await this.calculateBranchInfusKe(
          session.encounter.memberId,
          session.branchId,
          session.infusKe
        );

        // Get branch info
        const branch = await prisma.branch.findUnique({
          where: { id: session.branchId },
        });

        // Get all branches where member has sessions (for multi-branch display)
        const memberBranches = await prisma.treatmentSession.findMany({
          where: {
            encounter: {
              memberId: session.encounter.memberId,
              memberPackage: {
                packageType: 'BASIC',
              },
            },
            infusKe: {
              lte: session.infusKe,
            },
          },
          select: {
            branchId: true,
            branch: {
              select: {
                id: true,
                name: true,
                branchCode: true,
              },
            },
          },
          distinct: ['branchId'],
        });

        // Calculate session count per branch
        const branchSessionCounts = await Promise.all(
          memberBranches.map(async (mb) => {
            const count = await prisma.treatmentSession.count({
              where: {
                encounter: {
                  memberId: session.encounter.memberId,
                  branchId: mb.branchId,
                  memberPackage: {
                    packageType: 'BASIC',
                  },
                },
                infusKe: {
                  lte: session.infusKe,
                },
              },
            });

            return {
              branchId: mb.branchId,
              branchName: mb.branch.name,
              branchCode: mb.branch.branchCode,
              sessionCount: count,
            };
          })
        );

        return {
          session: {
            sessionId: session.id,
            sessionCode: session.sessionCode,
            encounterId: session.encounterId,
            encounterCode: session.encounter.encounterCode,
            infusKe: session.infusKe, // Total therapy count (global)
            branchInfusKe: branchInfusKe, // Therapy count at current branch
            branchId: session.branchId,
            branchName: branch?.name || 'Unknown',
            branchCode: branch?.branchCode || 'UNK',
            branchSessionCounts: branchSessionCounts, // Session counts per branch (for multi-branch display)
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
      })
    );

    return formattedSessions;
  }

  /**
   * Calculate branch-specific infusKe
   * Only counts sessions from BASIC packages
   */
  private async calculateBranchInfusKe(
    memberId: string,
    branchId: string,
    currentInfusKe: number
  ): Promise<number> {
    const branchSessions = await prisma.treatmentSession.findMany({
      where: {
        encounter: {
          memberId,
          branchId,
          memberPackage: {
            packageType: 'BASIC',
          },
        },
        infusKe: {
          lte: currentInfusKe,
        },
      },
      orderBy: { infusKe: 'asc' },
    });

    return branchSessions.length;
  }

  /**
   * Calculate step completion status
   */
  private calculateStepCompletion(session: any, diagnosis: any) {
    return {
      step1_diagnosis: !!diagnosis,
      step2_therapyPlan: !!session.therapyPlan,
      step3_vitalBefore: session.vitalSigns.some((v: any) => v.waktuCatat === 'SEBELUM'),
      step4_infusion: !!session.infusion,
      step5_materials: session.materials.length > 0,
      step6_photo: !!session.photo,
      step7_vitalAfter: session.vitalSigns.some((v: any) => v.waktuCatat === 'SESUDAH'),
      step8_evaluation: !!session.evaluation,
    };
  }

  /**
   * Format session data for response
   */
  private formatSessionData(session: any, branchInfusKe: number, branch: any) {
    return {
      sessionId: session.id,
      sessionCode: session.sessionCode,
      encounterId: session.encounterId,
      encounterCode: session.encounter.encounterCode,
      infusKe: session.infusKe,
      branchInfusKe: branchInfusKe,
      branchName: branch?.name || 'Unknown',
      infusNote:
        branchInfusKe === 1
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
      // Include multiple doctors and nurses
      sessionDoctors: session.sessionDoctors?.map((sd: any) => ({
        id: sd.id,
        isPrimary: sd.isPrimary,
        doctor: {
          userId: sd.doctor.id,
          fullName: sd.doctor.profile?.fullName || '',
          staffCode: sd.doctor.staffCode,
        },
      })) || [],
      sessionNurses: session.sessionNurses?.map((sn: any) => ({
        id: sn.id,
        isPrimary: sn.isPrimary,
        nurse: {
          userId: sn.nurse.id,
          fullName: sn.nurse.profile?.fullName || '',
          staffCode: sn.nurse.staffCode,
        },
      })) || [],
    };
  }
}
