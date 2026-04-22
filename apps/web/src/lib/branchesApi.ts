import { api } from './api';

export interface Branch {
  id: string;
  branchCode: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  type: 'KLINIK' | 'HOMECARE' | 'PREMIERE' | 'PARTNERSHIP';
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

export interface CreateBranchInput {
  branchCode: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  type?: 'KLINIK' | 'HOMECARE' | 'PREMIERE' | 'PARTNERSHIP';
  operatingHours?: string;
}

export interface UpdateBranchInput {
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  type?: 'KLINIK' | 'HOMECARE' | 'PREMIERE' | 'PARTNERSHIP';
  operatingHours?: string;
  isActive?: boolean;
}

// ── Get All Branches with Stats ───────────────────────────────
export async function getAllBranches() {
  const { data } = await api.get('/branches/all');
  return data;
}

// ── Get Single Branch ─────────────────────────────────────────
export async function getBranch(branchId: string) {
  const { data } = await api.get(`/branches/${branchId}`);
  return data;
}

// ── Create Branch ─────────────────────────────────────────────
export async function createBranch(input: CreateBranchInput) {
  const { data } = await api.post('/branches', input);
  return data;
}

// ── Update Branch ─────────────────────────────────────────────
export async function updateBranch(branchId: string, input: UpdateBranchInput) {
  const { data } = await api.patch(`/branches/${branchId}`, input);
  return data;
}

// ── Delete Branch ─────────────────────────────────────────────
export async function deleteBranch(branchId: string) {
  const { data } = await api.delete(`/branches/${branchId}`);
  return data;
}
