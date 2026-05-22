import { api } from './api';

export interface StaffMember {
  userId: string;
  staffCode: string;
  fullName: string;
  role?: string; // Added to identify ADMIN_CABANG in dropdown
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
};
