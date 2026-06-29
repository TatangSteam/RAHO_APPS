import { api } from '../api';

export interface MaterialUsageHistoryItem {
  id: string;
  date: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  productName: string;
  productCategory: MaterialCategory;
  quantity: number;
  unit: string;
  staffName: string;
  staffGroup: string;
  staffRole: string;
  sessionCode: string;
  notes: string | null;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  branchName: string;
  branchCode: string;
  staffBranches: {
    branchId: string;
    branchName: string;
    branchCode: string;
  }[];
}

export interface BranchGroup {
  id: string;
  name: string;
  branchCode: string;
  type: string;
}

export type MaterialCategory = 'MEDICINE' | 'DEVICE' | 'CONSUMABLE';

export interface MaterialUsageHistoryFilters {
  branchId?: string;
  staffId?: string;
  staffGroupId?: string;
  startDate?: string;
  endDate?: string;
  productName?: string;
  category?: MaterialCategory;
}

export const materialUsageHistoryApi = {
  /**
   * Get material usage history with filters
   */
  getHistory: async (
    filters?: MaterialUsageHistoryFilters
  ): Promise<MaterialUsageHistoryItem[]> => {
    const params = new URLSearchParams();
    
    if (filters?.branchId) params.append('branchId', filters.branchId);
    if (filters?.staffId) params.append('staffId', filters.staffId);
    if (filters?.staffGroupId) params.append('staffGroupId', filters.staffGroupId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.productName) params.append('productName', filters.productName);
    if (filters?.category) params.append('category', filters.category);

    const response = await api.get(
      `/inventory/material-usage-history?${params.toString()}`
    );
    return response.data.data;
  },

  /**
   * Get staff list for filter dropdown
   */
  getStaffList: async (branchId?: string): Promise<StaffMember[]> => {
    const params = new URLSearchParams();
    if (branchId) params.append('branchId', branchId);

    const response = await api.get(
      `/inventory/material-usage-history/staff?${params.toString()}`
    );
    return response.data.data;
  },

  /**
   * Get branch groups for filter dropdown
   */
  getBranchGroups: async (): Promise<BranchGroup[]> => {
    const response = await api.get('/inventory/material-usage-history/branch-groups');
    return response.data.data;
  },
};
