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

describe('EvaluationService idempotent create', () => {
  const transactionClient = {
    $executeRaw: jest.fn(),
    doctorEvaluation: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const session = {
    id: 'session-1',
    branchId: 'branch-1',
    doctorId: 'doctor-1',
    nurseId: 'nurse-1',
    adminLayananId: 'mso-1',
    sessionDoctors: [],
    sessionNurses: [],
    isCompleted: false,
    completedAt: null,
    emrNotes: [],
    branch: { branchCode: 'PST' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.treatmentSession.findUnique as jest.Mock).mockResolvedValue(session);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: Role.DOCTOR });
    transactionClient.$executeRaw.mockResolvedValue(1);
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient),
    );
    (logAudit as jest.Mock).mockResolvedValue(undefined);
  });

  it('updates the row created by the operational step instead of returning 409', async () => {
    const existing = {
      id: 'evaluation-1',
      evaluationCode: 'EVL-PST-0001',
      treatmentSessionId: 'session-1',
      keluhan: 'Pusing berkurang',
      rekomendasi: 'Istirahat cukup',
      subjective: null,
      objective: null,
      assessment: null,
      plan: null,
      generalNotes: null,
      writtenBy: 'nurse-1',
    };
    transactionClient.doctorEvaluation.findUnique.mockResolvedValue(existing);
    transactionClient.doctorEvaluation.update.mockResolvedValue({
      ...existing,
      subjective: 'Keluhan membaik',
      assessment: 'Terapi ditoleransi baik',
      writtenBy: 'doctor-1',
    });

    const result = await new EvaluationService().createEvaluation(
      'session-1',
      {
        subjective: 'Keluhan membaik',
        assessment: 'Terapi ditoleransi baik',
        writtenBy: 'doctor-1',
      },
      'doctor-1',
    );

    expect(result).toMatchObject({
      id: 'evaluation-1',
      evaluationCode: 'EVL-PST-0001',
      keluhan: 'Pusing berkurang',
      subjective: 'Keluhan membaik',
    });
    expect(transactionClient.doctorEvaluation.create).not.toHaveBeenCalled();
    expect(transactionClient.doctorEvaluation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { treatmentSessionId: 'session-1' } }),
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.UPDATE, beforeData: existing }),
    );
  });

  it('creates a new serialized evaluation when the session has no evaluation row', async () => {
    transactionClient.doctorEvaluation.findUnique.mockResolvedValue(null);
    transactionClient.doctorEvaluation.findFirst.mockResolvedValue({
      evaluationCode: 'EVL-PST-0007',
    });
    transactionClient.doctorEvaluation.create.mockResolvedValue({
      id: 'evaluation-8',
      evaluationCode: 'EVL-PST-2609-00008',
      treatmentSessionId: 'session-1',
      subjective: 'Stabil',
      writtenBy: 'doctor-1',
    });

    const result = await new EvaluationService().createEvaluation(
      'session-1',
      { subjective: 'Stabil', writtenBy: 'doctor-1' },
      'doctor-1',
    );

    expect(transactionClient.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transactionClient.doctorEvaluation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evaluationCode: expect.stringMatching(/^EVL-PST-\d{4}-00008$/),
        treatmentSessionId: 'session-1',
      }),
    });
    expect(result.evaluationCode).toBe('EVL-PST-2609-00008');
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.CREATE, beforeData: null }),
    );
  });
});
