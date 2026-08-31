import { api } from './api';

export interface StaffMember {
  userId: string;
  staffCode: string;
  fullName: string;
  role?: string; // Added to identify ADMIN_CABANG in dropdown
}

// ═══════════════════════════════════════════════════════════════
// STAFF PERFORMANCE TYPES
// ═══════════════════════════════════════════════════════════════

export interface StaffPerformance {
  id: string;
  email: string;
  role: string;
  staffCode: string;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  performance: {
    asDoctor: number;
    asNurse: number;
    asAdminLayanan: number;
    asOperational: number;
    total: number;
    incomplete: number;
  };
  // Optional branch info - included when viewing all branches (Super Admin)
  branch?: {
    id: string;
    branchCode: string;
    name: string;
  };
}

export interface StaffPerformanceSummaryResponse {
  branch: {
    id: string;
    branchCode: string;
    name: string;
  } | null;
  staff: StaffPerformance[];
  total: number;
  page: number;
  limit: number;
  dateRange: {
    startDate: string | null;
    endDate: string | null;
  };
  summary: {
    uniqueSessions: number;
    participations: number;
    asDoctor: number;
    asOperational: number;
    incomplete: number;
  };
}

export interface StaffSessionHistoryItem {
  id: string;
  sessionCode: string;
  infusKe: number;
  pelaksanaan: string;
  treatmentDate: string;
  isCompleted: boolean;
  branch: {
    id: string;
    branchCode: string;
    name: string;
  };
  member: {
    memberNo: string;
    fullName: string;
  };
  package: {
    packageType: string;
    boosterType: string | null;
  };
  positions: string[];
}

export interface StaffSessionHistoryResponse {
  staff: {
    id: string;
    email: string;
    role: string;
    staffCode: string;
    fullName: string;
    phone: string;
    avatarUrl: string | null;
    branch: {
      id: string;
      branchCode: string;
      name: string;
    } | null;
  };
  summary: {
    asDoctor: number;
    asNurse: number;
    asAdminLayanan: number;
    asOperational: number;
    total: number;
    incomplete: number;
  };
  sessions: StaffSessionHistoryItem[];
  total: number;
  page: number;
  limit: number;
  dateRange: {
    startDate: string | null;
    endDate: string | null;
  };
}

export interface StaffPerformanceQuery {
  branchId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface StaffSessionHistoryQuery {
  branchId?: string;
  position?: 'doctor' | 'operational' | 'nurse' | 'adminLayanan' | 'all';
  completion?: 'all' | 'complete' | 'incomplete';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const usersApi = {
  // Get doctors (includes ADMIN_CABANG who can act as doctors)
  getDoctors: async (branchId?: string): Promise<StaffMember[]> => {
    const params = branchId ? { branchId } : {};
    const response = await api.get('/users/staff/DOCTOR', { params });
    return response.data.data || [];
  },

  // Get nurses (includes ADMIN_CABANG who can act as nurses)
  getNurses: async (branchId?: string): Promise<StaffMember[]> => {
    const params = branchId ? { branchId } : {};
    const response = await api.get('/users/staff/NURSE', { params });
    return response.data.data || [];
  },

  // Get admin layanan (includes ADMIN_CABANG who can act as admin layanan)
  getAdminLayanan: async (branchId?: string): Promise<StaffMember[]> => {
    const params = branchId ? { branchId } : {};
    const response = await api.get('/users/staff/ADMIN_LAYANAN', { params });
    return response.data.data || [];
  },

  // ═══════════════════════════════════════════════════════════════
  // STAFF PERFORMANCE APIs
  // ═══════════════════════════════════════════════════════════════

  // Get staff performance summary for a branch
  getStaffPerformanceSummary: async (query: StaffPerformanceQuery = {}): Promise<StaffPerformanceSummaryResponse> => {
    const response = await api.get('/users/performance/summary', { params: query });
    return response.data.data;
  },

  exportStaffPerformance: async (query: StaffPerformanceQuery = {}): Promise<Blob> => {
    const response = await api.get('/users/performance/export', {
      params: query,
      responseType: 'blob',
    });
    return response.data;
  },

  // Get detailed session history for a specific staff member
  getStaffSessionHistory: async (staffId: string, query: StaffSessionHistoryQuery = {}): Promise<StaffSessionHistoryResponse> => {
    const response = await api.get(`/users/performance/${staffId}/history`, { params: query });
    return response.data.data;
  },

  exportStaffPerformanceDetail: async (staffId: string, query: StaffSessionHistoryQuery = {}): Promise<Blob> => {
    const response = await api.get(`/users/performance/${staffId}/history/export`, {
      params: query,
      responseType: 'blob',
    });
    return response.data;
  },
};
