import { Request, Response, NextFunction } from 'express';
import { startImpersonation } from '../admin.controller';
import { ImpersonationService } from '../services/impersonation.service';
import { sendSuccess } from '@utils/response';
import { Role, AuditAction } from '@prisma/client';

// Mock dependencies
jest.mock('@utils/response');
jest.mock('@lib/jwt');
jest.mock('@utils/auditLog');

describe('POST /admin/impersonate/:userId - Integration Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockSendSuccess: jest.MockedFunction<typeof sendSuccess>;
  let createImpersonationTokenSpy: jest.SpyInstance;
  let mockVerifyAccessToken: jest.Mock;
  let mockLogAudit: jest.Mock;

  beforeEach(async () => {
    mockRequest = {
      params: { userId: 'target-user-id' },
      headers: {
        authorization: 'Bearer mock-token',
        'user-agent': 'test-agent'
      },
      ip: '127.0.0.1',
      user: {
        id: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
      } as any,
    };
    mockResponse = {};
    mockNext = jest.fn();
    mockSendSuccess = sendSuccess as jest.MockedFunction<typeof sendSuccess>;
    
    // Spy on the service method
    createImpersonationTokenSpy = jest.spyOn(ImpersonationService.prototype, 'createImpersonationToken');
    
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
    createImpersonationTokenSpy.mockRestore();
  });

  describe('Authorization - Super Admin Impersonating Admin Manager', () => {
    it('should allow Super Admin to impersonate Admin Manager', async () => {
      mockRequest.user = {
        id: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
      } as any;

      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null
      });

      const mockResult = {
        token: 'new-impersonation-token',
        targetUser: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager Name',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1', 'branch-2']
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(createImpersonationTokenSpy).toHaveBeenCalledWith(
        'super-admin-id',
        'target-user-id',
        expect.objectContaining({
          userId: 'super-admin-id',
          role: 'SUPER_ADMIN'
        })
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'super-admin-id',
        action: AuditAction.LOGIN,
        resource: 'Impersonation',
        resourceId: 'target-user-id',
        meta: expect.objectContaining({
          type: 'IMPERSONATE_START',
          targetUser: 'manager@raho.id',
          targetRole: 'ADMIN_MANAGER'
        })
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow Super Admin to impersonate Admin Cabang', async () => {
      mockRequest.user = {
        id: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
      } as any;

      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null
      });

      const mockResult = {
        token: 'new-impersonation-token',
        targetUser: {
          id: 'admin-cabang-id',
          email: 'admincabang@raho.id',
          fullName: 'Admin Cabang Name',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(createImpersonationTokenSpy).toHaveBeenCalled();
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        meta: expect.objectContaining({
          targetRole: 'ADMIN_CABANG'
        })
      }));
    });
  });

  describe('Authorization - Admin Manager Impersonating Admin Cabang', () => {
    it('should allow Admin Manager to impersonate Admin Cabang from their branches', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any;

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1', 'branch-2']
      });

      const mockResult = {
        token: 'new-impersonation-token',
        targetUser: {
          id: 'admin-cabang-id',
          email: 'admincabang@raho.id',
          fullName: 'Admin Cabang Name',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(createImpersonationTokenSpy).toHaveBeenCalledWith(
        'manager-id',
        'target-user-id',
        expect.objectContaining({
          userId: 'manager-id',
          role: 'ADMIN_MANAGER'
        })
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      expect(mockLogAudit).toHaveBeenCalled();
    });

    it('should reject Admin Manager impersonating Admin Cabang from unassigned branch', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1'],
      } as any;

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        email: 'manager@raho.id',
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
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Nested Impersonation', () => {
    it('should allow Super Admin → Admin Manager → Admin Cabang', async () => {
      mockRequest.user = {
        id: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branches: ['branch-1', 'branch-2'], // From impersonating Admin Manager
      } as any;

      // Current token shows Super Admin impersonating Admin Manager
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1', 'branch-2']
        }
      });

      const mockResult = {
        token: 'nested-impersonation-token',
        targetUser: {
          id: 'admin-cabang-id',
          email: 'admincabang@raho.id',
          fullName: 'Admin Cabang Name',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(createImpersonationTokenSpy).toHaveBeenCalledWith(
        'super-admin-id',
        'target-user-id',
        expect.objectContaining({
          impersonating: expect.objectContaining({
            userId: 'manager-id',
            role: 'ADMIN_MANAGER'
          })
        })
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        meta: expect.objectContaining({
          isNested: true
        })
      }));
    });

    it('should track nested impersonation in audit log', async () => {
      mockRequest.user = {
        id: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branches: ['branch-1'],
      } as any;

      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
          role: 'ADMIN_MANAGER'
        }
      });

      const mockResult = {
        token: 'nested-token',
        targetUser: {
          id: 'admin-cabang-id',
          email: 'admincabang@raho.id',
          fullName: 'Admin Cabang',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        meta: expect.objectContaining({
          type: 'IMPERSONATE_START',
          isNested: true
        })
      }));
    });
  });

  describe('Error Cases', () => {
    it('should reject impersonation of non-existent user', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
      });

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

    it('should reject impersonation of inactive user', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
      });

      const mockError = {
        status: 400,
        code: 'INVALID_IMPERSONATION',
        message: 'Tidak dapat impersonate user yang tidak aktif'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should reject impersonation of same or higher role', async () => {
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

      const mockError = {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Tidak dapat impersonate user dengan role yang sama atau lebih tinggi'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should reject when already impersonating (for non-nested scenarios)', async () => {
      mockRequest.user = {
        id: 'admin-cabang-id',
        email: 'admincabang@raho.id',
        role: 'ADMIN_CABANG' as Role,
        branchId: 'branch-1',
      } as any;

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        impersonating: {
          userId: 'admin-cabang-id',
          role: 'ADMIN_CABANG'
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
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should handle missing authorization token', async () => {
      mockRequest.headers = {};

      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
      });

      const mockResult = {
        token: 'new-token',
        targetUser: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1']
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      // Should still work, just without nested impersonation check
      expect(createImpersonationTokenSpy).toHaveBeenCalledWith(
        'super-admin-id',
        'target-user-id',
        undefined
      );
      expect(mockSendSuccess).toHaveBeenCalled();
    });
  });

  describe('Token Generation', () => {
    it('should generate token with impersonation context', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
      });

      const mockResult = {
        token: 'jwt-token-with-impersonation',
        targetUser: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager Name',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1', 'branch-2']
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, expect.objectContaining({
        token: expect.any(String),
        targetUser: expect.objectContaining({
          id: expect.any(String),
          email: expect.any(String),
          role: expect.any(String)
        })
      }));
    });

    it('should include branches for Admin Manager impersonation', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
      });

      const mockResult = {
        token: 'token',
        targetUser: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1', 'branch-2', 'branch-3']
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.targetUser.branches).toEqual(['branch-1', 'branch-2', 'branch-3']);
    });

    it('should include branchId for Admin Cabang impersonation', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
      });

      const mockResult = {
        token: 'token',
        targetUser: {
          id: 'admin-cabang-id',
          email: 'admincabang@raho.id',
          fullName: 'Admin Cabang',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.targetUser.branchId).toBe('branch-1');
    });
  });

  describe('Audit Logging', () => {
    it('should log impersonation start with correct metadata', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
      });

      const mockResult = {
        token: 'token',
        targetUser: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1']
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogAudit).toHaveBeenCalledWith({
        userId: 'super-admin-id',
        branchId: null,
        action: AuditAction.LOGIN,
        resource: 'Impersonation',
        resourceId: 'target-user-id',
        meta: {
          type: 'IMPERSONATE_START',
          targetUser: 'manager@raho.id',
          targetRole: 'ADMIN_MANAGER',
          isNested: false
        },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });
    });

    it('should log nested impersonation with isNested flag', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
          role: 'ADMIN_MANAGER'
        }
      });

      const mockResult = {
        token: 'token',
        targetUser: {
          id: 'admin-cabang-id',
          email: 'admincabang@raho.id',
          fullName: 'Admin Cabang',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        meta: expect.objectContaining({
          isNested: true
        })
      }));
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
        role: 'SUPER_ADMIN'
      });

      const mockResult = {
        token: 'token',
        targetUser: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1']
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0'
      }));
    });
  });

  describe('Response Format', () => {
    it('should return token and target user information', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
      });

      const mockResult = {
        token: 'new-impersonation-token',
        targetUser: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager Name',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1', 'branch-2']
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, {
        token: 'new-impersonation-token',
        targetUser: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager Name',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1', 'branch-2']
        }
      });
    });

    it('should have correct structure for Admin Manager target', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
      });

      const mockResult = {
        token: 'token',
        targetUser: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1']
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('targetUser');
      expect(result.targetUser).toHaveProperty('id');
      expect(result.targetUser).toHaveProperty('email');
      expect(result.targetUser).toHaveProperty('fullName');
      expect(result.targetUser).toHaveProperty('role');
      expect(result.targetUser).toHaveProperty('branches');
      expect(Array.isArray(result.targetUser.branches)).toBe(true);
    });

    it('should have correct structure for Admin Cabang target', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
      });

      const mockResult = {
        token: 'token',
        targetUser: {
          id: 'admin-cabang-id',
          email: 'admincabang@raho.id',
          fullName: 'Admin Cabang',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('targetUser');
      expect(result.targetUser).toHaveProperty('branchId');
      expect(result.targetUser.branchId).toBe('branch-1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle service throwing unexpected error', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
      });

      const mockError = new Error('Unexpected database error');
      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should handle malformed token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      const mockError = new Error('Invalid token');
      mockVerifyAccessToken.mockImplementation(() => {
        throw mockError;
      });

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should handle missing user in request', async () => {
      mockRequest.user = undefined;

      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        role: 'SUPER_ADMIN'
      });

      const mockResult = {
        token: 'token',
        targetUser: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1']
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      // The controller will try to access user.id which will throw
      // This should be caught and passed to next
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
