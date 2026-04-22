import { Request, Response, NextFunction } from 'express';
import { prisma } from '@lib/prisma';
import { sendSuccess, buildPaginationMeta } from '@utils/response';
import { Role } from '@prisma/client';

export async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    // Admin Cabang can only see logs from their branch
    if (req.user.role === Role.ADMIN_CABANG && req.user.branchId) {
      // Get users from the same branch
      const branchUsers = await prisma.user.findMany({
        where: { branchId: req.user.branchId },
        select: { id: true },
      });
      
      where.userId = {
        in: branchUsers.map(u => u.id),
      };
    }

    // Filter by action
    if (req.query.action) {
      where.action = req.query.action;
    }

    // Filter by resource
    if (req.query.resource) {
      where.resource = req.query.resource;
    }

    // Filter by date range
    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      if (req.query.startDate) {
        where.createdAt.gte = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        where.createdAt.lte = new Date(req.query.endDate as string);
      }
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              staffCode: true,
              role: true,
              profile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    sendSuccess(res, logs, 200, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const where: any = {};

    // Admin Cabang can only see stats from their branch
    if (req.user.role === Role.ADMIN_CABANG && req.user.branchId) {
      const branchUsers = await prisma.user.findMany({
        where: { branchId: req.user.branchId },
        select: { id: true },
      });
      
      where.userId = {
        in: branchUsers.map(u => u.id),
      };
    }

    // Get stats for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    where.createdAt = { gte: thirtyDaysAgo };

    const [totalActions, actionsByType, topUsers] = await Promise.all([
      // Total actions
      prisma.auditLog.count({ where }),

      // Actions by type
      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
      }),

      // Top active users
      prisma.auditLog.groupBy({
        by: ['userId'],
        where,
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),
    ]);

    // Get user details for top users
    const userIds = topUsers.map(u => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        staffCode: true,
        profile: {
          select: { fullName: true },
        },
      },
    });

    const topUsersWithDetails = topUsers.map(tu => {
      const user = users.find(u => u.id === tu.userId);
      return {
        userId: tu.userId,
        staffCode: user?.staffCode,
        fullName: user?.profile?.fullName,
        actionCount: tu._count.userId,
      };
    });

    sendSuccess(res, {
      totalActions,
      actionsByType: actionsByType.map(a => ({
        action: a.action,
        count: a._count.action,
      })),
      topUsers: topUsersWithDetails,
    });
  } catch (err) {
    next(err);
  }
}
