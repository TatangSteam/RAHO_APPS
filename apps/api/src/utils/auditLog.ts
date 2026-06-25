import { AuditAction } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { logger } from '@lib/logger';

export interface AuditLogPayload {
  userId?: string | null;
  branchId?: string | null;
  action: AuditAction;
  resource: string;
  resourceId: string;
  meta?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  impersonating?: {
    email: string;
    role: string;
    note?: string;
  };
}

type ActorSnapshot = {
  userId: string | null;
  email: string | null;
  fullName: string | null;
  role: string | null;
  staffCode: string | null;
  branchId: string | null;
  branchCode: string | null;
};

const UNKNOWN_USER_IDS = new Set(['', 'unknown', 'system', 'anonymous']);

function isUsableUserId(userId?: string | null): userId is string {
  return Boolean(userId && !UNKNOWN_USER_IDS.has(userId.toLowerCase()));
}

function emptyActorSnapshot(userId?: string | null): ActorSnapshot {
  return {
    userId: isUsableUserId(userId) ? userId : null,
    email: null,
    fullName: null,
    role: null,
    staffCode: null,
    branchId: null,
    branchCode: null,
  };
}

async function getActorSnapshot(userId?: string | null): Promise<ActorSnapshot> {
  if (!isUsableUserId(userId)) return emptyActorSnapshot(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      staffCode: true,
      branchId: true,
      profile: { select: { fullName: true } },
      branch: { select: { branchCode: true } },
    },
  });

  if (!user) return emptyActorSnapshot(null);

  return {
    userId: user.id,
    email: user.email,
    fullName: user.profile?.fullName || user.email,
    role: user.role,
    staffCode: user.staffCode,
    branchId: user.branchId,
    branchCode: user.branch?.branchCode || null,
  };
}

/**
 * Record a sensitive action to the audit log.
 * Fires and forgets — never throws, just logs warning on failure.
 */
export async function logAudit(payload: AuditLogPayload): Promise<void> {
  try {
    const actorSnapshot = await getActorSnapshot(payload.userId);
    const metaData: Record<string, unknown> = { ...(payload.meta ?? {}) };
    metaData.actorSnapshot = {
      ...(typeof metaData.actorSnapshot === 'object' && metaData.actorSnapshot !== null
        ? (metaData.actorSnapshot as Record<string, unknown>)
        : {}),
      ...actorSnapshot,
    };
    
    // Add impersonation info to meta if present
    if (payload.impersonating) {
      metaData.impersonating = payload.impersonating.email;
      metaData.impersonatedRole = payload.impersonating.role;
      metaData.note = payload.impersonating.note || `Action performed as ${payload.impersonating.email}`;
    }
    
    await prisma.auditLog.create({
      data: {
        userId: actorSnapshot.userId,
        branchId: payload.branchId || null,
        action: payload.action,
        resource: payload.resource,
        resourceId: payload.resourceId,
        meta: metaData as object,
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

/**
 * Helper to create audit log from Express request
 * Automatically handles impersonation tracking
 */
export async function logAuditFromRequest(
  req: any,
  action: AuditAction,
  resource: string,
  resourceId: string,
  meta?: Record<string, unknown>
): Promise<void> {
  const userId = req.originalUser?.userId || req.user.userId;
  const branchId = req.user.branchId;
  
  const impersonating = req.isImpersonating ? {
    email: req.user.email,
    role: req.user.role,
    note: `Action performed as ${req.user.email}`
  } : undefined;
  
  await logAudit({
    userId,
    branchId,
    action,
    resource,
    resourceId,
    meta,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    impersonating
  });
}
