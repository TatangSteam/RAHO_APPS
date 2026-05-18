'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import Link from 'next/link';
import { Activity, Users, Building2 } from 'lucide-react';
import { BranchAdminsTab } from '@/components/admin/BranchAdminsTab';
import styles from './page.module.css';

type TabType = 'overview' | 'admin-cabang' | 'branches';

interface AdminManagerStats {
  totalBranches: number;
  activeBranches: number;
  totalMembers: number;
  activeMembers: number;
  totalSessions: number;
  monthlySessions: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalBranchAdmins: number;
  activeBranchAdmins: number;
}

export default function AdminManagerPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [stats, setStats] = useState<AdminManagerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!user || !accessToken) {
      router.push('/login');
      return;
    }

    if (user.role !== 'ADMIN_MANAGER') {
      showToast.error('Akses ditolak - Hanya untuk Admin Manager');
      router.push('/dashboard');
      return;
    }

    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user, accessToken]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/manager-stats`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        // If endpoint doesn't exist yet, use mock data
        setStats({
          totalBranches: 0,
          activeBranches: 0,
          totalMembers: 0,
          activeMembers: 0,
          totalSessions: 0,
          monthlySessions: 0,
          totalRevenue: 0,
          monthlyRevenue: 0,
          totalBranchAdmins: 0,
          activeBranchAdmins: 0,
        });
        return;
      }

      const result = await response.json();
      setStats(result.data);
    } catch (error: any) {
      console.error('Error loading stats:', error);
      // Use mock data on error
      setStats({
        totalBranches: 0,
        activeBranches: 0,
        totalMembers: 0,
        activeMembers: 0,
        totalSessions: 0,
        monthlySessions: 0,
        totalRevenue: 0,
        monthlyRevenue: 0,
        totalBranchAdmins: 0,
        activeBranchAdmins: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>⏳</div>
          <p>Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>📊 Admin Manager Dashboard</h1>
          <p className={styles.subtitle}>
            Selamat datang, {user?.fullName} - Kelola branches dan Admin Cabang Anda
          </p>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🏢</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{stats?.totalBranches || 0}</div>
            <div className={styles.statLabel}>Total Cabang</div>
            <div className={styles.statSubtext}>
              {stats?.activeBranches || 0} aktif
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>👥</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{stats?.totalBranchAdmins || 0}</div>
            <div className={styles.statLabel}>Admin Cabang</div>
            <div className={styles.statSubtext}>
              {stats?.activeBranchAdmins || 0} aktif
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>🧑‍🤝‍🧑</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{stats?.totalMembers || 0}</div>
            <div className={styles.statLabel}>Total Member</div>
            <div className={styles.statSubtext}>
              {stats?.activeMembers || 0} aktif
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>💉</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{stats?.totalSessions || 0}</div>
            <div className={styles.statLabel}>Total Sesi Terapi</div>
            <div className={styles.statSubtext}>
              {stats?.monthlySessions || 0} bulan ini
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>💰</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>
              {formatCurrency(stats?.totalRevenue || 0)}
            </div>
            <div className={styles.statLabel}>Total Pendapatan</div>
            <div className={styles.statSubtext}>
              {formatCurrency(stats?.monthlyRevenue || 0)} bulan ini
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <div className={styles.tabsNav}>
          <button
            className={`${styles.tabButton} ${activeTab === 'overview' ? styles.active : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Activity size={18} />
            <span>Overview</span>
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'admin-cabang' ? styles.active : ''}`}
            onClick={() => setActiveTab('admin-cabang')}
          >
            <Users size={18} />
            <span>Admin Cabang</span>
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'branches' ? styles.active : ''}`}
            onClick={() => setActiveTab('branches')}
          >
            <Building2 size={18} />
            <span>Branches</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {activeTab === 'overview' && (
            <div className={styles.overviewContent}>
              {/* Management Sections */}
              <div className={styles.sectionsGrid}>
                {/* Branch Management */}
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2>🏢 Manajemen Cabang</h2>
                    <p>Kelola branches yang di-assign ke Anda</p>
                  </div>
                  <div className={styles.sectionContent}>
                    <Link href="/branches" className={styles.actionCard}>
                      <div className={styles.actionIcon}>🏢</div>
                      <div className={styles.actionContent}>
                        <h3>Kelola Cabang</h3>
                        <p>Lihat dan kelola semua cabang Anda</p>
                      </div>
                      <div className={styles.actionArrow}>→</div>
                    </Link>

                    <Link href="/members" className={styles.actionCard}>
                      <div className={styles.actionIcon}>👥</div>
                      <div className={styles.actionContent}>
                        <h3>Kelola Member</h3>
                        <p>Lihat dan kelola member di cabang Anda</p>
                      </div>
                      <div className={styles.actionArrow}>→</div>
                    </Link>
                  </div>
                </div>

                {/* Admin Cabang Management */}
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2>👥 Manajemen Admin Cabang</h2>
                    <p>Kelola Admin Cabang di branches Anda</p>
                  </div>
                  <div className={styles.sectionContent}>
                    <button 
                      onClick={() => setActiveTab('admin-cabang')}
                      className={styles.actionCard}
                    >
                      <div className={styles.actionIcon}>👤</div>
                      <div className={styles.actionContent}>
                        <h3>Admin Cabang</h3>
                        <p>Kelola dan impersonate Admin Cabang</p>
                      </div>
                      <div className={styles.actionArrow}>→</div>
                    </button>

                    <Link href="/sessions" className={styles.actionCard}>
                      <div className={styles.actionIcon}>💉</div>
                      <div className={styles.actionContent}>
                        <h3>Sesi Terapi</h3>
                        <p>Monitor sesi terapi di cabang Anda</p>
                      </div>
                      <div className={styles.actionArrow}>→</div>
                    </Link>
                  </div>
                </div>

                {/* Reports & Analytics */}
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2>📊 Laporan & Analisis</h2>
                    <p>Monitor performa cabang Anda</p>
                  </div>
                  <div className={styles.sectionContent}>
                    <Link href="/inventory" className={styles.actionCard}>
                      <div className={styles.actionIcon}>📦</div>
                      <div className={styles.actionContent}>
                        <h3>Inventory</h3>
                        <p>Monitor stok inventory cabang</p>
                      </div>
                      <div className={styles.actionArrow}>→</div>
                    </Link>

                    <Link href="/reports" className={styles.actionCard}>
                      <div className={styles.actionIcon}>📈</div>
                      <div className={styles.actionContent}>
                        <h3>Laporan</h3>
                        <p>Lihat laporan performa cabang</p>
                      </div>
                      <div className={styles.actionArrow}>→</div>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className={styles.quickActions}>
                <h2>⚡ Aksi Cepat</h2>
                <div className={styles.quickActionsGrid}>
                  <button
                    onClick={() => router.push('/branches')}
                    className={styles.quickActionBtn}
                  >
                    <span className={styles.quickActionIcon}>🏢</span>
                    <span>Lihat Cabang</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('admin-cabang')}
                    className={styles.quickActionBtn}
                  >
                    <span className={styles.quickActionIcon}>👤</span>
                    <span>Kelola Admin Cabang</span>
                  </button>

                  <button
                    onClick={() => router.push('/members')}
                    className={styles.quickActionBtn}
                  >
                    <span className={styles.quickActionIcon}>👥</span>
                    <span>Lihat Member</span>
                  </button>

                  <button
                    onClick={() => router.push('/sessions')}
                    className={styles.quickActionBtn}
                  >
                    <span className={styles.quickActionIcon}>💉</span>
                    <span>Lihat Sesi Terapi</span>
                  </button>

                  <button
                    onClick={loadStats}
                    className={styles.quickActionBtn}
                  >
                    <span className={styles.quickActionIcon}>🔄</span>
                    <span>Refresh Data</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admin-cabang' && (
            <BranchAdminsTab />
          )}

          {activeTab === 'branches' && (
            <div className={styles.tabPlaceholder}>
              <h2>Branches</h2>
              <p>Redirecting to Branches page...</p>
              <button
                onClick={() => router.push('/branches')}
                className={styles.redirectBtn}
              >
                Go to Branches
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
