import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@utils/response';
import { logAudit } from '@utils/auditLog';
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  updateOwnFullNameSchema,
  updateOwnUsernameSchema,
} from './auth.schema';
import {
  loginService,
  refreshService,
  getMeService,
  updateOwnFullNameService,
  updateOwnUsernameService,
} from './auth.service';

function getRequestIp(req: Request) {
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
  return ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1' ? '127.0.0.1' : ipAddress;
}

function getUserAgent(req: Request) {
  return req.headers['user-agent'] || 'unknown';
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const result = await loginService(input, getRequestIp(req), getUserAgent(req));
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokens = await refreshService(refreshToken);
    sendSuccess(res, tokens);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    logoutSchema.parse(req.body);

    if (req.user?.userId) {
      try {
        const shouldIncludeBranch = req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN_MANAGER';

        await logAudit({
          userId: req.user.userId,
          branchId: shouldIncludeBranch ? req.user.branchId : null,
          action: 'LOGOUT',
          module: 'AUTH',
          resource: 'Auth',
          resourceId: req.user.userId,
          entityType: 'User',
          entityId: req.user.userId,
          entityCode: req.user.email,
          description: `${req.user.email} logout dari sistem.`,
          meta: {
            email: req.user.email,
            role: req.user.role,
          },
          ipAddress: getRequestIp(req),
          userAgent: getUserAgent(req),
        });
      } catch (error) {
        console.error('Failed to create LOGOUT audit log:', error);
      }
    } else {
      console.warn('LOGOUT - No user in request, audit log not created');
    }

    sendSuccess(res, { message: 'Logout berhasil.' });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await getMeService(req.user.userId);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function updateOwnUsername(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateOwnUsernameSchema.parse(req.body);
    const oldUsername = req.user.email;
    const result = await updateOwnUsernameService(req.user.userId, input);

    logAudit({
      userId: req.user.userId,
      branchId: ['SUPER_ADMIN', 'ADMIN_MANAGER'].includes(req.user.role) ? null : req.user.branchId,
      action: 'UPDATE',
      module: 'AUTH',
      resource: 'User',
      resourceId: req.user.userId,
      entityType: 'User',
      entityId: req.user.userId,
      entityCode: result.username,
      description: `${oldUsername} mengubah username login menjadi ${result.username}.`,
      meta: { action: 'own_username_change', oldUsername, newUsername: result.username },
      ipAddress: getRequestIp(req),
      userAgent: getUserAgent(req),
    }).catch((error) => {
      console.error('Failed to create own username change audit log:', error);
    });

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function updateOwnFullName(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateOwnFullNameSchema.parse(req.body);
    const currentUser = await getMeService(req.user.userId);
    const previousFullName = currentUser.profile?.fullName ?? '';
    const result = await updateOwnFullNameService(req.user.userId, input);

    logAudit({
      userId: req.user.userId,
      branchId: ['SUPER_ADMIN', 'ADMIN_MANAGER'].includes(req.user.role) ? null : req.user.branchId,
      action: 'UPDATE',
      module: 'AUTH',
      resource: 'UserProfile',
      resourceId: req.user.userId,
      entityType: 'UserProfile',
      entityId: req.user.userId,
      entityCode: req.user.email,
      description: `${req.user.email} mengubah nama lengkap profil.`,
      meta: {
        action: 'own_full_name_change',
        previousFullName,
        nextFullName: result.fullName,
      },
      ipAddress: getRequestIp(req),
      userAgent: getUserAgent(req),
    }).catch((error) => {
      console.error('Failed to create own full name change audit log:', error);
    });

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
