import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { sendError } from '@utils/response';

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

    next();
  };
}

// ── Convenience role groups ──────────────────────────────────

export const ALLSTAFF: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.DOCTOR,
  Role.NURSE,
];

export const ADMIN_ABOVE: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
];

export const MANAGER_ABOVE: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_MANAGER];

export const SUPER_ADMIN_ONLY: Role[] = [Role.SUPER_ADMIN];
