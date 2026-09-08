import type { NextFunction, Request, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { authenticate } from '../authenticate';
import { verifyAccessToken, type JwtPayload } from '@lib/jwt';
import {
  getCurrentDatabaseProfileId,
  getCurrentDatabaseRuntimeRevision,
  prisma,
} from '@lib/prisma';
import { sendError } from '@utils/response';
import {
  getAccessibleBranchIds,
  getEffectivePermissionCodes,
} from '@modules/iam/authorization.service';

jest.mock('@lib/jwt');
jest.mock('@utils/response');
jest.mock('@modules/iam/authorization.service', () => ({
  getAccessibleBranchIds: jest.fn(),
  getEffectivePermissionCodes: jest.fn(),
}));
jest.mock('@lib/prisma', () => ({
  getCurrentDatabaseProfileId: jest.fn(() => 'dummy'),
  getCurrentDatabaseRuntimeRevision: jest.fn(() => 2),
  prisma: {
    user: { findUnique: jest.fn() },
    branch: { findMany: jest.fn() },
  },
}));
jest.mock('@lib/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const users: Record<string, any> = {
  'user-123': {
    id: 'user-123', email: 'user@example.com', role: 'ADMIN_CABANG',
    branchId: 'branch-1', roleTemplateId: 'role-1', staffCode: 'STAFF001',
    isActive: true, adminManagerAccessScope: null,
    profile: { fullName: 'John Doe' }, branch: { branchCode: 'JKT' },
  },
  'manager-id': {
    id: 'manager-id', email: 'manager@raho.id', role: 'ADMIN_MANAGER',
    branchId: null, roleTemplateId: 'role-manager', staffCode: null,
    isActive: true, adminManagerAccessScope: 'FULL',
    profile: { fullName: 'Manager Aktif' }, branch: null,
  },
  'branch-admin-id': {
    id: 'branch-admin-id', email: 'branch@raho.id', role: 'ADMIN_CABANG',
    branchId: 'branch-1', roleTemplateId: 'role-branch', staffCode: 'CAB001',
    isActive: true, adminManagerAccessScope: null,
    profile: { fullName: 'Admin Cabang Aktif' }, branch: { branchCode: 'B001' },
  },
};

describe('authenticate middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { headers: {}, method: 'GET', path: '/test' };
    res = {};
    next = jest.fn();
    (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => users[where.id] ?? null);
    (prisma.branch.findMany as jest.Mock).mockResolvedValue([
      { id: 'branch-1' }, { id: 'branch-2' },
    ]);
    (getEffectivePermissionCodes as jest.Mock).mockResolvedValue(['sessions.read']);
    (getAccessibleBranchIds as jest.Mock).mockImplementation(async (userId: string) => {
      if (userId === 'manager-id') return ['branch-1', 'branch-2'];
      return ['branch-1'];
    });
  });

  it('rejects a missing bearer token', async () => {
    await authenticate(req as Request, res as Response, next);

    expect(sendError).toHaveBeenCalledWith(
      res, 401, 'AUTH_TOKEN_MISSING', 'Token autentikasi diperlukan.',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('loads normal authorization context from the database', async () => {
    req.headers = { authorization: 'Bearer valid-token' };
    (verifyAccessToken as jest.Mock).mockReturnValue({
      userId: 'user-123', email: 'stale@example.com', role: 'SUPER_ADMIN',
      branchId: null, branchCode: null, fullName: 'Stale', staffCode: null,
    } satisfies JwtPayload);

    await authenticate(req as Request, res as Response, next);

    expect(req.user).toMatchObject({
      id: 'user-123', email: 'user@example.com', role: 'ADMIN_CABANG',
      branchId: 'branch-1', branchCode: 'JKT', permissions: ['sessions.read'],
      accessibleBranchIds: ['branch-1'], branches: ['branch-1'],
    });
    expect(req.isImpersonating).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects an inactive or deleted database user', async () => {
    req.headers = { authorization: 'Bearer valid-token' };
    (verifyAccessToken as jest.Mock).mockReturnValue({ userId: 'missing-user' });

    await authenticate(req as Request, res as Response, next);

    expect(sendError).toHaveBeenCalledWith(
      res, 401, 'AUTH_USER_INACTIVE', 'Akun tidak aktif atau tidak ditemukan.',
    );
  });

  it('rejects a token issued before the active database changed', async () => {
    req.headers = { authorization: 'Bearer old-database-token' };
    (verifyAccessToken as jest.Mock).mockReturnValue({
      userId: 'user-123',
      databaseProfileId: 'production',
      databaseRuntimeRevision: 1,
    });

    await authenticate(req as Request, res as Response, next);

    expect(getCurrentDatabaseProfileId).toHaveBeenCalled();
    expect(getCurrentDatabaseRuntimeRevision).not.toHaveBeenCalled();
    expect(sendError).toHaveBeenCalledWith(
      res,
      401,
      'AUTH_DATABASE_CHANGED',
      'Database aktif telah berubah. Silakan login kembali.',
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an old session after switching away and back to the same database', async () => {
    req.headers = { authorization: 'Bearer stale-revision-token' };
    (verifyAccessToken as jest.Mock).mockReturnValue({
      userId: 'user-123',
      databaseProfileId: 'dummy',
      databaseRuntimeRevision: 1,
    });

    await authenticate(req as Request, res as Response, next);

    expect(getCurrentDatabaseRuntimeRevision).toHaveBeenCalled();
    expect(sendError).toHaveBeenCalledWith(
      res,
      401,
      'AUTH_DATABASE_CHANGED',
      'Database aktif telah berubah. Silakan login kembali.',
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('uses the active database context for single-level impersonation', async () => {
    req.headers = { authorization: 'Bearer impersonation-token' };
    (verifyAccessToken as jest.Mock).mockReturnValue({
      userId: 'super-admin-id', email: 'superadmin@raho.id', role: 'SUPER_ADMIN',
      branchId: null, branchCode: null, fullName: 'Super Admin', staffCode: null,
      impersonating: {
        userId: 'manager-id', email: 'manager@raho.id', role: 'ADMIN_MANAGER',
        branches: ['stale-branch'],
      },
    } satisfies JwtPayload);

    await authenticate(req as Request, res as Response, next);

    expect(req.originalUser).toMatchObject({ id: 'super-admin-id', role: 'SUPER_ADMIN' });
    expect(req.user).toMatchObject({
      id: 'manager-id', role: 'ADMIN_MANAGER', fullName: 'Manager Aktif',
      branches: ['branch-1', 'branch-2'], adminManagerAccessScope: 'FULL',
    });
    expect(req.impersonationChain).toEqual(['superadmin@raho.id', 'manager@raho.id']);
    expect(req.isImpersonating).toBe(true);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses the deepest user for nested impersonation', async () => {
    req.headers = { authorization: 'Bearer nested-token' };
    (verifyAccessToken as jest.Mock).mockReturnValue({
      userId: 'super-admin-id', email: 'superadmin@raho.id', role: 'SUPER_ADMIN',
      branchId: null, branchCode: null, fullName: 'Super Admin', staffCode: null,
      impersonating: {
        userId: 'manager-id', email: 'manager@raho.id', role: 'ADMIN_MANAGER',
        impersonating: {
          userId: 'branch-admin-id', email: 'branch@raho.id', role: 'ADMIN_CABANG',
          branchId: 'branch-1',
        },
      },
    } satisfies JwtPayload);

    await authenticate(req as Request, res as Response, next);

    expect(req.user).toMatchObject({
      id: 'branch-admin-id', role: 'ADMIN_CABANG', branchId: 'branch-1',
    });
    expect(req.impersonationChain).toEqual([
      'superadmin@raho.id', 'manager@raho.id', 'branch@raho.id',
    ]);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('maps an expired token to AUTH_TOKEN_EXPIRED', async () => {
    req.headers = { authorization: 'Bearer expired-token' };
    (verifyAccessToken as jest.Mock).mockImplementation(() => {
      throw new TokenExpiredError('expired', new Date());
    });

    await authenticate(req as Request, res as Response, next);

    expect(sendError).toHaveBeenCalledWith(
      res, 401, 'AUTH_TOKEN_EXPIRED', 'Sesi Anda telah berakhir. Silakan login kembali.',
    );
  });

  it('maps malformed tokens to AUTH_TOKEN_INVALID', async () => {
    req.headers = { authorization: 'Bearer invalid-token' };
    (verifyAccessToken as jest.Mock).mockImplementation(() => {
      throw new JsonWebTokenError('invalid');
    });

    await authenticate(req as Request, res as Response, next);

    expect(sendError).toHaveBeenCalledWith(
      res, 401, 'AUTH_TOKEN_INVALID', 'Token tidak valid.',
    );
  });
});
