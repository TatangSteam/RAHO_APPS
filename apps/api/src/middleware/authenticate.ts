import { Request, Response, NextFunction } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { verifyAccessToken, JwtPayload } from '@lib/jwt';
import { sendError } from '@utils/response';
import {
  getCurrentDatabaseProfileId,
  getCurrentDatabaseRuntimeRevision,
  prisma,
} from '@lib/prisma';
import { logger } from '@lib/logger';
import { getAccessibleBranchIds, getEffectivePermissionCodes } from '@modules/iam/authorization.service';

// Extend Express Request with authenticated user
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        userId: string;
        email: string;
        role: string;
        branchId: string | null;
        branchCode: string | null;
        adminManagerAccessScope?: string | null;
        fullName: string;
        staffCode: string | null;
        branches?: string[];
        permissions?: string[];
        accessibleBranchIds?: string[] | null;
        roleTemplateId?: string | null;
      };
      originalUser?: {
        id: string;
        userId: string;
        email: string;
        role: string;
        branchId: string | null;
        adminManagerAccessScope?: string | null;
        fullName: string;
      };
      isImpersonating: boolean;
      impersonationChain?: string[];
    }
  }
}

function extractDeepestImpersonation(payload: JwtPayload): {
  deepest: NonNullable<JwtPayload['impersonating']>;
  chain: string[];
} {
  const chain: string[] = [payload.email];
  let current = payload.impersonating;

  if (!current) {
    throw new Error('No impersonation data found');
  }

  while (current.impersonating) {
    chain.push(current.email);
    current = current.impersonating;
  }

  chain.push(current.email);

  return { deepest: current, chain };
}

async function getCurrentUserContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      branchId: true,
      roleTemplateId: true,
      staffCode: true,
      isActive: true,
      adminManagerAccessScope: true,
      profile: { select: { fullName: true } },
      branch: { select: { branchCode: true } },
    },
  });
  if (!user?.isActive) return null;
  const [permissions, accessibleBranchIds] = await Promise.all([
    getEffectivePermissionCodes(user.id),
    getAccessibleBranchIds(user.id),
  ]);
  const legacyBranchIds = accessibleBranchIds === null
    ? (await prisma.branch.findMany({ where: { isActive: true }, select: { id: true } })).map((branch) => branch.id)
    : accessibleBranchIds;
  return { user, permissions, accessibleBranchIds, legacyBranchIds };
}

/**
 * Verify JWT access token and attach the current authorization user to the request.
 *
 * For impersonation tokens, req.user is the deepest impersonated user so all
 * authorization checks evaluate the actor currently being used.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn('Authentication token missing or invalid format');
    sendError(res, 401, 'AUTH_TOKEN_MISSING', 'Token autentikasi diperlukan.');
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);

    if (
      (
        payload.databaseProfileId
        && payload.databaseProfileId !== getCurrentDatabaseProfileId()
      ) || (
        payload.databaseRuntimeRevision !== undefined
        && payload.databaseRuntimeRevision !== getCurrentDatabaseRuntimeRevision()
      )
    ) {
      sendError(
        res,
        401,
        'AUTH_DATABASE_CHANGED',
        'Database aktif telah berubah. Silakan login kembali.',
      );
      return;
    }

    if (payload.impersonating) {
      const { deepest, chain } = extractDeepestImpersonation(payload);
      const current = await getCurrentUserContext(deepest.userId);
      if (!current) {
        sendError(res, 401, 'AUTH_USER_INACTIVE', 'Akun tidak aktif atau tidak ditemukan.');
        return;
      }
      const { user, permissions, accessibleBranchIds, legacyBranchIds } = current;

      logger.debug('Impersonation token authenticated', {
        chain,
        actingAs: deepest.email,
        actingRole: deepest.role,
      });

      req.originalUser = {
        id: payload.userId,
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        branchId: payload.branchId,
        fullName: payload.fullName,
      };

      req.user = {
        id: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
        branchCode: user.branch?.branchCode || null,
        fullName: user.profile?.fullName || user.email,
        staffCode: user.staffCode,
        roleTemplateId: user.roleTemplateId,
        branches: legacyBranchIds,
        permissions,
        accessibleBranchIds,
        ...(user.role === 'ADMIN_MANAGER' ? { adminManagerAccessScope: user.adminManagerAccessScope } : {}),
      };

      req.isImpersonating = true;
      req.impersonationChain = chain;
    } else {
      const current = await getCurrentUserContext(payload.userId);
      if (!current) {
        sendError(res, 401, 'AUTH_USER_INACTIVE', 'Akun tidak aktif atau tidak ditemukan.');
        return;
      }
      const { user, permissions, accessibleBranchIds, legacyBranchIds } = current;

      req.user = {
        id: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
        branchCode: user.branch?.branchCode || null,
        fullName: user.profile?.fullName || user.email,
        staffCode: user.staffCode,
        roleTemplateId: user.roleTemplateId,
        branches: legacyBranchIds,
        permissions,
        accessibleBranchIds,
        ...(user.role === 'ADMIN_MANAGER' ? { adminManagerAccessScope: user.adminManagerAccessScope } : {}),
      };
      req.isImpersonating = false;
    }

    next();
  } catch (err) {
    logger.warn('Authentication token verification failed', { err });

    if (err instanceof TokenExpiredError) {
      sendError(res, 401, 'AUTH_TOKEN_EXPIRED', 'Sesi Anda telah berakhir. Silakan login kembali.');
      return;
    }

    if (err instanceof JsonWebTokenError) {
      sendError(res, 401, 'AUTH_TOKEN_INVALID', 'Token tidak valid.');
      return;
    }

    sendError(res, 401, 'AUTH_TOKEN_INVALID', 'Token tidak valid.');
  }
}
