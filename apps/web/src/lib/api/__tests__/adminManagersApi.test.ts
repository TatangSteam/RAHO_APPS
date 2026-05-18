import { adminManagersApi } from '../adminManagersApi';
import { api } from '../../api';

// Mock the api module
jest.mock('../../api');

describe('adminManagersApi', () => {
  describe('impersonateUser', () => {
    it('should call POST /admin/impersonate/:userId with correct parameters', async () => {
      // Arrange
      const userId = 'test-user-id';
      const targetRole = 'ADMIN_MANAGER';
      const mockResponse = {
        data: {
          data: {
            token: 'mock-jwt-token',
            user: {
              id: userId,
              email: 'manager@test.com',
              fullName: 'Test Manager',
              role: 'ADMIN_MANAGER',
              branches: ['branch-1', 'branch-2']
            }
          }
        }
      };

      (api.post as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await adminManagersApi.impersonateUser(userId, targetRole);

      // Assert
      expect(api.post).toHaveBeenCalledWith(
        `/admin/impersonate/${userId}`,
        { targetRole }
      );
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should support ADMIN_CABANG target role', async () => {
      // Arrange
      const userId = 'test-admin-cabang-id';
      const targetRole = 'ADMIN_CABANG';
      const mockResponse = {
        data: {
          data: {
            token: 'mock-jwt-token',
            user: {
              id: userId,
              email: 'admincabang@test.com',
              fullName: 'Test Admin Cabang',
              role: 'ADMIN_CABANG',
              branchId: 'branch-1'
            }
          }
        }
      };

      (api.post as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await adminManagersApi.impersonateUser(userId, targetRole);

      // Assert
      expect(api.post).toHaveBeenCalledWith(
        `/admin/impersonate/${userId}`,
        { targetRole }
      );
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should return properly typed response', async () => {
      // Arrange
      const userId = 'test-user-id';
      const targetRole = 'ADMIN_MANAGER';
      const mockResponse = {
        data: {
          data: {
            token: 'mock-jwt-token',
            user: {
              id: userId,
              email: 'manager@test.com',
              fullName: 'Test Manager',
              role: 'ADMIN_MANAGER',
              branches: ['branch-1']
            }
          }
        }
      };

      (api.post as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await adminManagersApi.impersonateUser(userId, targetRole);

      // Assert
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('email');
      expect(result.user).toHaveProperty('fullName');
      expect(result.user).toHaveProperty('role');
    });
  });

  describe('stopImpersonation', () => {
    it('should call POST /admin/stop-impersonation', async () => {
      // Arrange
      const mockResponse = {
        data: {
          data: {
            token: 'original-jwt-token'
          }
        }
      };

      (api.post as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await adminManagersApi.stopImpersonation();

      // Assert
      expect(api.post).toHaveBeenCalledWith('/admin/stop-impersonation');
      expect(result).toEqual(mockResponse.data.data);
    });
  });
});
