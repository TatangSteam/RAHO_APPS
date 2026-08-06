'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, Users, TrendingUp, TrendingDown,
  Activity, ChevronRight, MapPin, BarChart3,
  UserCog, Crown, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { formatCurrency, formatNumberWithDots } from '@/lib/formatNumber';
import { dashboardApi, type AdminManagerDashboardData } from '@/lib/dashboardApi';
import {
  getDashboardDateRange,
  getDashboardRangeLabel,
  type DashboardDateRange,
} from '@/lib/dashboardPresentation';
import { DashboardDateRangeFilter } from '@/components/dashboard/DashboardDateRangeFilter';
import { DashboardErrorState } from '@/components/dashboard/DashboardErrorState';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';

export default function AdminManagerDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [data, setData] = useState<AdminManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DashboardDateRange>('month');

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDashboardDateRange(dateRange);

      const result = await dashboardApi.getAdminManagerDashboard(
        startDate.toISOString(),
        endDate.toISOString()
      );
      setData(result);
    } catch (error) {
      assertCaughtError(error);
      devError('Dashboard error:', error);
      showToast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'ADMIN_MANAGER') {
      router.push('/dashboard');
      return;
    }
    void loadDashboard();
  }, [loadDashboard, router, user]);

  if (loading) {
    return <DashboardLoadingState text="Memuat dashboard..." color="violet" />;
  }

  if (!data) {
    return (
      <DashboardErrorState
        message="Gagal memuat data dashboard"
        onRetry={loadDashboard}
        actionColor="violet"
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                Multi-Branch Dashboard
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Overview {data.summary.totalBranches} cabang - {getDashboardRangeLabel(dateRange)}
              </p>
            </div>
          </div>

          <DashboardDateRangeFilter value={dateRange} onChange={setDateRange} accent="violet" />
        </div>

        {/* Summary Cards - Aggregated from all branches */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 dark:from-violet-500/20 dark:to-violet-500/10 rounded-2xl p-5 border border-violet-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
                <Building2 className="h-5 w-5 text-violet-500" />
              </div>
              <span className="text-xs font-medium text-violet-500 bg-violet-500/10 px-2 py-1 rounded-full">
                Dikelola
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-1">
              {data.summary.totalBranches}
            </div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Total Cabang</div>
          </div>

          <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 dark:from-cyan-500/20 dark:to-cyan-500/10 rounded-2xl p-5 border border-cyan-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-cyan-500" />
              </div>
              <span className="text-xs font-medium text-cyan-500 bg-cyan-500/10 px-2 py-1 rounded-full">
                Semua Cabang
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-1">
              {formatNumberWithDots(data.summary.activeMembers)}
            </div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Member Aktif</div>
            <div className="text-xs text-neutral-500 mt-1">dari {formatNumberWithDots(data.summary.totalMembers)} total</div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/10 rounded-2xl p-5 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Activity className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                Semua Cabang
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-1">
              {formatNumberWithDots(data.summary.completedSessions)}
            </div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Sesi Selesai</div>
            <div className="text-xs text-neutral-500 mt-1">dari {formatNumberWithDots(data.summary.totalSessions)} total</div>
          </div>

          <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 dark:from-amber-500/20 dark:to-amber-500/10 rounded-2xl p-5 border border-amber-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <UserCog className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-1">
              {data.summary.totalAdminCabang}
            </div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Admin Cabang</div>
            <Link href="/admin-manager" className="text-xs text-amber-500 hover:text-amber-600 mt-1 inline-flex items-center gap-1">
              Kelola <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Total Revenue Card */}
        <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 dark:from-violet-500/20 dark:to-purple-500/10 rounded-2xl border border-violet-500/20 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-violet-500" />
                </div>
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Total Revenue Semua Cabang</span>
              </div>
              <div className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-white">
                {formatCurrency(data.summary.monthlyRevenue)}
              </div>
              <div className="text-sm text-neutral-500 mt-1">
                Total kumulatif: {formatCurrency(data.summary.totalRevenue)}
              </div>
            </div>
            <div className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold ${
              data.summary.revenueGrowth >= 0 
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                : 'bg-red-500/15 text-red-600 dark:text-red-400'
            }`}>
              {data.summary.revenueGrowth >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {Math.abs(data.summary.revenueGrowth).toFixed(1)}% vs bulan lalu
            </div>
          </div>
        </div>

        {/* Branch Performance Comparison */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-violet-500" />
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Perbandingan Performa Cabang
              </h2>
            </div>
            <Link 
              href="/branches"
              className="text-sm text-violet-500 hover:text-violet-600 flex items-center gap-1"
            >
              Lihat Detail <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Branch Cards */}
          <div className="space-y-4">
            {data.branches.map((branch, index) => (
              <Link
                key={branch.id}
                href={`/branches/${branch.id}`}
                className="block p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors border border-transparent hover:border-violet-500/20"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Branch Info */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        branch.type === 'PUSAT' 
                          ? 'bg-gradient-to-br from-amber-500 to-orange-500' 
                          : 'bg-gradient-to-br from-violet-500 to-purple-500'
                      }`}>
                        <Building2 className="h-7 w-7 text-white" />
                      </div>
                      {index === 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                          <Crown className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {branch.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          branch.type === 'PUSAT' 
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' 
                            : 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
                        }`}>
                          {branch.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-neutral-500 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {branch.city || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Growth Indicator */}
                  <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold ${
                    branch.growth >= 0 
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-red-500/15 text-red-600 dark:text-red-400'
                  }`}>
                    {branch.growth >= 0 ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                    {Math.abs(branch.growth).toFixed(1)}%
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                  <div>
                    <div className="text-lg font-bold text-neutral-900 dark:text-white">
                      {branch.stats.activeMembers}
                    </div>
                    <div className="text-xs text-neutral-500">Member Aktif</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-neutral-900 dark:text-white">
                      {branch.stats.completedSessions}
                    </div>
                    <div className="text-xs text-neutral-500">Sesi Selesai</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(branch.stats.monthlyRevenue)}
                    </div>
                    <div className="text-xs text-neutral-500">Revenue</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {branch.stats.pendingPayments}
                    </div>
                    <div className="text-xs text-neutral-500">Pending</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-neutral-900 dark:text-white">
                      {branch.stats.totalStaff}
                    </div>
                    <div className="text-xs text-neutral-500">Staff</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link 
            href="/branches"
            className="flex flex-col items-center gap-3 p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-violet-500/50 transition-colors group"
          >
            <div className="w-12 h-12 bg-violet-500/15 rounded-xl flex items-center justify-center group-hover:bg-violet-500/25 transition-colors">
              <Building2 className="h-6 w-6 text-violet-500" />
            </div>
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Kelola Cabang</span>
          </Link>

          <Link 
            href="/admin-manager"
            className="flex flex-col items-center gap-3 p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-amber-500/50 transition-colors group"
          >
            <div className="w-12 h-12 bg-amber-500/15 rounded-xl flex items-center justify-center group-hover:bg-amber-500/25 transition-colors">
              <UserCog className="h-6 w-6 text-amber-500" />
            </div>
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Admin Cabang</span>
          </Link>

          <Link 
            href="/members"
            className="flex flex-col items-center gap-3 p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/50 transition-colors group"
          >
            <div className="w-12 h-12 bg-cyan-500/15 rounded-xl flex items-center justify-center group-hover:bg-cyan-500/25 transition-colors">
              <Users className="h-6 w-6 text-cyan-500" />
            </div>
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Semua Member</span>
          </Link>

          <Link 
            href="/sessions"
            className="flex flex-col items-center gap-3 p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 transition-colors group"
          >
            <div className="w-12 h-12 bg-emerald-500/15 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
              <Activity className="h-6 w-6 text-emerald-500" />
            </div>
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Semua Sesi</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
