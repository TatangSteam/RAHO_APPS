import { api } from '../api';

export interface BranchListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateBranchData {
  branchCode: string;
  name: string;
  type: 'PUSAT' | 'PREMIERE' | 'PARTNERSHIP' | 'KLINIK' | 'HOMECARE';
  address: string;
  city: string;
  phone: string;
  operatingHours?: string;
  isActive?: boolean;
}

export interface UpdateBranchData extends Partial<CreateBranchData> {}

export interface AuditLogParams {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
}

export const branchesApi = {
  /**
   * List branches with pagination
   */
  listBranches: (params?: BranchListParams) => {
    return api.get('/branches', { params });
  },

  /**
   * Get all branches with stats (no pagination)
   */
  getAllBranches: () => {
    return api.get('/branches/all');
  },

  /**
   * Get single branch detail with stats
   */
  getBranch: (branchId: string) => {
    return api.get(`/branches/${branchId}`);
  },

  /**
   * Get branch members
   */
  getBranchMembers: (branchId: string, params?: { page?: number; limit?: number }) => {
    return api.get(`/branches/${branchId}/members`, { params });
  },

  /**
   * Get branch staff
   */
  getBranchStaff: (branchId: string, params?: { page?: number; limit?: number }) => {
    return api.get(`/branches/${branchId}/staff`, { params: { ...params, branchId } });
  },

  /**
   * Get branch managers (Admin Managers assigned to this branch)
   */
  getBranchManagers: (branchId: string) => {
    return api.get(`/branches/${branchId}/managers`);
  },

  /**
   * Get available managers for branch (not yet assigned)
   */
  getAvailableManagers: (branchId: string) => {
    return api.get(`/branches/${branchId}/managers/available`);
  },

  /**
   * Assign manager to branch
   */
  assignManager: (branchId: string, managerId: string) => {
    return api.post(`/branches/${branchId}/managers`, { managerId });
  },

  /**
   * Unassign manager from branch
   */
  unassignManager: (branchId: string, managerId: string) => {
    return api.delete(`/branches/${branchId}/managers/${managerId}`);
  },

  /**
   * Create new branch
   */
  createBranch: (data: CreateBranchData) => {
    return api.post('/branches', data);
  },

  /**
   * Update branch
   */
  updateBranch: (branchId: string, data: UpdateBranchData) => {
    return api.patch(`/branches/${branchId}`, data);
  },

  /**
   * Delete branch (soft delete)
   */
  deleteBranch: (branchId: string) => {
    return api.delete(`/branches/${branchId}`);
  },

  // ============================================================
  // SYSTEM ENDPOINTS (SUPER ADMIN ONLY)
  // ============================================================

  /**
   * Get system statistics
   */
  getSystemStats: () => {
    return api.get('/branches/system/stats');
  },

  /**
   * Get system health
   */
  getSystemHealth: () => {
    return api.get('/branches/system/health');
  },

  /**
   * Get recent activities
   */
  getRecentActivities: (params?: { limit?: number }) => {
    return api.get('/branches/system/activities', { params });
  },

  /**
   * Get branch performance comparison
   */
  getBranchPerformance: (params?: { startDate?: string; endDate?: string }) => {
    return api.get('/branches/system/performance', { params });
  },

  /**
   * Get audit logs
   */
  getAuditLogs: (params?: AuditLogParams) => {
    return api.get('/branches/system/audit-logs', { params });
  },
};
