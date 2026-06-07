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

    // Validate vital sign ranges
    const validationError = this.validateVitalSignRange(data.pencatatan, data.value);
    if (validationError) {
      throw { status: 400, code: 'INVALID_VITAL_RANGE', message: validationError };
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

  // Validate vital sign value is within acceptable range
  private validateVitalSignRange(type: string, value: number): string | null {
    const ranges: Record<string, { min: number; max: number; label: string; unit: string }> = {
      SISTOL: { min: 80, max: 200, label: 'Sistol', unit: 'mmHg' },
      DIASTOL: { min: 40, max: 130, label: 'Diastol', unit: 'mmHg' },
      HR: { min: 40, max: 150, label: 'Heart Rate', unit: 'bpm' },
      SATURASI: { min: 70, max: 100, label: 'Saturasi O2', unit: '%' },
      PI: { min: 0.1, max: 20, label: 'Perfusion Index', unit: '%' },
    };

    const range = ranges[type];
    if (!range) {
      return null; // Unknown type, skip validation
    }

    if (value < range.min || value > range.max) {
      return `${range.label} harus antara ${range.min}-${range.max} ${range.unit}. Nilai yang diinput: ${value} ${range.unit}`;
    }

    return null; // Valid
  }
}
