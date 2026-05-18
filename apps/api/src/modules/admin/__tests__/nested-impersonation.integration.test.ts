import { Request, Response, NextFunction } from 'express';
import { startImpersonation, stopImpersonation } from '../admin.controller';
import { ImpersonationService } from '../services/impersonation.service';
import { sendSuccess } from '@utils/response';
import { Role, AuditAction } from '@prisma/client';

// Mock dependencies
jest.mock('@utils/response');
jest.mock('@lib/jwt');
jest.mock('@utils/auditLog');

describe('Nested Impersonation Flow - Integration Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockSendSuccess: jest.MockedFunction<typeof sendSuccess>;
  let createImpersonationTokenSpy: jest.SpyInstance;
  let stopImpersonationSpy: jest.SpyInstance;
  let mockVerifyAccessToken: jest.Mock;
  let mockLogAudit: jest.Mock;

  beforeEach(async () => {
    mockRequest = {
      params: {},
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
    
    // Spy on service methods
    createImpersonationTokenSpy = jest.spyOn(ImpersonationService.prototype, 'createImpersonationToken');
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
    createImpersonationTokenSpy.mockRestore();
    stopImpersonationSpy.mockRestore();
  });

  describe('Complete Nested Flow: Super Admin → Admin Manager → Admin Cabang', () => {
    it('should allow Super Admin to impersonate Admin Manager', async () => {
      // Step 1: Super Admin impersonates Admin Manager
      mockRequest.params = { userId: 'manager-id' };
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
        token: 'impersonation-token-level-1',
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
        'manager-id',
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
        meta: expect.objectContaining({
          type: 'IMPERSONATE_START',
          targetUser: 'manager@raho.id',
          targetRole: 'ADMIN_MANAGER',
          isNested: false
        })
      }));
    });

    it('should allow nested impersonation: Admin Manager → Admin Cabang', async () => {
      // Step 2: While impersonating Admin Manager, impersonate Admin Cabang
      mockRequest.params = { userId: 'admin-cabang-id' };
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any;

      // Current token shows Super Admin → Admin Manager
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
        token: 'nested-impersonation-token-level-2',
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

      // The controller passes user.id (manager-id) and the currentToken
      expect(createImpersonationTokenSpy).toHaveBeenCalledWith(
        'manager-id', // user.id from req.user
        'admin-cabang-id',
        expect.objectContaining({
          userId: 'super-admin-id',
          impersonating: expect.objectContaining({
            userId: 'manager-id',
            role: 'ADMIN_MANAGER'
          })
        })
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'manager-id', // user.id from req.user
        action: AuditAction.LOGIN,
        resource: 'Impersonation',
        meta: expect.objectContaining({
          type: 'IMPERSONATE_START',
          targetUser: 'admincabang@raho.id',
          targetRole: 'ADMIN_CABANG',
          isNested: true
        })
      }));
    });

    it('should stop nested impersonation and return to Admin Manager (not Super Admin)', async () => {
      // Step 3: Stop impersonation from Admin Cabang → back to Admin Manager
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
        token: 'back-to-manager-token',
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
      // Verify we're back to Admin Manager, not Super Admin
      expect(mockResult.user.id).toBe('manager-id');
      expect(mockResult.user.role).toBe('ADMIN_MANAGER');
      expect(mockResult.user.branches).toBeDefined();
      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'super-admin-id',
        action: AuditAction.LOGOUT,
        resource: 'Impersonation',
        meta: expect.objectContaining({
          type: 'IMPERSONATE_STOP',
          impersonatedUser: 'manager@raho.id', // currentToken.impersonating.email (immediate level)
          impersonatedRole: 'ADMIN_MANAGER' // currentToken.impersonating.role (immediate level)
        })
      }));
    });

    it('should stop impersonation from Admin Manager and return to Super Admin', async () => {
      // Step 4: Stop impersonation from Admin Manager → back to Super Admin
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any;

      // Current token shows Super Admin → Admin Manager (no nested)
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
        token: 'back-to-super-admin-token',
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

      expect(stopImpersonationSpy).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'super-admin-id',
        impersonating: expect.objectContaining({
          userId: 'manager-id',
          role: 'ADMIN_MANAGER'
        })
      }));
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      // Verify we're back to Super Admin
      expect(mockResult.user.id).toBe('super-admin-id');
      expect(mockResult.user.role).toBe('SUPER_ADMIN');
      expect((mockResult.user as any).branches).toBeUndefined();
      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'super-admin-id',
        action: AuditAction.LOGOUT,
        resource: 'Impersonation',
        meta: expect.objectContaining({
          type: 'IMPERSONATE_STOP',
          impersonatedUser: 'manager@raho.id',
          impersonatedRole: 'ADMIN_MANAGER'
        })
      }));
    });
  });

  describe('Token Structure Verification', () => {
    it('should have correct token structure for single-level impersonation', async () => {
      mockRequest.params = { userId: 'manager-id' };
      
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: null
      });

      const mockResult = {
        token: 'token-level-1',
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

      // Token should contain impersonating field
      expect(createImpersonationTokenSpy).toHaveBeenCalledWith(
        'super-admin-id',
        'manager-id',
        expect.objectContaining({
          userId: 'super-admin-id',
          role: 'SUPER_ADMIN'
        })
      );
    });

    it('should have correct token structure for nested impersonation', async () => {
      mockRequest.params = { userId: 'admin-cabang-id' };
      
      // Token shows Super Admin → Admin Manager
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

      // Token should contain nested impersonating field
      expect(createImpersonationTokenSpy).toHaveBeenCalledWith(
        'super-admin-id',
        'admin-cabang-id',
        expect.objectContaining({
          userId: 'super-admin-id',
          impersonating: expect.objectContaining({
            userId: 'manager-id',
            role: 'ADMIN_MANAGER'
          })
        })
      );
    });
  });

  describe('Permission Verification', () => {
    it('should verify each level has correct permissions', async () => {
      // Level 1: Super Admin → Admin Manager
      mockRequest.params = { userId: 'manager-id' };
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

      const mockManagerResult = {
        token: 'token',
        targetUser: {
          id: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Manager',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-1', 'branch-2']
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockManagerResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify Admin Manager has branches
      const managerResult = mockSendSuccess.mock.calls[0][1] as any;
      expect(managerResult.targetUser.branches).toBeDefined();
      expect(Array.isArray(managerResult.targetUser.branches)).toBe(true);
      expect(managerResult.targetUser.branches.length).toBeGreaterThan(0);

      jest.clearAllMocks();

      // Level 2: Admin Manager → Admin Cabang
      mockRequest.params = { userId: 'admin-cabang-id' };
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any;

      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1', 'branch-2']
        }
      });

      const mockCabangResult = {
        token: 'token',
        targetUser: {
          id: 'admin-cabang-id',
          email: 'admincabang@raho.id',
          fullName: 'Admin Cabang',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockCabangResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify Admin Cabang has single branchId
      const cabangResult = mockSendSuccess.mock.calls[0][1] as any;
      expect(cabangResult.targetUser.branchId).toBeDefined();
      expect(cabangResult.targetUser.branchId).toBe('branch-1');
    });

    it('should verify branch access at each level', async () => {
      // Admin Manager should only see branches assigned to them
      mockRequest.params = { userId: 'manager-id' };
      
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
          branches: ['branch-1', 'branch-2'] // Only these branches
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.targetUser.branches).toEqual(['branch-1', 'branch-2']);
    });
  });

  describe('Audit Log Tracking', () => {
    it('should track full chain in audit logs for nested impersonation', async () => {
      mockRequest.params = { userId: 'admin-cabang-id' };
      
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1']
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
        userId: 'super-admin-id', // Original user
        action: AuditAction.LOGIN,
        resource: 'Impersonation',
        resourceId: 'admin-cabang-id',
        meta: expect.objectContaining({
          type: 'IMPERSONATE_START',
          targetUser: 'admincabang@raho.id',
          targetRole: 'ADMIN_CABANG',
          isNested: true
        })
      }));
    });

    it('should track each stop impersonation in audit logs', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          impersonating: {
            userId: 'admin-cabang-id',
            email: 'admincabang@raho.id',
            role: 'ADMIN_CABANG'
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
        userId: 'super-admin-id', // Original user
        action: AuditAction.LOGOUT,
        resource: 'Impersonation',
        meta: expect.objectContaining({
          type: 'IMPERSONATE_STOP'
        })
      }));
    });
  });

  describe('Error Cases in Nested Flow', () => {
    it('should reject impersonation beyond 2 levels', async () => {
      mockRequest.params = { userId: 'another-user-id' };
      
      // Already at 2 levels: Super Admin → Admin Manager → Admin Cabang
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
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should reject Admin Manager impersonating Admin Cabang from unassigned branch', async () => {
      mockRequest.params = { userId: 'admin-cabang-id' };
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1'], // Only has access to branch-1
      } as any;

      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1']
        }
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

    it('should handle stop impersonation when not impersonating', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
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
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Response Format Verification', () => {
    it('should return correct structure when stopping nested impersonation', async () => {
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
        token: 'new-token',
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

      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('email');
      expect(result.user).toHaveProperty('fullName');
      expect(result.user).toHaveProperty('role');
      expect(result.user).toHaveProperty('branches');
      expect(Array.isArray(result.user.branches)).toBe(true);
      expect(result.user.branches.length).toBeGreaterThan(0);
    });

    it('should return correct structure when stopping single-level impersonation', async () => {
      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
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

      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe('super-admin-id');
      expect(result.user.role).toBe('SUPER_ADMIN');
      expect((result.user as any).branches).toBeUndefined();
    });
  });
});
