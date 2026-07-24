'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, Package, Users, CreditCard, CheckCircle2,
  Clock, UserPlus, UsersRound
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { dashboardApi, type DashboardStats } from '@/lib/dashboardApi';
import {
  getDashboardDateRange,
  getDashboardRangeLabel,
  type DashboardDateRange,
} from '@/lib/dashboardPresentation';
import { formatNumberWithDots } from '@/lib/formatNumber';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';

import { DashboardDateRangeFilter } from '@/components/dashboard/DashboardDateRangeFilter';
import { DashboardErrorState } from '@/components/dashboard/DashboardErrorState';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';
import { DashboardStatCard as StatCard } from '@/components/dashboard/DashboardStatCard';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DashboardDateRange>('month');

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

    // Redirect to role-specific dashboards
    if (user.role === 'DOCTOR') {
      router.push('/dashboard/doctor');
      return;
    }

    if (user.role === 'NURSE') {
      router.push('/dashboard/nurse');
      return;
    }

    if (user.role === 'ADMIN_LAYANAN') {
      router.push('/dashboard/admin-layanan');
      return;
    }

    if (user.role === 'ADMIN_MANAGER') {
      router.push('/dashboard/admin-manager');
      return;
    }

    if (user.role === 'ADMIN_LOGISTIK') {
      router.replace('/inventory/master-data');
      return;
    }
    
    // Only ADMIN_CABANG can access this dashboard
    if (user.role !== 'ADMIN_CABANG') {
      showToast.error('Anda tidak memiliki akses ke dashboard ini');
      router.push('/members');
      return;
    }

    loadDashboard();
  }, [user, dateRange]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDashboardDateRange(dateRange);

      // For ADMIN_MANAGER, backend will handle branch selection automatically
      const data = await dashboardApi.getBranchDashboard(
        startDate.toISOString(),
        endDate.toISOString(),
        user?.branchId || undefined
      );
      
      setStats(data);
    } catch (error) {
      devError('Dashboard error:', error);
      showToast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <DashboardLoadingState text="Memuat dashboard" color="blue" />;
  }

  if (!stats) {
    return (
      <DashboardErrorState
        message="Gagal memuat data dashboard"
        onRetry={loadDashboard}
        actionColor="blue"
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
              <LayoutDashboard className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                Dashboard
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Ringkasan performa cabang - {getDashboardRangeLabel(dateRange)}
              </p>
            </div>
          </div>

          <DashboardDateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard 
            icon={<Package className="h-5 w-5" />}
            label="Paket Terjual"
            value={formatNumberWithDots(stats.packages.packagesSold)}
            subtitle={`${stats.packages.activePackages} aktif`}
            color="pink"
          />
          <StatCard 
            icon={<Users className="h-5 w-5" />}
            label="Member Aktif"
            value={formatNumberWithDots(stats.members.activeMembers)}
            subtitle={`dari ${stats.members.totalMembers} total`}
            color="cyan"
          />
          <StatCard 
            icon={<CreditCard className="h-5 w-5" />}
            label="Aktivitas Pembayaran"
            value={formatNumberWithDots(stats.revenue.transactionCount)}
            subtitle="Jumlah transaksi tercatat"
            color="emerald"
          />
        </div>

        {/* Secondary Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Sesi Selesai"
            value={formatNumberWithDots(stats.sessions.completedSessions)}
            subtitle={`dari ${stats.sessions.totalSessions} total`}
            color="amber"
          />
          <StatCard 
            icon={<Clock className="h-5 w-5" />}
            label="Pending Payment"
            value={formatNumberWithDots(stats.packages.pendingPayment)}
            color="blue"
          />
          <StatCard 
            icon={<UserPlus className="h-5 w-5" />}
            label="Member Baru"
            value={formatNumberWithDots(stats.members.newMembersThisMonth)}
            subtitle="bulan ini"
            color="rose"
          />
          <StatCard 
            icon={<UsersRound className="h-5 w-5" />}
            label="Total Staff"
            value={formatNumberWithDots(stats.staff.totalStaff)}
            color="indigo"
          />
        </div>

      </div>
    </div>
  );
}
