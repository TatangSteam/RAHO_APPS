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
          where: { isActive: true },
        },
        users: {
          where: { isActive: true },
        },
        packages: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    const performance = await Promise.all(
      branches.map(async (branch) => {
        // Calculate revenue
        const revenue = await prisma.revenueRecognition.aggregate({
          where: {
            branchId: branch.id,
            status: 'POSTED',
          },
          _sum: { amount: true },
        });

        // Calculate monthly revenue
        const monthlyRevenue = await prisma.revenueRecognition.aggregate({
          where: {
            branchId: branch.id,
            status: 'POSTED',
            recognizedAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: { amount: true },
        });

        return {
          branchId: branch.id,
          branchName: branch.name,
          branchCode: branch.branchCode,
          metrics: {
            totalMembers: branch.members.length,
            totalUsers: branch.users.length,
            totalPackages: branch.packages.length,
            totalRevenue: Number(revenue._sum.amount || 0),
            monthlyRevenue: Number(monthlyRevenue._sum.amount || 0),
          },
        };
      })
    );

    return performance;
  }
}
