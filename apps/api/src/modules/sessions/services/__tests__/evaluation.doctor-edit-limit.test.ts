import { Role } from '@prisma/client';
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
  nurseId: null,
  adminLayananId: null,
  sessionDoctors: [],
  sessionNurses: [],
  isCompleted: false,
  completedAt: null,
};

const evaluation = {
  id: 'evaluation-1',
  treatmentSessionId: 'session-1',
  subjective: 'Keluhan awal',
  objective: 'Stabil',
  assessment: 'Baik',
  plan: 'Observasi',
  generalNotes: null,
  doctorEditedAt: null,
};

describe('EvaluationService doctor edit limit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.treatmentSession.findUnique.mockResolvedValue(assignedSession);
    mockedPrisma.user.findUnique.mockResolvedValue({ role: Role.DOCTOR });
    mockedPrisma.$transaction.mockImplementation(
      (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient),
    );
    transactionClient.$executeRaw.mockResolvedValue(1);
    transactionClient.doctorEvaluation.findUnique.mockResolvedValue(evaluation);
    transactionClient.doctorEvaluation.update.mockImplementation(({ data }) => Promise.resolve({
      ...evaluation,
      ...data,
    }));
    (logAudit as jest.Mock).mockResolvedValue(undefined);
  });

  it('marks the first doctor correction as the single used edit', async () => {
    const result = await new EvaluationService().updateEvaluation(
      'session-1',
      { subjective: 'Keluhan membaik' },
      'doctor-1',
    );

    expect(result.doctorEditedAt).toBeInstanceOf(Date);
    expect(transactionClient.doctorEvaluation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ doctorEditedAt: expect.any(Date) }),
      }),
    );
  });

  it('rejects another doctor correction after the edit was used', async () => {
    transactionClient.doctorEvaluation.findUnique.mockResolvedValue({
      ...evaluation,
      doctorEditedAt: new Date('2026-09-14T05:00:00.000Z'),
    });

    await expect(new EvaluationService().updateEvaluation(
      'session-1',
      { subjective: 'Diubah lagi' },
      'doctor-1',
    )).rejects.toMatchObject({
      status: 409,
      code: 'DOCTOR_EVALUATION_EDIT_LIMIT_REACHED',
    });
    expect(transactionClient.doctorEvaluation.update).not.toHaveBeenCalled();
  });

  it('does not consume the edit when the doctor first fills an operational placeholder row', async () => {
    transactionClient.doctorEvaluation.findUnique.mockResolvedValue({
      ...evaluation,
      subjective: null,
      objective: null,
      assessment: null,
      plan: null,
      generalNotes: null,
    });

    const result = await new EvaluationService().updateEvaluation(
      'session-1',
      { subjective: 'Pengisian pertama' },
      'doctor-1',
    );

    expect(result.doctorEditedAt).toBeNull();
    expect(transactionClient.doctorEvaluation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ doctorEditedAt: expect.anything() }),
      }),
    );
  });
});
