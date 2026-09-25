import { prisma } from '../../../../lib/prisma';
import { MemberTherapyPlanSetEditService } from '../member-therapy-plan-set-edit.service';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    therapyPlanSet: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    therapyPlan: {
      findMany: jest.fn(),
    },
    treatmentSession: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../sessions/services/infusion-material-sync.service', () => ({
  syncSessionInfusionToTherapyPlan: jest.fn(),
}));

const prismaMock = prisma as any;

describe('MemberTherapyPlanSetEditService.deleteTherapyPlanSet', () => {
  const transactionClient = {
    therapyPlan: {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    therapyPlanSet: {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.therapyPlanSet.findUnique.mockResolvedValue({ id: 'set-v3', memberId: 'member-1' });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient),
    );
  });

  it('deletes the active set and all unused historical versions atomically', async () => {
    prismaMock.therapyPlanSet.findMany.mockResolvedValue([
      { id: 'set-v1', supersededById: 'set-v2' },
      { id: 'set-v2', supersededById: 'set-v3' },
      { id: 'set-v3', supersededById: null },
      { id: 'other-set', supersededById: null },
    ]);
    prismaMock.therapyPlan.findMany.mockResolvedValue([
      { id: 'plan-v1', planCode: 'TP-1', planNumber: 1, treatmentSessionId: null, infusions: [], _count: { infusions: 0 } },
      { id: 'plan-v2', planCode: 'TP-2', planNumber: 1, treatmentSessionId: null, infusions: [], _count: { infusions: 0 } },
      { id: 'plan-v3', planCode: 'TP-3', planNumber: 1, treatmentSessionId: null, infusions: [], _count: { infusions: 0 } },
    ]);

    const result = await new MemberTherapyPlanSetEditService()
      .deleteTherapyPlanSet('member-1', 'set-v3');

    expect(prismaMock.therapyPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        therapyPlanSetId: {
          in: expect.arrayContaining(['set-v1', 'set-v2', 'set-v3']),
        },
      },
    }));
    expect(transactionClient.therapyPlan.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['plan-v1', 'plan-v2', 'plan-v3'] } },
      data: { supersededById: null },
    });
    expect(transactionClient.therapyPlan.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['plan-v1', 'plan-v2', 'plan-v3'] } },
    });
    expect(transactionClient.therapyPlanSet.updateMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(['set-v1', 'set-v2', 'set-v3']) } },
      data: { supersededById: null },
    });
    expect(transactionClient.therapyPlanSet.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(['set-v1', 'set-v2', 'set-v3']) } },
    });
    expect(result.data).toEqual({
      setId: 'set-v3',
      deletedSets: 3,
      deletedPlans: 3,
      deletedSessions: 0,
      reversedSessions: 0,
      sessionCodes: [],
    });
    expect(result.message).toContain('2 versi riwayat');
  });

  it('blocks deletion when a plan in any historical version was used', async () => {
    prismaMock.therapyPlanSet.findMany.mockResolvedValue([
      { id: 'set-v1', supersededById: 'set-v2' },
      { id: 'set-v2', supersededById: 'set-v3' },
      { id: 'set-v3', supersededById: null },
    ]);
    prismaMock.therapyPlan.findMany.mockResolvedValue([
      { id: 'plan-v1', planCode: 'TP-1', planNumber: 1, treatmentSessionId: 'session-1', infusions: [{ treatmentSessionId: 'session-1' }], _count: { infusions: 1 } },
      { id: 'plan-v3', planCode: 'TP-3', planNumber: 1, treatmentSessionId: null, infusions: [], _count: { infusions: 0 } },
    ]);

    await expect(
      new MemberTherapyPlanSetEditService().deleteTherapyPlanSet('member-1', 'set-v3'),
    ).rejects.toMatchObject({
      status: 409,
      code: 'THERAPY_PLAN_SET_IN_USE',
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('deletes linked sessions and reverses completed sessions before deleting the set family', async () => {
    prismaMock.therapyPlanSet.findMany.mockResolvedValue([
      { id: 'set-v1', supersededById: 'set-v2' },
      { id: 'set-v2', supersededById: null },
    ]);
    prismaMock.therapyPlan.findMany.mockResolvedValue([
      {
        id: 'plan-v1',
        planCode: 'TP-1',
        planNumber: 1,
        treatmentSessionId: 'session-1',
        infusions: [{ treatmentSessionId: 'session-1' }],
        _count: { infusions: 1 },
      },
      {
        id: 'plan-v2',
        planCode: 'TP-2',
        planNumber: 2,
        treatmentSessionId: 'session-2',
        infusions: [],
        _count: { infusions: 0 },
      },
    ]);
    prismaMock.treatmentSession.findMany.mockResolvedValue([
      { id: 'session-1', sessionCode: 'SES-001', isCompleted: true, completionStatus: 'COMPLETED' },
      { id: 'session-2', sessionCode: 'SES-002', isCompleted: false, completionStatus: 'IN_PROGRESS' },
    ]);
    const completionService = { cancelCompletion: jest.fn().mockResolvedValue({}) };
    const deletionService = { deleteSession: jest.fn().mockResolvedValue({}) };

    const result = await new MemberTherapyPlanSetEditService(completionService, deletionService)
      .deleteTherapyPlanSet('member-1', 'set-v3', 'admin-1', {
        deleteLinkedSessions: true,
        confirmation: 'HAPUS SET DAN SESI',
        reason: 'Salah membuat rencana terapi',
      });

    expect(completionService.cancelCompletion).toHaveBeenCalledTimes(1);
    expect(completionService.cancelCompletion).toHaveBeenCalledWith(
      'session-1',
      'admin-1',
      expect.objectContaining({ reopenForEditing: true, reason: 'Salah membuat rencana terapi' }),
    );
    expect(deletionService.deleteSession).toHaveBeenNthCalledWith(1, 'session-1', 'admin-1');
    expect(deletionService.deleteSession).toHaveBeenNthCalledWith(2, 'session-2', 'admin-1');
    expect(result.data).toEqual(expect.objectContaining({
      deletedSessions: 2,
      reversedSessions: 1,
      sessionCodes: ['SES-001', 'SES-002'],
    }));
    expect(transactionClient.therapyPlan.deleteMany).toHaveBeenCalled();
    expect(transactionClient.therapyPlanSet.deleteMany).toHaveBeenCalled();
  });

  it('requires explicit confirmation before deleting linked sessions', async () => {
    prismaMock.therapyPlanSet.findMany.mockResolvedValue([
      { id: 'set-v3', supersededById: null },
    ]);
    prismaMock.therapyPlan.findMany.mockResolvedValue([
      {
        id: 'plan-v3',
        planCode: 'TP-3',
        planNumber: 1,
        treatmentSessionId: 'session-1',
        infusions: [],
        _count: { infusions: 0 },
      },
    ]);

    await expect(
      new MemberTherapyPlanSetEditService().deleteTherapyPlanSet(
        'member-1',
        'set-v3',
        'admin-1',
        { deleteLinkedSessions: true, confirmation: 'HAPUS', reason: 'Salah data' },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: 'THERAPY_PLAN_SET_DELETE_CONFIRMATION_REQUIRED',
    });

    expect(prismaMock.treatmentSession.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('does not allow deleting a set owned by another member', async () => {
    prismaMock.therapyPlanSet.findUnique.mockResolvedValue({ id: 'set-v3', memberId: 'member-2' });

    await expect(
      new MemberTherapyPlanSetEditService().deleteTherapyPlanSet('member-1', 'set-v3'),
    ).rejects.toMatchObject({
      status: 404,
      code: 'THERAPY_PLAN_SET_NOT_FOUND',
    });

    expect(prismaMock.therapyPlanSet.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
