import { api } from '../api';

export interface DoctorBranchAssignment {
  branchId: string;
  branchName: string;
  branchCode: string;
  assignedAt: string;
}

export interface DoctorWithBranches {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  assignedBranches: DoctorBranchAssignment[];
  sessionCount: number;
}

export interface ManagedBranch {
  branchId: string;
  branchName: string;
  branchCode: string;
  address: string | null;
  type: string;
  isPrimary: boolean;
  addedAt: string;
  stats?: {
    doctorCount: number;
    nurseCount: number;
    memberCount: number;
  };
}

export const doctorBranchApi = {
  /**
   * Get doctors by branch (Admin Manager or Super Admin)
   */
  async getDoctorsByBranch(params?: {
    branchId?: string;
    status?: boolean;
    page?: number;
    limit?: number;
  }) {
    const response = await api.get<{
      doctors: DoctorWithBranches[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>('/users/doctors', { params });
    return response.data;
  },

  /**
   * Assign doctor to branch
   */
  async assignDoctorToBranch(doctorId: string, branchId: string) {
    const response = await api.post(`/users/doctors/${doctorId}/branches`, { branchId });
    return response.data;
  },

  /**
   * Remove doctor from branch
   */
  async removeDoctorFromBranch(doctorId: string, branchId: string) {
    const response = await api.delete(`/users/doctors/${doctorId}/branches/${branchId}`);
    return response.data;
  },

  /**
   * Get managed branches for Admin Manager
   */
  async getManagedBranches(includeStats: boolean = false) {
    const response = await api.get<{ success?: boolean; data?: ManagedBranch[] } | ManagedBranch[]>('/admin-manager/branches', {
      params: { includeStats },
    });
    return Array.isArray(response.data) ? response.data : response.data.data || [];
  },

  /**
   * Add branch to Admin Manager's managed list
   */
  async addManagedBranch(branchId: string) {
    const response = await api.post('/admin-manager/branches', { branchId });
    return response.data;
  },

  /**
   * Remove branch from Admin Manager's managed list
   */
  async removeManagedBranch(branchId: string) {
    const response = await api.delete(`/admin-manager/branches/${branchId}`);
    return response.data;
  },

  /**
   * Get all doctors (Super Admin only)
   */
  async getAllDoctors(params?: {
    branchId?: string;
    status?: boolean;
    page?: number;
    limit?: number;
  }) {
    const response = await api.get<{
      doctors: DoctorWithBranches[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>('/admin/doctors', { params });
    return response.data;
  },
};
