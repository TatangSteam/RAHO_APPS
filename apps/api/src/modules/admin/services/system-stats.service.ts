import { prisma } from '../../../lib/prisma';
import { Prisma } from '@prisma/client';

type RecentActivity = Prisma.AuditLogGetPayload<{
  include: {
    user: { include: { profile: true } };
    branch: { select: { name: true } };
  };
}>;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getAuditMeta(activity: RecentActivity) {
  return asRecord(activity.meta);
}

function resolveActivityUserName(activity: RecentActivity): string {
  const meta = getAuditMeta(activity);
  const actorSnapshot = asRecord(meta.actorSnapshot);

  return (
    activity.userName ||
    activity.user?.profile?.fullName ||
    activity.user?.email ||
    optionalString(actorSnapshot.userName) ||
    optionalString(actorSnapshot.fullName) ||
    optionalString(actorSnapshot.email) ||
    'System'
  );
}

function resolveActivityUserEmail(activity: RecentActivity): string {
  const meta = getAuditMeta(activity);
  const actorSnapshot = asRecord(meta.actorSnapshot);

  return (
    activity.user?.email ||
    optionalString(actorSnapshot.email) ||
    activity.userName ||
    'system'
  );
}

function resolveActivityBranchName(activity: RecentActivity): string | null {
  const meta = getAuditMeta(activity);
  const branchSnapshot = asRecord(meta.branchSnapshot);

  return activity.branchName || activity.branch?.name || optionalString(branchSnapshot.branchName) || null;
}

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
        prisma.revenueRecognition.aggregate({
          where: {
            status: 'POSTED',
            branch: { isActive: true },
          },
          _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: null } })),
        
        // Monthly revenue from active branches only
        prisma.revenueRecognition.aggregate({
          where: {
            status: 'POSTED',
            branch: { isActive: true },
            recognizedAt: { gte: firstDayOfMonth },
          },
          _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: null } })),
        
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
        totalRevenue: Number(totalRevenue._sum.amount || 0),
        monthlyRevenue: Number(monthlyRevenue._sum.amount || 0),
        totalSessions,
        monthlySessions,
        usersByRole: usersByRole.map(item => ({
          role: item.role,
          count: item._count,
        })),
        recentActivities: recentActivities.map(activity => ({
          id: activity.id,
          action: activity.action,
          userName: resolveActivityUserName(activity),
          userEmail: resolveActivityUserEmail(activity),
          branchName: resolveActivityBranchName(activity),
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
      userName: resolveActivityUserName(activity),
      userEmail: resolveActivityUserEmail(activity),
      branchName: resolveActivityBranchName(activity),
      meta: activity.meta,
      timestamp: activity.createdAt.toISOString(),
    }));
  }
}
