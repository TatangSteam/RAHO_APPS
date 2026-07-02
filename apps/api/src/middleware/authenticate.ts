import { Request, Response, NextFunction } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { verifyAccessToken, JwtPayload } from '@lib/jwt';
import { sendError } from '@utils/response';
import { prisma } from '@lib/prisma';
import { logger } from '@lib/logger';

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
        fullName: string;
        staffCode: string | null;
        branches?: string[];
      };
      originalUser?: {
        id: string;
        userId: string;
        email: string;
        role: string;
        branchId: string | null;
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

function uniqueBranchIds(branchId: string, assignedBranchIds: string[]): string[] {
  return [branchId, ...assignedBranchIds].filter(
    (value, index, all) => all.indexOf(value) === index,
  );
}

async function getAssignedBranchIds(
  userId: string,
  role: string,
  branchId?: string | null,
): Promise<string[]> {
  if (role === 'MEMBER' || !branchId) {
    return [];
  }

  const staffBranches = await prisma.staffBranch.findMany({
    where: { userId },
    select: { branchId: true },
  });

  return uniqueBranchIds(
    branchId,
    staffBranches.map((staffBranch) => staffBranch.branchId),
  );
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

    if (payload.impersonating) {
      const { deepest, chain } = extractDeepestImpersonation(payload);
      const assignedBranchIds = await getAssignedBranchIds(
        deepest.userId,
        deepest.role,
        deepest.branchId,
      );

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
        id: deepest.userId,
        userId: deepest.userId,
        email: deepest.email,
        role: deepest.role,
        branchId: deepest.branchId || null,
        branchCode: null,
        fullName: payload.fullName,
        staffCode: null,
        branches: deepest.branches || assignedBranchIds,
      };

      req.isImpersonating = true;
      req.impersonationChain = chain;
    } else {
      const assignedBranchIds = await getAssignedBranchIds(
        payload.userId,
        payload.role,
        payload.branchId,
      );

      req.user = {
        ...payload,
        id: payload.userId,
        branches: payload.branches || assignedBranchIds,
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
