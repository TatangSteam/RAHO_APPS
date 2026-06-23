import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { TherapyPlanService } from '../services/therapy-plan.service';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    therapyPlan: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../utils/auditLog', () => ({
  logAudit: jest.fn(),
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
      { editableTreatmentSessionId: 'session-1' }
    );
    expect(logAudit).toHaveBeenCalled();
    expect(result.data.version).toBe(3);
  });
});
