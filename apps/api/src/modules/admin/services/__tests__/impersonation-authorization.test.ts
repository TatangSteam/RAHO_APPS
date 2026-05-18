import { Request, Response, NextFunction } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { Role } from '@prisma/client';
import { verifyAccessToken } from '@lib/jwt';
import { sendError } from '@utils/response';

// Mock dependencies
jest.mock('@lib/jwt');
jest.mock('@utils/response');

describe('Authorization Checks with Impersonation', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockVerifyAccessToken: jest.MockedFunction<typeof verifyAccessToken>;
  let mockSendError: jest.MockedFunction<typeof sendError>;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      method: 'GET',
      path: '/test',
    };
    mockResponse = {};
    mockNext = jest.fn();
    mockVerifyAccessToken = verifyAccessToken as jest.MockedFunction<typeof verifyAccessToken>;
    mockSendError = sendError as jest.MockedFunction<typeof sendError>;
    jest.clearAllMocks();
  });

  describe('Super Admin → Admin Manager Impersonation', () => {
    const superAdminToken = {
      userId: 'super-admin-id',
      email: 'superadmin@raho.id',
      role: 'SUPER_ADMIN' as Role,
      branchId: null,
      branchCode: null,
      fullName: 'Super Admin',
      staffCode: null,
      impersonating: {
        userId: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      },
    };

    it('should use impersonated user role for authorization checks', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(superAdminToken);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user?.role).toBe('ADMIN_MANAGER');
      expect(mockRequest.originalUser?.role).toBe('SUPER_ADMIN');
      expect(mockRequest.isImpersonating).toBe(true);
    });

    it('should allow access to Admin Manager endpoints when impersonating', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(superAdminToken);

      // First authenticate
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Then authorize for Admin Manager role
      const authorizeMiddleware = authorize(['ADMIN_MANAGER' as Role]);
      authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2); // Once for authenticate, once for authorize
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should deny access to Super Admin only endpoints when impersonating', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(superAdminToken);

      // First authenticate
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Then try to authorize for Super Admin only
      const authorizeMiddleware = authorize(['SUPER_ADMIN' as Role]);
      authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        403,
        'AUTH_FORBIDDEN',
        'Anda tidak memiliki izin untuk melakukan aksi ini.'
      );
    });

    it('should use impersonated user branches for data filtering', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(superAdminToken);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user?.branches).toEqual(['branch-1', 'branch-2']);
      expect(mockRequest.user?.branchId).toBeNull();
    });

    it('should set correct impersonation chain', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(superAdminToken);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.impersonationChain).toEqual([
        'superadmin@raho.id',
        'manager@raho.id',
      ]);
    });
  });

  describe('Admin Manager → Admin Cabang Impersonation', () => {
    const adminManagerToken = {
      userId: 'manager-id',
      email: 'manager@raho.id',
      role: 'ADMIN_MANAGER' as Role,
      branchId: null,
      branchCode: null,
      fullName: 'Admin Manager',
      staffCode: null,
      impersonating: {
        userId: 'admin-cabang-id',
        email: 'admincabang@raho.id',
        role: 'ADMIN_CABANG' as Role,
        branchId: 'branch-1',
      },
    };

    it('should use impersonated user role for authorization checks', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(adminManagerToken);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user?.role).toBe('ADMIN_CABANG');
      expect(mockRequest.originalUser?.role).toBe('ADMIN_MANAGER');
      expect(mockRequest.isImpersonating).toBe(true);
    });

    it('should allow access to Admin Cabang endpoints when impersonating', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(adminManagerToken);

      // First authenticate
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Then authorize for Admin Cabang role
      const authorizeMiddleware = authorize(['ADMIN_CABANG' as Role]);
      authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should deny access to Admin Manager only endpoints when impersonating', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(adminManagerToken);

      // First authenticate
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Then try to authorize for Admin Manager only
      const authorizeMiddleware = authorize(['ADMIN_MANAGER' as Role]);
      authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        403,
        'AUTH_FORBIDDEN',
        'Anda tidak memiliki izin untuk melakukan aksi ini.'
      );
    });

    it('should use impersonated user single branch for data filtering', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(adminManagerToken);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user?.branchId).toBe('branch-1');
      expect(mockRequest.user?.branches).toBeUndefined();
    });

    it('should set correct impersonation chain', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(adminManagerToken);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.impersonationChain).toEqual([
        'manager@raho.id',
        'admincabang@raho.id',
      ]);
    });
  });

  describe('Nested Impersonation (Super Admin → Admin Manager → Admin Cabang)', () => {
    const nestedToken = {
      userId: 'super-admin-id',
      email: 'superadmin@raho.id',
      role: 'SUPER_ADMIN' as Role,
      branchId: null,
      branchCode: null,
      fullName: 'Super Admin',
      staffCode: null,
      impersonating: {
        userId: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
        impersonating: {
          userId: 'admin-cabang-id',
          email: 'admincabang@raho.id',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1',
        },
      },
    };

    it('should use deepest impersonated user role for authorization checks', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(nestedToken);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user?.role).toBe('ADMIN_CABANG');
      expect(mockRequest.originalUser?.role).toBe('SUPER_ADMIN');
      expect(mockRequest.isImpersonating).toBe(true);
    });

    it('should allow access to Admin Cabang endpoints only', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(nestedToken);

      // First authenticate
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Should allow Admin Cabang access
      const authorizeCabang = authorize(['ADMIN_CABANG' as Role]);
      authorizeCabang(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should deny access to Admin Manager endpoints', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(nestedToken);

      // First authenticate
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Should deny Admin Manager access
      const authorizeManager = authorize(['ADMIN_MANAGER' as Role]);
      authorizeManager(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        403,
        'AUTH_FORBIDDEN',
        'Anda tidak memiliki izin untuk melakukan aksi ini.'
      );
    });

    it('should deny access to Super Admin endpoints', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(nestedToken);

      // First authenticate
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Should deny Super Admin access
      const authorizeSuperAdmin = authorize(['SUPER_ADMIN' as Role]);
      authorizeSuperAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        403,
        'AUTH_FORBIDDEN',
        'Anda tidak memiliki izin untuk melakukan aksi ini.'
      );
    });

    it('should use deepest impersonated user branch for data filtering', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(nestedToken);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user?.branchId).toBe('branch-1');
      expect(mockRequest.user?.branches).toBeUndefined();
    });

    it('should set correct full impersonation chain', () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(nestedToken);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.impersonationChain).toEqual([
        'superadmin@raho.id',
        'manager@raho.id',
        'admincabang@raho.id',
      ]);
    });
  });

  describe('Permission Validation Edge Cases', () => {
    it('should not allow Super Admin to bypass permissions when impersonating', () => {
      const token = {
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'admin-cabang-id',
          email: 'admincabang@raho.id',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1',
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(token);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Super Admin impersonating Admin Cabang should NOT have Super Admin permissions
      const authorizeSuperAdmin = authorize(['SUPER_ADMIN' as Role]);
      authorizeSuperAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        403,
        'AUTH_FORBIDDEN',
        'Anda tidak memiliki izin untuk melakukan aksi ini.'
      );
    });

    it('should allow access to endpoints that accept multiple roles including impersonated role', () => {
      const token = {
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1'],
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(token);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Endpoint that allows both Super Admin and Admin Manager
      const authorizeMultiple = authorize(['SUPER_ADMIN' as Role, 'ADMIN_MANAGER' as Role]);
      authorizeMultiple(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should correctly identify user as impersonating', () => {
      const token = {
        userId: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Admin Manager',
        staffCode: null,
        impersonating: {
          userId: 'admin-cabang-id',
          email: 'admincabang@raho.id',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1',
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(token);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.isImpersonating).toBe(true);
      expect(mockRequest.originalUser).toBeDefined();
      expect(mockRequest.originalUser?.id).toBe('manager-id');
      expect(mockRequest.user?.id).toBe('admin-cabang-id');
    });

    it('should correctly identify user as NOT impersonating', () => {
      const token = {
        userId: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Admin Manager',
        staffCode: null,
      };

      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(token);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.isImpersonating).toBe(false);
      expect(mockRequest.originalUser).toBeUndefined();
      expect(mockRequest.user?.id).toBe('manager-id');
    });
  });

  describe('Data Access Equality Tests', () => {
    it('should ensure impersonated Admin Manager sees only assigned branches', () => {
      const token = {
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1', 'branch-2'],
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(token);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify that req.user has the correct branches
      expect(mockRequest.user?.branches).toEqual(['branch-1', 'branch-2']);
      
      // Verify that original user info is preserved but not used for authorization
      expect(mockRequest.originalUser?.role).toBe('SUPER_ADMIN');
      
      // The key point: req.user should be used for all data filtering
      expect(mockRequest.user?.role).toBe('ADMIN_MANAGER');
    });

    it('should ensure impersonated Admin Cabang sees only single branch', () => {
      const token = {
        userId: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Admin Manager',
        staffCode: null,
        impersonating: {
          userId: 'admin-cabang-id',
          email: 'admincabang@raho.id',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1',
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(token);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify that req.user has the correct single branch
      expect(mockRequest.user?.branchId).toBe('branch-1');
      expect(mockRequest.user?.branches).toBeUndefined();
      
      // Verify that original user info is preserved but not used for authorization
      expect(mockRequest.originalUser?.role).toBe('ADMIN_MANAGER');
      
      // The key point: req.user should be used for all data filtering
      expect(mockRequest.user?.role).toBe('ADMIN_CABANG');
    });

    it('should ensure nested impersonation uses deepest level for data access', () => {
      const token = {
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1', 'branch-2', 'branch-3'],
          impersonating: {
            userId: 'admin-cabang-id',
            email: 'admincabang@raho.id',
            role: 'ADMIN_CABANG' as Role,
            branchId: 'branch-1',
          },
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(token);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      // Should use deepest level (Admin Cabang) for data access
      expect(mockRequest.user?.branchId).toBe('branch-1');
      expect(mockRequest.user?.branches).toBeUndefined();
      expect(mockRequest.user?.role).toBe('ADMIN_CABANG');
      
      // Original user should be the root (Super Admin)
      expect(mockRequest.originalUser?.role).toBe('SUPER_ADMIN');
      
      // Should NOT have access to all branches from Admin Manager level
      // Only the single branch from Admin Cabang level
    });
  });

  describe('Authorization Middleware Integration', () => {
    it('should work correctly with authorize middleware for impersonated users', () => {
      const token = {
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1'],
        },
      };

      mockRequest.headers = {
        authorization: 'Bearer mock-token',
      };
      mockVerifyAccessToken.mockReturnValue(token);

      // Simulate middleware chain
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Test various authorization scenarios
      const scenarios = [
        { roles: ['ADMIN_MANAGER' as Role], shouldPass: true },
        { roles: ['SUPER_ADMIN' as Role], shouldPass: false },
        { roles: ['ADMIN_CABANG' as Role], shouldPass: false },
        { roles: ['SUPER_ADMIN' as Role, 'ADMIN_MANAGER' as Role], shouldPass: true },
      ];

      scenarios.forEach((scenario, index) => {
        jest.clearAllMocks();
        const authorizeMiddleware = authorize(scenario.roles);
        authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        if (scenario.shouldPass) {
          expect(mockNext).toHaveBeenCalled();
          expect(mockSendError).not.toHaveBeenCalled();
        } else {
          expect(mockSendError).toHaveBeenCalledWith(
            mockResponse,
            403,
            'AUTH_FORBIDDEN',
            'Anda tidak memiliki izin untuk melakukan aksi ini.'
          );
        }
      });
    });
  });
});
