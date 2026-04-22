'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import styles from './page.module.css';

interface SystemStats {
  totalBranches: number;
  activeBranches: number;
  totalUsers: number;
  activeUsers: number;
  totalMembers: number;
  activeMembers: number;
  totalPackages: number;
  activePackages: number;
  totalSessions: number;
  completedSessions: number;
  totalRevenue: number;
  monthlyRevenue: number;
}

interface RecentActivity {
  id: string;
  type: 'USER_CREATED' | 'MEMBER_REGISTERED' | 'PACKAGE_ASSIGNED' | 'SESSION_COMPLETED' | 'BRANCH_CREATED';
  description: string;
  timestamp: string;
  user: string;
  branch?: string;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
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
    loadRecentActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user, accessToken]);

  const loadSystemStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/branches/system/stats`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

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

  const loadRecentActivities = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/branches/system/activities?limit=10`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) throw new Error('Gagal memuat aktivitas');

      const result = await response.json();
      setActivities(result.data || []);
    } catch (error: any) {
      console.error('Error loading activities:', error);
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
          <h1>🔐 Super Admin Dashboard</h1>
          <p className={styles.subtitle}>Overview sistem RAHO secara keseluruhan</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <button
          className={styles.actionCard}
          onClick={() => router.push('/admin/branches')}
        >
          <div className={styles.actionIcon}>🏢</div>
          <div className={styles.actionContent}>
            <h3>Kelola Cabang</h3>
            <p>Manajemen semua cabang</p>
          </div>
        </button>

        <button
          className={styles.actionCard}
          onClick={() => router.push('/admin/users')}
        >
          <div className={styles.actionIcon}>👥</div>
          <div className={styles.actionContent}>
            <h3>Kelola User</h3>
            <p>Manajemen staff & admin</p>
          </div>
        </button>

        <button
          className={styles.actionCard}
          onClick={() => router.push('/members')}
        >
          <div className={styles.actionIcon}>🧑‍⚕️</div>
          <div className={styles.actionContent}>
            <h3>Kelola Member</h3>
            <p>Semua member sistem</p>
          </div>
        </button>

        <button
          className={styles.actionCard}
          onClick={() => router.push('/admin/package-pricing')}
        >
          <div className={styles.actionIcon}>💰</div>
          <div className={styles.actionContent}>
            <h3>Harga Paket</h3>
            <p>Konfigurasi pricing</p>
          </div>
        </button>
      </div>

      {/* System Stats */}
      {stats && (
        <>
          <div className={styles.sectionHeader}>
            <h2>📊 Statistik Sistem</h2>
          </div>

          <div className={styles.statsGrid}>
            {/* Branches */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon}>🏢</span>
                <span className={styles.statLabel}>Cabang</span>
              </div>
              <div className={styles.statValue}>{stats.activeBranches}</div>
              <div className={styles.statSubtext}>
                dari {stats.totalBranches} total cabang
              </div>
            </div>

            {/* Users */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon}>👥</span>
                <span className={styles.statLabel}>Staff Aktif</span>
              </div>
              <div className={styles.statValue}>{stats.activeUsers}</div>
              <div className={styles.statSubtext}>
                dari {stats.totalUsers} total user
              </div>
            </div>

            {/* Members */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon}>🧑‍⚕️</span>
                <span className={styles.statLabel}>Member Aktif</span>
              </div>
              <div className={styles.statValue}>{stats.activeMembers}</div>
              <div className={styles.statSubtext}>
                dari {stats.totalMembers} total member
              </div>
            </div>

            {/* Packages */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon}>📦</span>
                <span className={styles.statLabel}>Paket Aktif</span>
              </div>
              <div className={styles.statValue}>{stats.activePackages}</div>
              <div className={styles.statSubtext}>
                dari {stats.totalPackages} total paket
              </div>
            </div>

            {/* Sessions */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon}>💉</span>
                <span className={styles.statLabel}>Sesi Selesai</span>
              </div>
              <div className={styles.statValue}>{stats.completedSessions}</div>
              <div className={styles.statSubtext}>
                dari {stats.totalSessions} total sesi
              </div>
            </div>

            {/* Monthly Revenue */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon}>💰</span>
                <span className={styles.statLabel}>Revenue Bulan Ini</span>
              </div>
              <div className={styles.statValue}>
                {formatCurrency(stats.monthlyRevenue)}
              </div>
              <div className={styles.statSubtext}>
                Total: {formatCurrency(stats.totalRevenue)}
              </div>
            </div>
          </div>
        </>
      )}

      {/* System Management */}
      <div className={styles.sectionHeader}>
        <h2>⚙️ Manajemen Sistem</h2>
      </div>

      <div className={styles.managementGrid}>
        <div className={styles.managementCard}>
          <div className={styles.managementIcon}>🔐</div>
          <h3>Audit Log</h3>
          <p>Lihat semua aktivitas sistem</p>
          <button
            className={styles.managementBtn}
            onClick={() => router.push('/admin/audit')}
          >
            Lihat Log
          </button>
        </div>

        <div className={styles.managementCard}>
          <div className={styles.managementIcon}>📊</div>
          <h3>Laporan</h3>
          <p>Generate laporan sistem</p>
          <button
            className={styles.managementBtn}
            onClick={() => showToast.success('Fitur dalam pengembangan')}
          >
            Generate
          </button>
        </div>

        <div className={styles.managementCard}>
          <div className={styles.managementIcon}>⚙️</div>
          <h3>Konfigurasi</h3>
          <p>Pengaturan sistem global</p>
          <button
            className={styles.managementBtn}
            onClick={() => showToast.success('Fitur dalam pengembangan')}
          >
            Kelola
          </button>
        </div>

        <div className={styles.managementCard}>
          <div className={styles.managementIcon}>🔔</div>
          <h3>Notifikasi</h3>
          <p>Broadcast ke semua user</p>
          <button
            className={styles.managementBtn}
            onClick={() => showToast.success('Fitur dalam pengembangan')}
          >
            Kirim
          </button>
        </div>
      </div>

      {/* System Health */}
      <div className={styles.sectionHeader}>
        <h2>🏥 Status Sistem</h2>
      </div>

      <div className={styles.healthGrid}>
        <div className={styles.healthCard}>
          <div className={styles.healthStatus}>
            <span className={styles.healthDot} style={{ background: '#4ade80' }}></span>
            <span className={styles.healthLabel}>Database</span>
          </div>
          <div className={styles.healthValue}>Operational</div>
        </div>

        <div className={styles.healthCard}>
          <div className={styles.healthStatus}>
            <span className={styles.healthDot} style={{ background: '#4ade80' }}></span>
            <span className={styles.healthLabel}>API Server</span>
          </div>
          <div className={styles.healthValue}>Operational</div>
        </div>

        <div className={styles.healthCard}>
          <div className={styles.healthStatus}>
            <span className={styles.healthDot} style={{ background: '#4ade80' }}></span>
            <span className={styles.healthLabel}>Storage</span>
          </div>
          <div className={styles.healthValue}>Operational</div>
        </div>

        <div className={styles.healthCard}>
          <div className={styles.healthStatus}>
            <span className={styles.healthDot} style={{ background: '#4ade80' }}></span>
            <span className={styles.healthLabel}>Authentication</span>
          </div>
          <div className={styles.healthValue}>Operational</div>
        </div>
      </div>
    </div>
  );
}
