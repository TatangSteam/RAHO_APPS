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
    };
  }

  /**
   * Get all sessions with optional filters
   */
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

    // Format sessions
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

  /**
   * Calculate branch-specific infusKe
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
    };
  }
}
