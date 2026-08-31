import { AuditAction, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { logAudit } from '@utils/auditLog';
import { DiagnosisService } from '../diagnosis.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    diagnosis: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    treatmentSession: { findFirst: jest.fn() },
  },
}));

jest.mock('@utils/auditLog', () => ({ logAudit: jest.fn() }));

const mockedPrisma = prisma as unknown as {
  diagnosis: { findUnique: jest.Mock; update: jest.Mock };
  user: { findUnique: jest.Mock };
  treatmentSession: { findFirst: jest.Mock };
};

describe('DiagnosisService session-writer edit access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.treatmentSession.findFirst.mockResolvedValue({ isCompleted: false, completedAt: null });
  });

  it('allows DOCTOR to update a session diagnosis and writes an audit log', async () => {
    mockedPrisma.diagnosis.findUnique.mockResolvedValue({
      id: 'diagnosis-1',
      diagnosisCode: 'DXS-001',
      kategoriDiagnosa: null,
      kategoriDiagnosaList: [],
      encounter: { branch: { id: 'branch-1' } },
    });
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 'doctor-1', role: Role.DOCTOR });
    mockedPrisma.diagnosis.update.mockResolvedValue({
      id: 'diagnosis-1',
      diagnosisCode: 'DXS-001',
      diagnosa: 'Diagnosa terkoreksi',
    });

    const result = await new DiagnosisService().updateDiagnosis(
      'encounter-1',
      { diagnosa: 'Diagnosa terkoreksi' },
      'doctor-1',
    );

    expect(result.diagnosa).toBe('Diagnosa terkoreksi');
    expect(mockedPrisma.diagnosis.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'diagnosis-1' },
      data: expect.objectContaining({ diagnosa: 'Diagnosa terkoreksi' }),
    }));
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'doctor-1',
      action: AuditAction.UPDATE,
      resource: 'Diagnosis',
      resourceId: 'diagnosis-1',
    }));
  });

  it.each([Role.NURSE, Role.ADMIN_LAYANAN])('allows %s to edit session diagnosis data', async (role) => {
    mockedPrisma.diagnosis.findUnique.mockResolvedValue({
      id: 'diagnosis-1',
      diagnosisCode: 'DXS-001',
      kategoriDiagnosa: null,
      kategoriDiagnosaList: [],
      encounter: { branch: { id: 'branch-1' } },
    });
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 'operator-1', role });
    mockedPrisma.diagnosis.update.mockResolvedValue({
      id: 'diagnosis-1',
      diagnosisCode: 'DXS-001',
      diagnosa: 'Diperbarui operasional',
    });

    await expect(new DiagnosisService().updateDiagnosis(
      'encounter-1',
      { diagnosa: 'Diperbarui operasional' },
      'operator-1',
    )).resolves.toMatchObject({ diagnosa: 'Diperbarui operasional' });
    expect(mockedPrisma.diagnosis.update).toHaveBeenCalled();
  });
});
