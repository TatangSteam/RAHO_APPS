'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, TrendingUp, TrendingDown, Package, Users, 
  CreditCard, CheckCircle2, Clock, UserPlus, UsersRound,
  Loader2, RefreshCw, AlertCircle, ChevronRight, BarChart3
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { dashboardApi, type DashboardStats } from '@/lib/dashboardApi';
import { formatCurrency, formatNumberWithDots } from '@/lib/formatNumber';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';

import RevenueChart from '@/components/dashboard/RevenueChart';
import RecentTransactions from '@/components/dashboard/RecentTransactions';

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
      devError('Dashboard error:', error);
      showToast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getRangeName = () => {
    if (dateRange === 'today') return 'Hari Ini';
    if (dateRange === 'week') return '7 Hari Terakhir';
    return 'Bulan Ini';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-neutral-500 dark:text-neutral-400">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-neutral-500 mb-4">Gagal memuat data dashboard</p>
            <button 
              onClick={loadDashboard} 
              className="px-4 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
            >
              <RefreshCw className="h-4 w-4 inline mr-2" />
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
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
                Ringkasan performa cabang - {getRangeName()}
              </p>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex gap-2 bg-white dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateRange === 'today'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
              onClick={() => setDateRange('today')}
            >
              Hari Ini
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateRange === 'week'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
              onClick={() => setDateRange('week')}
            >
              7 Hari
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateRange === 'month'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
              onClick={() => setDateRange('month')}
            >
              Bulan Ini
            </button>
          </div>
        </div>

        {/* Revenue Card - Full Width */}
        <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 dark:from-violet-500/20 dark:to-purple-500/10 rounded-2xl border border-violet-500/20 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-violet-500" />
                </div>
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Total Revenue</span>
              </div>
              <div className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-white">
                {formatCurrency(stats.revenue.totalRevenue)}
              </div>
            </div>
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold ${
              stats.revenue.revenueGrowth >= 0 
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                : 'bg-red-500/15 text-red-600 dark:text-red-400'
            }`}>
              {stats.revenue.revenueGrowth >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {Math.abs(stats.revenue.revenueGrowth).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
            label="Transaksi"
            value={formatNumberWithDots(stats.revenue.transactionCount)}
            subtitle={`Rata-rata ${formatCurrency(stats.revenue.averageTransaction)}`}
            color="emerald"
          />
        </div>

        {/* Secondary Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

        {/* Revenue Chart */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 md:p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Grafik Revenue
            </h2>
          </div>
          <RevenueChart data={stats.revenue.revenueByDay} />
        </div>

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Transaksi Terbaru
              </h2>
            </div>
            <Link 
              href="/members"
              className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
            >
              Lihat Semua <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <RecentTransactions transactions={stats.recentTransactions} />
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  icon, 
  label, 
  value, 
  subtitle,
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
  subtitle?: string;
  color: 'blue' | 'emerald' | 'amber' | 'purple' | 'pink' | 'cyan' | 'rose' | 'indigo';
}) {
  const colors = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-500',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-500',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-500',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-500',
    pink: 'from-pink-500/10 to-pink-500/5 border-pink-500/20 text-pink-500',
    cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20 text-cyan-500',
    rose: 'from-rose-500/10 to-rose-500/5 border-rose-500/20 text-rose-500',
    indigo: 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 text-indigo-500',
  };

  const bgColors = {
    blue: 'bg-blue-500/20',
    emerald: 'bg-emerald-500/20',
    amber: 'bg-amber-500/20',
    purple: 'bg-purple-500/20',
    pink: 'bg-pink-500/20',
    cyan: 'bg-cyan-500/20',
    rose: 'bg-rose-500/20',
    indigo: 'bg-indigo-500/20',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-2xl p-5 border relative overflow-hidden`}>
      <div className={`w-10 h-10 ${bgColors[color]} rounded-xl flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-1">{value}</div>
      <div className="text-sm text-neutral-600 dark:text-neutral-400">{label}</div>
      {subtitle && <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>}
    </div>
  );
}
