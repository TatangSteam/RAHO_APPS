'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Activity, Package, AlertTriangle, ClipboardList, BarChart3 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Role } from '@/types/auth';
import { KPICard } from '@/components/ui/KPICard';
import {
  getStaffDashboardApi,
  getAdminCabangDashboardApi,
  getAdminManagerDashboardApi,
  getSuperAdminDashboardApi,
} from '@/lib/dashboardApi';
import type {
  StaffDashboardData,
  AdminCabangDashboardData,
  AdminManagerDashboardData,
  SuperAdminDashboardData,
} from '@/lib/dashboardApi';
import { getApiErrorMessage } from '@/lib/api';

// ── Dashboard Components ───────────────────────────────────────

function StaffDashboard({ data }: { data: StaffDashboardData }) {
  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
          Ringkasan aktivitas klinik hari ini
        </p>
      </div>

      <div className="dashboard-grid">
        <KPICard
          label="Sesi Hari Ini"
          value={data.sesiHariIni}
          icon={<Activity size={18} />}
          color="green"
        />
        <KPICard
          label="Member Aktif"
          value={data.memberAktif}
          icon={<Users size={18} />}
          color="blue"
        />
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
          Aksi Cepat
        </h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => window.location.href = '/sessions'}>
            <Activity size={16} />
            Buat Sesi Baru
          </button>
          <button className="btn btn-secondary" onClick={() => window.location.href = '/members'}>
            <Users size={16} />
            Cari Member
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminCabangDashboard({ data }: { data: AdminCabangDashboardData }) {
  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          Dashboard Cabang
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
          Ringkasan performa cabang Anda
        </p>
      </div>

      <div className="dashboard-grid">
        <KPICard
          label="Member Aktif"
          value={data.memberAktif}
          icon={<Users size={18} />}
          color="blue"
        />
        <KPICard
          label="Sesi Hari Ini"
          value={data.sesiHariIni}
          icon={<Activity size={18} />}
          color="green"
        />
        <KPICard
          label="Sesi Bulan Ini"
          value={data.sesiBulanIni}
          icon={<BarChart3 size={18} />}
          color="purple"
        />
        <KPICard
          label="Stok Kritis"
          value={data.stokKritis}
          icon={<AlertTriangle size={18} />}
          color={data.stokKritis > 0 ? 'red' : 'green'}
          badge={data.stokKritis > 0 ? 'Perlu Aksi' : 'Aman'}
        />
        <KPICard
          label="Paket Pending Verifikasi"
          value={data.paketPendingVerifikasi}
          icon={<Package size={18} />}
          color={data.paketPendingVerifikasi > 0 ? 'amber' : 'green'}
        />
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
          Aksi Cepat
        </h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => window.location.href = '/procurement/requests'}>
            <ClipboardList size={16} />
            Request Stok
          </button>
          <button className="btn btn-secondary" onClick={() => window.location.href = '/admin/users'}>
            <Users size={16} />
            Kelola User
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminManagerDashboard({ data }: { data: AdminManagerDashboardData }) {
  const maxSesi = Math.max(...data.chartSesiPerCabang.map(c => c.sesiBulanIni), 1);

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          Dashboard Manager
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
          Ringkasan performa semua cabang
        </p>
      </div>

      <div className="dashboard-grid">
        <KPICard
          label="Total Member Aktif"
          value={data.totalMemberAktif}
          icon={<Users size={18} />}
          color="blue"
        />
        <KPICard
          label="Total Sesi Bulan Ini"
          value={data.totalSesiBulanIni}
          icon={<Activity size={18} />}
          color="green"
        />
        <KPICard
          label="Total Paket Aktif"
          value={data.totalPaketAktif}
          icon={<Package size={18} />}
          color="purple"
        />
      </div>

      {/* Chart Sesi Per Cabang */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
          Sesi Bulan Ini per Cabang
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.chartSesiPerCabang.map((branch) => (
            <div key={branch.branchCode} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 80, flexShrink: 0 }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}>
                  {branch.branchCode}
                </span>
              </div>
              <div style={{ flex: 1, height: 24, background: 'rgba(30, 41, 59, 0.6)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(branch.sesiBulanIni / maxSesi) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 8,
                    minWidth: branch.sesiBulanIni > 0 ? 40 : 0,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>
                    {branch.sesiBulanIni}
                  </span>
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>
                {branch.branchName}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuperAdminDashboard({ data }: { data: SuperAdminDashboardData }) {
  const maxSesi = Math.max(...data.chartSesiPerCabang.map(c => c.sesiBulanIni), 1);

  const actionLabels: Record<string, string> = {
    CREATE: 'Buat',
    UPDATE: 'Ubah',
    DELETE: 'Hapus',
    VERIFY: 'Verifikasi',
  };

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          Dashboard Super Admin
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
          Ringkasan sistem dan aktivitas terbaru
        </p>
      </div>

      <div className="dashboard-grid">
        <KPICard
          label="Total Member Aktif"
          value={data.totalMemberAktif}
          icon={<Users size={18} />}
          color="blue"
        />
        <KPICard
          label="Total Sesi Bulan Ini"
          value={data.totalSesiBulanIni}
          icon={<Activity size={18} />}
          color="green"
        />
        <KPICard
          label="Total Paket Aktif"
          value={data.totalPaketAktif}
          icon={<Package size={18} />}
          color="purple"
        />
        <KPICard
          label="Stock Request Pending"
          value={data.stockRequestPending}
          icon={<ClipboardList size={18} />}
          color={data.stockRequestPending > 0 ? 'amber' : 'green'}
          badge={data.stockRequestPending > 0 ? 'Perlu Review' : 'Aman'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
        {/* Chart Sesi Per Cabang */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
            Sesi Bulan Ini per Cabang
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.chartSesiPerCabang.map((branch) => (
              <div key={branch.branchCode} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', width: 40 }}>
                  {branch.branchCode}
                </span>
                <div style={{ flex: 1, height: 20, background: 'rgba(30, 41, 59, 0.6)', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(branch.sesiBulanIni / maxSesi) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 6,
                      minWidth: branch.sesiBulanIni > 0 ? 32 : 0,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>
                      {branch.sesiBulanIni}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Log Terbaru */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
            Aktivitas Terbaru
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.auditLogTerbaru.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Belum ada aktivitas.</p>
            ) : (
              data.auditLogTerbaru.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    background: 'rgba(30, 41, 59, 0.4)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    background: log.action === 'DELETE' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    color: log.action === 'DELETE' ? '#f87171' : '#60a5fa',
                    borderRadius: 4,
                  }}>
                    {actionLabels[log.action] || log.action}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.resource}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {log.userName}
                    </p>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(log.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard Page ────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [staffData, setStaffData] = useState<StaffDashboardData | null>(null);
  const [adminCabangData, setAdminCabangData] = useState<AdminCabangDashboardData | null>(null);
  const [managerData, setManagerData] = useState<AdminManagerDashboardData | null>(null);
  const [superAdminData, setSuperAdminData] = useState<SuperAdminDashboardData | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const role = user.role as Role;

    async function fetchDashboard() {
      setLoading(true);
      setError(null);

      try {
        if (role === 'ADMIN_LAYANAN' || role === 'DOCTOR' || role === 'NURSE') {
          const data = await getStaffDashboardApi();
          setStaffData(data);
        } else if (role === 'ADMIN_CABANG') {
          const data = await getAdminCabangDashboardApi();
          setAdminCabangData(data);
        } else if (role === 'ADMIN_MANAGER') {
          const data = await getAdminManagerDashboardApi();
          setManagerData(data);
        } else if (role === 'SUPER_ADMIN') {
          const data = await getSuperAdminDashboardApi();
          setSuperAdminData(data);
        }
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [user, router]);

  if (!user) return null;

  const role = user.role as Role;

  // Loading state
  if (loading) {
    return (
      <div className="fade-in">
        <div style={{ marginBottom: 24 }}>
          <div className="skeleton" style={{ width: 200, height: 28, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 280, height: 16, borderRadius: 4, marginTop: 8 }} />
        </div>
        <div className="dashboard-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ width: 100, height: 12, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 60, height: 32, borderRadius: 6, marginTop: 12 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fade-in">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#f87171', marginBottom: 16 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  // Render based on role
  if ((role === 'ADMIN_LAYANAN' || role === 'DOCTOR' || role === 'NURSE') && staffData) {
    return <StaffDashboard data={staffData} />;
  }

  if (role === 'ADMIN_CABANG' && adminCabangData) {
    return <AdminCabangDashboard data={adminCabangData} />;
  }

  if (role === 'ADMIN_MANAGER' && managerData) {
    return <AdminManagerDashboard data={managerData} />;
  }

  if (role === 'SUPER_ADMIN' && superAdminData) {
    return <SuperAdminDashboard data={superAdminData} />;
  }

  return null;
}