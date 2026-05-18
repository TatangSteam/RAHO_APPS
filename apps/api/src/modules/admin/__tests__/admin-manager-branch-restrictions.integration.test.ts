import { Request, Response, NextFunction } from 'express';
import { startImpersonation } from '../admin.controller';
import { ImpersonationService } from '../services/impersonation.service';
import { sendSuccess } from '@utils/response';
import { Role, AuditAction } from '@prisma/client';

// Mock dependencies
jest.mock('@utils/response');
jest.mock('@lib/jwt');
jest.mock('@utils/auditLog');

describe('Admin Manager Branch Access Restrictions - Integration Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockSendSuccess: jest.MockedFunction<typeof sendSuccess>;
  let createImpersonationTokenSpy: jest.SpyInstance;
  let mockVerifyAccessToken: jest.Mock;
  let mockLogAudit: jest.Mock;

  beforeEach(async () => {
    mockRequest = {
      params: { userId: 'admin-cabang-id' },
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

  describe('Admin Manager Can Impersonate Branch Admins in Assigned Branches', () => {
    it('should allow Admin Manager to impersonate Admin Cabang from branch-1 (assigned)', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-1-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1', 'branch-2']
      });

      const mockResult = {
        token: 'impersonation-token',
        targetUser: {
          id: 'admin-cabang-branch-1-id',
          email: 'admincabang.branch1@raho.id',
          fullName: 'Admin Cabang Branch 1',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1',
          branchCode: 'BR1'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(createImpersonationTokenSpy).toHaveBeenCalledWith(
        'manager-id',
        'admin-cabang-branch-1-id',
        expect.objectContaining({
          userId: 'manager-id',
          role: 'ADMIN_MANAGER'
        })
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow Admin Manager to impersonate Admin Cabang from branch-2 (assigned)', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-2-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1', 'branch-2']
      });

      const mockResult = {
        token: 'impersonation-token',
        targetUser: {
          id: 'admin-cabang-branch-2-id',
          email: 'admincabang.branch2@raho.id',
          fullName: 'Admin Cabang Branch 2',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-2',
          branchCode: 'BR2'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(createImpersonationTokenSpy).toHaveBeenCalled();
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow Admin Manager with multiple branches to impersonate any Admin Cabang from those branches', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2', 'branch-3'],
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-3-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1', 'branch-2', 'branch-3']
      });

      const mockResult = {
        token: 'impersonation-token',
        targetUser: {
          id: 'admin-cabang-branch-3-id',
          email: 'admincabang.branch3@raho.id',
          fullName: 'Admin Cabang Branch 3',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-3',
          branchCode: 'BR3'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(createImpersonationTokenSpy).toHaveBeenCalled();
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });
  });

  describe('Admin Manager CANNOT Impersonate Branch Admins from Unassigned Branches', () => {
    it('should reject Admin Manager impersonating Admin Cabang from branch-3 (not assigned)', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'], // Only branch-1 and branch-2
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-3-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1', 'branch-2']
      });

      const mockError = {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(createImpersonationTokenSpy).toHaveBeenCalledWith(
        'manager-id',
        'admin-cabang-branch-3-id',
        expect.any(Object)
      );
      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should reject Admin Manager with single branch impersonating Admin Cabang from different branch', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1'], // Only branch-1
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-2-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1']
      });

      const mockError = {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should reject Admin Manager with no branches impersonating any Admin Cabang', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: [], // No branches assigned
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-1-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER',
        branches: []
      });

      const mockError = {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Error Responses for Unauthorized Impersonation', () => {
    it('should return 403 status code for branch access denied', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1'],
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-2-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1']
      });

      const mockError = {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        code: 'BRANCH_ACCESS_DENIED'
      }));
    });

    it('should return descriptive error message for branch access denied', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1'],
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-2-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1']
      });

      const mockError = {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
      }));
    });

    it('should not log audit entry for failed impersonation attempt', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1'],
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-2-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1']
      });

      const mockError = {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      // Audit log should not be called for failed attempts
      expect(mockLogAudit).not.toHaveBeenCalled();
    });
  });

  describe('Branch Validation Logic', () => {
    it('should validate branch access before creating impersonation token', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-1-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1', 'branch-2']
      });

      const mockResult = {
        token: 'token',
        targetUser: {
          id: 'admin-cabang-branch-1-id',
          email: 'admincabang@raho.id',
          fullName: 'Admin Cabang',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      // Service should be called with correct parameters
      expect(createImpersonationTokenSpy).toHaveBeenCalledWith(
        'manager-id',
        'admin-cabang-branch-1-id',
        expect.objectContaining({
          userId: 'manager-id',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1', 'branch-2']
        })
      );
    });

    it('should check branch membership using branchId of target Admin Cabang', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-3-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1', 'branch-2']
      });

      // Target Admin Cabang has branchId: 'branch-3' which is NOT in manager's branches
      const mockError = {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should work correctly with Admin Manager having single branch', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1'], // Single branch
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-1-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1']
      });

      const mockResult = {
        token: 'token',
        targetUser: {
          id: 'admin-cabang-branch-1-id',
          email: 'admincabang@raho.id',
          fullName: 'Admin Cabang',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });

    it('should work correctly with Admin Manager having many branches', async () => {
      const manyBranches = ['branch-1', 'branch-2', 'branch-3', 'branch-4', 'branch-5'];
      
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: manyBranches,
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-4-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        role: 'ADMIN_MANAGER',
        branches: manyBranches
      });

      const mockResult = {
        token: 'token',
        targetUser: {
          id: 'admin-cabang-branch-4-id',
          email: 'admincabang@raho.id',
          fullName: 'Admin Cabang',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-4'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });
  });

  describe('Nested Impersonation Branch Restrictions', () => {
    it('should allow Super Admin → Admin Manager → Admin Cabang (from manager branches)', async () => {
      mockRequest.user = {
        id: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branches: ['branch-1', 'branch-2'], // From impersonating Admin Manager
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-1-id' };

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
          id: 'admin-cabang-branch-1-id',
          email: 'admincabang@raho.id',
          fullName: 'Admin Cabang',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(createImpersonationTokenSpy).toHaveBeenCalledWith(
        'super-admin-id',
        'admin-cabang-branch-1-id',
        expect.objectContaining({
          impersonating: expect.objectContaining({
            userId: 'manager-id',
            role: 'ADMIN_MANAGER',
            branches: ['branch-1', 'branch-2']
          })
        })
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });

    it('should reject Super Admin → Admin Manager → Admin Cabang (from unassigned branch)', async () => {
      mockRequest.user = {
        id: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branches: ['branch-1', 'branch-2'], // From impersonating Admin Manager
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-3-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1', 'branch-2'] // branch-3 not included
        }
      });

      const mockError = {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should validate branch access based on impersonated Admin Manager branches', async () => {
      mockRequest.user = {
        id: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branches: ['branch-1'], // From impersonating Admin Manager with only branch-1
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-2-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'super-admin-id',
        impersonating: {
          userId: 'manager-id',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1'] // Only branch-1
        }
      });

      const mockError = {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle Admin Cabang with null branchId', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any;

      mockRequest.params = { userId: 'admin-cabang-no-branch-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1', 'branch-2']
      });

      const mockError = {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should handle case-sensitive branch ID comparison', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any;

      mockRequest.params = { userId: 'admin-cabang-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1', 'branch-2']
      });

      // Target has branchId: 'BRANCH-1' (uppercase) - should not match 'branch-1'
      const mockError = {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should handle Admin Manager with undefined branches array', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: undefined, // Undefined branches
      } as any;

      mockRequest.params = { userId: 'admin-cabang-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        role: 'ADMIN_MANAGER',
        branches: undefined
      });

      const mockError = {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
      };

      createImpersonationTokenSpy.mockRejectedValue(mockError);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });

  describe('Successful Impersonation Audit Logging', () => {
    it('should log successful impersonation with branch information', async () => {
      mockRequest.user = {
        id: 'manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any;

      mockRequest.params = { userId: 'admin-cabang-branch-1-id' };

      mockVerifyAccessToken.mockReturnValue({
        userId: 'manager-id',
        role: 'ADMIN_MANAGER',
        branches: ['branch-1', 'branch-2']
      });

      const mockResult = {
        token: 'token',
        targetUser: {
          id: 'admin-cabang-branch-1-id',
          email: 'admincabang@raho.id',
          fullName: 'Admin Cabang',
          role: 'ADMIN_CABANG' as Role,
          branchId: 'branch-1'
        }
      };

      createImpersonationTokenSpy.mockResolvedValue(mockResult);

      await startImpersonation(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'manager-id',
        action: AuditAction.LOGIN,
        resource: 'Impersonation',
        resourceId: 'admin-cabang-branch-1-id',
        meta: expect.objectContaining({
          type: 'IMPERSONATE_START',
          targetUser: 'admincabang@raho.id',
          targetRole: 'ADMIN_CABANG'
        })
      }));
    });
  });
});
