import { prisma } from '../../../lib/prisma';
import type { CreateVitalSignInput } from '../sessions.schema';
import { AuditAction, Prisma, Role } from '@prisma/client';
import { logAudit } from '../../../utils/auditLog';
import { assertSessionEditWindow } from './session-edit-window';

const VITAL_EDITORS: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.NURSE,
];

export class VitalSignsService {
  async upsertVitalSign(sessionId: string, data: CreateVitalSignInput, userId: string) {
    // Check if session exists
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      include: { sessionNurses: { select: { nurseId: true } } },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!actor || !VITAL_EDITORS.includes(actor.role)) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Tanda vital hanya dapat dikoreksi oleh Nakes, MSO, atau admin yang berwenang.' };
    }
    if (
      actor.role === Role.ADMIN_LAYANAN
      && session.adminLayananId !== userId
    ) {
      throw { status: 403, code: 'SESSION_NOT_ASSIGNED', message: 'MSO hanya dapat mengedit sesi yang ditugaskan kepadanya.' };
    }
    if (
      actor.role === Role.NURSE
      && session.nurseId !== userId
      && !session.sessionNurses.some((assignment) => assignment.nurseId === userId)
    ) {
      throw { status: 403, code: 'SESSION_NOT_ASSIGNED', message: 'Nakes hanya dapat mengedit sesi yang ditugaskan kepadanya.' };
    }
    assertSessionEditWindow(session);

    const existing = await prisma.vitalSign.findUnique({
      where: {
        treatmentSessionId_pencatatan_waktuCatat: {
          treatmentSessionId: sessionId,
          pencatatan: data.pencatatan,
          waktuCatat: data.waktuCatat,
        },
      },
    });

    // No prerequisite validation - allow vital signs anytime
    const vitalSign = await prisma.vitalSign.upsert({
      where: {
        treatmentSessionId_pencatatan_waktuCatat: {
          treatmentSessionId: sessionId,
          pencatatan: data.pencatatan,
          waktuCatat: data.waktuCatat,
        },
      },
      create: {
        treatmentSessionId: sessionId,
        ...data,
        recordedBy: userId,
      } as Prisma.VitalSignUncheckedCreateInput,
      update: {
        value: data.value,
        unit: data.unit,
        recordedBy: userId,
      },
    });

    await logAudit({
      userId,
      branchId: session.branchId,
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      resource: 'VitalSign',
      resourceId: vitalSign.id,
      beforeData: existing,
      afterData: vitalSign,
      meta: { sessionId, pencatatan: data.pencatatan, waktuCatat: data.waktuCatat },
    });

    return vitalSign;
  }

  async getVitalSigns(sessionId: string) {
    const vitalSigns = await prisma.vitalSign.findMany({
      where: { treatmentSessionId: sessionId },
      orderBy: { createdAt: 'asc' },
    });

    return vitalSigns;
  }
}
