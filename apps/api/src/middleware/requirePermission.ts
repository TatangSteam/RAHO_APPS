import { NextFunction, Request, Response } from 'express';
import { sendError } from '@utils/response';
import { hasPermission } from '@modules/iam/authorization.service';
import { PermissionCode } from '@modules/iam/permission-catalog';

type BranchResolver = (req: Request) => string | null | undefined;

function defaultBranchResolver(req: Request): string | null | undefined {
  const value = req.params?.branchId ?? req.query?.branchId ?? req.body?.branchId;
  return typeof value === 'string' && value.trim() ? value : null;
}

export function requirePermission(permission: PermissionCode, branchResolver: BranchResolver = defaultBranchResolver) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 401, 'AUTH_TOKEN_MISSING', 'Token autentikasi diperlukan.');
      return;
    }

    try {
      const branchId = branchResolver(req);
      const allowed = await hasPermission(req.user.userId, permission, branchId);
      if (!allowed) {
        sendError(res, 403, 'PERMISSION_FORBIDDEN', `Permission ${permission} diperlukan.`);
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
