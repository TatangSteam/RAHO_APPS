// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateDiagnosisCode } from '../../../utils/codeGenerator';
import type { CreateDiagnosisInput } from '../sessions.schema';
import { Role, AuditAction } from '@prisma/client';

export class DiagnosisService {
  /**
   * Create a session-specific diagnosis copy for an encounter.
   * 
   * This function creates a NEW diagnosis record for each therapy session,
   * copying data from the selected diagnosis. This prevents the original
   * diagnosis from being modified and allows the same diagnosis to be
   * used across multiple sessions.
   * 
   * IMPORTANT: 
   * - Original diagnoses (with encounterId = null) are created from Member Detail page
   * - Session diagnoses (with encounterId set) are copies created for each session
   * - This prevents duplicate diagnoses appearing in member's diagnosis list
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
    // Use "DXS" prefix for session diagnoses to differentiate from member diagnoses "DX"
    const branchCode = encounter.branch.branchCode;
    const prefix = `DXS-${branchCode}-`;
    const lastDiagnosis = await prisma.diagnosis.findFirst({
      where: { diagnosisCode: { startsWith: prefix } },
      orderBy: { diagnosisCode: 'desc' },
    });
    
    const sequence = lastDiagnosis 
      ? parseInt(lastDiagnosis.diagnosisCode.split('-').pop() || '0') + 1 
      : 1;
    
    const diagnosisCode = generateDiagnosisCode(branchCode, sequence, 'DXS');

    // Always create a new diagnosis record for this session
    // This is a "session copy" of the original diagnosis
    const diagnosis = await prisma.diagnosis.create({
      data: {
        diagnosisCode,
        memberId: encounter.memberId,
        encounterId, // Link to this specific encounter/session
        doktorPemeriksa: data.doktorPemeriksa,
        diagnosa: data.diagnosa,
        kategoriDiagnosa: data.kategoriDiagnosa || null,
        icdPrimer: data.icdPrimer || null,
        icdSekunder: data.icdSekunder || null,
        icdTersier: data.icdTersier || null,
        keluhanRiwayatSekarang: data.keluhanRiwayatSekarang || null,
        riwayatPenyakitTerdahulu: data.riwayatPenyakitTerdahulu || null,
        riwayatSosialKebiasaan: data.riwayatSosialKebiasaan || null,
        riwayatPengobatan: data.riwayatPengobatan || null,
        pemeriksaanFisik: data.pemeriksaanFisik || null,
        pemeriksaanTambahan: data.pemeriksaanTambahan || undefined,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'Diagnosis',
      resourceId: diagnosis.id,
      meta: { 
        diagnosisCode, 
        encounterId,
        action: 'SESSION_DIAGNOSIS_COPY',
        originalDiagnosa: data.diagnosa,
      },
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
