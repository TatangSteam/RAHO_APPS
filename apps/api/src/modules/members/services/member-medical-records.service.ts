// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction } from '@prisma/client';

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
    const diagnoses = await prisma.encounterDiagnosis.findMany({
      where: {
        encounter: {
          memberId,
        },
      },
      include: {
        encounter: {
          include: {
            member: true,
            branch: true,
          },
        },
        diagnosedByUser: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { diagnosedAt: 'desc' },
    });

    return diagnoses.map(d => ({
      id: d.id,
      encounterId: d.encounterId,
      category: d.category,
      diagnosis: d.diagnosis,
      notes: d.notes,
      diagnosedAt: d.diagnosedAt.toISOString(),
      diagnosedBy: d.diagnosedByUser.profile?.fullName || 'Unknown',
      encounter: {
        id: d.encounter.id,
        encounterDate: d.encounter.encounterDate.toISOString(),
        branchName: d.encounter.branch.name,
      },
    }));
  }

  /**
   * Create member diagnosis
   */
  async createMemberDiagnosis(memberId: string, data: any, userId: string) {
    // Check if member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Create or get encounter
    let encounter = await prisma.encounter.findFirst({
      where: {
        memberId,
        encounterDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    });

    if (!encounter) {
      // Create new encounter
      encounter = await prisma.encounter.create({
        data: {
          memberId,
          branchId: data.branchId,
          encounterDate: new Date(),
          status: 'ACTIVE',
        },
      });
    }

    // Create diagnosis
    const diagnosis = await prisma.encounterDiagnosis.create({
      data: {
        encounterId: encounter.id,
        category: data.category,
        diagnosis: data.diagnosis,
        notes: data.notes,
        diagnosedBy: userId,
        diagnosedAt: new Date(),
      },
      include: {
        encounter: {
          include: {
            member: true,
            branch: true,
          },
        },
        diagnosedByUser: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Audit log
    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'EncounterDiagnosis',
      resourceId: diagnosis.id,
      meta: { memberId, encounterId: encounter.id, category: data.category },
    });

    return {
      id: diagnosis.id,
      encounterId: diagnosis.encounterId,
      category: diagnosis.category,
      diagnosis: diagnosis.diagnosis,
      notes: diagnosis.notes,
      diagnosedAt: diagnosis.diagnosedAt.toISOString(),
      diagnosedBy: diagnosis.diagnosedByUser.profile?.fullName || 'Unknown',
    };
  }

  /**
   * Get member therapy plans
   */
  async getMemberTherapyPlans(memberId: string) {
    const plans = await prisma.therapyPlan.findMany({
      where: {
        session: {
          encounter: {
            memberId,
          },
        },
      },
      include: {
        session: {
          include: {
            encounter: {
              include: {
                member: true,
                branch: true,
              },
            },
          },
        },
        createdByUser: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return plans.map(p => ({
      id: p.id,
      sessionId: p.sessionId,
      planDetails: p.planDetails,
      goals: p.goals,
      expectedOutcome: p.expectedOutcome,
      createdAt: p.createdAt.toISOString(),
      createdBy: p.createdByUser.profile?.fullName || 'Unknown',
      session: {
        id: p.session.id,
        sessionDate: p.session.sessionDate.toISOString(),
        branchName: p.session.encounter.branch.name,
      },
    }));
  }

  /**
   * Create member therapy plan
   */
  async createMemberTherapyPlan(memberId: string, data: any, userId: string) {
    // Check if member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Get or create encounter
    let encounter = await prisma.encounter.findFirst({
      where: {
        memberId,
        encounterDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    });

    if (!encounter) {
      encounter = await prisma.encounter.create({
        data: {
          memberId,
          branchId: data.branchId,
          encounterDate: new Date(),
          status: 'ACTIVE',
        },
      });
    }

    // Get or create session
    let session = await prisma.treatmentSession.findFirst({
      where: {
        encounterId: encounter.id,
        sessionDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    });

    if (!session) {
      session = await prisma.treatmentSession.create({
        data: {
          encounterId: encounter.id,
          sessionDate: new Date(),
          status: 'IN_PROGRESS',
        },
      });
    }

    // Create therapy plan
    const plan = await prisma.therapyPlan.create({
      data: {
        sessionId: session.id,
        planDetails: data.planDetails,
        goals: data.goals,
        expectedOutcome: data.expectedOutcome,
        createdBy: userId,
      },
      include: {
        session: {
          include: {
            encounter: {
              include: {
                member: true,
                branch: true,
              },
            },
          },
        },
        createdByUser: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Audit log
    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'TherapyPlan',
      resourceId: plan.id,
      meta: { memberId, sessionId: session.id },
    });

    return {
      id: plan.id,
      sessionId: plan.sessionId,
      planDetails: plan.planDetails,
      goals: plan.goals,
      expectedOutcome: plan.expectedOutcome,
      createdAt: plan.createdAt.toISOString(),
      createdBy: plan.createdByUser.profile?.fullName || 'Unknown',
    };
  }

  /**
   * Get member infusions
   */
  async getMemberInfusions(memberId: string) {
    const infusions = await prisma.infusion.findMany({
      where: {
        session: {
          encounter: {
            memberId,
          },
        },
      },
      include: {
        session: {
          include: {
            encounter: {
              include: {
                member: true,
                branch: true,
              },
            },
          },
        },
        administeredByUser: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { administeredAt: 'desc' },
    });

    return infusions.map(i => ({
      id: i.id,
      sessionId: i.sessionId,
      infusionType: i.infusionType,
      dosage: i.dosage,
      notes: i.notes,
      administeredAt: i.administeredAt.toISOString(),
      administeredBy: i.administeredByUser.profile?.fullName || 'Unknown',
      session: {
        id: i.session.id,
        sessionDate: i.session.sessionDate.toISOString(),
        branchName: i.session.encounter.branch.name,
      },
    }));
  }
}
