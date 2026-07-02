'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Activity, Calendar, Clock, Package, CheckCircle2, 
  PlayCircle, ChevronRight,
  Heart, AlertTriangle, Boxes
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { dashboardApi, type NurseDashboardData } from '@/lib/dashboardApi';
import { getDashboardLoadErrorMessage } from '@/lib/dashboardPresentation';
import { DashboardErrorState } from '@/components/dashboard/DashboardErrorState';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';
import { DashboardStatCard as StatCard } from '@/components/dashboard/DashboardStatCard';

export default function NurseDashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NurseDashboardData | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dashboardApi.getNurseDashboard();
      setData(result);
    } catch (error) {
      setError(getDashboardLoadErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'NURSE') {
      router.push('/dashboard');
      return;
    }
    fetchDashboard();
  }, [user, router]);

  if (loading) {
    return <DashboardLoadingState color="amber" />;
  }

  if (error) {
    return <DashboardErrorState message={error} onRetry={fetchDashboard} actionColor="amber" />;
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-500/30">
              <Heart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                Dashboard Perawat
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Selamat datang, {user?.fullName}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            icon={<Calendar className="h-5 w-5" />}
            label="Sesi Hari Ini"
            value={data.todaySessions.total}
            color="blue"
          />
          <StatCard 
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Selesai"
            value={data.todaySessions.completed}
            color="emerald"
          />
          <StatCard 
            icon={<PlayCircle className="h-5 w-5" />}
            label="Berlangsung"
            value={data.todaySessions.ongoing}
            color="amber"
          />
          <StatCard 
            icon={<Package className="h-5 w-5" />}
            label="Material Dipakai"
            value={data.materialUsedToday}
            subtitle="hari ini"
            color="purple"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Active Sessions */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 md:p-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2 mb-4">
              <PlayCircle className="h-5 w-5 text-amber-500" />
              Sesi Aktif
            </h2>

            {data.activeSessions.length > 0 ? (
              <div className="space-y-4">
                {data.activeSessions.map((session) => (
                  <div key={session.id} className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          {session.memberName}
                        </div>
                        <div className="text-sm text-neutral-500">
                          {session.sessionCode} • Dr. {session.doctorName}
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold rounded-full">
                        Infus ke-{session.infusKe}
                      </span>
                    </div>

                    {session.vitalSigns && (
                      <div className="grid grid-cols-4 gap-2 p-3 bg-white/50 dark:bg-neutral-800/50 rounded-lg">
                        <div className="text-center">
                          <div className="text-xs text-neutral-500 mb-1">Sistol</div>
                          <div className="font-semibold text-neutral-900 dark:text-white text-sm">
                            {session.vitalSigns.sistol || '-'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-neutral-500 mb-1">Diastol</div>
                          <div className="font-semibold text-neutral-900 dark:text-white text-sm">
                            {session.vitalSigns.diastol || '-'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-neutral-500 mb-1">HR</div>
                          <div className="font-semibold text-neutral-900 dark:text-white text-sm">
                            {session.vitalSigns.hr || '-'} bpm
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-neutral-500 mb-1">SpO2</div>
                          <div className="font-semibold text-neutral-900 dark:text-white text-sm">
                            {session.vitalSigns.saturasi || '-'}%
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <Link
                        href={`/sessions/${session.id}`}
                        className="flex-1 text-center px-3 py-2 bg-amber-500 hover:bg-amber-600 text-black text-sm font-medium rounded-lg transition-colors"
                      >
                        Lanjutkan Sesi
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-500">Tidak ada sesi aktif</p>
              </div>
            )}
          </div>

          {/* Upcoming Sessions */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 md:p-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-blue-500" />
              Sesi Mendatang
            </h2>

            {data.upcomingSessions.length > 0 ? (
              <div className="space-y-3">
                {data.upcomingSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[50px]">
                        <div className="text-sm font-bold text-neutral-900 dark:text-white">
                          {new Date(session.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-neutral-900 dark:text-white text-sm">
                          {session.memberName}
                        </div>
                        <div className="text-xs text-neutral-500">
                          Dr. {session.doctorName} • Infus ke-{session.infusKe}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-neutral-400" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-500">Tidak ada sesi mendatang</p>
              </div>
            )}
          </div>
        </div>

        {/* Stock Overview */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Boxes className="h-5 w-5 text-purple-500" />
              Stok Material
            </h2>
            <Link 
              href="/inventory"
              className="text-sm text-amber-500 hover:text-amber-600 flex items-center gap-1"
            >
              Lihat Inventori <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {data.stockOverview.map((item, idx) => (
              <div 
                key={idx}
                className={`p-4 rounded-xl border ${
                  item.isLow 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium text-neutral-900 dark:text-white text-sm truncate pr-2">
                    {item.itemName}
                  </div>
                  {item.isLow && (
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  )}
                </div>
                <div className={`text-2xl font-bold ${item.isLow ? 'text-red-500' : 'text-neutral-900 dark:text-white'}`}>
                  {item.currentStock}
                </div>
                <div className="text-xs text-neutral-500">{item.unit}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

