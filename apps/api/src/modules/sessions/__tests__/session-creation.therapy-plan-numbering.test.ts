import { prisma } from '../../../lib/prisma';
import { SessionCreationService } from '../services/session-creation.service';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    therapyPlan: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    treatmentSession: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../../utils/auditLog', () => ({
  logAudit: jest.fn(),
}));

jest.mock('../../../utils/codeGenerator', () => ({
  generateEncounterCode: jest.fn(),
  generateSessionCode: jest.fn(),
}));

describe('SessionCreationService therapy-plan numbering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a selected plan when its set order differs from the global session number', async () => {
    const selectedPlan = {
      id: 'plan-1',
      memberId: 'member-1',
      planNumber: 1,
      treatmentSessionId: null,
      supersededById: null,
      therapyPlanSet: { status: 'ACTIVE' },
    };
    (prisma.therapyPlan.findUnique as jest.Mock).mockResolvedValue(selectedPlan);

    const service = new SessionCreationService();
    const result = await (service as any).resolveTherapyPlanForSession(
      'plan-1',
      'member-1',
      50
    );

    expect(result).toBe(selectedPlan);
  });

  it('auto-selects the earliest unused plan from the active set', async () => {
    const nextPlan = {
      id: 'plan-2',
      memberId: 'member-1',
      planNumber: 2,
      treatmentSessionId: null,
      supersededById: null,
      therapyPlanSet: { status: 'ACTIVE' },
    };
    (prisma.therapyPlan.findFirst as jest.Mock).mockResolvedValue(nextPlan);

    const service = new SessionCreationService();
    const result = await (service as any).resolveTherapyPlanForSession(
      undefined,
      'member-1',
      50
    );

    expect(prisma.therapyPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          memberId: 'member-1',
          treatmentSessionId: null,
          supersededById: null,
          therapyPlanSet: { status: 'ACTIVE' },
        }),
        orderBy: [{ planNumber: 'asc' }, { createdAt: 'asc' }],
      })
    );
    expect(result).toBe(nextPlan);
  });

  it('continues automatic numbering from persisted manual global and branch numbers', async () => {
    (prisma.treatmentSession.findFirst as jest.Mock)
      .mockResolvedValueOnce({ infusKe: 50 })
      .mockResolvedValueOnce({ branchInfusKe: 10 });

    const service = new SessionCreationService();
    const result = await (service as any).calculateInfusKe('member-1', 'branch-1');

    expect(result).toEqual({ globalInfusKe: 51, branchInfusKe: 11 });
    expect(prisma.treatmentSession.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 'branch-1',
          encounter: expect.objectContaining({ memberId: 'member-1' }),
        }),
        select: { branchInfusKe: true },
        orderBy: { branchInfusKe: 'desc' },
      })
    );
  });

  it('rejects a duplicate manual branch number for the same member and branch', async () => {
    (prisma.treatmentSession.findFirst as jest.Mock).mockResolvedValue({
      sessionCode: 'SES-001',
      treatmentDate: new Date('2026-07-06T00:00:00.000Z'),
    });

    const service = new SessionCreationService();

    await expect(
      (service as any).validateManualBranchInfusKe('member-1', 'branch-1', 10)
    ).rejects.toMatchObject({
      status: 422,
      code: 'BRANCH_INFUS_KE_ALREADY_USED',
    });
  });
});
