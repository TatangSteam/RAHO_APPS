import { prisma } from '../../../lib/prisma';
import { MemberTherapyPlanSetEditService } from '../../members/services/member-therapy-plan-set-edit.service';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    therapyPlanSet: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('session therapy plan set editing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('moves the current session and infusion to the copied plan version', async () => {
    const currentPlan = {
      id: 'plan-current',
      planCode: 'TP-SET-01',
      memberId: 'member-1',
      therapyPlanSetId: 'set-1',
      planNumber: 1,
      treatmentSessionId: 'session-1',
      keterangan: 'Lama',
      ifa250: 1,
      ifa500: null,
      hho: null,
      hhoKonsentrat: null,
      h2: null,
      no: null,
      gaso: null,
      o2: null,
      o3: null,
      edta: null,
      mb: null,
      h2s: null,
      kcl: null,
      jmlNb: null,
      ifaSubstances: null,
      ifaSubstanceTotalMl: null,
    };
    const otherUsedPlan = {
      ...currentPlan,
      id: 'plan-other-used',
      planCode: 'TP-SET-02',
      planNumber: 2,
      treatmentSessionId: 'session-2',
    };
    const futurePlan = {
      ...currentPlan,
      id: 'plan-future',
      planCode: 'TP-SET-03',
      planNumber: 3,
      treatmentSessionId: null,
    };

    (prisma.therapyPlanSet.findUnique as jest.Mock).mockResolvedValue({
      id: 'set-1',
      memberId: 'member-1',
      setCode: 'TPS-001',
      name: 'Set #1',
      version: 1,
      status: 'ACTIVE',
      createdBy: 'doctor-1',
      plans: [currentPlan, otherUsedPlan, futurePlan],
    });

    const therapyPlanCreate = jest
      .fn()
      .mockResolvedValueOnce({ id: 'plan-current-v2' })
      .mockResolvedValueOnce({ id: 'plan-other-used-v2' })
      .mockResolvedValueOnce({ id: 'plan-future-v2' });
    const therapyPlanUpdate = jest.fn().mockResolvedValue({});
    const infusionUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      therapyPlanSet: {
        create: jest.fn().mockResolvedValue({
          id: 'set-2',
          setCode: 'TPS-001-V2',
          version: 2,
          createdAt: new Date('2026-06-23T00:00:00.000Z'),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      therapyPlan: {
        create: therapyPlanCreate,
        update: therapyPlanUpdate,
      },
      infusionExecution: {
        updateMany: infusionUpdateMany,
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx)
    );

    const service = new MemberTherapyPlanSetEditService();
    const result = await service.bulkEditTherapyPlanSet(
      'set-1',
      {
        plans: [
          {
            planNumber: 1,
            keterangan: 'Diperbarui dari sesi',
            ifa250: 1,
          },
        ],
      },
      { editableTreatmentSessionId: 'session-1' }
    );

    expect(therapyPlanUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-current' },
      data: { treatmentSessionId: null },
    });
    expect(therapyPlanUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-current-v2' },
      data: { treatmentSessionId: 'session-1' },
    });
    expect(infusionUpdateMany).toHaveBeenCalledWith({
      where: { treatmentSessionId: 'session-1' },
      data: { therapyPlanId: 'plan-current-v2' },
    });
    expect(therapyPlanUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-other-used' },
      data: { treatmentSessionId: null },
    });
    expect(therapyPlanUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-other-used-v2' },
      data: { treatmentSessionId: 'session-2' },
    });
    expect(infusionUpdateMany).toHaveBeenCalledWith({
      where: { treatmentSessionId: 'session-2' },
      data: { therapyPlanId: 'plan-other-used-v2' },
    });
    expect(result.data.sessionTherapyPlanId).toBe('plan-current-v2');
    expect(result.data.version).toBe(2);
  });

  it('copies only retained plans when reducing therapy count', async () => {
    const basePlan = {
      id: 'plan-1',
      planCode: 'TP-SET-01',
      memberId: 'member-1',
      therapyPlanSetId: 'set-1',
      planNumber: 1,
      treatmentSessionId: null,
      keterangan: 'Terapi 1',
      ifa250: 1,
      ifa500: null,
      hho: null,
      hhoKonsentrat: null,
      h2: null,
      no: null,
      gaso: null,
      o2: null,
      o3: null,
      edta: null,
      mb: null,
      h2s: null,
      kcl: null,
      jmlNb: null,
      ifaSubstances: null,
      ifaSubstanceTotalMl: null,
    };
    const plans = [
      basePlan,
      {
        ...basePlan,
        id: 'plan-2',
        planCode: 'TP-SET-02',
        planNumber: 2,
        keterangan: 'Terapi 2',
      },
      {
        ...basePlan,
        id: 'plan-3',
        planCode: 'TP-SET-03',
        planNumber: 3,
        keterangan: 'Terapi 3',
      },
    ];

    (prisma.therapyPlanSet.findUnique as jest.Mock).mockResolvedValue({
      id: 'set-1',
      memberId: 'member-1',
      setCode: 'TPS-001',
      name: 'Set #1',
      version: 1,
      status: 'ACTIVE',
      createdBy: 'doctor-1',
      plans,
    });

    const therapyPlanCreate = jest
      .fn()
      .mockResolvedValueOnce({ id: 'plan-1-v2' })
      .mockResolvedValueOnce({ id: 'plan-2-v2' });
    const therapyPlanUpdate = jest.fn().mockResolvedValue({});
    const tx = {
      therapyPlanSet: {
        create: jest.fn().mockResolvedValue({
          id: 'set-2',
          setCode: 'TPS-001-V2',
          version: 2,
          createdAt: new Date('2026-06-23T00:00:00.000Z'),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      therapyPlan: {
        create: therapyPlanCreate,
        update: therapyPlanUpdate,
      },
      infusionExecution: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx)
    );

    const service = new MemberTherapyPlanSetEditService();
    const result = await service.bulkEditTherapyPlanSet('set-1', {
      retainedPlanNumbers: [1, 2],
      plans: [],
    });

    expect(therapyPlanCreate).toHaveBeenCalledTimes(2);
    expect(therapyPlanCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ planNumber: 1 }),
      })
    );
    expect(therapyPlanCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ planNumber: 2 }),
      })
    );
    expect(therapyPlanUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: expect.objectContaining({ supersededById: 'plan-1-v2' }),
    });
    expect(therapyPlanUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-2' },
      data: expect.objectContaining({ supersededById: 'plan-2-v2' }),
    });
    expect(therapyPlanUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'plan-3' } })
    );
    expect(result.data.totalPlans).toBe(2);
    expect(result.data.editedPlans).toBe(0);
  });
});
