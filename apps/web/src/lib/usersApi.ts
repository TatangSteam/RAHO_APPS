import { api } from './api';

export interface StaffMember {
  userId: string;
  staffCode: string;
  fullName: string;
}

export const usersApi = {
  // Get doctors
  getDoctors: async (branchId?: string): Promise<StaffMember[]> => {
    const params = branchId ? { branchId } : {};
    const response = await api.get('/users/staff/DOCTOR', { params });
    return response.data.data || [];
  },

  // Get nurses
  getNurses: async (branchId?: string): Promise<StaffMember[]> => {
    const params = branchId ? { branchId } : {};
    const response = await api.get('/users/staff/NURSE', { params });
    return response.data.data || [];
  },

  // Get admin layanan
  getAdminLayanan: async (branchId?: string): Promise<StaffMember[]> => {
    const params = branchId ? { branchId } : {};
    const response = await api.get('/users/staff/ADMIN_LAYANAN', { params });
    return response.data.data || [];
  },
};
