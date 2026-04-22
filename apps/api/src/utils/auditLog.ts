import { AuditAction } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { logger } from '@lib/logger';

export interface AuditLogPayload {
  userId: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  meta?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Record a sensitive action to the audit log.
 * Fires and forgets — never throws, just logs warning on failure.
 */
export async function logAudit(payload: AuditLogPayload): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: payload.action,
        resource: payload.resource,
        resourceId: payload.resourceId,
        meta: (payload.meta ?? {}) as object,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
      },
    });
  } catch (err) {
    logger.warn('[AuditLog] Failed to write audit log entry', {
      error: err,
      payload,
    });
  }
}
