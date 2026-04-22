// @ts-nocheck
import { prisma } from '../../../lib/prisma';

/**
 * Service for branch performance analytics
 */
export class BranchPerformanceService {
  /**
   * Get branch performance metrics
   */
  async getBranchPerformance() {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      include: {
        members: {
          where: { status: 'ACTIVE' },
        },
        users: {
          where: { isActive: true },
        },
        packages: {
          where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
        },
      },
    });

    const performance = await Promise.all(
      branches.map(async (branch) => {
        // Calculate revenue
        const revenue = await prisma.memberPackage.aggregate({
          where: {
            branchId: branch.id,
            status: { in: ['ACTIVE', 'COMPLETED'] },
          },
          _sum: { finalPrice: true },
        });

        // Calculate monthly revenue
        const monthlyRevenue = await prisma.memberPackage.aggregate({
          where: {
            branchId: branch.id,
            status: { in: ['ACTIVE', 'COMPLETED'] },
            paidAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: { finalPrice: true },
        });

        return {
          branchId: branch.id,
          branchName: branch.name,
          branchCode: branch.branchCode,
          metrics: {
            totalMembers: branch.members.length,
            totalUsers: branch.users.length,
            totalPackages: branch.packages.length,
            totalRevenue: Number(revenue._sum.finalPrice || 0),
            monthlyRevenue: Number(monthlyRevenue._sum.finalPrice || 0),
          },
        };
      })
    );

    return performance;
  }
}
