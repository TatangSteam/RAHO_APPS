// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { AuditAction } from '@prisma/client';

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
    const where: any = {};

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
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
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
      },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      logs: logs.map(log => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        userId: log.userId,
        userName: log.user.profile?.fullName || log.user.email,
        userEmail: log.user.email,
        meta: log.meta,
        timestamp: log.timestamp.toISOString(),
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
