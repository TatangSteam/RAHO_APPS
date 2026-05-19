// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateDiagnosisCode } from '../../../utils/codeGenerator';
import type { CreateDiagnosisInput } from '../sessions.schema';
import { Role, AuditAction } from '@prisma/client';

export class DiagnosisService {
  /**
   * Link an existing diagnosis to an encounter for a therapy session.
   * 
   * This function finds an existing diagnosis by matching the diagnosis text
   * and links it to the encounter. If no matching diagnosis is found,
   * it creates a new one.
   * 
   * IMPORTANT: Diagnoses should be created from the Member Detail page first.
   * This function is used to link an existing diagnosis to a therapy session.
   */
  async createDiagnosis(encounterId: string, data: CreateDiagnosisInput, userId: string) {
    // Check if diagnosis already linked to this encounter
    const existingLinked = await prisma.diagnosis.findUnique({
      where: { encounterId },
    });

    if (existingLinked) {
      throw {
        status: 409,
        code: 'DIAGNOSIS_EXISTS',
        message: 'Diagnosa untuk encounter ini sudah ada',
      };
    }

    // Get encounter for member info
    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: { branch: true },
    });

    if (!encounter) {
      throw { status: 404, code: 'ENCOUNTER_NOT_FOUND', message: 'Encounter tidak ditemukan' };
    }

    // Try to find existing diagnosis for this member with matching diagnosis text
    const existingDiagnosis = await prisma.diagnosis.findFirst({
      where: {
        memberId: encounter.memberId,
        diagnosa: data.diagnosa,
        encounterId: null, // Only find unlinked diagnoses
      },
    });

    if (existingDiagnosis) {
      // Link existing diagnosis to this encounter
      const linkedDiagnosis = await prisma.diagnosis.update({
        where: { id: existingDiagnosis.id },
        data: { encounterId },
      });

      await logAudit({
        userId,
        action: AuditAction.UPDATE,
        resource: 'Diagnosis',
        resourceId: linkedDiagnosis.id,
        meta: { 
          action: 'LINK_TO_ENCOUNTER',
          diagnosisCode: linkedDiagnosis.diagnosisCode, 
          encounterId 
        },
      });

      return linkedDiagnosis;
    }

    // If no existing diagnosis found, create a new one
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
