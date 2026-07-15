import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { TherapyPlanService } from '../services/therapy-plan.service';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    therapyPlan: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    therapyPlanSet: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../utils/auditLog', () => ({
  logAudit: jest.fn(),
}));

jest.mock('../../../utils/codeGenerator', () => ({
  generateTherapyPlanCode: jest.fn(() => 'TP-TEST-0001'),
}));

jest.mock('../services/infusion-material-sync.service', () => ({
  syncSessionInfusionToTherapyPlan: jest.fn().mockResolvedValue({
    synced: true,
    adjustedMaterials: 0,
  }),
}));

describe('TherapyPlanService session editing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes a session from a superseded plan before creating a new version', async () => {
    (prisma.therapyPlan.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'plan-v1',
        planNumber: 1,
        therapyPlanSetId: 'set-v1',
        supersededById: 'plan-v2',
      })
      .mockResolvedValueOnce({
        id: 'plan-v2',
        planNumber: 1,
        therapyPlanSetId: 'set-v2',
        supersededById: null,
        treatmentSessionId: null,
      });

    const therapyPlanUpdate = jest.fn().mockResolvedValue({});
    const infusionUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (
        callback: (transaction: {
          therapyPlan: { update: typeof therapyPlanUpdate };
          infusionExecution: { updateMany: typeof infusionUpdateMany };
        }) => Promise<unknown>
      ) =>
        callback({
          therapyPlan: { update: therapyPlanUpdate },
          infusionExecution: { updateMany: infusionUpdateMany },
        })
    );

    const bulkEditTherapyPlanSet = jest.fn().mockResolvedValue({
      success: true,
      data: {
        setId: 'set-v3',
        originalSetId: 'set-v2',
        version: 3,
        editedPlans: 1,
      },
    });

    const service = new TherapyPlanService();
    (service as any).therapyPlanSetEditService = {
      bulkEditTherapyPlanSet,
    };

    const result = await service.updateTherapyPlanSetForSession(
      'session-1',
      { plans: [{ planNumber: 1, ifa250: 1 }] },
      'doctor-1'
    );

    expect(therapyPlanUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-v1' },
      data: { treatmentSessionId: null },
    });
    expect(therapyPlanUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-v2' },
      data: { treatmentSessionId: 'session-1' },
    });
    expect(bulkEditTherapyPlanSet).toHaveBeenCalledWith(
      'set-v2',
      { plans: [{ planNumber: 1, ifa250: 1 }] },
      { editableTreatmentSessionId: 'session-1', updatedBy: 'doctor-1' }
    );
    expect(logAudit).toHaveBeenCalled();
    expect(result.data.version).toBe(3);
  });

  it('can move the session to another unused therapy number without creating a new set version', async () => {
    (prisma.therapyPlan.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'plan-1',
      planNumber: 1,
      therapyPlanSetId: 'set-1',
      supersededById: null,
    });
    (prisma.therapyPlan.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'plan-3',
      planNumber: 3,
      therapyPlanSetId: 'set-1',
      supersededById: null,
      treatmentSessionId: null,
    });
    (prisma.therapyPlanSet.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'set-1',
      version: 1,
    });
    (prisma.therapyPlan.count as jest.Mock).mockResolvedValueOnce(3);

    const therapyPlanUpdate = jest.fn().mockResolvedValue({});
    const infusionUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (
        callback: (transaction: {
          therapyPlan: { update: typeof therapyPlanUpdate };
          infusionExecution: { updateMany: typeof infusionUpdateMany };
        }) => Promise<unknown>
      ) =>
        callback({
          therapyPlan: { update: therapyPlanUpdate },
          infusionExecution: { updateMany: infusionUpdateMany },
        })
    );

    const bulkEditTherapyPlanSet = jest.fn();
    const service = new TherapyPlanService();
    (service as any).therapyPlanSetEditService = {
      bulkEditTherapyPlanSet,
    };

    const result = await service.updateTherapyPlanSetForSession(
      'session-1',
      { sessionPlanNumber: 3, plans: [] },
      'admin-1'
    );

    expect(prisma.therapyPlan.findFirst).toHaveBeenCalledWith({
      where: {
        therapyPlanSetId: 'set-1',
        planNumber: 3,
      },
      select: {
        id: true,
        planNumber: true,
        therapyPlanSetId: true,
        supersededById: true,
        treatmentSessionId: true,
        ifa250: true,
        ifa500: true,
        hho: true,
        hhoKonsentrat: true,
        h2: true,
        no: true,
        gaso: true,
        o2: true,
        o3: true,
        edta: true,
        mb: true,
        h2s: true,
        kcl: true,
        jmlNb: true,
        ifaSubstances: true,
      },
    });
    expect(therapyPlanUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { treatmentSessionId: null },
    });
    expect(therapyPlanUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-3' },
      data: { treatmentSessionId: 'session-1' },
    });
    expect(infusionUpdateMany).toHaveBeenCalledWith({
      where: { treatmentSessionId: 'session-1' },
      data: { therapyPlanId: 'plan-3' },
    });
    expect(bulkEditTherapyPlanSet).not.toHaveBeenCalled();
    expect(result.data.sessionTherapyPlanId).toBe('plan-3');
    expect(result.data.version).toBe(1);
  });
});
