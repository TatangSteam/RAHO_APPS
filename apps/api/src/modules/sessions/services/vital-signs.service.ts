// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import type { CreateVitalSignInput } from '../sessions.schema';

export class VitalSignsService {
  async upsertVitalSign(sessionId: string, data: CreateVitalSignInput, _userId: string) {
    // Check if session exists
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

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
      },
      update: {
        value: data.value,
        unit: data.unit,
        recordedBy: data.recordedBy,
      },
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
