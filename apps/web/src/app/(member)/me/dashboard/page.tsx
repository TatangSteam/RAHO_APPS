'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Ticket, Package, Calendar, Activity, FileText, 
  Phone, MapPin, ChevronRight, Loader2, RefreshCw,
  CheckCircle2, Clock, AlertCircle
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { dashboardApi, type MemberDashboardEnhanced } from '@/lib/dashboardApi';

export default function MemberDashboardPage() {
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MemberDashboardEnhanced | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dashboardApi.getMemberDashboard();
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchDashboard();
  }, [user]);

  if (!user) return null;

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton Header */}
        <div className="h-24 sm:h-28 bg-neutral-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
        
        {/* Skeleton Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 sm:h-32 bg-neutral-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
          ))}
        </div>

        {/* Loading indicator */}
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
          Gagal Memuat Dashboard
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400 mb-6 text-sm sm:text-base">{error}</p>
        <button
          onClick={fetchDashboard}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-xl transition-colors text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header with Greeting */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:via-amber-500/10 dark:to-transparent rounded-2xl p-5 sm:p-6 md:p-8 border border-amber-500/20">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-1 sm:mb-2">
          {data.greeting} 👋
        </h1>
        <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
          Selamat datang kembali di Portal Member RAHO Premier Club
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard 
          icon={<Ticket className="h-5 w-5 sm:h-6 sm:w-6" />}
          label="Voucher Tersisa"
          value={data.stats.voucherSisa}
          color="emerald"
        />
        <StatCard 
          icon={<Package className="h-5 w-5 sm:h-6 sm:w-6" />}
          label="Paket Aktif"
          value={data.stats.paketAktif}
          color="blue"
        />
        <StatCard 
          icon={<Activity className="h-5 w-5 sm:h-6 sm:w-6" />}
          label="Total Sesi"
          value={data.stats.totalSesi}
          color="purple"
        />
        <StatCard 
          icon={<CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />}
          label="Sesi Selesai"
          value={data.stats.sesiSelesai}
          color="amber"
        />
      </div>

      {/* Active Packages */}
      {data.activePackages.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-500" />
              Paket Terapi Aktif
            </h2>
            <Link 
              href="/me/vouchers"
              className="text-xs sm:text-sm text-amber-500 hover:text-amber-600 flex items-center gap-1"
            >
              Lihat Semua <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            {data.activePackages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        </section>
      )}

      {/* Last Session & Recent Invoices */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Last Session */}
        <section className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              Sesi Terakhir
            </h2>
            <Link 
              href="/me/sessions"
              className="text-xs sm:text-sm text-amber-500 hover:text-amber-600 flex items-center gap-1"
            >
              Riwayat <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {data.lastSession ? (
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-white mb-1 text-sm sm:text-base">
                    {data.lastSession.sessionCode}
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                    Infus ke-{data.lastSession.infusKe}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  data.lastSession.isCompleted
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}>
                  {data.lastSession.isCompleted ? 'Selesai' : 'Dalam Proses'}
                </span>
              </div>

              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {new Date(data.lastSession.treatmentDate).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                  <Activity className="h-4 w-4 flex-shrink-0" />
                  <span>{data.lastSession.doctorName}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {data.lastSession.branchName} • {data.lastSession.pelaksanaan === 'ON_SITE' ? 'Di Klinik' : 'Home Care'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={Calendar} message="Belum ada sesi terapi" />
          )}
        </section>

        {/* Recent Invoices */}
        <section className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Invoice Terbaru
            </h2>
            <Link 
              href="/me/invoices"
              className="text-xs sm:text-sm text-amber-500 hover:text-amber-600 flex items-center gap-1"
            >
              Semua <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {data.recentInvoices.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {data.recentInvoices.map((invoice) => (
                <div 
                  key={invoice.id}
                  className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-neutral-900 dark:text-white text-xs sm:text-sm truncate">
                      {invoice.invoiceNumber}
                    </div>
                    <div className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400">
                      {new Date(invoice.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <div className="font-semibold text-neutral-900 dark:text-white text-xs sm:text-sm">
                      Rp {invoice.totalAmount.toLocaleString('id-ID')}
                    </div>
                    <span className={`text-[10px] sm:text-xs font-medium ${
                      invoice.status === 'PAID' 
                        ? 'text-emerald-500' 
                        : invoice.status === 'PENDING_PAYMENT'
                        ? 'text-amber-500'
                        : 'text-red-500'
                    }`}>
                      {invoice.status === 'PAID' ? '✓ Lunas' : invoice.status === 'PENDING_PAYMENT' ? '⏳ Pending' : '✗ Belum Bayar'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={FileText} message="Belum ada invoice" />
          )}
        </section>
      </div>

      {/* Branch Contact */}
      {data.branchContact && (
        <section className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 dark:from-amber-500/20 dark:to-amber-500/10 rounded-2xl border border-amber-500/20 p-4 sm:p-5 md:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <Phone className="h-5 w-5 text-amber-500" />
            Butuh Bantuan?
          </h2>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                Cabang Anda
              </div>
              <div className="font-semibold text-neutral-900 dark:text-white text-sm sm:text-base">
                {data.branchContact.name}
              </div>
              {data.branchContact.city && (
                <div className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                  {data.branchContact.city}
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              {data.branchContact.phone && (
                <>
                  <a 
                    href={`tel:${data.branchContact.phone}`}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-xl transition-colors text-sm"
                  >
                    <Phone className="h-4 w-4" />
                    {data.branchContact.phone}
                  </a>
                  <a 
                    href={`https://wa.me/${data.branchContact.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors text-sm"
                  >
                    <WhatsAppIcon />
                    WhatsApp
                  </a>
                </>
              )}
            </div>
          </div>

          {data.branchContact.address && (
            <div className="mt-4 pt-4 border-t border-amber-500/20">
              <div className="flex items-start gap-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{data.branchContact.address}</span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Quick Links */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <QuickLink href="/me/vouchers" icon={Ticket} label="Voucher" color="emerald" />
        <QuickLink href="/me/sessions" icon={Activity} label="Riwayat Sesi" color="purple" />
        <QuickLink href="/me/invoices" icon={FileText} label="Invoice" color="blue" />
        <QuickLink href="/me/profile" icon={UserIcon} label="Profil" color="amber" />
      </section>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════════

function StatCard({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number;
  color: 'emerald' | 'blue' | 'purple' | 'amber';
}) {
  const colors = {
    emerald: {
      bg: 'from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/10',
      border: 'border-emerald-500/20 hover:border-emerald-500/40',
      icon: 'bg-emerald-500/20',
      text: 'text-emerald-500',
      glow: 'bg-emerald-500/10',
    },
    blue: {
      bg: 'from-blue-500/10 to-blue-500/5 dark:from-blue-500/20 dark:to-blue-500/10',
      border: 'border-blue-500/20 hover:border-blue-500/40',
      icon: 'bg-blue-500/20',
      text: 'text-blue-500',
      glow: 'bg-blue-500/10',
    },
    purple: {
      bg: 'from-purple-500/10 to-purple-500/5 dark:from-purple-500/20 dark:to-purple-500/10',
      border: 'border-purple-500/20 hover:border-purple-500/40',
      icon: 'bg-purple-500/20',
      text: 'text-purple-500',
      glow: 'bg-purple-500/10',
    },
    amber: {
      bg: 'from-amber-500/10 to-amber-500/5 dark:from-amber-500/20 dark:to-amber-500/10',
      border: 'border-amber-500/20 hover:border-amber-500/40',
      icon: 'bg-amber-500/20',
      text: 'text-amber-500',
      glow: 'bg-amber-500/10',
    },
  };

  const c = colors[color];

  return (
    <div className={`bg-gradient-to-br ${c.bg} rounded-2xl p-4 sm:p-5 border ${c.border} relative overflow-hidden transition-colors`}>
      <div className={`absolute top-0 right-0 w-20 h-20 ${c.glow} rounded-full blur-2xl -mr-6 -mt-6`} />
      <div className="relative">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 ${c.icon} rounded-xl flex items-center justify-center mb-3 ${c.text}`}>
          {icon}
        </div>
        <div className={`text-2xl sm:text-3xl font-bold ${c.text} mb-0.5`}>
          {value}
        </div>
        <div className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
          {label}
        </div>
      </div>
    </div>
  );
}

interface PackageData {
  id: string;
  packageCode: string;
  packageType: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  progress: number;
  status: string;
  expiredAt: string | null;
  branchName: string;
}

function PackageCard({ pkg }: { pkg: PackageData }) {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 hover:border-amber-500/50 transition-colors">
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full ${
              pkg.packageType === 'BASIC' 
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' 
                : 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
            }`}>
              {pkg.packageType}
            </span>
            <span className="text-[10px] sm:text-xs text-emerald-500 font-medium">AKTIF</span>
          </div>
          <h3 className="font-semibold text-neutral-900 dark:text-white text-sm sm:text-base truncate">
            {pkg.packageCode}
          </h3>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 truncate">
            {pkg.branchName}
          </p>
        </div>
        <div className="text-right ml-3 flex-shrink-0">
          <div className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">
            {pkg.remainingSessions}
          </div>
          <div className="text-[10px] sm:text-xs text-neutral-500">sesi tersisa</div>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="mb-2 sm:mb-3">
        <div className="flex justify-between text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 mb-1">
          <span>Progress</span>
          <span>{pkg.usedSessions}/{pkg.totalSessions} sesi</span>
        </div>
        <div className="h-1.5 sm:h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${pkg.progress}%` }}
          />
        </div>
      </div>

      {pkg.expiredAt && (
        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400">
          <Clock className="h-3 w-3" />
          Berlaku hingga {new Date(pkg.expiredAt).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
    <div className="text-center py-8">
      <Icon className="h-10 w-10 sm:h-12 sm:w-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{message}</p>
    </div>
  );
}

function QuickLink({ 
  href, 
  icon: Icon, 
  label, 
  color 
}: { 
  href: string; 
  icon: React.ComponentType<{ className?: string }>; 
  label: string;
  color: 'emerald' | 'purple' | 'blue' | 'amber';
}) {
  const colors = {
    emerald: 'text-emerald-500',
    purple: 'text-purple-500',
    blue: 'text-blue-500',
    amber: 'text-amber-500',
  };

  return (
    <Link 
      href={href}
      className="flex flex-col items-center gap-2 p-3 sm:p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-amber-500/50 transition-colors text-center"
    >
      <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${colors[color]}`} />
      <span className="text-xs sm:text-sm font-medium text-neutral-900 dark:text-white">{label}</span>
    </Link>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
