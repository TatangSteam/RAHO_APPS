// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateDiagnosisCode } from '../../../utils/codeGenerator';
import type { CreateDiagnosisInput } from '../sessions.schema';
import { Role, AuditAction } from '@prisma/client';

export class DiagnosisService {
  async createDiagnosis(encounterId: string, data: CreateDiagnosisInput, userId: string) {
    // Check if diagnosis already exists
    const existing = await prisma.diagnosis.findUnique({
      where: { encounterId },
    });

    if (existing) {
      throw {
        status: 409,
        code: 'DIAGNOSIS_EXISTS',
        message: 'Diagnosa untuk encounter ini sudah ada',
      };
    }

    // Validate doctor
    const doctor = await prisma.user.findUnique({
      where: { id: data.doktorPemeriksa },
    });

    if (!doctor || doctor.role !== Role.DOCTOR) {
      throw {
        status: 403,
        code: 'INVALID_DOCTOR',
        message: 'Dokter pemeriksa tidak valid',
      };
    }

    // Get encounter for branch code and member
    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: { branch: true },
    });

    if (!encounter) {
      throw { status: 404, code: 'ENCOUNTER_NOT_FOUND', message: 'Encounter tidak ditemukan' };
    }

    // Generate diagnosis code with sequence
    const branchCode = encounter.branch.branchCode;
    const prefix = `DX-${branchCode}-`;
    const lastDiagnosis = await prisma.diagnosis.findFirst({
      where: { diagnosisCode: { startsWith: prefix } },
      orderBy: { diagnosisCode: 'desc' },
    });
    
    const sequence = lastDiagnosis 
      ? parseInt(lastDiagnosis.diagnosisCode.split('-').pop() || '0') + 1 
      : 1;
    
    const diagnosisCode = generateDiagnosisCode(branchCode, sequence);

    const diagnosis = await prisma.diagnosis.create({
      data: {
        diagnosisCode,
        memberId: encounter.memberId,
        encounterId,
        ...data,
        pemeriksaanTambahan: data.pemeriksaanTambahan || undefined,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'Diagnosis',
      resourceId: diagnosis.id,
      meta: { diagnosisCode, encounterId },
    });

    return diagnosis;
  }

  async getDiagnosisByEncounter(encounterId: string) {
    const diagnosis = await prisma.diagnosis.findUnique({
      where: { encounterId },
    });

    return diagnosis;
  }
}
