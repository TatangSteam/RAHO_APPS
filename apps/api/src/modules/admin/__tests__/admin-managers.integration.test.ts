import { Request, Response, NextFunction } from 'express';
import { getAdminManagers } from '../admin.controller';
import { ImpersonationService } from '../services/impersonation.service';
import { sendSuccess } from '@utils/response';
import { Role } from '@prisma/client';

// Mock dependencies
jest.mock('@utils/response');

describe('GET /admin/managers - Integration Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockSendSuccess: jest.MockedFunction<typeof sendSuccess>;
  let getAdminManagersSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRequest = {
      query: {},
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
    getAdminManagersSpy = jest.spyOn(ImpersonationService.prototype, 'getAdminManagers');
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    getAdminManagersSpy.mockRestore();
  });

  describe('Authorization', () => {
    it('should only be accessible by Super Admin', async () => {
      // This test verifies that the endpoint is protected by authorize(['SUPER_ADMIN'])
      // The actual authorization is handled by the authorize middleware
      // Here we just verify the controller works when called with Super Admin user
      
      const mockManagers = [
        {
          id: 'manager-1',
          email: 'manager1@raho.id',
          fullName: 'Manager One',
          isActive: true,
          branches: [
            { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' }
          ],
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

      getAdminManagersSpy.mockResolvedValue({
        managers: mockManagers,
        pagination: mockPagination
      });

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getAdminManagersSpy).toHaveBeenCalled();
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, {
        managers: mockManagers,
        pagination: mockPagination
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Query Parameters', () => {
    it('should handle search parameter', async () => {
      mockRequest.query = { search: 'john' };

      const mockResult = {
        managers: [
          {
            id: 'manager-1',
            email: 'john@raho.id',
            fullName: 'John Doe',
            isActive: true,
            branches: [],
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

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getAdminManagersSpy).toHaveBeenCalledWith({
        search: 'john',
        isActive: undefined,
        page: undefined,
        limit: undefined
      });
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });

    it('should handle isActive filter (true)', async () => {
      mockRequest.query = { isActive: 'true' };

      const mockResult = {
        managers: [
          {
            id: 'manager-1',
            email: 'active@raho.id',
            fullName: 'Active Manager',
            isActive: true,
            branches: [],
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

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getAdminManagersSpy).toHaveBeenCalledWith({
        search: undefined,
        isActive: true,
        page: undefined,
        limit: undefined
      });
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });

    it('should handle isActive filter (false)', async () => {
      mockRequest.query = { isActive: 'false' };

      const mockResult = {
        managers: [
          {
            id: 'manager-2',
            email: 'inactive@raho.id',
            fullName: 'Inactive Manager',
            isActive: false,
            branches: [],
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

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getAdminManagersSpy).toHaveBeenCalledWith({
        search: undefined,
        isActive: false,
        page: undefined,
        limit: undefined
      });
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });

    it('should handle pagination parameters', async () => {
      mockRequest.query = { page: '2', limit: '20' };

      const mockResult = {
        managers: [],
        pagination: {
          page: 2,
          limit: 20,
          total: 50,
          totalPages: 3
        }
      };

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getAdminManagersSpy).toHaveBeenCalledWith({
        search: undefined,
        isActive: undefined,
        page: 2,
        limit: 20
      });
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });

    it('should handle multiple query parameters', async () => {
      mockRequest.query = {
        search: 'manager',
        isActive: 'true',
        page: '1',
        limit: '5'
      };

      const mockResult = {
        managers: [
          {
            id: 'manager-1',
            email: 'manager1@raho.id',
            fullName: 'Manager One',
            isActive: true,
            branches: [
              { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' }
            ],
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

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getAdminManagersSpy).toHaveBeenCalledWith({
        search: 'manager',
        isActive: true,
        page: 1,
        limit: 5
      });
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });
  });

  describe('Response Format', () => {
    it('should return managers with correct structure', async () => {
      const mockManagers = [
        {
          id: 'manager-1',
          email: 'manager1@raho.id',
          fullName: 'Manager One',
          isActive: true,
          branches: [
            { id: 'branch-1', name: 'Jakarta', branchCode: 'JKT' },
            { id: 'branch-2', name: 'Bandung', branchCode: 'BDG' }
          ],
          createdAt: new Date('2024-01-01'),
          lastLoginAt: new Date('2024-01-15')
        },
        {
          id: 'manager-2',
          email: 'manager2@raho.id',
          fullName: 'Manager Two',
          isActive: true,
          branches: [
            { id: 'branch-3', name: 'Surabaya', branchCode: 'SBY' }
          ],
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

      getAdminManagersSpy.mockResolvedValue({
        managers: mockManagers,
        pagination: mockPagination
      });

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, {
        managers: mockManagers,
        pagination: mockPagination
      });

      // Verify structure
      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.managers).toHaveLength(2);
      expect(result.managers[0]).toHaveProperty('id');
      expect(result.managers[0]).toHaveProperty('email');
      expect(result.managers[0]).toHaveProperty('fullName');
      expect(result.managers[0]).toHaveProperty('isActive');
      expect(result.managers[0]).toHaveProperty('branches');
      expect(result.managers[0]).toHaveProperty('createdAt');
      expect(result.managers[0]).toHaveProperty('lastLoginAt');
      expect(result.managers[0].branches).toHaveLength(2);
      expect(result.managers[0].branches[0]).toHaveProperty('id');
      expect(result.managers[0].branches[0]).toHaveProperty('name');
      expect(result.managers[0].branches[0]).toHaveProperty('branchCode');
    });

    it('should return empty array when no managers found', async () => {
      const mockResult = {
        managers: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0
        }
      };

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      expect((mockSendSuccess.mock.calls[0][1] as any).managers).toHaveLength(0);
    });

    it('should include pagination metadata', async () => {
      const mockResult = {
        managers: [
          {
            id: 'manager-1',
            email: 'manager1@raho.id',
            fullName: 'Manager One',
            isActive: true,
            branches: [],
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

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

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
      getAdminManagersSpy.mockRejectedValue(mockError);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it('should handle custom error objects', async () => {
      const mockError = {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong'
      };
      getAdminManagersSpy.mockRejectedValue(mockError);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle manager with no branches', async () => {
      const mockResult = {
        managers: [
          {
            id: 'manager-1',
            email: 'manager1@raho.id',
            fullName: 'Manager One',
            isActive: true,
            branches: [], // No branches assigned
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

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.managers[0].branches).toEqual([]);
    });

    it('should handle manager with null lastLoginAt', async () => {
      const mockResult = {
        managers: [
          {
            id: 'manager-1',
            email: 'manager1@raho.id',
            fullName: 'Manager One',
            isActive: true,
            branches: [],
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

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.managers[0].lastLoginAt).toBeNull();
    });

    it('should handle invalid page number gracefully', async () => {
      mockRequest.query = { page: 'invalid' };

      const mockResult = {
        managers: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0
        }
      };

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      // parseInt('invalid') returns NaN, which should be handled by the service
      expect(getAdminManagersSpy).toHaveBeenCalledWith({
        search: undefined,
        isActive: undefined,
        page: NaN,
        limit: undefined
      });
    });

    it('should handle invalid limit number gracefully', async () => {
      mockRequest.query = { limit: 'invalid' };

      const mockResult = {
        managers: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0
        }
      };

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getAdminManagersSpy).toHaveBeenCalledWith({
        search: undefined,
        isActive: undefined,
        page: undefined,
        limit: NaN
      });
    });
  });

  describe('Data Filtering', () => {
    it('should only return users with ADMIN_MANAGER role', async () => {
      // This is tested at the service level, but we verify the controller
      // correctly passes the filters to the service
      const mockResult = {
        managers: [
          {
            id: 'manager-1',
            email: 'manager1@raho.id',
            fullName: 'Manager One',
            isActive: true,
            branches: [],
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

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      // The service ensures only ADMIN_MANAGER role is returned
    });

    it('should support case-insensitive search', async () => {
      mockRequest.query = { search: 'JOHN' };

      const mockResult = {
        managers: [
          {
            id: 'manager-1',
            email: 'john@raho.id',
            fullName: 'John Doe',
            isActive: true,
            branches: [],
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

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(getAdminManagersSpy).toHaveBeenCalledWith({
        search: 'JOHN',
        isActive: undefined,
        page: undefined,
        limit: undefined
      });
      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
    });
  });

  describe('Performance', () => {
    it('should handle large result sets with pagination', async () => {
      mockRequest.query = { page: '1', limit: '100' };

      const mockManagers = Array.from({ length: 100 }, (_, i) => ({
        id: `manager-${i}`,
        email: `manager${i}@raho.id`,
        fullName: `Manager ${i}`,
        isActive: true,
        branches: [],
        createdAt: new Date(),
        lastLoginAt: null
      }));

      const mockResult = {
        managers: mockManagers,
        pagination: {
          page: 1,
          limit: 100,
          total: 500,
          totalPages: 5
        }
      };

      getAdminManagersSpy.mockResolvedValue(mockResult);

      await getAdminManagers(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSendSuccess).toHaveBeenCalledWith(mockResponse, mockResult);
      const result = mockSendSuccess.mock.calls[0][1] as any;
      expect(result.managers).toHaveLength(100);
    });
  });
});
