import { api } from '@/lib/api';

// ============================================================
// ADMIN CABANG - KPI & DASHBOARD
// ============================================================

export async function getBranchKPI() {
  const { data } = await api.get('/admin/branch/kpi');
  return data;
}

export async function getBranchStockStatus() {
  const { data } = await api.get('/admin/branch/stock-status');
  return data;
}

export async function getPendingPackages() {
  const { data } = await api.get('/admin/branch/pending-packages');
  return data;
}

// ============================================================
// ADMIN CABANG - USER MANAGEMENT
// ============================================================

export async function createBranchUser(userData: {
  email: string;
  password: string;
  role: string;
  fullName: string;
  phone?: string;
}) {
  const { data } = await api.post('/admin/branch/users', userData);
  return data;
}

export async function getBranchUsers() {
  const { data } = await api.get('/admin/branch/users');
  return data;
}

export async function deactivateUser(userId: string) {
  const { data } = await api.patch(`/admin/branch/users/${userId}/deactivate`);
  return data;
}

// ============================================================
// ADMIN CABANG - STOCK REQUEST
// ============================================================

export async function createStockRequest(requestData: {
  notes?: string;
  items: Array<{
    masterProductId: string;
    quantity: number;
    notes?: string;
  }>;
}) {
  const { data } = await api.post('/admin/branch/stock-requests', requestData);
  return data;
}

export async function getBranchStockRequests() {
  const { data } = await api.get('/admin/branch/stock-requests');
  return data;
}

// ============================================================
// ADMIN MANAGER - MULTI-BRANCH KPI
// ============================================================

export async function getMultiBranchKPI() {
  const { data } = await api.get('/admin/manager/kpi');
  return data;
}

export async function getSessionsPerBranch(period: number = 30) {
  const { data } = await api.get(`/admin/manager/sessions-per-branch?period=${period}`);
  return data;
}

// ============================================================
// ADMIN MANAGER - BRANCH MANAGEMENT
// ============================================================

export async function createBranch(branchData: {
  branchCode: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  type?: string;
  operatingHours?: string;
}) {
  const { data } = await api.post('/admin/manager/branches', branchData);
  return data;
}

export async function getAllBranches() {
  const { data } = await api.get('/admin/manager/branches');
  return data;
}

export async function updateBranch(branchId: string, updateData: any) {
  const { data } = await api.patch(`/admin/manager/branches/${branchId}`, updateData);
  return data;
}

// ============================================================
// ADMIN MANAGER - PACKAGE PRICING
// ============================================================

export async function getAllPackagePricing() {
  const { data } = await api.get('/admin/manager/package-pricing');
  return data;
}

export async function updatePackagePricing(pricingId: string, updateData: any) {
  const { data } = await api.patch(`/admin/manager/package-pricing/${pricingId}`, updateData);
  return data;
}