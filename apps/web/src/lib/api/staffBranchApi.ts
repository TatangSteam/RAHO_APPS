/**
 * Staff Branch API Client
 * Handles multi-branch assignment for doctors and nurses
 */

import { api } from '@/lib/api';

export interface Branch {
  id: string;
  branchCode: string;
  name: string;
  city?: string;
  type?: string;
  isActive?: boolean;
}

export interface StaffBranchAssignment {
  id: string;
  userId: string;
  branchId: string;
  branch: Branch;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserBranchesResponse {
  userId: string;
  fullName: string;
  role: string;
  primaryBranch: Branch | null;
  assignedBranches: StaffBranchAssignment[];
}

/**
 * Get all branches assigned to a user
 */
export async function getUserBranches(userId: string): Promise<UserBranchesResponse> {
  const res = await api.get(`/users/${userId}/branches`);
  return res.data.data;
}

/**
 * Assign user to a branch
 */
export async function assignUserToBranch(userId: string, branchId: string): Promise<StaffBranchAssignment> {
  const res = await api.post(`/users/${userId}/branches`, { branchId });
  return res.data.data;
}

/**
 * Remove user from a branch
 */
export async function removeUserFromBranch(userId: string, branchId: string): Promise<void> {
  await api.delete(`/users/${userId}/branches/${branchId}`);
}

/**
 * Get available branches for a user (branches not yet assigned)
 */
export async function getAvailableBranches(userId: string): Promise<Branch[]> {
  const res = await api.get(`/users/${userId}/branches/available`);
  return res.data.data;
}

/**
 * Set a branch as primary for a user
 */
export async function setPrimaryBranch(userId: string, branchId: string): Promise<void> {
  await api.patch(`/users/${userId}/branches/${branchId}/set-primary`);
}
