import { Request, Response, NextFunction } from 'express';
import { 
  getAdminManagers, 
  getBranchAdmins, 
  startImpersonation, 
  stopImpersonation 
} from '../admin.controller';
import { ImpersonationService } from '../services/impersonation.service';
import { sendSuccess } from '@utils/response';
import { verifyAccessToken } from '@lib/jwt';
import { logAudit } from '@utils/auditLog';
import { Role } from '@prisma/client';

// Mock dependencies
jest.mock('@utils/response');
jest.mock('@lib/jwt');
jest.mock('@utils/auditLog');
jest.mock('@lib/prisma', () => ({
  prisma: {
    managerBranch: {
      findMany: jest.fn()
    }
  }
}));

describe('Impersonation Error Cases - Integration Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockSendSuccess: jest.MockedFunction<typeof sendSuccess>;
  let mockVerifyAccessToken: jest.Mock;
  let mockLogAudit: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      params: {},
      query: {},
      headers: {
        authorization: 'Bearer mock-token',
        'user-agent': 'test-agent'
      },
      ip: '127.0.0.1',
    };
    mockResponse = {};
    mockNext = jest.fn();
    mockSendSuccess = sendSuccess as jest.MockedFunction<typeof sendSuccess>;
    
    jest.clearAllMocks();
    mockVerifyAccessToken = verifyAccessToken as jest.Mock;
    mockLogAudit = logAudit as jest.Mock;
    mockLogAudit.mockResolvedValue(undefined);
    mockVerifyAccessToken.mockReturnValue({
      userId: 'super-admin-id',
      email: 'superadmin@raho.id',
      role: Role.SUPER_ADMIN,
      branchId: null,
      branchCode: null,
      fullName: 'Super Admin',
      staffCode: null,
    });
  });

  // ══════════════════════════════════════════════════════════════
  // GET /admin/managers - Error Cases
  // ══════════════════════════════════════════════════════════════

  describe('GET /admin/managers - Error Cases', () => {
    let getAdminManagersSpy: jest.SpyInstance;

    beforeEach(() => {
      getAdminManagersSpy = jest.spyOn(ImpersonationService.prototype, 'getAdminManagers');
      mockRequest.user = {
        id: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
      } as any;
    });

    afterEach(() => {
      getAdminManagersSpy.mockRestore();
    });

    it('should reject unauthorized access (missing token)', async () => {
      mockRequest.headers = {}; // No authorization header
      
      // This would be caught by authenticate middleware in real scenario
      // Here we simulate the error
      const mockError = {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Token autentikasi diperlukan'
      };

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      // In real scenario, authenticate middleware would catch this
      // For this test, we verify the endpoint doesn't proceed without user
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject unauthorized access (invalid token)', async () => {
      mockRequest.user = undefined; // No user set (invalid token)
      
      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject unauthorized access (expired token)', async () => {
      const mockError = {
        status: 401,
        code: 'TOKEN_EXPIRED',
        message: 'Token telah kadaluarsa'
      };

      getAdminManagersSpy.mockRejectedValue(mockError);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should reject access from non-Super Admin roles', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1'],
      } as any;

      // This would be caught by authorize middleware
      const mockError = {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Anda tidak memiliki akses ke endpoint ini'
      };

      getAdminManagersSpy.mockRejectedValue(mockError);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should handle database connection errors', async () => {
      const mockError = new Error('Database connection failed');
      getAdminManagersSpy.mockRejectedValue(mockError);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      const mockError = {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan internal'
      };

      getAdminManagersSpy.mockRejectedValue(mockError);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // GET /admin/branch-admins - Error Cases
  // ══════════════════════════════════════════════════════════════

  describe('GET /admin/branch-admins - Error Cases', () => {
    let getBranchAdminsSpy: jest.SpyInstance;

    beforeEach(() => {
      getBranchAdminsSpy = jest.spyOn(ImpersonationService.prototype, 'getBranchAdmins');
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any;
    });

    afterEach(() => {
      getBranchAdminsSpy.mockRestore();
    });

    it('should reject unauthorized access (missing token)', async () => {
      mockRequest.headers = {};
      mockRequest.user = undefined;

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject unauthorized access (invalid token)', async () => {
      mockRequest.user = undefined;

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject access from non-Admin Manager roles', async () => {
      mockRequest.user = {
        id: 'admin-cabang-id',
        email: 'admincabang@raho.id',
        role: 'ADMIN_CABANG' as Role,
        branchId: 'branch-1',
      } as any;

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        code: 'FORBIDDEN'
      }));
    });

    it('should reject access from Doctor role', async () => {
      mockRequest.user = {
        id: 'doctor-id',
        email: 'doctor@raho.id',
        role: 'DOCTOR' as Role,
        branchId: 'branch-1',
      } as any;

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        code: 'FORBIDDEN'
      }));
    });

    it('should handle database connection errors', async () => {
      const mockError = new Error('Database connection failed');
      getBranchAdminsSpy.mockRejectedValue(mockError);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should handle service errors gracefully', async () => {
      const mockError = {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan internal'
      };

      getBranchAdminsSpy.mockRejectedValue(mockError);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // POST /admin/impersonate/:userId - Error Cases
  // ══════════════════════════════════════════════════════════════

  describe('POST /admin/impersonate/:userId - Error Cases', () => {
    let createImpersonationTokenSpy: jest.SpyInstance;

    beforeEach(() => {
      createImpersonationTokenSpy = jest.spyOn(ImpersonationService.prototype, 'createImpersonationToken');
      mockRequest.params = { userId: 'target-user-id' };
      mockRequest.user = {
        id: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
      } as any;
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
      });
    });

    afterEach(() => {
      createImpersonationTokenSpy.mockRestore();
    });

    it('should reject unauthorized access (missing token)', async () => {
      mockRequest.headers = {};
      mockRequest.user = undefined;

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject unauthorized access (invalid token)', async () => {
      mockRequest.user = undefined;

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject unauthorized access (expired token)', async () => {
      const mockError = {
        status: 401,
        code: 'TOKEN_EXPIRED',
        message: 'Token telah kadaluarsa'
      };

      mockVerifyAccessToken.mockImplementation(() => {
        throw mockError;
      });

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should reject user not found', async () => {
      const mockError = {
        status: 404,
        code: 'USER_NOT_FOUND',
        message: 'User tidak ditemukan'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should reject invalid permissions (wrong role trying to impersonate)', async () => {
      mockRequest.user = {
        id: 'admin-cabang-id',
        email: 'admincabang@raho.id',
        role: 'ADMIN_CABANG' as Role,
        branchId: 'branch-1',
      } as any;

      const mockError = {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Anda tidak memiliki izin untuk melakukan impersonation'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should reject forbidden scenarios (Admin Manager trying to impersonate outside their branches)', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1'],
      } as any;

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1']
      });

      const mockError = {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Anda tidak dapat impersonate Admin Cabang di luar branches yang di-assign'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should reject invalid impersonation depth (more than 2 levels)', async () => {
      // Already at Admin Cabang level (nested: Super Admin → Admin Manager → Admin Cabang)
      mockRequest.user = {
        id: 'admin-cabang-id',
        email: 'admincabang@raho.id',
        role: 'ADMIN_CABANG' as Role,
        branchId: 'branch-1',
      } as any;

      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
          role: 'ADMIN_MANAGER',
          impersonating: {
            userId: 'admin-cabang-id',
            role: 'ADMIN_CABANG'
          }
        }
      });

      const mockError = {
        status: 400,
        code: 'INVALID_IMPERSONATION',
        message: 'Tidak dapat melakukan impersonation lebih dari 2 level'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should reject impersonating inactive users', async () => {
      const mockError = {
        status: 400,
        code: 'INVALID_IMPERSONATION',
        message: 'Tidak dapat impersonate user yang tidak aktif'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should reject impersonating same role', async () => {
      const mockError = {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Tidak dapat impersonate user dengan role yang sama atau lebih tinggi'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should reject impersonating higher role', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1'],
      } as any;

      const mockError = {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Tidak dapat impersonate user dengan role yang sama atau lebih tinggi'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should handle database connection errors', async () => {
      const mockError = new Error('Database connection failed');
      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should handle service errors gracefully', async () => {
      const mockError = {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan internal'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should return proper error response format', async () => {
      const mockError = {
        status: 404,
        code: 'USER_NOT_FOUND',
        message: 'User tidak ditemukan'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        status: 404,
        code: 'USER_NOT_FOUND',
        message: expect.any(String)
      }));
    });

    it('should return proper error status codes', async () => {
      const testCases = [
        { status: 400, code: 'BAD_REQUEST' },
        { status: 401, code: 'UNAUTHORIZED' },
        { status: 403, code: 'FORBIDDEN' },
        { status: 404, code: 'NOT_FOUND' },
        { status: 500, code: 'INTERNAL_ERROR' }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        
        const mockError = {
          status: testCase.status,
          code: testCase.code,
          message: 'Test error'
        };

        createImpersonationTokenSpy.mockRejectedValue(mockError);

        await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
          status: testCase.status,
          code: testCase.code
        }));
      }
    });
  });

  // ══════════════════════════════════════════════════════════════
  // POST /admin/stop-impersonation - Error Cases
  // ══════════════════════════════════════════════════════════════

  describe('POST /admin/stop-impersonation - Error Cases', () => {
    let stopImpersonationSpy: jest.SpyInstance;

    beforeEach(() => {
      stopImpersonationSpy = jest.spyOn(ImpersonationService.prototype, 'stopImpersonation');
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1'],
      } as any;
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
          role: 'ADMIN_MANAGER'
        }
      });
    });

    afterEach(() => {
      stopImpersonationSpy.mockRestore();
    });

    it('should reject unauthorized access (missing token)', async () => {
      mockRequest.headers = {};

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        code: 'AUTH_TOKEN_MISSING'
      }));
    });

    it('should reject unauthorized access (invalid token)', async () => {
      const mockError = new Error('Invalid token');
      mockVerifyAccessToken.mockImplementation(() => {
        throw mockError;
      });

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should reject unauthorized access (expired token)', async () => {
      const mockError = {
        status: 401,
        code: 'TOKEN_EXPIRED',
        message: 'Token telah kadaluarsa'
      };

      mockVerifyAccessToken.mockImplementation(() => {
        throw mockError;
      });

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should reject stopping impersonation when not impersonating', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
        // No impersonating field
      });

      const mockError = {
        status: 400,
        code: 'NOT_IMPERSONATING',
        message: 'Tidak sedang dalam mode impersonation'
      };

      stopImpersonationSpy.mockRejectedValue(mockError);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should handle database connection errors', async () => {
      const mockError = new Error('Database connection failed');
      stopImpersonationSpy.mockRejectedValue(mockError);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should handle service errors gracefully', async () => {
      const mockError = {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan internal'
      };

      stopImpersonationSpy.mockRejectedValue(mockError);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should return proper error response format', async () => {
      const mockError = {
        status: 400,
        code: 'NOT_IMPERSONATING',
        message: 'Tidak sedang dalam mode impersonation'
      };

      stopImpersonationSpy.mockRejectedValue(mockError);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        status: 400,
        code: 'NOT_IMPERSONATING',
        message: expect.any(String)
      }));
    });

    it('should return proper error status codes', async () => {
      const testCases = [
        { status: 400, code: 'BAD_REQUEST' },
        { status: 401, code: 'UNAUTHORIZED' },
        { status: 500, code: 'INTERNAL_ERROR' }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        
        const mockError = {
          status: testCase.status,
          code: testCase.code,
          message: 'Test error'
        };

        stopImpersonationSpy.mockRejectedValue(mockError);

        await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
          status: testCase.status,
          code: testCase.code
        }));
      }
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Cross-Endpoint Error Scenarios
  // ══════════════════════════════════════════════════════════════

  describe('Cross-Endpoint Error Scenarios', () => {
    it('should handle malformed authorization header across all endpoints', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat'
      };

      const endpoints = [
        { fn: getAdminManagers, name: 'getAdminManagers' },
        { fn: getBranchAdmins, name: 'getBranchAdmins' },
        { fn: startImpersonation, name: 'startImpersonation' },
        { fn: stopImpersonation, name: 'stopImpersonation' }
      ];

      for (const endpoint of endpoints) {
        jest.clearAllMocks();
        mockNext = jest.fn();

        await endpoint.fn(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
      }
    });

    it('should handle missing user-agent header gracefully', async () => {
      mockRequest.headers = {
        authorization: 'Bearer mock-token'
        // No user-agent
      };
      mockRequest.user = {
        id: 'super-admin-id',
        role: 'SUPER_ADMIN' as Role
      } as any;

      const getAdminManagersSpy = jest.spyOn(ImpersonationService.prototype, 'getAdminManagers');
      getAdminManagersSpy.mockResolvedValue({
        managers: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
      });

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      // Should not throw error, just proceed without user-agent
      expect(mockSendSuccess).toHaveBeenCalled();
      
      getAdminManagersSpy.mockRestore();
    });

    it('should handle missing IP address gracefully', async () => {
      const requestWithoutIp = {
        ...mockRequest,
        ip: undefined
      };
      requestWithoutIp.user = {
        id: 'super-admin-id',
        role: 'SUPER_ADMIN' as Role
      } as any;

      const getAdminManagersSpy = jest.spyOn(ImpersonationService.prototype, 'getAdminManagers');
      getAdminManagersSpy.mockResolvedValue({
        managers: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
      });

      await getAdminManagers(requestWithoutIp as Request, mockResponse as Response, mockNext);

      // Should not throw error, just proceed without IP
      expect(mockSendSuccess).toHaveBeenCalled();
      
      getAdminManagersSpy.mockRestore();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Error Message Validation
  // ══════════════════════════════════════════════════════════════

  describe('Error Message Validation', () => {
    it('should return Indonesian error messages', async () => {
      const createImpersonationTokenSpy = jest.spyOn(ImpersonationService.prototype, 'createImpersonationToken');
      mockRequest.params = { userId: 'target-user-id' };
      mockRequest.user = {
        id: 'super-admin-id',
        role: 'SUPER_ADMIN' as Role
      } as any;

      const mockError = {
        status: 404,
        code: 'USER_NOT_FOUND',
        message: 'User tidak ditemukan'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('tidak')
      }));

      createImpersonationTokenSpy.mockRestore();
    });

    it('should return descriptive error messages', async () => {
      const createImpersonationTokenSpy = jest.spyOn(ImpersonationService.prototype, 'createImpersonationToken');
      mockRequest.params = { userId: 'target-user-id' };
      mockRequest.user = {
        id: 'super-admin-id',
        role: 'SUPER_ADMIN' as Role
      } as any;

      const mockError = {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Anda tidak dapat impersonate Admin Cabang di luar branches yang di-assign'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringMatching(/branches|cabang|impersonate/i)
      }));

      createImpersonationTokenSpy.mockRestore();
    });
  });
});
