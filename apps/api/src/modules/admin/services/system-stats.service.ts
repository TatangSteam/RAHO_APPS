// @ts-nocheck
import { prisma } from '../../../lib/prisma';

/**
 * Service for system statistics and health monitoring
 */
export class SystemStatsService {
  /**
   * Get system statistics
   */
  async getSystemStats() {
    const [
      totalMembers,
      activeMembers,
      totalBranches,
      activeBranches,
      totalUsers,
      activeUsers,
      totalPackages,
      activePackages,
      totalRevenue,
      monthlyRevenue,
    ] = await Promise.all([
      // Total members
      prisma.member.count(),
      
      // Active members
      prisma.member.count({ where: { status: 'ACTIVE' } }),
      
      // Total branches
      prisma.branch.count(),
      
      // Active branches
      prisma.branch.count({ where: { isActive: true } }),
      
      // Total users
      prisma.user.count(),
      
      // Active users
      prisma.user.count({ where: { isActive: true } }),
      
      // Total packages
      prisma.memberPackage.count(),
      
      // Active packages
      prisma.memberPackage.count({ where: { status: 'ACTIVE' } }),
      
      // Total revenue (all paid packages)
      prisma.memberPackage.aggregate({
        where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
        _sum: { finalPrice: true },
      }),
      
      // Monthly revenue (current month)
      prisma.memberPackage.aggregate({
        where: {
          status: { in: ['ACTIVE', 'COMPLETED'] },
          paidAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { finalPrice: true },
      }),
    ]);

    return {
      members: {
        total: totalMembers,
        active: activeMembers,
        inactive: totalMembers - activeMembers,
      },
      branches: {
        total: totalBranches,
        active: activeBranches,
        inactive: totalBranches - activeBranches,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
      },
      packages: {
        total: totalPackages,
        active: activePackages,
        completed: totalPackages - activePackages,
      },
      revenue: {
        total: Number(totalRevenue._sum.finalPrice || 0),
        monthly: Number(monthlyRevenue._sum.finalPrice || 0),
      },
    };
  }

  /**
   * Get system health status
   */
  async getSystemHealth() {
    const dbHealth = await this.checkDatabaseHealth();
    
    return {
      status: dbHealth ? 'healthy' : 'unhealthy',
      database: dbHealth ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(limit: number = 20) {
    const activities = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    return activities.map(activity => ({
      id: activity.id,
      action: activity.action,
      resource: activity.resource,
      resourceId: activity.resourceId,
      userId: activity.userId,
      userName: activity.user.profile?.fullName || activity.user.email,
      meta: activity.meta,
      timestamp: activity.timestamp.toISOString(),
    }));
  }
}
