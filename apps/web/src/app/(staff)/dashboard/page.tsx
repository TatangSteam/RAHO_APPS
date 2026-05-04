'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { dashboardApi, type DashboardStats } from '@/lib/dashboardApi';
import { formatCurrency, formatNumberWithDots } from '@/lib/formatNumber';
import { showToast } from '@/lib/toast';

import StatCard from '@/components/dashboard/StatCard';
import RevenueChart from '@/components/dashboard/RevenueChart';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import TopPackages from '@/components/dashboard/TopPackages';
import TopStaff from '@/components/dashboard/TopStaff';

import styles from './page.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'month' | 'week' | 'today'>('month');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Redirect SUPER_ADMIN to Super Admin Panel
    if (user.role === 'SUPER_ADMIN') {
      router.push('/admin/super-admin');
      return;
    }
    
    // Only ADMIN_MANAGER, ADMIN_CABANG, and ADMIN_LAYANAN can access this dashboard
    if (!['ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN'].includes(user.role)) {
      showToast.error('Anda tidak memiliki akses ke dashboard ini');
      router.push('/members');
      return;
    }

    loadDashboard();
  }, [user, dateRange]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      if (dateRange === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (dateRange === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else {
        startDate.setDate(1); // First day of month
      }

      // For ADMIN_MANAGER, backend will handle branch selection automatically
      const data = await dashboardApi.getBranchDashboard(
        startDate.toISOString(),
        endDate.toISOString(),
        user?.branchId || undefined
      );
      
      setStats(data);
    } catch (error: any) {
      console.error('Dashboard error:', error);
      showToast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Memuat dashboard...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={styles.error}>
        <p>Gagal memuat data dashboard</p>
        <button onClick={loadDashboard} className="btn btn-primary">
          Coba Lagi
        </button>
      </div>
    );
  }

  const getRangeName = () => {
    if (dateRange === 'today') return 'Hari Ini';
    if (dateRange === 'week') return '7 Hari Terakhir';
    return 'Bulan Ini';
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>📊 Dashboard</h1>
          <p className={styles.subtitle}>
            Ringkasan performa cabang Anda - {getRangeName()}
          </p>
        </div>
        <div className={styles.filters}>
          <button
            className={`${styles.filterBtn} ${dateRange === 'today' ? styles.active : ''}`}
            onClick={() => setDateRange('today')}
          >
            Hari Ini
          </button>
          <button
            className={`${styles.filterBtn} ${dateRange === 'week' ? styles.active : ''}`}
            onClick={() => setDateRange('week')}
          >
            7 Hari
          </button>
          <button
            className={`${styles.filterBtn} ${dateRange === 'month' ? styles.active : ''}`}
            onClick={() => setDateRange('month')}
          >
            Bulan Ini
          </button>
        </div>
      </div>

      {/* Revenue Stats - Full Width */}
      <div className={styles.revenueCard}>
        <StatCard
          icon="💰"
          label="Total Revenue"
          value={formatCurrency(stats.revenue.totalRevenue)}
          trend={{
            value: stats.revenue.revenueGrowth,
            isPositive: stats.revenue.revenueGrowth >= 0,
          }}
          gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        />
      </div>

      {/* Main Stats Grid */}
      <div className={styles.statsGrid}>
        <StatCard
          icon="📦"
          label="Paket Terjual"
          value={formatNumberWithDots(stats.packages.packagesSold)}
          subtitle={`${stats.packages.activePackages} aktif`}
          gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
        />
        <StatCard
          icon="👥"
          label="Member Aktif"
          value={formatNumberWithDots(stats.members.activeMembers)}
          subtitle={`dari ${stats.members.totalMembers} total`}
          gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
        />
        <StatCard
          icon="💳"
          label="Transaksi"
          value={formatNumberWithDots(stats.revenue.transactionCount)}
          subtitle={`Rata-rata ${formatCurrency(stats.revenue.averageTransaction)}`}
          gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
        />
      </div>

      {/* Secondary Stats */}
      <div className={styles.secondaryGrid}>
        <StatCard
          icon="✅"
          label="Sesi Selesai"
          value={formatNumberWithDots(stats.sessions.completedSessions)}
          subtitle={`dari ${stats.sessions.totalSessions} total`}
          gradient="linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
        />
        <StatCard
          icon="⏳"
          label="Pending Payment"
          value={formatNumberWithDots(stats.packages.pendingPayment)}
          gradient="linear-gradient(135deg, #30cfd0 0%, #330867 100%)"
        />
        <StatCard
          icon="👤"
          label="Member Baru"
          value={formatNumberWithDots(stats.members.newMembersThisMonth)}
          subtitle="bulan ini"
          gradient="linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)"
        />
        <StatCard
          icon="👨‍⚕️"
          label="Total Staff"
          value={formatNumberWithDots(stats.staff.totalStaff)}
          gradient="linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)"
        />
      </div>

      {/* Charts and Lists */}
      <div className={styles.chartsGrid}>
        <div className={styles.chartFull}>
          <RevenueChart data={stats.revenue.revenueByDay} />
        </div>
      </div>

      <div className={styles.listsGrid}>
        <RecentTransactions transactions={stats.recentTransactions} />
        <TopPackages packages={stats.topPackages} />
        <TopStaff staff={stats.topStaff} />
      </div>
    </div>
  );
}
