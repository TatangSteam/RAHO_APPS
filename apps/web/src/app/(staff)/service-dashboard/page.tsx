'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import styles from './page.module.css';

interface ServiceStats {
  todaySessions: number;
  pendingMembers: number;
  activePackages: number;
  completedSessions: number;
}

export default function ServiceDashboardPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ServiceStats>({
    todaySessions: 0,
    pendingMembers: 0,
    activePackages: 0,
    completedSessions: 0,
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Only service staff can access
    if (!['ADMIN_LAYANAN', 'DOCTOR', 'NURSE'].includes(user.role)) {
      showToast.error('Anda tidak memiliki akses ke dashboard ini');
      router.push('/members');
      return;
    }

    loadServiceStats();
  }, [user]);

  const loadServiceStats = async () => {
    try {
      setLoading(true);
      
      // Mock data for now - replace with actual API calls
      const mockStats: ServiceStats = {
        todaySessions: 12,
        pendingMembers: 5,
        activePackages: 28,
        completedSessions: 156,
      };
      
      setStats(mockStats);
    } catch (error: any) {
      console.error('Failed to load service stats:', error);
      showToast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}>⏳</div>
        <p>Memuat dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>🏥</div>
        <div>
          <h1>Dashboard Layanan</h1>
          <p>Ringkasan aktivitas layanan hari ini</p>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>📊 SESI HARI INI</h2>
        </div>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIconWrapper}>
              <span className={styles.statIcon}>📅</span>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.todaySessions}</div>
              <div className={styles.statLabel}>sesi terapi</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper}>
              <span className={styles.statIcon}>⏳</span>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.pendingMembers}</div>
              <div className={styles.statLabel}>menunggu verifikasi</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper}>
              <span className={styles.statIcon}>📦</span>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.activePackages}</div>
              <div className={styles.statLabel}>paket berjalan</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper}>
              <span className={styles.statIcon}>✅</span>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.completedSessions}</div>
              <div className={styles.statLabel}>bulan ini</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>🚀 Aksi Cepat</h2>
        </div>
        <div className={styles.actionGrid}>
          <button 
            className={styles.actionCard}
            onClick={() => router.push('/members')}
          >
            <div className={styles.actionIcon}>👥</div>
            <div className={styles.actionContent}>
              <div className={styles.actionTitle}>Kelola Member</div>
              <div className={styles.actionDesc}>Lihat dan kelola data member</div>
            </div>
          </button>
          
          <button 
            className={styles.actionCard}
            onClick={() => router.push('/sessions')}
          >
            <div className={styles.actionIcon}>🏥</div>
            <div className={styles.actionContent}>
              <div className={styles.actionTitle}>Sesi Terapi</div>
              <div className={styles.actionDesc}>Kelola sesi terapi harian</div>
            </div>
          </button>
          
          <button 
            className={styles.actionCard}
            onClick={() => router.push('/inventory')}
          >
            <div className={styles.actionIcon}>📦</div>
            <div className={styles.actionContent}>
              <div className={styles.actionTitle}>Inventori</div>
              <div className={styles.actionDesc}>Cek stok dan material</div>
            </div>
          </button>
          
          <button 
            className={styles.actionCard}
            onClick={() => router.push('/reports')}
          >
            <div className={styles.actionIcon}>📊</div>
            <div className={styles.actionContent}>
              <div className={styles.actionTitle}>Laporan</div>
              <div className={styles.actionDesc}>Lihat laporan aktivitas</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}