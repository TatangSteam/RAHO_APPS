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

export interface Branch {
  id: string;
  branchCode: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  type: 'PUSAT' | 'PREMIER' | 'PARTNERSHIP';
  operatingHours?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  stats?: {
    activeUsers: number;
    totalMembers: number;
    activePackages: number;
  };
}

export interface CreateBranchData {
  name: string;
  type: 'PUSAT' | 'PREMIER' | 'PARTNERSHIP';
  address: string;
  city: string;
  provinceCode?: string;
  regencyCode: string;
  phone: string;
  operatingHours?: string;
  isActive?: boolean;
}

export type UpdateBranchData = Partial<CreateBranchData>;

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
   * Get branch sessions (therapy sessions)
   */
  getBranchSessions: (branchId: string, params?: { page?: number; limit?: number; status?: string }) => {
    return api.get(`/branches/${branchId}/sessions`, { params });
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
   * Delete branch permanently (SUPER_ADMIN only)
   */
  deleteBranch: (branchId: string) => {
    return api.delete(`/branches/${branchId}`);
  },

  /**
   * Force delete branch (SUPER_ADMIN only - deletes ALL data)
   * ⚠️ DANGEROUS: This will permanently delete ALL data related to the branch
   */
  forceDeleteBranch: (branchId: string) => {
    return api.delete(`/branches/${branchId}/force`);
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

  // ============================================================
  // STAFF BRANCH MANAGEMENT (Multi-Branch Assignment)
  // ============================================================

  /**
   * Get medical staff (DOCTOR/NURSE) not assigned to a specific branch
   */
  getMedicalStaffNotInBranch: (excludeBranchId: string) => {
    return api.get('/users/medical-staff', { params: { excludeBranchId } });
  },

  /**
   * Get all medical staff (DOCTOR/NURSE) - shows all regardless of assignment
   */
  getAllMedicalStaff: () => {
    return api.get('/users/medical-staff/all');
  },

  /**
   * Get all branches assigned to a user (DOCTOR/NURSE)
   */
  getUserBranches: (userId: string) => {
    return api.get(`/users/${userId}/branches`);
  },

  /**
   * Get available branches for a user (branches not yet assigned)
   */
  getAvailableBranchesForUser: (userId: string) => {
    return api.get(`/users/${userId}/branches/available`);
  },

  /**
   * Assign a user (DOCTOR/NURSE) to a branch
   */
  assignUserToBranch: (userId: string, branchId: string) => {
    return api.post(`/users/${userId}/branches`, { branchId });
  },

  /**
   * Remove a user (DOCTOR/NURSE) from a branch
   */
  removeUserFromBranch: (userId: string, branchId: string) => {
    return api.delete(`/users/${userId}/branches/${branchId}`);
  },

  /**
   * Set a branch as the primary branch for a user (DOCTOR/NURSE)
   */
  setPrimaryBranch: (userId: string, branchId: string) => {
    return api.patch(`/users/${userId}/branches/${branchId}/set-primary`);
  },
};
