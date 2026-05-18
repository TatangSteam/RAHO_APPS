import { api } from '../api';

// ── Types & Interfaces ─────────────────────────────────────────

export interface BranchAdmin {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  branch: {
    id: string;
    name: string;
    branchCode: string;
  };
  createdAt: string;
  lastLoginAt: string | null;
}

export interface BranchAdminsListParams {
  page?: number;
  limit?: number;
  search?: string;
  branchId?: string;
  status?: 'active' | 'inactive';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ImpersonateBranchAdminRequest {
  targetRole: 'ADMIN_CABANG';
}

export interface ImpersonateBranchAdminResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: 'ADMIN_CABANG';
    branchId: string;
  };
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── API Methods ────────────────────────────────────────────────

export const branchAdminsApi = {
  /**
   * Get list of Branch Admins (Admin Manager only)
   * Only returns branch admins from branches assigned to the Admin Manager
   */
  getBranchAdmins: async (
    params?: BranchAdminsListParams
  ): Promise<{ data: BranchAdmin[]; meta: PaginatedMeta }> => {
    const res = await api.get('/admin/branch-admins', { params });
    return { data: res.data.data.branchAdmins, meta: res.data.data.pagination };
  },

  /**
   * Impersonate a Branch Admin (Admin Manager only)
   * Admin Manager can only impersonate branch admins in their assigned branches
   */
  impersonateBranchAdmin: async (
    userId: string
  ): Promise<ImpersonateBranchAdminResponse> => {
    const res = await api.post(`/admin/impersonate/${userId}`, {
      targetRole: 'ADMIN_CABANG',
    });
    return res.data.data;
  },

  /**
   * Stop impersonation and return to Admin Manager
   */
  stopImpersonation: async (): Promise<{ token: string }> => {
    const res = await api.post('/admin/stop-impersonation');
    return res.data.data;
  },
};
