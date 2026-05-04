'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import Link from 'next/link';
import styles from './page.module.css';

interface SystemStats {
  totalBranches: number;
  activeBranches: number;
  totalUsers: number;
  activeUsers: number;
  totalMembers: number;
  activeMembers: number;
  totalProducts: number;
  activeProducts: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalSessions: number;
  monthlySessions: number;
  usersByRole: {
    role: string;
    count: number;
  }[];
  recentActivities: {
    id: string;
    action: string;
    userName: string;
    userEmail: string;
    branchName: string | null;
    createdAt: string;
  }[];
}

export default function SuperAdminPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!user || !accessToken) {
      router.push('/login');
      return;
    }

    if (user.role !== 'SUPER_ADMIN') {
      showToast.error('Akses ditolak - Hanya untuk Super Admin');
      router.push('/dashboard');
      return;
    }

    loadSystemStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user, accessToken]);

  const loadSystemStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/system-stats`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Gagal memuat statistik sistem');

      const result = await response.json();
      setStats(result.data);
    } catch (error: any) {
      console.error('Error loading system stats:', error);
      showToast.error(error.message || 'Gagal memuat statistik sistem');
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      SUPER_ADMIN: 'Super Admin',
      ADMIN_MANAGER: 'Admin Manager',
      ADMIN_CABANG: 'Admin Cabang',
      ADMIN_LAYANAN: 'Admin Layanan',
      DOCTOR: 'Dokter',
      NURSE: 'Perawat',
    };
    return roleMap[role] || role;
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>⏳</div>
          <p>Memuat data sistem...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>🛡️ Super Admin Panel</h1>
          <p className={styles.subtitle}>
            Selamat datang, {user?.fullName} - Kontrol penuh sistem RAHO
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
            <div className={styles.statValue}>{stats?.totalUsers || 0}</div>
            <div className={styles.statLabel}>Total Staff</div>
            <div className={styles.statSubtext}>
              {stats?.activeUsers || 0} aktif
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
          <div className={styles.statIcon}>📦</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{stats?.totalProducts || 0}</div>
            <div className={styles.statLabel}>Master Produk</div>
            <div className={styles.statSubtext}>
              {stats?.activeProducts || 0} aktif
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
      </div>

      {/* Management Sections */}
      <div className={styles.sectionsGrid}>
        {/* Master Data Management */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>📋 Master Data</h2>
            <p>Kelola data master sistem</p>
          </div>
          <div className={styles.sectionContent}>
            <Link href="/admin/master-products" className={styles.actionCard}>
              <div className={styles.actionIcon}>📦</div>
              <div className={styles.actionContent}>
                <h3>Master Produk</h3>
                <p>Kelola produk untuk semua cabang</p>
              </div>
              <div className={styles.actionArrow}>→</div>
            </Link>

            <Link href="/branches" className={styles.actionCard}>
              <div className={styles.actionIcon}>🏢</div>
              <div className={styles.actionContent}>
                <h3>Manajemen Cabang</h3>
                <p>Kelola semua cabang RAHO</p>
              </div>
              <div className={styles.actionArrow}>→</div>
            </Link>
          </div>
        </div>

        {/* User Management */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>👥 Manajemen User</h2>
            <p>Kelola akses dan role user</p>
          </div>
          <div className={styles.sectionContent}>
            <Link href="/admin/users" className={styles.actionCard}>
              <div className={styles.actionIcon}>👤</div>
              <div className={styles.actionContent}>
                <h3>Kelola User</h3>
                <p>Tambah, edit, hapus user sistem</p>
              </div>
              <div className={styles.actionArrow}>→</div>
            </Link>

            <div className={styles.userRoleStats}>
              <h4>Distribusi Role</h4>
              {stats?.usersByRole.map((roleData) => (
                <div key={roleData.role} className={styles.roleItem}>
                  <span className={styles.roleName}>
                    {getRoleLabel(roleData.role)}
                  </span>
                  <span className={styles.roleCount}>{roleData.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Monitoring */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>📊 Monitoring Sistem</h2>
            <p>Pantau aktivitas dan performa</p>
          </div>
          <div className={styles.sectionContent}>
            <Link href="/admin/audit-logs" className={styles.actionCard}>
              <div className={styles.actionIcon}>📜</div>
              <div className={styles.actionContent}>
                <h3>Audit Logs</h3>
                <p>Riwayat aktivitas semua user</p>
              </div>
              <div className={styles.actionArrow}>→</div>
            </Link>

            <Link href="/admin/branch-performance" className={styles.actionCard}>
              <div className={styles.actionIcon}>📈</div>
              <div className={styles.actionContent}>
                <h3>Performa Cabang</h3>
                <p>Analisis performa setiap cabang</p>
              </div>
              <div className={styles.actionArrow}>→</div>
            </Link>
          </div>
        </div>

        {/* Recent Activities */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>🕐 Aktivitas Terbaru</h2>
            <p>10 aktivitas terakhir sistem</p>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.activityList}>
              {stats?.recentActivities && stats.recentActivities.length > 0 ? (
                stats.recentActivities.map((activity) => (
                  <div key={activity.id} className={styles.activityItem}>
                    <div className={styles.activityIcon}>
                      {activity.action === 'LOGIN' && '🔓'}
                      {activity.action === 'LOGOUT' && '🔒'}
                      {activity.action === 'CREATE' && '➕'}
                      {activity.action === 'UPDATE' && '✏️'}
                      {activity.action === 'DELETE' && '🗑️'}
                      {activity.action === 'VERIFY' && '✅'}
                    </div>
                    <div className={styles.activityContent}>
                      <div className={styles.activityAction}>
                        {activity.action}
                      </div>
                      <div className={styles.activityUser}>
                        {activity.userName} ({activity.userEmail})
                      </div>
                      {activity.branchName && (
                        <div className={styles.activityBranch}>
                          📍 {activity.branchName}
                        </div>
                      )}
                    </div>
                    <div className={styles.activityTime}>
                      {formatDate(activity.createdAt)}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>
                  Belum ada aktivitas terbaru
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <h2>⚡ Aksi Cepat</h2>
        <div className={styles.quickActionsGrid}>
          <button
            onClick={() => router.push('/admin/master-products')}
            className={styles.quickActionBtn}
          >
            <span className={styles.quickActionIcon}>📦</span>
            <span>Tambah Produk</span>
          </button>

          <button
            onClick={() => router.push('/branches')}
            className={styles.quickActionBtn}
          >
            <span className={styles.quickActionIcon}>🏢</span>
            <span>Tambah Cabang</span>
          </button>

          <button
            onClick={() => router.push('/admin/users')}
            className={styles.quickActionBtn}
          >
            <span className={styles.quickActionIcon}>👤</span>
            <span>Tambah User</span>
          </button>

          <button
            onClick={() => router.push('/admin/audit-logs')}
            className={styles.quickActionBtn}
          >
            <span className={styles.quickActionIcon}>📜</span>
            <span>Lihat Audit Log</span>
          </button>

          <button
            onClick={loadSystemStats}
            className={styles.quickActionBtn}
          >
            <span className={styles.quickActionIcon}>🔄</span>
            <span>Refresh Data</span>
          </button>
        </div>
      </div>
    </div>
  );
}
