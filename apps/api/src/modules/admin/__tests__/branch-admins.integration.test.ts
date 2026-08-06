import { Request, Response, NextFunction } from 'express';
import { getBranchAdmins } from '../admin.controller';
import { ImpersonationService } from '../services/impersonation.service';
import { sendSuccess } from '@utils/response';
import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';

// Mock dependencies
jest.mock('@utils/response');
jest.mock('@lib/prisma', () => ({
  prisma: {
    managerBranch: {
      findMany: jest.fn()
    }
  }
}));

describe('GET /admin/branch-admins - Integration Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockSendSuccess: jest.MockedFunction<typeof sendSuccess>;
  let getBranchAdminsSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRequest = {
      query: {},
      user: {
        id: 'admin-manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any,
    };
    mockResponse = {};
    mockNext = jest.fn();
    mockSendSuccess = sendSuccess as jest.MockedFunction<typeof sendSuccess>;
    
    // Spy on the service method
    getBranchAdminsSpy = jest.spyOn(ImpersonationService.prototype, 'getBranchAdmins');
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    getBranchAdminsSpy.mockRestore();
  });

  describe('Authorization', () => {
    it('should be accessible by Admin Manager', async () => {
      const mockAdmins = [
        {
          id: 'admin-1',
          email: 'admin1@raho.id',
          fullName: 'Admin One',
          isActive: true,
          branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
          createdAt: new Date('2024-01-01'),
          lastLoginAt: new Date('2024-01-15')
        }
      ];

      const mockPagination = {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      };

      getBranchAdminsSpy.mockResolvedValue({
        admins: mockAdmins,
        pagination: mockPagination
      });

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getBranchAdminsSpy).toHaveBeenCalledWith(
        ['branch-1', 'branch-2'],
        {
          branchId: undefined,
          search: undefined,
          isActive: undefined,
          page: undefined,
          limit: undefined
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, {
        admins: mockAdmins,
        pagination: mockPagination
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should be accessible by Super Admin impersonating Admin Manager', async () => {
      mockRequest.user = {
        id: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branches: ['branch-1', 'branch-2'], // From impersonation
      } as any;

      const mockAdmins = [
        {
          id: 'admin-1',
          email: 'admin1@raho.id',
          fullName: 'Admin One',
          isActive: true,
          branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
          createdAt: new Date(),
          lastLoginAt: null
        }
      ];

      const mockPagination = {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      };

      getBranchAdminsSpy.mockResolvedValue({
        admins: mockAdmins,
        pagination: mockPagination
      });

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getBranchAdminsSpy).toHaveBeenCalled();
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, {
        admins: mockAdmins,
        pagination: mockPagination
      });
    });

    it('should fetch branches from database if user.branches is not set', async () => {
      mockRequest.user = {
        id: 'admin-manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        // No branches property
      } as any;

      const mockPrismaFindMany = jest.fn().mockResolvedValue([
        { id: 'mb-1', userId: 'admin-manager-id', branchId: 'branch-1', createdAt: new Date(), updatedAt: new Date() },
        { id: 'mb-2', userId: 'admin-manager-id', branchId: 'branch-2', createdAt: new Date(), updatedAt: new Date() }
      ]);
      
      (prisma.managerBranch.findMany as jest.Mock) = mockPrismaFindMany;

      const mockAdmins = [
        {
          id: 'admin-1',
          email: 'admin1@raho.id',
          fullName: 'Admin One',
          isActive: true,
          branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
          createdAt: new Date(),
          lastLoginAt: null
        }
      ];

      const mockPagination = {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      };

      getBranchAdminsSpy.mockResolvedValue({
        admins: mockAdmins,
        pagination: mockPagination
      });

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrismaFindMany).toHaveBeenCalledWith({
        where: { userId: 'admin-manager-id' },
        select: { branchId: true }
      });
      expect(getBranchAdminsSpy).toHaveBeenCalledWith(
        ['branch-1', 'branch-2'],
        expect.any(Object)
      );
      expect(mockSendSuccess).toHaveBeenCalled();
    });
  });

  describe('Branch Access Restrictions', () => {
    it('should only return branch admins from assigned branches', async () => {
      mockRequest.user = {
        id: 'admin-manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1', 'branch-2'],
      } as any;

      const mockAdmins = [
        {
          id: 'admin-1',
          email: 'admin1@raho.id',
          fullName: 'Admin One',
          isActive: true,
          branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
          createdAt: new Date(),
          lastLoginAt: null
        },
        {
          id: 'admin-2',
          email: 'admin2@raho.id',
          fullName: 'Admin Two',
          isActive: true,
          branch: { id: 'branch-2', name: 'Bandung', branchCode: 'BDG' },
          createdAt: new Date(),
          lastLoginAt: null
        }
      ];

      const mockPagination = {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1
      };

      getBranchAdminsSpy.mockResolvedValue({
        admins: mockAdmins,
        pagination: mockPagination
      });

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getBranchAdminsSpy).toHaveBeenCalledWith(
        ['branch-1', 'branch-2'],
        expect.any(Object)
      );
      
      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.admins).toHaveLength(2);
      expect(result.admins.every((admin) =>
        ['branch-1', 'branch-2'].includes(admin.branch.id)
      )).toBe(true);
    });

    it('should not return branch admins from unassigned branches', async () => {
      mockRequest.user = {
        id: 'admin-manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: ['branch-1'],
      } as any;

      const mockAdmins = [
        {
          id: 'admin-1',
          email: 'admin1@raho.id',
          fullName: 'Admin One',
          isActive: true,
          branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
          createdAt: new Date(),
          lastLoginAt: null
        }
      ];

      const mockPagination = {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      };

      getBranchAdminsSpy.mockResolvedValue({
        admins: mockAdmins,
        pagination: mockPagination
      });

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.admins).toHaveLength(1);
      expect(result.admins[0].branch.id).toBe('branch-1');
    });
  });

  describe('Query Parameters', () => {
    it('should handle branchId filter', async () => {
      mockRequest.query = { branchId: 'branch-1' };

      const mockResult = {
        admins: [
          {
            id: 'admin-1',
            email: 'admin1@raho.id',
            fullName: 'Admin One',
            isActive: true,
            branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
            createdAt: new Date(),
            lastLoginAt: null
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getBranchAdminsSpy).toHaveBeenCalledWith(
        ['branch-1', 'branch-2'],
        {
          branchId: 'branch-1',
          search: undefined,
          isActive: undefined,
          page: undefined,
          limit: undefined
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });

    it('should handle search parameter', async () => {
      mockRequest.query = { search: 'john' };

      const mockResult = {
        admins: [
          {
            id: 'admin-1',
            email: 'john@raho.id',
            fullName: 'John Doe',
            isActive: true,
            branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
            createdAt: new Date(),
            lastLoginAt: null
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getBranchAdminsSpy).toHaveBeenCalledWith(
        ['branch-1', 'branch-2'],
        {
          branchId: undefined,
          search: 'john',
          isActive: undefined,
          page: undefined,
          limit: undefined
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });

    it('should handle isActive filter (true)', async () => {
      mockRequest.query = { isActive: 'true' };

      const mockResult = {
        admins: [
          {
            id: 'admin-1',
            email: 'active@raho.id',
            fullName: 'Active Admin',
            isActive: true,
            branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
            createdAt: new Date(),
            lastLoginAt: null
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getBranchAdminsSpy).toHaveBeenCalledWith(
        ['branch-1', 'branch-2'],
        {
          branchId: undefined,
          search: undefined,
          isActive: true,
          page: undefined,
          limit: undefined
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });

    it('should handle isActive filter (false)', async () => {
      mockRequest.query = { isActive: 'false' };

      const mockResult = {
        admins: [
          {
            id: 'admin-2',
            email: 'inactive@raho.id',
            fullName: 'Inactive Admin',
            isActive: false,
            branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
            createdAt: new Date(),
            lastLoginAt: null
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getBranchAdminsSpy).toHaveBeenCalledWith(
        ['branch-1', 'branch-2'],
        {
          branchId: undefined,
          search: undefined,
          isActive: false,
          page: undefined,
          limit: undefined
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });

    it('should handle pagination parameters', async () => {
      mockRequest.query = { page: '2', limit: '20' };

      const mockResult = {
        admins: [],
        pagination: {
          page: 2,
          limit: 20,
          total: 50,
          totalPages: 3
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getBranchAdminsSpy).toHaveBeenCalledWith(
        ['branch-1', 'branch-2'],
        {
          branchId: undefined,
          search: undefined,
          isActive: undefined,
          page: 2,
          limit: 20
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });

    it('should handle multiple query parameters', async () => {
      mockRequest.query = {
        branchId: 'branch-1',
        search: 'admin',
        isActive: 'true',
        page: '1',
        limit: '5'
      };

      const mockResult = {
        admins: [
          {
            id: 'admin-1',
            email: 'admin1@raho.id',
            fullName: 'Admin One',
            isActive: true,
            branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
            createdAt: new Date(),
            lastLoginAt: new Date()
          }
        ],
        pagination: {
          page: 1,
          limit: 5,
          total: 1,
          totalPages: 1
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getBranchAdminsSpy).toHaveBeenCalledWith(
        ['branch-1', 'branch-2'],
        {
          branchId: 'branch-1',
          search: 'admin',
          isActive: true,
          page: 1,
          limit: 5
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });
  });

  describe('Response Format', () => {
    it('should return branch admins with correct structure', async () => {
      const mockAdmins = [
        {
          id: 'admin-1',
          email: 'admin1@raho.id',
          fullName: 'Admin One',
          isActive: true,
          branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
          createdAt: new Date('2024-01-01'),
          lastLoginAt: new Date('2024-01-15')
        },
        {
          id: 'admin-2',
          email: 'admin2@raho.id',
          fullName: 'Admin Two',
          isActive: true,
          branch: { id: 'branch-2', name: 'Bandung', branchCode: 'BDG' },
          createdAt: new Date('2024-01-02'),
          lastLoginAt: null
        }
      ];

      const mockPagination = {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1
      };

      getBranchAdminsSpy.mockResolvedValue({
        admins: mockAdmins,
        pagination: mockPagination
      });

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, {
        admins: mockAdmins,
        pagination: mockPagination
      });

      // Verify structure
      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.admins).toHaveLength(2);
      expect(result.admins[0]).toHaveProperty('id');
      expect(result.admins[0]).toHaveProperty('email');
      expect(result.admins[0]).toHaveProperty('fullName');
      expect(result.admins[0]).toHaveProperty('isActive');
      expect(result.admins[0]).toHaveProperty('branch');
      expect(result.admins[0]).toHaveProperty('createdAt');
      expect(result.admins[0]).toHaveProperty('lastLoginAt');
      expect(result.admins[0].branch).toHaveProperty('id');
      expect(result.admins[0].branch).toHaveProperty('name');
      expect(result.admins[0].branch).toHaveProperty('branchCode');
    });

    it('should return empty array when no branch admins found', async () => {
      const mockResult = {
        admins: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      expect((mockSendSuccess.mock.calls[0][1] as any).admins).toHaveLength(0);
    });

    it('should include pagination metadata', async () => {
      const mockResult = {
        admins: [
          {
            id: 'admin-1',
            email: 'admin1@raho.id',
            fullName: 'Admin One',
            isActive: true,
            branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
            createdAt: new Date(),
            lastLoginAt: null
          }
        ],
        pagination: {
          page: 2,
          limit: 10,
          total: 25,
          totalPages: 3
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors', async () => {
      const mockError = new Error('Database connection failed');
      getBranchAdminsSpy.mockRejectedValue(mockError);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should handle custom error objects', async () => {
      const mockError = {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong'
      };
      getBranchAdminsSpy.mockRejectedValue(mockError);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should handle forbidden access for non-Admin Manager roles', async () => {
      mockRequest.user = {
        id: 'user-id',
        email: 'user@raho.id',
        role: 'ADMIN_CABANG' as Role,
        branchId: 'branch-1',
      } as any;

      const mockError = {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Hanya Admin Manager yang dapat mengakses endpoint ini'
      };

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(getBranchAdminsSpy).not.toHaveBeenCalled();
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle branch admin with null lastLoginAt', async () => {
      const mockResult = {
        admins: [
          {
            id: 'admin-1',
            email: 'admin1@raho.id',
            fullName: 'Admin One',
            isActive: true,
            branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
            createdAt: new Date(),
            lastLoginAt: null // Never logged in
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.admins[0].lastLoginAt).toBeNull();
    });

    it('should handle invalid page number gracefully', async () => {
      mockRequest.query = { page: 'invalid' };

      const mockResult = {
        admins: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      // parseInt('invalid') returns NaN, which should be handled by the service
      expect(getBranchAdminsSpy).toHaveBeenCalledWith(
        ['branch-1', 'branch-2'],
        {
          branchId: undefined,
          search: undefined,
          isActive: undefined,
          page: NaN,
          limit: undefined
        }
      );
    });

    it('should handle invalid limit number gracefully', async () => {
      mockRequest.query = { limit: 'invalid' };

      const mockResult = {
        admins: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getBranchAdminsSpy).toHaveBeenCalledWith(
        ['branch-1', 'branch-2'],
        {
          branchId: undefined,
          search: undefined,
          isActive: undefined,
          page: undefined,
          limit: NaN
        }
      );
    });

    it('should handle Admin Manager with no assigned branches', async () => {
      mockRequest.user = {
        id: 'admin-manager-id',
        email: 'manager@raho.id',
        role: 'ADMIN_MANAGER' as Role,
        branches: [],
      } as any;

      const mockResult = {
        admins: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getBranchAdminsSpy).toHaveBeenCalledWith(
        [],
        expect.any(Object)
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });
  });

  describe('Data Filtering', () => {
    it('should only return users with ADMIN_CABANG role', async () => {
      const mockResult = {
        admins: [
          {
            id: 'admin-1',
            email: 'admin1@raho.id',
            fullName: 'Admin One',
            isActive: true,
            branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
            createdAt: new Date(),
            lastLoginAt: null
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      // The service ensures only ADMIN_CABANG role is returned
    });

    it('should support case-insensitive search', async () => {
      mockRequest.query = { search: 'JOHN' };

      const mockResult = {
        admins: [
          {
            id: 'admin-1',
            email: 'john@raho.id',
            fullName: 'John Doe',
            isActive: true,
            branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
            createdAt: new Date(),
            lastLoginAt: null
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getBranchAdminsSpy).toHaveBeenCalledWith(
        ['branch-1', 'branch-2'],
        {
          branchId: undefined,
          search: 'JOHN',
          isActive: undefined,
          page: undefined,
          limit: undefined
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });
  });

  describe('Performance', () => {
    it('should handle large result sets with pagination', async () => {
      mockRequest.query = { page: '1', limit: '100' };

      const mockAdmins = Array.from({ length: 100 }, (_, i) => ({
        id: `admin-${i}`,
        email: `admin${i}@raho.id`,
        fullName: `Admin ${i}`,
        isActive: true,
        branch: { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
        createdAt: new Date(),
        lastLoginAt: null
      }));

      const mockResult = {
        admins: mockAdmins,
        pagination: {
          page: 1,
          limit: 100,
          total: 500,
          totalPages: 5
        }
      };

      getBranchAdminsSpy.mockResolvedValue(mockResult);

      await getBranchAdmins(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.admins).toHaveLength(100);
    });
  });
});
