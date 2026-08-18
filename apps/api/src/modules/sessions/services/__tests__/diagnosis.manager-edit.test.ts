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
  },
}));

jest.mock('@utils/auditLog', () => ({ logAudit: jest.fn() }));

const mockedPrisma = prisma as unknown as {
  diagnosis: { findUnique: jest.Mock; update: jest.Mock };
  user: { findUnique: jest.Mock };
};

describe('DiagnosisService Admin Manager edit access', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows ADMIN_MANAGER to update a session diagnosis and writes an audit log', async () => {
    mockedPrisma.diagnosis.findUnique.mockResolvedValue({
      id: 'diagnosis-1',
      diagnosisCode: 'DXS-001',
      kategoriDiagnosa: null,
      kategoriDiagnosaList: [],
      encounter: { branch: { id: 'branch-1' } },
    });
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 'manager-1', role: Role.ADMIN_MANAGER });
    mockedPrisma.diagnosis.update.mockResolvedValue({
      id: 'diagnosis-1',
      diagnosisCode: 'DXS-001',
      diagnosa: 'Diagnosa terkoreksi',
    });

    const result = await new DiagnosisService().updateDiagnosis(
      'encounter-1',
      { diagnosa: 'Diagnosa terkoreksi' },
      'manager-1',
    );

    expect(result.diagnosa).toBe('Diagnosa terkoreksi');
    expect(mockedPrisma.diagnosis.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'diagnosis-1' },
      data: expect.objectContaining({ diagnosa: 'Diagnosa terkoreksi' }),
    }));
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'manager-1',
      action: AuditAction.UPDATE,
      resource: 'Diagnosis',
      resourceId: 'diagnosis-1',
    }));
  });

  it('keeps unrelated roles from editing diagnosis data', async () => {
    mockedPrisma.diagnosis.findUnique.mockResolvedValue({
      id: 'diagnosis-1',
      diagnosisCode: 'DXS-001',
      kategoriDiagnosa: null,
      kategoriDiagnosaList: [],
      encounter: { branch: { id: 'branch-1' } },
    });
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 'admin-service-1', role: Role.ADMIN_LAYANAN });

    await expect(new DiagnosisService().updateDiagnosis(
      'encounter-1',
      { diagnosa: 'Tidak boleh' },
      'admin-service-1',
    )).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(mockedPrisma.diagnosis.update).not.toHaveBeenCalled();
  });
});
