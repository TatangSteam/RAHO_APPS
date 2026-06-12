// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateDiagnosisCode } from '../../../utils/codeGenerator';
import type { CreateDiagnosisInput } from '../sessions.schema';
import type { UpdateDiagnosisInput } from '../sessions.schema';
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

  /**
   * Update an existing diagnosis linked to an encounter.
   * Only allows updating certain fields, doktorPemeriksa cannot be changed.
   * Only doctors can update diagnoses.
   */
  async updateDiagnosis(encounterId: string, data: UpdateDiagnosisInput, userId: string) {
    // Check if diagnosis exists for this encounter
    const existingDiagnosis = await prisma.diagnosis.findUnique({
      where: { encounterId },
      include: { encounter: { include: { branch: true } } },
    });

    if (!existingDiagnosis) {
      throw {
        status: 404,
        code: 'DIAGNOSIS_NOT_FOUND',
        message: 'Diagnosa untuk encounter ini tidak ditemukan',
      };
    }

    // Verify that the user is a doctor
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== Role.DOCTOR) {
      throw {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Hanya dokter yang dapat mengedit diagnosa',
      };
    }

    // Build update data - only include fields that are provided
    const updateData: any = {};
    if (data.diagnosa !== undefined) updateData.diagnosa = data.diagnosa;
    if (data.kategoriDiagnosa !== undefined) updateData.kategoriDiagnosa = data.kategoriDiagnosa;
    if (data.icdPrimer !== undefined) updateData.icdPrimer = data.icdPrimer;
    if (data.icdSekunder !== undefined) updateData.icdSekunder = data.icdSekunder;
    if (data.icdTersier !== undefined) updateData.icdTersier = data.icdTersier;
    if (data.keluhanRiwayatSekarang !== undefined) updateData.keluhanRiwayatSekarang = data.keluhanRiwayatSekarang;
    if (data.riwayatPenyakitTerdahulu !== undefined) updateData.riwayatPenyakitTerdahulu = data.riwayatPenyakitTerdahulu;
    if (data.riwayatSosialKebiasaan !== undefined) updateData.riwayatSosialKebiasaan = data.riwayatSosialKebiasaan;
    if (data.riwayatPengobatan !== undefined) updateData.riwayatPengobatan = data.riwayatPengobatan;
    if (data.pemeriksaanFisik !== undefined) updateData.pemeriksaanFisik = data.pemeriksaanFisik;
    if (data.pemeriksaanTambahan !== undefined) updateData.pemeriksaanTambahan = data.pemeriksaanTambahan;

    // Update timestamp
    updateData.updatedAt = new Date();

    const updatedDiagnosis = await prisma.diagnosis.update({
      where: { id: existingDiagnosis.id },
      data: updateData,
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'Diagnosis',
      resourceId: updatedDiagnosis.id,
      meta: {
        diagnosisCode: updatedDiagnosis.diagnosisCode,
        encounterId,
        action: 'DIAGNOSIS_EDITED',
        changedFields: Object.keys(updateData),
      },
    });

    return updatedDiagnosis;
  }
}
