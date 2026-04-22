import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────

export interface StaffDashboardData {
  sesiHariIni: number;
  memberAktif: number;
}

export interface AdminCabangDashboardData {
  memberAktif: number;
  sesiHariIni: number;
  sesiBulanIni: number;
  stokKritis: number;
  paketPendingVerifikasi: number;
}

export interface ChartSesiPerCabang {
  branchCode: string;
  branchName: string;
  sesiBulanIni: number;
}

export interface AdminManagerDashboardData {
  totalMemberAktif: number;
  totalSesiBulanIni: number;
  totalPaketAktif: number;
  chartSesiPerCabang: ChartSesiPerCabang[];
}

export interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  userName: string;
  createdAt: string;
}

export interface SuperAdminDashboardData extends AdminManagerDashboardData {
  stockRequestPending: number;
  auditLogTerbaru: AuditLogItem[];
}

// ── API Calls ──────────────────────────────────────────────────

export async function getStaffDashboardApi(): Promise<StaffDashboardData> {
  const { data } = await api.get<{ data: StaffDashboardData }>('/dashboard/staff');
  return data.data;
}

export async function getAdminCabangDashboardApi(): Promise<AdminCabangDashboardData> {
  const { data } = await api.get<{ data: AdminCabangDashboardData }>('/dashboard/admin-cabang');
  return data.data;
}

export async function getAdminManagerDashboardApi(): Promise<AdminManagerDashboardData> {
  const { data } = await api.get<{ data: AdminManagerDashboardData }>('/dashboard/admin-manager');
  return data.data;
}

export async function getSuperAdminDashboardApi(): Promise<SuperAdminDashboardData> {
  const { data } = await api.get<{ data: SuperAdminDashboardData }>('/dashboard/super-admin');
  return data.data;
}