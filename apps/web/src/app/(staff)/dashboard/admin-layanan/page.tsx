'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Activity, Calendar, Users, CreditCard, CheckCircle2, 
  Clock, Loader2, RefreshCw, AlertCircle, ChevronRight,
  UserCheck, TrendingUp, Package, DollarSign, Bell
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { dashboardApi, type AdminLayananDashboardData } from '@/lib/dashboardApi';

export default function AdminLayananDashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminLayananDashboardData | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dashboardApi.getAdminLayananDashboard();
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
    if (user.role !== 'ADMIN_LAYANAN') {
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
              <UserCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                Dashboard Layanan
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Fokus pelayanan member dan sesi terapi
              </p>
            </div>
          </div>
        </div>

        {/* Today Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            icon={<Calendar className="h-5 w-5" />}
            label="Sesi Hari Ini"
            value={data.todayStats.sessionsToday}
            subtitle={`${data.todayStats.completedToday} selesai`}
            color="blue"
          />
          <StatCard 
            icon={<CreditCard className="h-5 w-5" />}
            label="Pending Payment"
            value={data.todayStats.pendingPayments}
            color="amber"
          />
          <StatCard 
            icon={<Users className="h-5 w-5" />}
            label="Member Aktif"
            value={data.todayStats.activeMembers}
            color="emerald"
          />
          <StatCard 
            icon={<TrendingUp className="h-5 w-5" />}
            label="Revenue Minggu Ini"
            value={formatCurrency(data.weeklyStats.revenue)}
            color="purple"
          />
        </div>

        {/* Session Schedule */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 md:p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
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

          {data.sessionSchedule.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase">Waktu</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase">Member</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase">Paket</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase">Dokter</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sessionSchedule.map((session) => (
                    <tr key={session.id} className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                      <td className="py-3 px-4 font-medium text-neutral-900 dark:text-white">
                        {new Date(session.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/members/${session.id}`} className="hover:text-amber-500">
                          <div className="font-medium text-neutral-900 dark:text-white">{session.memberName}</div>
                          <div className="text-xs text-neutral-500">{session.memberNo}</div>
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          session.packageType === 'BASIC' ? 'bg-blue-500/15 text-blue-500' : 'bg-purple-500/15 text-purple-500'
                        }`}>
                          {session.packageType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {session.doctorName}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          session.status === 'completed' 
                            ? 'bg-emerald-500/15 text-emerald-500' 
                            : session.status === 'ongoing'
                            ? 'bg-amber-500/15 text-amber-500'
                            : 'bg-neutral-500/15 text-neutral-500'
                        }`}>
                          {session.status === 'completed' ? 'Selesai' : session.status === 'ongoing' ? 'Berlangsung' : 'Terjadwal'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
              <p className="text-neutral-500">Tidak ada sesi hari ini</p>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Pending Payments */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-amber-500" />
                Pembayaran Pending
              </h2>
              <Link 
                href="/members"
                className="text-sm text-amber-500 hover:text-amber-600 flex items-center gap-1"
              >
                Verifikasi <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {data.pendingPayments.length > 0 ? (
              <div className="space-y-3">
                {data.pendingPayments.map((payment) => (
                  <div key={payment.invoiceId} className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-white text-sm">
                        {payment.memberName}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {payment.invoiceNumber} • {payment.daysOverdue} hari
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-amber-600 dark:text-amber-400">
                        {formatCurrency(payment.amount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-emerald-500/50 mx-auto mb-3" />
                <p className="text-neutral-500">Tidak ada pembayaran pending</p>
              </div>
            )}
          </div>

          {/* Members Need Follow-up */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-red-500" />
                Perlu Follow-up
              </h2>
            </div>

            {data.membersNeedFollowup.length > 0 ? (
              <div className="space-y-3">
                {data.membersNeedFollowup.map((member) => (
                  <Link 
                    key={member.memberId} 
                    href={`/members/${member.memberId}`}
                    className="block p-3 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/15 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-neutral-900 dark:text-white text-sm">
                          {member.memberName}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {member.memberNo}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </div>
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                      {member.reason}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-emerald-500/50 mx-auto mb-3" />
                <p className="text-neutral-500">Semua member aktif</p>
              </div>
            )}
          </div>
        </div>

        {/* Weekly Stats */}
        <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 dark:from-amber-500/20 dark:to-amber-500/10 rounded-2xl border border-amber-500/20 p-5 md:p-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            Statistik Minggu Ini
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-white/50 dark:bg-neutral-800/50 rounded-xl">
              <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                {data.weeklyStats.sessionsCompleted}
              </div>
              <div className="text-sm text-neutral-500">Sesi Selesai</div>
            </div>
            <div className="text-center p-4 bg-white/50 dark:bg-neutral-800/50 rounded-xl">
              <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                {data.weeklyStats.newMembers}
              </div>
              <div className="text-sm text-neutral-500">Member Baru</div>
            </div>
            <div className="text-center p-4 bg-white/50 dark:bg-neutral-800/50 rounded-xl">
              <div className="text-2xl font-bold text-neutral-900 dark:text-white">
                {data.weeklyStats.packagesSold}
              </div>
              <div className="text-sm text-neutral-500">Paket Terjual</div>
            </div>
            <div className="text-center p-4 bg-white/50 dark:bg-neutral-800/50 rounded-xl">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(data.weeklyStats.revenue)}
              </div>
              <div className="text-sm text-neutral-500">Revenue</div>
            </div>
          </div>
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
      <div className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-1">{value}</div>
      <div className="text-sm text-neutral-600 dark:text-neutral-400">{label}</div>
      {subtitle && <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>}
    </div>
  );
}
