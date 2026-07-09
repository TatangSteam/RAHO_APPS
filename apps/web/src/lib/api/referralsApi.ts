import { api } from '../api';

export interface ReferralCode {
  id: string;
  code: string;
  referrerName: string;
  referrerType: 'SALES' | 'DOKTER' | 'MEMBER';
  branchId: string;
  phone?: string;
  email?: string;
  totalReferrals: number;
  totalIncentiveEarned: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branch: {
    id: string;
    branchCode: string;
    name: string;
  };
  _count?: {
    members: number;
    incentiveRecords: number;
  };
}

export interface IncentiveRecord {
  id: string;
  packageType: string;
  packageName: string;
  packageValue: number;
  isFirstPackage: boolean;
  incentiveType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  incentiveValue: number;
  incentiveAmount: number;
  notes?: string;
  createdAt: string;
  member: {
    id: string;
    memberNo: string;
    user: {
      profile: {
        fullName: string;
      };
    };
  };
  memberPackage: {
    id: string;
    packageCode: string;
  };
}

export interface CreateReferralInput {
  referrerName: string;
  referrerType: 'SALES' | 'DOKTER' | 'MEMBER';
  branchId: string;
  phone?: string | null;
  email?: string | null;
}

export interface UpdateReferralInput {
  referrerName?: string;
  referrerType?: 'SALES' | 'DOKTER' | 'MEMBER';
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
}

export interface ListReferralsParams {
  page?: number;
  limit?: number;
  search?: string;
  branchId?: string;
  referrerType?: 'SALES' | 'DOKTER' | 'MEMBER';
  isActive?: 'true' | 'false';
}

// List referrals
export const listReferrals = (params?: ListReferralsParams) => {
  return api.get('/referrals', { params });
};

// Get active referrals (for dropdown)
export const getActiveReferrals = (branchId?: string) => {
  return api.get('/referrals/active', { params: { branchId } });
};

// Get referral by ID
export const getReferralById = (referralId: string) => {
  return api.get(`/referrals/${referralId}`);
};

// Get referral incentive records
export const getReferralIncentives = (referralId: string, page?: number, limit?: number) => {
  return api.get(`/referrals/${referralId}/incentives`, { params: { page, limit } });
};

// Create referral
export const createReferral = (data: CreateReferralInput) => {
  return api.post('/referrals', data);
};

// Update referral
export const updateReferral = (referralId: string, data: UpdateReferralInput) => {
  return api.patch(`/referrals/${referralId}`, data);
};

// Delete referral (soft delete)
export const deleteReferral = (referralId: string) => {
  return api.delete(`/referrals/${referralId}`);
};

// Export incentives to Excel
export const exportIncentivesExcel = (params?: {
  referralId?: string;
  branchId?: string;
  referrerType?: string;
  startDate?: string;
  endDate?: string;
}) => {
  return api.get('/referrals/export/excel', {
    params,
    responseType: 'blob',
  });
};

// Export incentives to PDF
export const exportIncentivesPDF = (params?: {
  referralId?: string;
  branchId?: string;
  referrerType?: string;
  startDate?: string;
  endDate?: string;
}) => {
  return api.get('/referrals/export/pdf', {
    params,
    responseType: 'blob',
  });
};

// Export summary per referral to Excel
export const exportSummaryExcel = (params?: {
  branchId?: string;
  referrerType?: string;
}) => {
  return api.get('/referrals/export/summary', {
    params,
    responseType: 'blob',
  });
};
