// @ts-nocheck
import { prisma } from '../../../lib/prisma';

/**
 * Service for session retrieval
 */
export class SessionRetrievalService {
  private hasDoctorEvaluation(evaluation: any): boolean {
    if (!evaluation) return false;

    return [
      evaluation.subjective,
      evaluation.objective,
      evaluation.assessment,
      evaluation.plan,
      evaluation.generalNotes,
    ].some((value) => typeof value === 'string' && value.trim().length > 0);
  }

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
            memberPackage: true,
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

    // Get branch info
    const branch = await prisma.branch.findUnique({
      where: { id: session.branchId },
    });

    // Calculate step completion
    const diagnosis = session.encounter.diagnoses[0];
    const steps = this.calculateStepCompletion(session, diagnosis);

    return {
      session: this.formatSessionData(session, session.branchInfusKe, branch),
      memberId: session.encounter.memberId, // Add memberId at top level for frontend
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
   * - ADMIN_CABANG, ADMIN_LAYANAN: See only sessions from their primary branch
   * - DOCTOR, NURSE: See sessions from all branches they have access to (via StaffBranch)
   */
  async getAllSessions(params: {
    memberId?: string;
    branchId?: string;
    branchIds?: string[];
    diagnosisCategories?: string[];
    role?: string;
    userId?: string;
    page?: number;
    limit?: number;
    // Additional filters
    doctorId?: string;
    doctorIds?: string[];
    nurseId?: string;
    nurseIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    pelaksanaan?: string;
  }) {
    const {
      memberId,
      branchId,
      branchIds,
      diagnosisCategories,
      role,
      userId,
      page = 1,
      limit = 20,
      doctorId,
      doctorIds,
      nurseId,
      nurseIds,
      dateFrom,
      dateTo,
      status,
      pelaksanaan,
    } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      encounter: {
        memberPackage: {
          packageType: 'BASIC', // Only show BASIC packages, not BOOSTER
        },
      },
    };

    const addAndFilter = (condition: any) => {
      where.AND = Array.isArray(where.AND) ? [...where.AND, condition] : [condition];
    };
    
    // Filter by memberId if provided
    if (memberId) {
      where.encounter.memberId = memberId;
    }

    // Filter by doctor(s), including additional doctors assigned to the session
    const selectedDoctorIds = doctorIds?.length
      ? doctorIds
      : doctorId && doctorId !== 'all'
        ? [doctorId]
        : [];

    if (selectedDoctorIds.length > 0) {
      addAndFilter({
        OR: [
          { doctorId: { in: selectedDoctorIds } },
          { sessionDoctors: { some: { doctorId: { in: selectedDoctorIds } } } },
        ],
      });
    }

    // Filter by nurse(s), including additional nurses assigned to the session
    const selectedNurseIds = nurseIds?.length
      ? nurseIds
      : nurseId && nurseId !== 'all'
        ? [nurseId]
        : [];

    if (selectedNurseIds.length > 0) {
      addAndFilter({
        OR: [
          { nurseId: { in: selectedNurseIds } },
          { sessionNurses: { some: { nurseId: { in: selectedNurseIds } } } },
        ],
      });
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      where.treatmentDate = {};
      if (dateFrom) {
        where.treatmentDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add 1 day to include the end date
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        where.treatmentDate.lt = endDate;
      }
    }

    // Filter by status
    if (status && status !== 'all') {
      where.isCompleted = status === 'completed';
    }

    // Filter by pelaksanaan
    if (pelaksanaan && pelaksanaan !== 'all') {
      where.pelaksanaan = pelaksanaan;
    }

    // Filter by diagnosis categories
    if (diagnosisCategories && diagnosisCategories.length > 0) {
      where.encounter.diagnoses = {
        some: {
          kategoriDiagnosa: { in: diagnosisCategories }
        }
      };
    }

    // Role-based branch filtering
    // SUPER_ADMIN and ADMIN_MANAGER can see all branches (or filter by specific branches)
    if (role && ['SUPER_ADMIN', 'ADMIN_MANAGER'].includes(role)) {
      // If branchIds array is provided, use it for filtering (multiple branches)
      if (branchIds && branchIds.length > 0) {
        if (branchIds.length === 1) {
          where.branchId = branchIds[0];
        } else {
          where.branchId = { in: branchIds };
        }
      } else if (branchId) {
        // Backward compatibility: single branchId (deprecated, use branchIds instead)
        where.branchId = branchId;
      }
      // Otherwise, no branch filter - see all branches
    } else if (role && !['SUPER_ADMIN', 'ADMIN_MANAGER'].includes(role)) {
      // For DOCTOR and NURSE, get all accessible branches from StaffBranch table
      if ((role === 'DOCTOR' || role === 'NURSE') && userId) {
        const staffBranches = await prisma.staffBranch.findMany({
          where: { userId },
          select: { branchId: true },
        });
        
        const accessibleBranchIds = staffBranches.map(sb => sb.branchId);
        
        // Also include primary branchId if exists
        if (branchId && !accessibleBranchIds.includes(branchId)) {
          accessibleBranchIds.push(branchId);
        }
        
        console.log(`🔒 ${role} ${userId} filtering sessions by branches:`, accessibleBranchIds);
        
        if (accessibleBranchIds.length > 0) {
          where.branchId = { in: accessibleBranchIds };
        } else {
          // No branches assigned - return empty result
          where.branchId = 'no-branches-assigned';
        }
      } else if (branchId) {
        // For ADMIN_CABANG and ADMIN_LAYANAN, use primary branchId
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
        sessionDoctors: {
          include: {
            doctor: { include: { profile: true } },
          },
          orderBy: { isPrimary: 'desc' },
        },
        sessionNurses: {
          include: {
            nurse: { include: { profile: true } },
          },
          orderBy: { isPrimary: 'desc' },
        },
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
            const latestBranchSession = await prisma.treatmentSession.findFirst({
              where: {
                branchId: mb.branchId,
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
              select: { branchInfusKe: true },
              orderBy: { branchInfusKe: 'desc' },
            });

            return {
              branchId: mb.branchId,
              branchName: mb.branch.name,
              branchCode: mb.branch.branchCode,
              sessionCount: latestBranchSession?.branchInfusKe || 0,
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
            branchInfusKe: session.branchInfusKe, // Persisted therapy number at current branch
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
            memberPackage: {
              packageId: session.encounter.memberPackage.id,
              packageCode: session.encounter.memberPackage.packageCode,
              packageType: session.encounter.memberPackage.packageType,
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
      step8_evaluation: this.hasDoctorEvaluation(session.evaluation),
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
      branchId: session.branchId,
      branchName: branch?.name || 'Unknown',
      branchCode: branch?.branchCode || '',
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
      memberPackage: {
        packageId: session.encounter.memberPackage.id,
        packageCode: session.encounter.memberPackage.packageCode,
        packageType: session.encounter.memberPackage.packageType,
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
