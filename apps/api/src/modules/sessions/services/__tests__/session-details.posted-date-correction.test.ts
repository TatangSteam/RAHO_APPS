import { prisma } from '../../../../lib/prisma';
import { logAudit } from '../../../../utils/auditLog';
import { SessionDetailsService } from '../session-details.service';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    treatmentSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../../../utils/auditLog', () => ({
  logAudit: jest.fn(),
}));

describe('SessionDetailsService posted session date correction', () => {
  const service = new SessionDetailsService();
  const originalTreatmentDate = new Date('2026-07-21T05:49:00.000Z');
  const completedAt = new Date('2026-07-21T08:00:00.000Z');
  const postedSession = {
    id: 'session-1',
    branchId: 'branch-1',
    isCompleted: true,
    completionStatus: 'COMPLETED',
    completedAt,
    treatmentDate: originalTreatmentDate,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.treatmentSession.findUnique as jest.Mock).mockResolvedValue(postedSession);
  });

  it('allows an authorized manager route to correct only treatmentDate', async () => {
    const nextTreatmentDate = '2026-07-22T06:30:00.000Z';
    const updated = { ...postedSession, treatmentDate: new Date(nextTreatmentDate) };
    (prisma.treatmentSession.update as jest.Mock).mockResolvedValue(updated);

    const result = await service.updateSessionDetails(
      'session-1',
      { treatmentDate: nextTreatmentDate, shiftFollowingSessions: false },
      'manager-1',
      'branch-1',
    );

    expect(prisma.treatmentSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { treatmentDate: new Date(nextTreatmentDate) },
    });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'manager-1',
      branchId: 'branch-1',
      resource: 'TreatmentSession',
      resourceId: 'session-1',
      meta: expect.objectContaining({
        action: 'CORRECT_POSTED_SESSION_TREATMENT_DATE',
        previousTreatmentDate: originalTreatmentDate,
        nextTreatmentDate: new Date(nextTreatmentDate),
      }),
    }));
    expect(result).toEqual(updated);
  });

  it('keeps every non-date field immutable after posting', async () => {
    await expect(service.updateSessionDetails(
      'session-1',
      {
        treatmentDate: '2026-07-22T06:30:00.000Z',
        pelaksanaan: 'ON_SITE',
        shiftFollowingSessions: false,
      },
      'manager-1',
      'branch-1',
    )).rejects.toMatchObject({
      status: 409,
      code: 'POSTED_SESSION_IMMUTABLE',
    });

    expect(prisma.treatmentSession.update).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('does not allow date correction outside the authorized branch', async () => {
    await expect(service.updateSessionDetails(
      'session-1',
      { treatmentDate: '2026-07-22T06:30:00.000Z', shiftFollowingSessions: false },
      'manager-1',
      'branch-2',
    )).rejects.toMatchObject({
      status: 403,
      code: 'SESSION_BRANCH_ACCESS_DENIED',
    });

    expect(prisma.treatmentSession.update).not.toHaveBeenCalled();
  });
});
