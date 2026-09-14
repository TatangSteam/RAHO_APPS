import { AuditAction, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { logAudit } from '@utils/auditLog';
import { EvaluationService } from '../evaluation.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    treatmentSession: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@utils/auditLog', () => ({ logAudit: jest.fn() }));

const mockedPrisma = prisma as unknown as {
  treatmentSession: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

const transactionClient = {
  $executeRaw: jest.fn(),
  doctorEvaluation: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const assignedSession = {
  id: 'session-1',
  branchId: 'branch-1',
  doctorId: 'doctor-1',
  nurseId: 'nurse-1',
  adminLayananId: 'mso-1',
  sessionDoctors: [],
  sessionNurses: [],
  isCompleted: false,
  completedAt: null,
};

describe('EvaluationService operational SOAP access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.treatmentSession.findUnique.mockResolvedValue(assignedSession);
    mockedPrisma.$transaction.mockImplementation(
      (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient),
    );
    transactionClient.$executeRaw.mockResolvedValue(1);
    transactionClient.doctorEvaluation.findUnique.mockResolvedValue({
      id: 'evaluation-1',
      treatmentSessionId: 'session-1',
      subjective: null,
      objective: null,
      assessment: null,
      plan: null,
      generalNotes: null,
      doctorEditedAt: null,
    });
    transactionClient.doctorEvaluation.update.mockImplementation(({ data }) => Promise.resolve({
      id: 'evaluation-1',
      ...data,
    }));
  });

  it.each([
    [Role.NURSE, 'nurse-1'],
    [Role.ADMIN_LAYANAN, 'mso-1'],
  ])('allows assigned %s to fill SOAP fields', async (role, userId) => {
    mockedPrisma.user.findUnique.mockResolvedValue({ role });

    await expect(new EvaluationService().updateEvaluation(
      'session-1',
      { subjective: 'Kondisi pasien stabil', assessment: 'Terapi ditoleransi baik' },
      userId,
    )).resolves.toMatchObject({
      subjective: 'Kondisi pasien stabil',
      assessment: 'Terapi ditoleransi baik',
      writtenBy: userId,
    });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      action: AuditAction.UPDATE,
      resource: 'DoctorEvaluation',
    }));
  });

  it('rejects an unassigned Nakes', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ role: Role.NURSE });

    await expect(new EvaluationService().updateEvaluation(
      'session-1',
      { subjective: 'Tidak boleh' },
      'nurse-other',
    )).rejects.toMatchObject({ status: 403, code: 'SESSION_NOT_ASSIGNED' });
    expect(transactionClient.doctorEvaluation.update).not.toHaveBeenCalled();
  });
});
