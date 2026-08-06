import { prisma } from '../../../lib/prisma';
import { AuditAction, Prisma } from '@prisma/client';

/**
 * Service for audit log management
 */
export class AuditLogsService {
  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters: {
    userId?: string;
    action?: AuditAction;
    resource?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      userId,
      action,
      resource,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters;

    // Build where clause
    const where: Prisma.AuditLogWhereInput = {};

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = action;
    }

    if (resource) {
      where.resource = resource;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await prisma.auditLog.count({ where });

    // Get logs with pagination
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        branch: {
          select: {
            id: true,
            branchCode: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      logs: logs.map(log => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        meta: log.meta,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString(),
        user: {
          id: log.user.id,
          email: log.user.email,
          fullName: log.user.profile?.fullName || log.user.email,
          role: log.user.role,
        },
        branch: log.branch ? {
          id: log.branch.id,
          branchCode: log.branch.branchCode,
          name: log.branch.name,
        } : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
