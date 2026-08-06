'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { getMultiBranchKPI, getSessionsPerBranch, getAllBranches } from '@/lib/adminApi';
import { showToast } from '@/lib/toast';
import { KPICard } from '@/components/ui/KPICard';
import styles from './page.module.css';

interface MultiKPI {
  totalBranches: number;
  totalActiveMembers: number;
  monthlySessionsCount: number;
  monthlyRevenue: number;
  packagesByType: Record<string, number>;
  criticalStockCount: number;
}

interface SessionPerBranch {
  branchId: string;
  branchName: string;
  branchCode: string;
  sessionCount: number;
}

interface Branch {
  id: string;
  branchCode: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  type: string;
  operatingHours?: string;
  isActive: boolean;
  stats: {
    activeUsers: number;
    totalMembers: number;
    activePackages: number;
  };
  createdAt: string;
}

export default function AdminManagerPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [kpi, setKpi] = useState<MultiKPI | null>(null);
  const [sessionsPerBranch, setSessionsPerBranch] = useState<SessionPerBranch[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'analytics'>('overview');

  useEffect(() => {
    if (user?.role !== 'ADMIN_MANAGER') {
      router.push('/dashboard');
      return;
    }

    loadData();
  }, [user, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [kpiRes, sessionsRes, branchesRes] = await Promise.all([
        getMultiBranchKPI(),
        getSessionsPerBranch(30),
        getAllBranches(),
      ]);

      setKpi(kpiRes.data);
      setSessionsPerBranch(sessionsRes.data || []);
      setBranches(branchesRes.data || []);
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Memuat data...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Dashboard Admin Manager</h1>
        <p>Monitoring dan kelola semua cabang</p>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'branches' ? styles.active : ''}`}
          onClick={() => setActiveTab('branches')}
        >
          🏢 Cabang ({kpi?.totalBranches || 0})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'analytics' ? styles.active : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 Analytics
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && kpi && (
        <div className={styles.kpiGrid}>
          <KPICard
            label="Total Cabang"
            value={kpi.totalBranches}
            icon="🏢"
            color="blue"
          />
          <KPICard
            label="Member Aktif (Semua)"
            value={kpi.totalActiveMembers}
            icon="👥"
            color="green"
          />
          <KPICard
            label="Sesi Bulan Ini"
            value={kpi.monthlySessionsCount}
            icon="📅"
            color="purple"
          />
          <KPICard
            label="Revenue Bulan Ini"
            value={`Rp ${(kpi.monthlyRevenue / 1000000).toFixed(1)}M`}
            icon="💰"
            color="amber"
          />
          <KPICard
            label="Stok Kritis (Semua)"
            value={kpi.criticalStockCount}
            icon="🔴"
            color="red"
          />
        </div>
      )}

      {/* Package Distribution */}
      {activeTab === 'overview' && kpi && Object.keys(kpi.packagesByType).length > 0 && (
        <div className={styles.packageDistribution}>
          <h2>Distribusi Paket Aktif</h2>
          <div className={styles.packageGrid}>
            {Object.entries(kpi.packagesByType).map(([type, count]) => (
              <div key={type} className={styles.packageCard}>
                <div className={styles.packageType}>{type}</div>
                <div className={styles.packageCount}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Branches Tab */}
      {activeTab === 'branches' && (
        <div className={styles.branchesSection}>
          <div className={styles.sectionHeader}>
            <h2>Daftar Cabang</h2>
            <button className={styles.addBtn} onClick={() => router.push('/admin/manager/branches/new')}>
              + Tambah Cabang
            </button>
          </div>

          {branches.length === 0 ? (
            <p className={styles.empty}>Tidak ada cabang</p>
          ) : (
            <div className={styles.branchGrid}>
              {branches.map((branch) => (
                <div key={branch.id} className={styles.branchCard}>
                  <div className={styles.branchHeader}>
                    <h3>{branch.name}</h3>
                    <span className={`${styles.badge} ${branch.isActive ? styles.active : styles.inactive}`}>
                      {branch.isActive ? '✅ Aktif' : '❌ Nonaktif'}
                    </span>
                  </div>
                  <div className={styles.branchInfo}>
                    <p><strong>Kode:</strong> {branch.branchCode}</p>
                    <p><strong>Kota:</strong> {branch.city}</p>
                    <p><strong>Telepon:</strong> {branch.phone}</p>
                    <p><strong>Tipe:</strong> {branch.type}</p>
                  </div>
                  <div className={styles.branchStats}>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>User Aktif</span>
                      <span className={styles.statValue}>{branch.stats.activeUsers}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Member</span>
                      <span className={styles.statValue}>{branch.stats.totalMembers}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Paket Aktif</span>
                      <span className={styles.statValue}>{branch.stats.activePackages}</span>
                    </div>
                  </div>
                  <button
                    className={styles.editBtn}
                    onClick={() => router.push(`/admin/manager/branches/${branch.id}`)}
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className={styles.analyticsSection}>
          <h2>Sesi per Cabang (30 Hari Terakhir)</h2>

          {sessionsPerBranch.length === 0 ? (
            <p className={styles.empty}>Tidak ada data sesi</p>
          ) : (
            <div className={styles.analyticsTable}>
              <table>
                <thead>
                  <tr>
                    <th>Cabang</th>
                    <th>Kode</th>
                    <th>Jumlah Sesi</th>
                    <th>Grafik</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionsPerBranch.map((item) => {
                    const maxSessions = Math.max(...sessionsPerBranch.map(s => s.sessionCount), 1);
                    const percentage = (item.sessionCount / maxSessions) * 100;

                    return (
                      <tr key={item.branchId}>
                        <td>{item.branchName}</td>
                        <td className={styles.code}>{item.branchCode}</td>
                        <td className={styles.count}>{item.sessionCount}</td>
                        <td>
                          <div className={styles.barChart}>
                            <div
                              className={styles.bar}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}