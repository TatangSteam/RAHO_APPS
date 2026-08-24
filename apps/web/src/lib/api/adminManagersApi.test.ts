import { adminManagersApi } from './adminManagersApi';
import { api } from '../api';

// Mock the api module
jest.mock('../api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('adminManagersApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAdminManagers', () => {
    it('should fetch admin managers with default parameters', async () => {
      const mockResponse = {
        data: {
          data: {
            managers: [
              {
                id: '1',
                email: 'manager1@raho.id',
                fullName: 'Manager One',
                isActive: true,
                branches: [
                  { id: 'b1', name: 'Jakarta', branchCode: 'JKT' },
                ],
                createdAt: '2024-01-01T00:00:00Z',
                lastLoginAt: '2024-01-02T00:00:00Z',
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1,
            },
          },
        },
      };

      (api.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adminManagersApi.getAdminManagers();

      expect(api.get).toHaveBeenCalledWith('/admin/managers', { params: undefined });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe('manager1@raho.id');
      expect(result.meta.total).toBe(1);
    });

    it('should support pagination parameters', async () => {
      const mockResponse = {
        data: {
          data: {
            managers: [],
            pagination: {
              page: 2,
              limit: 20,
              total: 50,
              totalPages: 3,
            },
          },
        },
      };

      (api.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adminManagersApi.getAdminManagers({
        page: 2,
        limit: 20,
      });

      expect(api.get).toHaveBeenCalledWith('/admin/managers', {
        params: { page: 2, limit: 20 },
      });
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(20);
    });

    it('should support search parameter', async () => {
      const mockResponse = {
        data: {
          data: {
            managers: [
              {
                id: '1',
                email: 'john@raho.id',
                fullName: 'John Doe',
                isActive: true,
                branches: [],
                createdAt: '2024-01-01T00:00:00Z',
                lastLoginAt: null,
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1,
            },
          },
        },
      };

      (api.get as jest.Mock).mockResolvedValue(mockResponse);

      await adminManagersApi.getAdminManagers({
        search: 'john',
      });

      expect(api.get).toHaveBeenCalledWith('/admin/managers', {
        params: { search: 'john' },
      });
    });

    it('should support status filtering', async () => {
      const mockResponse = {
        data: {
          data: {
            managers: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 0,
            },
          },
        },
      };

      (api.get as jest.Mock).mockResolvedValue(mockResponse);

      await adminManagersApi.getAdminManagers({
        status: 'active',
      });

      expect(api.get).toHaveBeenCalledWith('/admin/managers', {
        params: { status: 'active' },
      });
    });

    it('should support sorting parameters', async () => {
      const mockResponse = {
        data: {
          data: {
            managers: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 0,
            },
          },
        },
      };

      (api.get as jest.Mock).mockResolvedValue(mockResponse);

      await adminManagersApi.getAdminManagers({
        sortBy: 'fullName',
        sortOrder: 'asc',
      });

      expect(api.get).toHaveBeenCalledWith('/admin/managers', {
        params: { sortBy: 'fullName', sortOrder: 'asc' },
      });
    });

    it('should support all parameters combined', async () => {
      const mockResponse = {
        data: {
          data: {
            managers: [],
            pagination: {
              page: 2,
              limit: 20,
              total: 0,
              totalPages: 0,
            },
          },
        },
      };

      (api.get as jest.Mock).mockResolvedValue(mockResponse);

      await adminManagersApi.getAdminManagers({
        page: 2,
        limit: 20,
        search: 'test',
        status: 'active',
        sortBy: 'email',
        sortOrder: 'desc',
      });

      expect(api.get).toHaveBeenCalledWith('/admin/managers', {
        params: {
          page: 2,
          limit: 20,
          search: 'test',
          status: 'active',
          sortBy: 'email',
          sortOrder: 'desc',
        },
      });
    });

    it('should return properly typed response', async () => {
      const mockResponse = {
        data: {
          data: {
            managers: [
              {
                id: '1',
                email: 'manager@raho.id',
                fullName: 'Test Manager',
                isActive: true,
                branches: [
                  { id: 'b1', name: 'Jakarta', branchCode: 'JKT' },
                  { id: 'b2', name: 'Bandung', branchCode: 'BDG' },
                ],
                createdAt: '2024-01-01T00:00:00Z',
                lastLoginAt: '2024-01-02T00:00:00Z',
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1,
            },
          },
        },
      };

      (api.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adminManagersApi.getAdminManagers();

      // Verify data structure
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.data)).toBe(true);
      
      // Verify manager structure
      const manager = result.data[0];
      expect(manager).toHaveProperty('id');
      expect(manager).toHaveProperty('email');
      expect(manager).toHaveProperty('fullName');
      expect(manager).toHaveProperty('isActive');
      expect(manager).toHaveProperty('branches');
      expect(manager).toHaveProperty('createdAt');
      expect(manager).toHaveProperty('lastLoginAt');
      
      // Verify branch structure
      expect(Array.isArray(manager.branches)).toBe(true);
      expect(manager.branches[0]).toHaveProperty('id');
      expect(manager.branches[0]).toHaveProperty('name');
      expect(manager.branches[0]).toHaveProperty('branchCode');
      
      // Verify pagination structure
      expect(result.meta).toHaveProperty('page');
      expect(result.meta).toHaveProperty('limit');
      expect(result.meta).toHaveProperty('total');
      expect(result.meta).toHaveProperty('totalPages');
    });
  });

  describe('convertAdminManagerRole', () => {
    it('posts the selected Finance & Logistics target role', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'manager-1',
            email: 'manager@raho.id',
            role: 'FINANCE_LOGISTICS_CONTROLLER',
            roleTemplate: {
              id: 'template-1',
              code: 'FINANCE_LOGISTICS_CONTROLLER_DEFAULT',
              name: 'Finance & Logistics Controller',
            },
            assignedBranchCount: 3,
            historyPreserved: true,
          },
        },
      };
      (api.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adminManagersApi.convertAdminManagerRole(
        'manager-1',
        'FINANCE_LOGISTICS_CONTROLLER',
      );

      expect(api.post).toHaveBeenCalledWith('/admin/managers/manager-1/convert-role', {
        targetRole: 'FINANCE_LOGISTICS_CONTROLLER',
      });
      expect(result.data.historyPreserved).toBe(true);
      expect(result.data.assignedBranchCount).toBe(3);
    });
  });
});
