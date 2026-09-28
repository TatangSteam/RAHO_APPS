import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { SystemStatsService } from '../system-stats.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    member: { count: jest.fn() },
    branch: { count: jest.fn() },
    user: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    masterProduct: { count: jest.fn() },
    treatmentSession: { count: jest.fn() },
    revenueRecognition: { aggregate: jest.fn() },
    auditLog: { findMany: jest.fn() },
  },
}));

describe('SystemStatsService staff counts', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.member.count as jest.Mock).mockResolvedValue(0);
    (prisma.branch.count as jest.Mock).mockResolvedValue(0);
    (prisma.user.count as jest.Mock)
      .mockResolvedValueOnce(56)
      .mockResolvedValueOnce(54);
    (prisma.user.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.masterProduct.count as jest.Mock).mockResolvedValue(0);
    (prisma.treatmentSession.count as jest.Mock).mockResolvedValue(0);
    (prisma.revenueRecognition.aggregate as jest.Mock).mockResolvedValue({
      _sum: { amount: null },
    });
    (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('excludes MEMBER accounts from total and active staff', async () => {
    const result = await new SystemStatsService().getSystemStats();

    expect(prisma.user.count).toHaveBeenNthCalledWith(1, {
      where: { role: { not: Role.MEMBER } },
    });
    expect(prisma.user.count).toHaveBeenNthCalledWith(2, {
      where: {
        isActive: true,
        role: { not: Role.MEMBER },
      },
    });
    expect(result).toMatchObject({
      totalUsers: 56,
      activeUsers: 54,
    });
  });
});
