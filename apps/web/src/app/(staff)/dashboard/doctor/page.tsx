'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Activity, Calendar, Clock, Users, CheckCircle2, 
  PlayCircle, Loader2, RefreshCw, AlertCircle, ChevronRight,
  Stethoscope, TrendingUp
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { dashboardApi, type DoctorDashboardData } from '@/lib/dashboardApi';

export default function DoctorDashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DoctorDashboardData | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dashboardApi.getDoctorDashboard();
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'DOCTOR') {
      router.push('/dashboard');
      return;
    }
    fetchDashboard();
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-neutral-500 mb-4">{error}</p>
            <button onClick={fetchDashboard} className="px-4 py-2 bg-amber-500 text-black rounded-xl font-medium">
              <RefreshCw className="h-4 w-4 inline mr-2" />Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
      case 'ongoing': return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
      default: return 'bg-neutral-500/15 text-neutral-500 border-neutral-500/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Selesai';
      case 'ongoing': return 'Berlangsung';
      default: return 'Terjadwal';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
              <Stethoscope className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                Dashboard Dokter
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
            icon={<TrendingUp className="h-5 w-5" />}
            label="Completion Rate"
            value={`${data.monthlyStats.completionRate}%`}
            subtitle={`${data.monthlyStats.totalSessions} sesi bulan ini`}
            color="purple"
          />
        </div>

        {/* Today's Schedule */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 md:p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Jadwal Sesi Hari Ini
            </h2>
            <Link 
              href="/sessions"
              className="text-sm text-amber-500 hover:text-amber-600 flex items-center gap-1"
            >
              Semua Sesi <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {data.schedule.length > 0 ? (
            <div className="space-y-3">
              {data.schedule.map((session) => (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="block p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <div className="text-lg font-bold text-neutral-900 dark:text-white">
                          {new Date(session.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="h-12 w-px bg-neutral-200 dark:bg-neutral-700" />
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          {session.memberName}
                        </div>
                        <div className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            session.packageType === 'BASIC' ? 'bg-blue-500/15 text-blue-500' : 'bg-purple-500/15 text-purple-500'
                          }`}>
                            {session.packageType}
                          </span>
                          <span>Infus ke-{session.infusKe}</span>
                          <span>•</span>
                          <span>{session.pelaksanaan === 'ON_SITE' ? 'Di Klinik' : 'Home Care'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(session.status)}`}>
                        {getStatusLabel(session.status)}
                      </span>
                      <ChevronRight className="h-5 w-5 text-neutral-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
              <p className="text-neutral-500 dark:text-neutral-400">Tidak ada sesi terjadwal hari ini</p>
            </div>
          )}
        </div>

        {/* Recent Patients */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              Pasien Terbaru
            </h2>
            <Link 
              href="/members"
              className="text-sm text-amber-500 hover:text-amber-600 flex items-center gap-1"
            >
              Semua Member <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {data.recentPatients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase">Member</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase">Paket</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase">Progress</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase">Sesi Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPatients.map((patient) => (
                    <tr key={patient.memberId} className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                      <td className="py-3 px-4">
                        <Link href={`/members/${patient.memberId}`} className="hover:text-amber-500">
                          <div className="font-medium text-neutral-900 dark:text-white">{patient.memberName}</div>
                          <div className="text-xs text-neutral-500">{patient.memberNo}</div>
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          patient.packageType === 'BASIC' ? 'bg-blue-500/15 text-blue-500' : 'bg-purple-500/15 text-purple-500'
                        }`}>
                          {patient.packageType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {patient.progress} sesi
                      </td>
                      <td className="py-3 px-4 text-sm text-neutral-500">
                        {patient.lastSession 
                          ? new Date(patient.lastSession).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                          : '-'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
              <p className="text-neutral-500 dark:text-neutral-400">Belum ada pasien</p>
            </div>
          )}
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
  color: 'blue' | 'emerald' | 'amber' | 'purple';
}) {
  const colors = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-500',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-500',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-500',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-500',
  };

  const bgColors = {
    blue: 'bg-blue-500/20',
    emerald: 'bg-emerald-500/20',
    amber: 'bg-amber-500/20',
    purple: 'bg-purple-500/20',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-2xl p-5 border relative overflow-hidden`}>
      <div className={`w-10 h-10 ${bgColors[color]} rounded-xl flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-3xl font-bold text-neutral-900 dark:text-white mb-1">{value}</div>
      <div className="text-sm text-neutral-600 dark:text-neutral-400">{label}</div>
      {subtitle && <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>}
    </div>
  );
}
