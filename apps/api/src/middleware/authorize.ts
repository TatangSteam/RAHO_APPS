import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { sendError } from '@utils/response';

const MEMBER_VIEW_ONLY_SCOPE = 'MEMBER_VIEW_ONLY';

function getNormalizedPath(req: Request): string {
  const path = `${req.baseUrl}${req.path}`.replace(/\/+/g, '/');
  return path.replace(/^\/api\/v\d+/, '') || '/';
}

function isMemberViewOnlyAllowedRoute(req: Request): boolean {
  const method = req.method.toUpperCase();
  const path = getNormalizedPath(req);

  if (method === 'GET' && (path === '/members' || path.startsWith('/members/'))) {
    return true;
  }

  if (method === 'GET' && (path === '/branches/all' || path === '/branches')) {
    return true;
  }

  if (method === 'GET' && /^\/branches\/[^/]+\/members$/.test(path)) {
    return true;
  }

  if (method === 'GET' && path === '/treatment-sessions' && typeof req.query.memberId === 'string') {
    return true;
  }

  return false;
}

/**
 * Middleware factory — checks that req.user.role is in the allowed list.
 * Must be used AFTER `authenticate`.
 *
 * @example
 *   router.post('/members', authenticate, authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG']), handler)
 */
export function authorize(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'AUTH_TOKEN_MISSING', 'Token autentikasi diperlukan.');
      return;
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      sendError(
        res,
        403,
        'AUTH_FORBIDDEN',
        'Anda tidak memiliki izin untuk melakukan aksi ini.',
      );
      return;
    }

    if (
      req.user.role === Role.ADMIN_MANAGER &&
      req.user.adminManagerAccessScope === MEMBER_VIEW_ONLY_SCOPE &&
      !isMemberViewOnlyAllowedRoute(req)
    ) {
      sendError(
        res,
        403,
        'ADMIN_MANAGER_MEMBER_VIEW_ONLY',
        'Akses Admin Manager ini dibatasi hanya untuk melihat data member.',
      );
      return;
    }

    next();
  };
}

// ── Convenience role groups ──────────────────────────────────

export const ALLSTAFF: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.ADMIN_LOGISTIK,
  Role.DOCTOR,
  Role.NURSE,
];

export const ADMIN_ABOVE: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_LOGISTIK,
  Role.ADMIN_CABANG,
];

export const MANAGER_ABOVE: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_LOGISTIK];

export const SUPER_ADMIN_ONLY: Role[] = [Role.SUPER_ADMIN];
