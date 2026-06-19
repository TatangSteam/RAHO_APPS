// @ts-nocheck
import { prisma } from '../../../lib/prisma';

/**
 * Service for system statistics and health monitoring
 */
export class SystemStatsService {
  /**
   * Get comprehensive system statistics for Super Admin
   */
  async getSystemStats() {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalMembers,
        activeMembers,
        totalBranches,
        activeBranches,
        totalUsers,
        activeUsers,
        totalProducts,
        activeProducts,
        totalSessions,
        monthlySessions,
        totalRevenue,
        monthlyRevenue,
        usersByRole,
        recentActivities,
      ] = await Promise.all([
        // Total members
        prisma.member.count().catch(() => 0),
        
        // Active members
        prisma.member.count({ where: { isActive: true, isDeceased: false } }).catch(() => 0),
        
        // Total branches
        prisma.branch.count().catch(() => 0),
        
        // Active branches
        prisma.branch.count({ where: { isActive: true } }).catch(() => 0),
        
        // Total users
        prisma.user.count().catch(() => 0),
        
        // Active users
        prisma.user.count({ where: { isActive: true } }).catch(() => 0),
        
        // Total master products
        prisma.masterProduct.count().catch(() => 0),
        
        // Active master products
        prisma.masterProduct.count({ where: { isActive: true } }).catch(() => 0),
        
        // Total therapy sessions
        prisma.treatmentSession.count().catch(() => 0),
        
        // Monthly therapy sessions
        prisma.treatmentSession.count({
          where: {
            createdAt: { gte: firstDayOfMonth },
          },
        }).catch(() => 0),
        
        // Total revenue from active branches only
        prisma.invoice.aggregate({
          where: {
            status: 'PAID',
            branch: { isActive: true },
          },
          _sum: { totalAmount: true },
        }).catch(() => ({ _sum: { totalAmount: null } })),
        
        // Monthly revenue from active branches only
        prisma.invoice.aggregate({
          where: {
            status: 'PAID',
            branch: { isActive: true },
            paidAt: { gte: firstDayOfMonth },
          },
          _sum: { totalAmount: true },
        }).catch(() => ({ _sum: { totalAmount: null } })),
        
        // Users by role
        prisma.user.groupBy({
          by: ['role'],
          _count: true,
          where: { isActive: true },
        }).catch(() => []),
        
        // Recent activities (last 10)
        prisma.auditLog.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              include: {
                profile: true,
              },
            },
            branch: {
              select: {
                name: true,
              },
            },
          },
        }).catch(() => []),
      ]);

      return {
        totalBranches,
        activeBranches,
        totalUsers,
        activeUsers,
        totalMembers,
        activeMembers,
        totalProducts,
        activeProducts,
        totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
        monthlyRevenue: Number(monthlyRevenue._sum.totalAmount || 0),
        totalSessions,
        monthlySessions,
        usersByRole: usersByRole.map(item => ({
          role: item.role,
          count: item._count,
        })),
        recentActivities: recentActivities.map(activity => ({
          id: activity.id,
          action: activity.action,
          userName: activity.user.profile?.fullName || activity.user.email,
          userEmail: activity.user.email,
          branchName: activity.branch?.name || null,
          createdAt: activity.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      console.error('Error in getSystemStats:', error);
      // Return default values if there's an error
      return {
        totalBranches: 0,
        activeBranches: 0,
        totalUsers: 0,
        activeUsers: 0,
        totalMembers: 0,
        activeMembers: 0,
        totalProducts: 0,
        activeProducts: 0,
        totalRevenue: 0,
        monthlyRevenue: 0,
        totalSessions: 0,
        monthlySessions: 0,
        usersByRole: [],
        recentActivities: [],
      };
    }
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
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        branch: {
          select: {
            name: true,
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
      userEmail: activity.user.email,
      branchName: activity.branch?.name || null,
      meta: activity.meta,
      timestamp: activity.createdAt.toISOString(),
    }));
  }
}
