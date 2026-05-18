import { Request, Response, NextFunction } from 'express';
import { stopImpersonation } from '../admin.controller';
import { ImpersonationService } from '../services/impersonation.service';
import { sendSuccess } from '@utils/response';
import { Role, AuditAction } from '@prisma/client';

// Mock dependencies
jest.mock('@utils/response');
jest.mock('@lib/jwt');
jest.mock('@utils/auditLog');

describe('POST /admin/stop-impersonation - Integration Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockSendSuccess: jest.MockedFunction<typeof sendSuccess>;
  let stopImpersonationSpy: jest.SpyInstance;
  let mockVerifyAccessToken: jest.Mock;
  let mockLogAudit: jest.Mock;

  beforeEach(async () => {
    mockRequest = {
      headers: {
        authorization: 'Bearer mock-token',
        'user-agent': 'test-agent'
      },
      ip: '127.0.0.1',
      user: {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any,
    };
    mockResponse = {};
    mockNext = jest.fn();
    mockSendSuccess = sendSuccess as jest.MockedFunction<typeof sendSuccess>;
    
    // Spy on the service method
    stopImpersonationSpy = jest.spyOn(ImpersonationService.prototype, 'stopImpersonation');
    
    // Mock JWT verification
    const jwtModule = await import('@lib/jwt');
    mockVerifyAccessToken = jest.fn();
    (jwtModule.verifyAccessToken as any) = mockVerifyAccessToken;
    
    // Mock audit log
    const auditModule = await import('@utils/auditLog');
    mockLogAudit = jest.fn().mockResolvedValue(undefined);
    (auditModule.logAudit as any) = mockLogAudit;
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    stopImpersonationSpy.mockRestore();
  });

  describe('Single-Level Impersonation Stop', () => {
    it('should stop Super Admin → Admin Manager impersonation and return to Super Admin', async () => {
      // Current token shows Super Admin impersonating Admin Manager
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1', 'branch-2']
        }
      });

      const mockResult = {
        token: 'new-token-super-admin',
        user: {
          id: 'super-admin-id',
          email: 'superadmin@raho.id',
          fullName: 'Super Admin',
          role: 'SUPER_ADMIN' as Role,
          branchId: null,
          branchCode: null
        }
      };

      stopImpersonationSpy.mockResolvedValue(mockResult);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockVerifyAccessToken).toHaveBeenCalledWith('mock-token');
      expect(stopImpersonationSpy).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'super-admin-id',
        impersonating: expect.objectContaining({
          userId: 'manager-id',
          role: 'ADMIN_MANAGER'
        })
      }));
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'super-admin-id',
        action: AuditAction.LOGOUT,
        resource: 'Impersonation',
        resourceId: 'manager-id',
        meta: expect.objectContaining({
          type: 'IMPERSONATE_STOP',
          impersonatedUser: 'manager@raho.id',
          impersonatedRole: 'ADMIN_MANAGER'
        })
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should stop Admin Manager → Admin Cabang impersonation and return to Admin Manager', async () => {
      mockRequest.user = {
        id: 'admin-cabang-id',
        email: 'admincabang@raho.id',
        role: 'ADMIN_CABANG' as Role,
        branchId: 'branch-1',
      } as any;

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER',
        branchId: null,
        branchCode: null,
        fullName: 'Manager Name',
        staffCode: null,
        impersonating: {
          userId: 'admin-cabang-id',
          email: 'admincabang@raho.id',
          role: 'ADMIN_CABANG',
          branchId: 'branch-1'
        }
      });

      const mockResult = {
        token: 'new-token-manager',
        user: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager Name',
          role: 'ADMIN_MANAGER' as Role,
          branchId: null,
          branchCode: null,
          branches: [
            { id: 'branch-1', name: 'Branch 1', branchCode: 'B001' },
            { id: 'branch-2', name: 'Branch 2', branchCode: 'B002' }
          ]
        }
      };

      stopImpersonationSpy.mockResolvedValue(mockResult);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(stopImpersonationSpy).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'manager-id',
        impersonating: expect.objectContaining({
          userId: 'admin-cabang-id',
          role: 'ADMIN_CABANG'
        })
      }));
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        meta: expect.objectContaining({
          type: 'IMPERSONATE_STOP',
          impersonatedUser: 'admincabang@raho.id',
          impersonatedRole: 'ADMIN_CABANG'
        })
      }));
    });
  });

  describe('Nested Impersonation Stop', () => {
    it('should stop nested impersonation (Admin Cabang → Admin Manager) and return to Admin Manager, not Super Admin', async () => {
      mockRequest.user = {
        id: 'admin-cabang-id',
        email: 'admincabang@raho.id',
        role: 'ADMIN_CABANG' as Role,
        branchId: 'branch-1',
      } as any;

      // Current token shows Super Admin → Admin Manager → Admin Cabang
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1', 'branch-2'],
          impersonating: {
            userId: 'admin-cabang-id',
            email: 'admincabang@raho.id',
            role: 'ADMIN_CABANG',
            branchId: 'branch-1'
          }
        }
      });

      const mockResult = {
        token: 'new-token-back-to-manager',
        user: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager Name',
          role: 'ADMIN_MANAGER' as Role,
          branchId: null,
          branchCode: null,
          branches: [
            { id: 'branch-1', name: 'Branch 1', branchCode: 'B001' },
            { id: 'branch-2', name: 'Branch 2', branchCode: 'B002' }
          ]
        }
      };

      stopImpersonationSpy.mockResolvedValue(mockResult);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(stopImpersonationSpy).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'super-admin-id',
        impersonating: expect.objectContaining({
          userId: 'manager-id',
          role: 'ADMIN_MANAGER',
          impersonating: expect.objectContaining({
            userId: 'admin-cabang-id',
            role: 'ADMIN_CABANG'
          })
        })
      }));
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      // Should return to Admin Manager, not Super Admin
      expect(mockResult.user.id).toBe('manager-id');
      expect(mockResult.user.role).toBe('ADMIN_MANAGER');
    });

    it('should track nested impersonation stop in audit log', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1'],
          impersonating: {
            userId: 'admin-cabang-id',
            email: 'admincabang@raho.id',
            role: 'ADMIN_CABANG',
            branchId: 'branch-1'
          }
        }
      });

      const mockResult = {
        token: 'token',
        user: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager',
          role: 'ADMIN_MANAGER' as Role,
          branchId: null,
          branchCode: null,
          branches: []
        }
      };

      stopImpersonationSpy.mockResolvedValue(mockResult);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'super-admin-id',
        action: AuditAction.LOGOUT,
        resource: 'Impersonation',
        meta: expect.objectContaining({
          type: 'IMPERSONATE_STOP'
        })
      }));
    });
  });

  describe('Authentication Requirements', () => {
    it('should reject request without authorization token', async () => {
      mockRequest.headers = {};

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        code: 'AUTH_TOKEN_MISSING',
        message: 'Token autentikasi diperlukan'
      }));
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat'
      };

      const mockError = new Error('Invalid token format');
      mockVerifyAccessToken.mockImplementation(() => {
        throw mockError;
      });

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      const mockError = new Error('Invalid token');
      mockVerifyAccessToken.mockImplementation(() => {
        throw mockError;
      });

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Token Generation', () => {
    it('should generate token without impersonation context after stopping', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1']
        }
      });

      const mockResult = {
        token: 'new-token-without-impersonation',
        user: {
          id: 'super-admin-id',
          email: 'superadmin@raho.id',
          fullName: 'Super Admin',
          role: 'SUPER_ADMIN' as Role,
          branchId: null,
          branchCode: null
        }
      };

      stopImpersonationSpy.mockResolvedValue(mockResult);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, expect.objectContaining({
        token: expect.any(String),
        user: expect.objectContaining({
          id: expect.any(String),
          email: expect.any(String),
          role: expect.any(String)
        })
      }));
    });

    it('should include branches for Admin Manager after stopping nested impersonation', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1', 'branch-2'],
          impersonating: {
            userId: 'admin-cabang-id',
            role: 'ADMIN_CABANG',
            branchId: 'branch-1'
          }
        }
      });

      const mockResult = {
        token: 'token',
        user: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager',
          role: 'ADMIN_MANAGER' as Role,
          branchId: null,
          branchCode: null,
          branches: [
            { id: 'branch-1', name: 'Branch 1', branchCode: 'B001' },
            { id: 'branch-2', name: 'Branch 2', branchCode: 'B002' }
          ]
        }
      };

      stopImpersonationSpy.mockResolvedValue(mockResult);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.user.branches).toBeDefined();
      expect(Array.isArray(result.user.branches)).toBe(true);
      expect(result.user.branches.length).toBeGreaterThan(0);
    });
  });

  describe('Audit Logging', () => {
    it('should log impersonation stop with correct metadata', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1']
        }
      });

      const mockResult = {
        token: 'token',
        user: {
          id: 'super-admin-id',
          email: 'superadmin@raho.id',
          fullName: 'Super Admin',
          role: 'SUPER_ADMIN' as Role,
          branchId: null,
          branchCode: null
        }
      };

      stopImpersonationSpy.mockResolvedValue(mockResult);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogAudit).toHaveBeenCalledWith({
        userId: 'super-admin-id',
        branchId: null,
        action: AuditAction.LOGOUT,
        resource: 'Impersonation',
        resourceId: 'manager-id',
        meta: {
          type: 'IMPERSONATE_STOP',
          impersonatedUser: 'manager@raho.id',
          impersonatedRole: 'ADMIN_MANAGER'
        },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });
    });

    it('should include IP address and user agent in audit log', async () => {
      mockRequest = {
        ...mockRequest,
        ip: '192.168.1.100',
        headers: {
          authorization: 'Bearer token',
          'user-agent': 'Mozilla/5.0'
        }
      };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER'
        }
      });

      const mockResult = {
        token: 'token',
        user: {
          id: 'super-admin-id',
          email: 'superadmin@raho.id',
          fullName: 'Super Admin',
          role: 'SUPER_ADMIN' as Role,
          branchId: null,
          branchCode: null
        }
      };

      stopImpersonationSpy.mockResolvedValue(mockResult);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0'
      }));
    });
  });

  describe('Error Cases', () => {
    it('should reject when not currently impersonating', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null
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
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should handle service throwing unexpected error', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER'
        }
      });

      const mockError = new Error('Unexpected database error');
      stopImpersonationSpy.mockRejectedValue(mockError);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should handle malformed token payload', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        // Missing required fields
      });

      const mockError = new Error('Invalid token payload');
      stopImpersonationSpy.mockRejectedValue(mockError);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });

  describe('Response Format', () => {
    it('should return token and user information', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER'
        }
      });

      const mockResult = {
        token: 'new-token',
        user: {
          id: 'super-admin-id',
          email: 'superadmin@raho.id',
          fullName: 'Super Admin',
          role: 'SUPER_ADMIN' as Role,
          branchId: null,
          branchCode: null
        }
      };

      stopImpersonationSpy.mockResolvedValue(mockResult);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, {
        token: 'new-token',
        user: {
          id: 'super-admin-id',
          email: 'superadmin@raho.id',
          fullName: 'Super Admin',
          role: 'SUPER_ADMIN',
          branchId: null,
          branchCode: null
        }
      });
    });

    it('should have correct structure for Super Admin return', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
          role: 'ADMIN_MANAGER'
        }
      });

      const mockResult = {
        token: 'token',
        user: {
          id: 'super-admin-id',
          email: 'superadmin@raho.id',
          fullName: 'Super Admin',
          role: 'SUPER_ADMIN' as Role,
          branchId: null,
          branchCode: null
        }
      };

      stopImpersonationSpy.mockResolvedValue(mockResult);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('email');
      expect(result.user).toHaveProperty('fullName');
      expect(result.user).toHaveProperty('role');
      expect(result.user).toHaveProperty('branchId');
      expect(result.user).toHaveProperty('branchCode');
    });

    it('should have correct structure for Admin Manager return', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        impersonating: {
          userId: 'admin-cabang-id',
          role: 'ADMIN_CABANG'
        }
      });

      const mockResult = {
        token: 'token',
        user: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager',
          role: 'ADMIN_MANAGER' as Role,
          branchId: null,
          branchCode: null,
          branches: [
            { id: 'branch-1', name: 'Branch 1', branchCode: 'B001' }
          ]
        }
      };

      stopImpersonationSpy.mockResolvedValue(mockResult);

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.user).toHaveProperty('branches');
      expect(Array.isArray(result.user.branches)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing authorization header', async () => {
      mockRequest.headers = {};

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        code: 'AUTH_TOKEN_MISSING'
      }));
    });

    it('should handle empty authorization header', async () => {
      mockRequest.headers = {
        authorization: ''
      };

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        code: 'AUTH_TOKEN_MISSING'
      }));
    });

    it('should handle authorization header without Bearer prefix', async () => {
      mockRequest.headers = {
        authorization: 'just-a-token'
      };

      const mockError = new Error('Invalid token format');
      mockVerifyAccessToken.mockImplementation(() => {
        throw mockError;
      });

      await stopImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });
});
