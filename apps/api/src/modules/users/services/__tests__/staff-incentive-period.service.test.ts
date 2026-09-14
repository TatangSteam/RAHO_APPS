import { Role, StaffIncentivePeriodStatus } from '@prisma/client';
import { prisma } from '@lib/prisma';
import {
  getMonthlyStaffIncentivesService,
  transitionStaffIncentivePeriodService,
} from '../staff-incentive.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    staffIncentivePeriod: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

const prismaMock = prisma as any;
const savedReport = {
  period: {
    month: '2026-09',
    timezone: 'Asia/Jakarta',
    start: '2026-08-31T17:00:00.000Z',
    endExclusive: '2026-09-30T17:00:00.000Z',
  },
  rules: {},
  nakes: [],
  mso: [],
  coordinators: [],
  doctorHeads: [],
  anomalies: [],
  summary: { grandTotalAmount: 0 },
};

describe('staff incentive period workflow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a saved snapshot instead of silently recalculating historical values', async () => {
    prismaMock.staffIncentivePeriod.findUnique.mockResolvedValue({
      id: 'period-1',
      status: StaffIncentivePeriodStatus.APPROVED,
      report: savedReport,
      generatedAt: new Date('2026-10-01T00:00:00.000Z'),
      reviewedAt: new Date('2026-10-01T01:00:00.000Z'),
      approvedAt: new Date('2026-10-01T02:00:00.000Z'),
      paidAt: null,
    });

    const result = await getMonthlyStaffIncentivesService(
      { month: '2026-09' },
      Role.SUPER_ADMIN,
      'super-1',
      null,
    );

    expect(result.workflow).toMatchObject({ periodId: 'period-1', status: 'APPROVED' });
    expect(result.summary.grandTotalAmount).toBe(0);
  });

  it('blocks approval while assignment anomalies remain', async () => {
    prismaMock.staffIncentivePeriod.findUnique.mockResolvedValue({
      id: 'period-1',
      status: StaffIncentivePeriodStatus.REVIEWED,
      report: { ...savedReport, anomalies: [{ code: 'MISSING_BRANCH_DOCTOR' }] },
    });

    await expect(transitionStaffIncentivePeriodService(
      'period-1',
      'APPROVE',
      Role.SUPER_ADMIN,
      'super-1',
    )).rejects.toMatchObject({ code: 'INCENTIVE_PERIOD_HAS_ANOMALIES' });
    expect(prismaMock.staffIncentivePeriod.updateMany).not.toHaveBeenCalled();
  });

  it('moves an anomaly-free reviewed period to approved', async () => {
    prismaMock.staffIncentivePeriod.findUnique.mockResolvedValue({
      id: 'period-1',
      status: StaffIncentivePeriodStatus.REVIEWED,
      report: savedReport,
    });
    prismaMock.staffIncentivePeriod.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.staffIncentivePeriod.findUniqueOrThrow.mockResolvedValue({ id: 'period-1', status: 'APPROVED' });

    await transitionStaffIncentivePeriodService(
      'period-1',
      'APPROVE',
      Role.FINANCE_LOGISTICS_CONTROLLER,
      'finance-1',
    );

    expect(prismaMock.staffIncentivePeriod.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'period-1', status: StaffIncentivePeriodStatus.REVIEWED },
      data: expect.objectContaining({
        status: StaffIncentivePeriodStatus.APPROVED,
        approvedBy: 'finance-1',
      }),
    }));
  });
});
