import { api } from '../api';
import type { AdminManagerAccessScope } from '@/types/auth';

export interface Branch {
  id: string;
  branchCode: string;
  name: string;
  city?: string;
  type: string;
  isActive: boolean;
}

export interface AdminManager {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  adminManagerAccessScope?: AdminManagerAccessScope | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  branches: Branch[];
}

export interface CreateAdminManagerData {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  adminManagerAccessScope?: AdminManagerAccessScope;
  branchIds: string[];
}

export interface UpdateAdminManagerData {
  email?: string;
  password?: string;
  fullName?: string;
  phoneNumber?: string;
  adminManagerAccessScope?: AdminManagerAccessScope;
  isActive?: boolean;
}

export interface AdminManagersResponse {
  data: AdminManager[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ImpersonateResponse {
  token: string;  // Backend returns 'token', not 'accessToken'
  user?: {
    id: string;
    email: string;
    role: string;
    fullName: string;
    branchId?: string | null;
    adminManagerAccessScope?: AdminManagerAccessScope | null;
    branches?: string[];
  };
  targetUser: {
    id: string;
    email: string;
    role: string;
    fullName: string;
    branchId?: string | null;
    adminManagerAccessScope?: AdminManagerAccessScope | null;
  };
  originalUser?: {
    id: string;
    email: string;
    role: string;
  };
}

export const adminManagersApi = {
  /**
   * Get all admin managers
   */
  getAdminManagers: async (params?: {
    search?: string;
    isActive?: boolean;
    status?: 'active' | 'inactive' | string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<AdminManagersResponse> => {
    const response = await api.get('/admin/managers', { params });
    
    // Backend returns { managers, pagination }, transform to { data, meta }
    const backendData = response.data.data || response.data;
    
    return {
      data: backendData.managers || [],
      meta: {
        total: backendData.pagination?.total || 0,
        page: backendData.pagination?.page || 1,
        limit: backendData.pagination?.limit || 10,
        totalPages: backendData.pagination?.totalPages || 0,
      }
    };
  },

  /**
   * Create new admin manager
   */
  createAdminManager: async (data: CreateAdminManagerData): Promise<{ data: AdminManager }> => {
    const response = await api.post('/admin/users/admin-manager', data);
    return response.data;
  },

  /**
   * Update admin manager
   */
  updateAdminManager: async (managerId: string, data: UpdateAdminManagerData): Promise<{ data: AdminManager }> => {
    const response = await api.put(`/admin/managers/${managerId}`, data);
    return response.data;
  },

  /**
   * Delete admin manager
   */
  deleteAdminManager: async (managerId: string): Promise<{ data: { message: string } }> => {
    const response = await api.delete(`/admin/managers/${managerId}`);
    return response.data;
  },

  /**
   * Get available branches for a manager (not yet assigned)
   */
  getAvailableBranchesForManager: async (managerId: string): Promise<{ data: Branch[] }> => {
    const response = await api.get(`/admin/managers/${managerId}/available-branches`);
    return response.data;
  },

  /**
   * Assign branch to manager
   */
  assignBranchToManager: async (managerId: string, branchId: string): Promise<{ data: { message: string; branch: Branch } }> => {
    const response = await api.post(`/admin/managers/${managerId}/branches`, { branchId });
    return response.data;
  },

  /**
   * Unassign branch from manager
   */
  unassignBranchFromManager: async (managerId: string, branchId: string): Promise<{ data: { message: string } }> => {
    const response = await api.delete(`/admin/managers/${managerId}/branches/${branchId}`);
    return response.data;
  },

  /**
   * Start impersonation
   */
  startImpersonation: async (userId: string): Promise<ImpersonateResponse> => {
    const response = await api.post(`/admin/impersonate/${userId}`);
    // Backend returns { success: true, data: { token, targetUser, originalUser } }
    return response.data.data;
  },

  impersonateUser: async (userId: string, targetRole?: string): Promise<ImpersonateResponse> => {
    const response = await api.post(
      `/admin/impersonate/${userId}`,
      targetRole ? { targetRole } : undefined
    );
    return response.data.data;
  },

  /**
   * Stop impersonation
   */
  stopImpersonation: async (): Promise<{ accessToken: string }> => {
    const response = await api.post('/admin/stop-impersonation');
    return response.data.data;
  },

  /**
   * Get all branches (for assignment)
   */
  getBranches: async (): Promise<{ data: Branch[] }> => {
    const response = await api.get('/admin/branches');
    return response.data;
  },
};
