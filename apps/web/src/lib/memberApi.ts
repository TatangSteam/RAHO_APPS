import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────

export interface MemberDashboardData {
  voucherSisa: number;
  paketAktif: number;
  sesiTerakhir: {
    sessionCode: string;
    treatmentDate: string;
    infusKe: number;
    pelaksanaan: string;
  } | null;
}

export interface MemberSession {
  id: string;
  sessionCode: string;
  treatmentDate: string;
  infusKe: number;
  pelaksanaan: string;
  isCompleted: boolean;
}

export interface MemberDiagnosis {
  id: string;
  diagnosisCode: string;
  diagnosa: string;
  kategoriDiagnosa: string | null;
  kategoriDiagnosaList?: string[] | null;
  createdAt: string;
  doctorName: string;
}

export interface MemberPackage {
  id: string;
  packageId: string;
  packageCode: string;
  packageType: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  status: string;
  activatedAt: string | null;
  branchId?: string;
  branchName: string;
}

export interface MemberDetail {
  memberId: string;
  memberNo: string;
  voucherCount: number;
  profile?: {
    fullName: string;
    phone?: string;
    avatarUrl?: string;
  };
  registrationBranch?: {
    id: string;
    name: string;
    branchCode: string;
  };
}

// ── API Calls ──────────────────────────────────────────────────

export async function getMemberDashboardApi(): Promise<MemberDashboardData> {
  const { data } = await api.get<{ data: MemberDashboardData }>('/me/dashboard');
  return data.data;
}

export async function getMemberSessionsApi(params?: { page?: number; limit?: number }): Promise<{
  data: MemberSession[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}> {
  const { data } = await api.get<{ data: MemberSession[]; meta: { total: number; page: number; limit: number; totalPages: number } }>('/me/sessions', { params });
  return data;
}

export async function getMemberDiagnosesApi(): Promise<{ data: MemberDiagnosis[] }> {
  const { data } = await api.get<{ data: MemberDiagnosis[] }>('/me/diagnoses');
  return data;
}

export async function getMemberPackagesApi(): Promise<{ data: MemberPackage[] }> {
  const { data } = await api.get<{ data: MemberPackage[] }>('/me/vouchers');
  return data;
}

// ── Staff API for Members ──────────────────────────────────────

export const memberApi = {
  // Get member by ID (for staff)
  getMemberById: async (memberId: string): Promise<MemberDetail> => {
    const { data } = await api.get<{ data: MemberDetail }>(`/members/${memberId}`);
    return data.data;
  },

  // Get member packages (for staff)
  getMemberPackages: async (memberId: string, branchId?: string): Promise<MemberPackage[]> => {
    const { data } = await api.get<{ data: MemberPackage[] }>(`/members/${memberId}/packages`, {
      params: branchId ? { branchId } : undefined,
    });
    return data.data;
  },

  // Get member diagnoses (for staff)
  getMemberDiagnoses: async (memberId: string): Promise<{ data: MemberDiagnosis[] }> => {
    const { data } = await api.get<{ data: MemberDiagnosis[] }>(`/members/${memberId}/diagnoses`);
    return { data: data.data };
  },
};
