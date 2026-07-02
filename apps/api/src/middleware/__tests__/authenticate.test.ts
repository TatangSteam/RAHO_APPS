import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../authenticate';
import { JwtPayload } from '@lib/jwt';
import { sendError } from '@utils/response';
import { prisma } from '@lib/prisma';

// Mock dependencies
jest.mock('@lib/jwt');
jest.mock('@utils/response');
jest.mock('@lib/prisma', () => ({
  prisma: {
    staffBranch: {
      findMany: jest.fn(),
    },
  },
}));
jest.mock('@lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('authenticate middleware - Token Validation', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      method: 'GET',
      path: '/test',
    };
    mockResponse = {};
    mockNext = jest.fn();
    jest.clearAllMocks();
    (prisma.staffBranch.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe('Normal Authentication (No Impersonation)', () => {
    it('should authenticate a normal user without impersonation', async () => {
      const payload: JwtPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'ADMIN_CABANG',
        branchId: 'branch-1',
        branchCode: 'JKT',
        fullName: 'John Doe',
        staffCode: 'STAFF001',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      (require('@lib/jwt').verifyAccessToken as jest.Mock).mockReturnValue(payload);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toEqual({
        ...payload,
        id: payload.userId,
        branches: ['branch-1'],
      });
      expect(mockRequest.isImpersonating).toBe(false);
      expect(mockRequest.originalUser).toBeUndefined();
      expect(mockRequest.impersonationChain).toBeUndefined();
    });
  });

  describe('Single Level Impersonation - Super Admin → Admin Manager', () => {
    it('should correctly extract impersonation data for Admin Manager', async () => {
      const payload: JwtPayload = {
        userId: 'super-admin-123',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-456',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branchId: null,
          branches: ['branch-1', 'branch-2', 'branch-3'],
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer impersonation-token',
      };

      (require('@lib/jwt').verifyAccessToken as jest.Mock).mockReturnValue(payload);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      
      // Original user should be Super Admin
      expect(mockRequest.originalUser).toEqual({
        id: 'super-admin-123',
        userId: 'super-admin-123',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        fullName: 'Super Admin',
      });

      // Current user should be Admin Manager
      expect(mockRequest.user).toEqual({
        id: 'manager-456',
        userId: 'manager-456',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        branches: ['branch-1', 'branch-2', 'branch-3'],
      });

      expect(mockRequest.isImpersonating).toBe(true);
      expect(mockRequest.impersonationChain).toEqual([
        'superadmin@raho.id',
        'manager@raho.id',
      ]);
    });
  });

  describe('Single Level Impersonation - Admin Manager → Admin Cabang', () => {
    it('should correctly extract impersonation data for Admin Cabang', async () => {
      const payload: JwtPayload = {
        userId: 'manager-456',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER',
        branchId: null,
        branchCode: null,
        fullName: 'Manager Name',
        staffCode: null,
        impersonating: {
          userId: 'admin-cabang-789',
          email: 'admincabang@raho.id',
          role: 'ADMIN_CABANG',
          branchId: 'branch-1',
          branches: undefined,
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer impersonation-token',
      };

      (require('@lib/jwt').verifyAccessToken as jest.Mock).mockReturnValue(payload);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      
      // Original user should be Admin Manager
      expect(mockRequest.originalUser).toEqual({
        id: 'manager-456',
        userId: 'manager-456',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER',
        branchId: null,
        fullName: 'Manager Name',
      });

      // Current user should be Admin Cabang
      expect(mockRequest.user).toEqual({
        id: 'admin-cabang-789',
        userId: 'admin-cabang-789',
        email: 'admincabang@raho.id',
        role: 'ADMIN_CABANG',
        branchId: 'branch-1',
        branchCode: null,
        fullName: 'Manager Name',
        staffCode: null,
        branches: ['branch-1'],
      });

      expect(mockRequest.isImpersonating).toBe(true);
      expect(mockRequest.impersonationChain).toEqual([
        'manager@raho.id',
        'admincabang@raho.id',
      ]);
    });
  });

  describe('Nested Impersonation - Super Admin → Admin Manager → Admin Cabang', () => {
    it('should correctly extract deepest impersonation level', async () => {
      const payload: JwtPayload = {
        userId: 'super-admin-123',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-456',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branchId: null,
          branches: ['branch-1', 'branch-2'],
          impersonating: {
            userId: 'admin-cabang-789',
            email: 'admincabang@raho.id',
            role: 'ADMIN_CABANG',
            branchId: 'branch-1',
          },
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer nested-impersonation-token',
      };

      (require('@lib/jwt').verifyAccessToken as jest.Mock).mockReturnValue(payload);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      
      // Original user should be Super Admin (root of chain)
      expect(mockRequest.originalUser).toEqual({
        id: 'super-admin-123',
        userId: 'super-admin-123',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        fullName: 'Super Admin',
      });

      // Current user should be Admin Cabang (deepest level)
      expect(mockRequest.user).toEqual({
        id: 'admin-cabang-789',
        userId: 'admin-cabang-789',
        email: 'admincabang@raho.id',
        role: 'ADMIN_CABANG',
        branchId: 'branch-1',
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        branches: ['branch-1'],
      });

      expect(mockRequest.isImpersonating).toBe(true);
      expect(mockRequest.impersonationChain).toEqual([
        'superadmin@raho.id',
        'manager@raho.id',
        'admincabang@raho.id',
      ]);
    });

    it('should handle nested impersonation with multiple branches', async () => {
      const payload: JwtPayload = {
        userId: 'super-admin-123',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-456',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branchId: null,
          branches: ['branch-1', 'branch-2', 'branch-3', 'branch-4'],
          impersonating: {
            userId: 'admin-cabang-999',
            email: 'admincabang.bandung@raho.id',
            role: 'ADMIN_CABANG',
            branchId: 'branch-3',
          },
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer nested-token',
      };

      (require('@lib/jwt').verifyAccessToken as jest.Mock).mockReturnValue(payload);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user?.branchId).toBe('branch-3');
      expect(mockRequest.user?.role).toBe('ADMIN_CABANG');
      expect(mockRequest.originalUser?.role).toBe('SUPER_ADMIN');
      expect(mockRequest.impersonationChain).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    it('should return 401 when authorization header is missing', async () => {
      mockRequest.headers = {};

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sendError).toHaveBeenCalledWith(
        mockResponse,
        401,
        'AUTH_TOKEN_MISSING',
        'Token autentikasi diperlukan.'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not start with Bearer', async () => {
      mockRequest.headers = {
        authorization: 'Basic some-token',
      };

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sendError).toHaveBeenCalledWith(
        mockResponse,
        401,
        'AUTH_TOKEN_MISSING',
        'Token autentikasi diperlukan.'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired', async () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-token',
      };

      // Import the actual TokenExpiredError class from jsonwebtoken
      const { TokenExpiredError } = require('jsonwebtoken');
      const expiredError = new TokenExpiredError('jwt expired', new Date());
      
      (require('@lib/jwt').verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw expiredError;
      });

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sendError).toHaveBeenCalledWith(
        mockResponse,
        401,
        'AUTH_TOKEN_EXPIRED',
        'Sesi Anda telah berakhir. Silakan login kembali.'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      // Import the actual JsonWebTokenError class from jsonwebtoken
      const { JsonWebTokenError } = require('jsonwebtoken');
      const invalidError = new JsonWebTokenError('invalid token');
      
      (require('@lib/jwt').verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw invalidError;
      });

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sendError).toHaveBeenCalledWith(
        mockResponse,
        401,
        'AUTH_TOKEN_INVALID',
        'Token tidak valid.'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for generic token errors', async () => {
      mockRequest.headers = {
        authorization: 'Bearer malformed-token',
      };

      (require('@lib/jwt').verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Some other error');
      });

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sendError).toHaveBeenCalledWith(
        mockResponse,
        401,
        'AUTH_TOKEN_INVALID',
        'Token tidak valid.'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle Admin Manager with empty branches array', async () => {
      const payload: JwtPayload = {
        userId: 'super-admin-123',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-456',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branchId: null,
          branches: [], // Empty branches
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer token',
      };

      (require('@lib/jwt').verifyAccessToken as jest.Mock).mockReturnValue(payload);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user?.branches).toEqual([]);
    });

    it('should handle Admin Cabang with null branchId', async () => {
      const payload: JwtPayload = {
        userId: 'manager-456',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER',
        branchId: null,
        branchCode: null,
        fullName: 'Manager Name',
        staffCode: null,
        impersonating: {
          userId: 'admin-cabang-789',
          email: 'admincabang@raho.id',
          role: 'ADMIN_CABANG',
          branchId: null, // Null branchId
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer token',
      };

      (require('@lib/jwt').verifyAccessToken as jest.Mock).mockReturnValue(payload);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user?.branchId).toBeNull();
    });

    it('should preserve fullName from original user in impersonation', async () => {
      const payload: JwtPayload = {
        userId: 'super-admin-123',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin Full Name',
        staffCode: null,
        impersonating: {
          userId: 'manager-456',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branchId: null,
          branches: ['branch-1'],
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer token',
      };

      (require('@lib/jwt').verifyAccessToken as jest.Mock).mockReturnValue(payload);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user?.fullName).toBe('Super Admin Full Name');
    });
  });

  describe('Authorization Context', () => {
    it('should set req.user to impersonated user for authorization checks', async () => {
      const payload: JwtPayload = {
        userId: 'super-admin-123',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-456',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branchId: null,
          branches: ['branch-1', 'branch-2'],
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer token',
      };

      (require('@lib/jwt').verifyAccessToken as jest.Mock).mockReturnValue(payload);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify that req.user contains the impersonated user's data
      // This is CRITICAL for authorization checks
      expect(mockRequest.user?.id).toBe('manager-456');
      expect(mockRequest.user?.role).toBe('ADMIN_MANAGER');
      expect(mockRequest.user?.branches).toEqual(['branch-1', 'branch-2']);
      
      // Original user should be preserved for audit logging
      expect(mockRequest.originalUser?.id).toBe('super-admin-123');
      expect(mockRequest.originalUser?.role).toBe('SUPER_ADMIN');
    });

    it('should allow data filtering based on impersonated user branches', async () => {
      const payload: JwtPayload = {
        userId: 'super-admin-123',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-456',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branchId: null,
          branches: ['branch-1', 'branch-2'],
          impersonating: {
            userId: 'admin-cabang-789',
            email: 'admincabang@raho.id',
            role: 'ADMIN_CABANG',
            branchId: 'branch-1',
          },
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer token',
      };

      (require('@lib/jwt').verifyAccessToken as jest.Mock).mockReturnValue(payload);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // In nested impersonation, req.user should be the deepest level
      // This ensures data filtering works correctly
      expect(mockRequest.user?.branchId).toBe('branch-1');
      expect(mockRequest.user?.role).toBe('ADMIN_CABANG');
      
      // This simulates how data filtering should work:
      // const branchFilter = req.user.role === 'ADMIN_MANAGER' 
      //   ? req.user.branches 
      //   : [req.user.branchId];
      const branchFilter = mockRequest.user?.role === 'ADMIN_MANAGER'
        ? mockRequest.user?.branches
        : [mockRequest.user?.branchId];
      
      expect(branchFilter).toEqual(['branch-1']);
    });
  });
});

