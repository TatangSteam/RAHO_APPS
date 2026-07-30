'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Calendar, Users, CreditCard, CheckCircle2,
  ChevronRight, UserCheck, TrendingUp, Bell
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { dashboardApi, type AdminLayananDashboardData } from '@/lib/dashboardApi';
import { getDashboardLoadErrorMessage } from '@/lib/dashboardPresentation';
import { DashboardErrorState } from '@/components/dashboard/DashboardErrorState';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';
import { DashboardStatCard as StatCard } from '@/components/dashboard/DashboardStatCard';
import { RoleWorkspaceHeader } from '@/components/dashboard/RoleWorkspace';

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
    if (user.role !== 'ADMIN_LAYANAN') {
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
        <RoleWorkspaceHeader
          accent="amber"
          icon={<UserCheck className="h-6 w-6" />}
          eyebrow="Ruang kerja admin layanan"
          title="Siapkan pelayanan hari ini"
          description="Kelola jadwal, pembayaran yang perlu perhatian, dan kesiapan tim dari satu halaman."
          userName={user?.fullName}
          primaryAction={{ href: '/sessions', label: 'Buka Sesi Hari Ini' }}
          secondaryAction={{ href: '/members', label: 'Cari Member' }}
          guide={[
            'Pastikan member dan paket yang dipakai sudah benar.',
            'Pilih dokter dan tenaga kesehatan untuk sesi.',
            'Pantau sesi sampai siap dievaluasi dan diselesaikan.',
          ]}
        />

        {/* Today Stats */}
        <div className="my-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
            label="Paket Minggu Ini"
            value={data.weeklyStats.packagesSold}
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
                        <Link href={`/sessions/${session.id}`} className="hover:text-amber-500">
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
                        <div className="flex items-center justify-between gap-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            session.status === 'completed'
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : session.status === 'ongoing'
                              ? 'bg-amber-500/15 text-amber-500'
                              : 'bg-neutral-500/15 text-neutral-500'
                          }`}>
                            {session.status === 'completed' ? 'Selesai' : session.status === 'ongoing' ? 'Berlangsung' : 'Terjadwal'}
                          </span>
                          <Link href={`/sessions/${session.id}`} className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            Buka
                          </Link>
                        </div>
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
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">Perlu verifikasi</span>
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
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          </div>
        </div>
      </div>
    </div>
  );
}

