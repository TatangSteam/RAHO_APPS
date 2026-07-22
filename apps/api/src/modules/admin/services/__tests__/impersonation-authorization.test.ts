import type { NextFunction, Request, Response } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { verifyAccessToken } from '@lib/jwt';
import { prisma } from '@lib/prisma';
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
  prisma: {
    user: { findUnique: jest.fn() },
    branch: { findMany: jest.fn() },
  },
}));
jest.mock('@lib/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const manager = {
  id: 'manager-id', email: 'manager@raho.id', role: 'ADMIN_MANAGER',
  branchId: null, roleTemplateId: 'manager-role', staffCode: null,
  isActive: true, adminManagerAccessScope: 'FULL',
  profile: { fullName: 'Manager Aktif' }, branch: null,
};
const branchAdmin = {
  id: 'branch-admin-id', email: 'branch@raho.id', role: 'ADMIN_CABANG',
  branchId: 'branch-1', roleTemplateId: 'branch-role', staffCode: 'CAB001',
  isActive: true, adminManagerAccessScope: null,
  profile: { fullName: 'Admin Cabang Aktif' }, branch: { branchCode: 'B001' },
};

describe('authorization checks with impersonation', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: { authorization: 'Bearer mock-token' },
      method: 'GET',
      baseUrl: '',
      path: '/dashboard',
      query: {},
      params: {},
      body: {},
    };
    res = {};
    next = jest.fn();
    (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => (
      where.id === manager.id ? manager : where.id === branchAdmin.id ? branchAdmin : null
    ));
    (prisma.branch.findMany as jest.Mock).mockResolvedValue([]);
    (getEffectivePermissionCodes as jest.Mock).mockResolvedValue(['dashboard.read']);
    (getAccessibleBranchIds as jest.Mock).mockImplementation(async (userId: string) => (
      userId === manager.id ? ['branch-1', 'branch-2'] : ['branch-1']
    ));
  });

  it('authorizes the impersonated manager role, not the original super admin role', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({
      userId: 'super-admin-id', email: 'superadmin@raho.id', role: 'SUPER_ADMIN',
      branchId: null, fullName: 'Super Admin',
      impersonating: {
        userId: manager.id, email: manager.email, role: manager.role,
      },
    });

    await authenticate(req as Request, res as Response, next);
    await authorize(['ADMIN_MANAGER'])(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(req.user).toMatchObject({
      role: 'ADMIN_MANAGER', branches: ['branch-1', 'branch-2'],
    });

    jest.clearAllMocks();
    await authorize(['SUPER_ADMIN'])(req as Request, res as Response, next);
    expect(sendError).toHaveBeenCalledWith(
      res, 403, 'AUTH_FORBIDDEN', 'Anda tidak memiliki izin untuk melakukan aksi ini.',
    );
  });

  it('authorizes the deepest nested impersonation role', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({
      userId: 'super-admin-id', email: 'superadmin@raho.id', role: 'SUPER_ADMIN',
      branchId: null, fullName: 'Super Admin',
      impersonating: {
        userId: manager.id, email: manager.email, role: manager.role,
        impersonating: {
          userId: branchAdmin.id, email: branchAdmin.email, role: branchAdmin.role,
          branchId: branchAdmin.branchId,
        },
      },
    });

    await authenticate(req as Request, res as Response, next);
    await authorize(['ADMIN_CABANG'])(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(req.user).toMatchObject({ role: 'ADMIN_CABANG', branchId: 'branch-1' });
    expect(req.impersonationChain).toEqual([
      'superadmin@raho.id', 'manager@raho.id', 'branch@raho.id',
    ]);
  });

  it('rejects inactive impersonation targets before authorization', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({
      userId: 'super-admin-id', email: 'superadmin@raho.id', role: 'SUPER_ADMIN',
      branchId: null, fullName: 'Super Admin',
      impersonating: {
        userId: 'inactive-user', email: 'inactive@raho.id', role: 'ADMIN_MANAGER',
      },
    });

    await authenticate(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(sendError).toHaveBeenCalledWith(
      res, 401, 'AUTH_USER_INACTIVE', 'Akun tidak aktif atau tidak ditemukan.',
    );
  });
});
