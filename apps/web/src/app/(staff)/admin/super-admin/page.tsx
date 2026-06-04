'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import Link from 'next/link';
import { 
  Activity, Users, Package, FileText, Building2,
  UsersRound, DollarSign, Stethoscope, Shield,
  BarChart3, RefreshCw, Plus, Loader2, Clock,
  CheckCircle2, AlertCircle, ArrowRight, LogIn, LogOut,
  UserPlus, Edit, Trash2, Eye
} from 'lucide-react';
import { AdminManagersTab } from '@/components/admin/AdminManagersTab';

type TabType = 'overview' | 'admin-managers' | 'master-products' | 'audit-logs';

interface SystemStats {
  totalBranches: number;
  activeBranches: number;
  totalUsers: number;
  activeUsers: number;
  totalMembers: number;
  activeMembers: number;
  totalProducts: number;
  activeProducts: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalSessions: number;
  monthlySessions: number;
  usersByRole: {
    role: string;
    count: number;
  }[];
  recentActivities: {
    id: string;
    action: string;
    userName: string;
    userEmail: string;
    branchName: string | null;
    createdAt: string;
  }[];
}

export default function SuperAdminPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!user || !accessToken) {
      router.push('/login');
      return;
    }

    if (user.role !== 'SUPER_ADMIN') {
      showToast.error('Akses ditolak - Hanya untuk Super Admin');
      router.push('/dashboard');
      return;
    }

    loadSystemStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user, accessToken]);

  const loadSystemStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/system-stats`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Gagal memuat statistik sistem');

      const result = await response.json();
      setStats(result.data);
    } catch (error: any) {
      devError('Error loading system stats:', error);
      showToast.error(error.message || 'Gagal memuat statistik sistem');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      SUPER_ADMIN: 'Super Admin',
      ADMIN_MANAGER: 'Admin Manager',
      ADMIN_CABANG: 'Admin Cabang',
      ADMIN_LAYANAN: 'Admin Layanan',
      DOCTOR: 'Dokter',
      NURSE: 'Perawat',
    };
    return roleMap[role] || role;
  };

  const getActivityIcon = (action: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      LOGIN: <LogIn className="h-4 w-4" />,
      LOGOUT: <LogOut className="h-4 w-4" />,
      CREATE: <Plus className="h-4 w-4" />,
      UPDATE: <Edit className="h-4 w-4" />,
      DELETE: <Trash2 className="h-4 w-4" />,
      VERIFY: <CheckCircle2 className="h-4 w-4" />,
    };
    return iconMap[action] || <Activity className="h-4 w-4" />;
  };

  const getActivityColor = (action: string) => {
    const colorMap: Record<string, string> = {
      LOGIN: 'text-emerald-500 bg-emerald-500/10',
      LOGOUT: 'text-neutral-500 bg-neutral-500/10',
      CREATE: 'text-blue-500 bg-blue-500/10',
      UPDATE: 'text-amber-500 bg-amber-500/10',
      DELETE: 'text-red-500 bg-red-500/10',
      VERIFY: 'text-green-500 bg-green-500/10',
    };
    return colorMap[action] || 'text-neutral-500 bg-neutral-500/10';
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
          <p className="text-neutral-500 dark:text-neutral-400">Memuat data sistem...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Super Admin Panel
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Selamat datang, {user?.fullName} - Kontrol penuh sistem RAHO
            </p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard 
            icon={<Building2 className="h-5 w-5" />}
            label="Total Cabang"
            value={stats?.totalBranches || 0}
            subtitle={`${stats?.activeBranches || 0} aktif`}
            color="blue"
          />
          <StatCard 
            icon={<Users className="h-5 w-5" />}
            label="Total Staff"
            value={stats?.totalUsers || 0}
            subtitle={`${stats?.activeUsers || 0} aktif`}
            color="emerald"
          />
          <StatCard 
            icon={<UsersRound className="h-5 w-5" />}
            label="Total Member"
            value={stats?.totalMembers || 0}
            subtitle={`${stats?.activeMembers || 0} aktif`}
            color="cyan"
          />
          <StatCard 
            icon={<Package className="h-5 w-5" />}
            label="Master Produk"
            value={stats?.totalProducts || 0}
            subtitle={`${stats?.activeProducts || 0} aktif`}
            color="purple"
          />
          <StatCard 
            icon={<DollarSign className="h-5 w-5" />}
            label="Total Pendapatan"
            value={formatCurrency(stats?.totalRevenue || 0)}
            subtitle={`${formatCurrency(stats?.monthlyRevenue || 0)} bulan ini`}
            color="amber"
          />
          <StatCard 
            icon={<Stethoscope className="h-5 w-5" />}
            label="Total Sesi Terapi"
            value={stats?.totalSessions || 0}
            subtitle={`${stats?.monthlySessions || 0} bulan ini`}
            color="pink"
          />
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          {/* Tabs Nav */}
          <div className="flex gap-2 p-1 border-b border-neutral-200 dark:border-neutral-800">
            <TabButton
              icon={<Activity size={18} />}
              label="Overview"
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            />
            <TabButton
              icon={<Users size={18} />}
              label="Admin Managers"
              active={activeTab === 'admin-managers'}
              onClick={() => setActiveTab('admin-managers')}
            />
            <TabButton
              icon={<Package size={18} />}
              label="Master Products"
              active={activeTab === 'master-products'}
              onClick={() => setActiveTab('master-products')}
            />
            <TabButton
              icon={<FileText size={18} />}
              label="Audit Logs"
              active={activeTab === 'audit-logs'}
              onClick={() => setActiveTab('audit-logs')}
            />
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Management Sections Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Master Data Management */}
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Package className="h-5 w-5 text-violet-500" />
                        Master Data
                      </h2>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Kelola data master sistem
                      </p>
                    </div>
                    <div className="space-y-2">
                      <ActionLink
                        href="/admin/master-products"
                        icon={<Package className="h-5 w-5" />}
                        title="Master Produk"
                        description="Kelola produk untuk semua cabang"
                      />
                      <ActionLink
                        href="/branches"
                        icon={<Building2 className="h-5 w-5" />}
                        title="Manajemen Cabang"
                        description="Kelola semua cabang RAHO"
                      />
                    </div>
                  </div>

                  {/* User Management */}
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        Manajemen User
                      </h2>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Kelola akses dan role user
                      </p>
                    </div>
                    <div className="space-y-2">
                      <ActionLink
                        href="/admin/users"
                        icon={<UserPlus className="h-5 w-5" />}
                        title="Kelola User"
                        description="Tambah, edit, hapus user sistem"
                      />
                    </div>
                    {/* User Role Stats */}
                    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700">
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">
                        Distribusi Role
                      </h4>
                      <div className="space-y-2">
                        {stats?.usersByRole.map((roleData) => (
                          <div 
                            key={roleData.role} 
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-neutral-600 dark:text-neutral-400">
                              {getRoleLabel(roleData.role)}
                            </span>
                            <span className="font-semibold text-neutral-900 dark:text-white">
                              {roleData.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* System Monitoring */}
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-emerald-500" />
                        Monitoring Sistem
                      </h2>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Pantau aktivitas dan performa
                      </p>
                    </div>
                    <div className="space-y-2">
                      <ActionLink
                        href="/admin/audit-logs"
                        icon={<FileText className="h-5 w-5" />}
                        title="Audit Logs"
                        description="Riwayat aktivitas semua user"
                      />
                      <ActionLink
                        href="/admin/branch-performance"
                        icon={<BarChart3 className="h-5 w-5" />}
                        title="Performa Cabang"
                        description="Analisis performa setiap cabang"
                      />
                    </div>
                  </div>

                  {/* Recent Activities */}
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-500" />
                        Aktivitas Terbaru
                      </h2>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        10 aktivitas terakhir sistem
                      </p>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {stats?.recentActivities && stats.recentActivities.length > 0 ? (
                        stats.recentActivities.map((activity) => (
                          <div 
                            key={activity.id} 
                            className="flex items-start gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700"
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getActivityColor(activity.action)}`}>
                              {getActivityIcon(activity.action)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-neutral-900 dark:text-white">
                                {activity.action}
                              </div>
                              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                {activity.userName} ({activity.userEmail})
                              </div>
                              {activity.branchName && (
                                <div className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                                  <Building2 className="h-3 w-3" />
                                  {activity.branchName}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-neutral-500 whitespace-nowrap">
                              {formatDate(activity.createdAt)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-neutral-500 dark:text-neutral-400 text-sm">
                          Belum ada aktivitas terbaru
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 dark:from-violet-500/20 dark:to-purple-500/10 rounded-2xl border border-violet-500/20 p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-violet-500" />
                    Aksi Cepat
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <QuickActionButton
                      icon={<Package className="h-5 w-5" />}
                      label="Tambah Produk"
                      onClick={() => router.push('/admin/master-products')}
                    />
                    <QuickActionButton
                      icon={<Building2 className="h-5 w-5" />}
                      label="Tambah Cabang"
                      onClick={() => router.push('/branches')}
                    />
                    <QuickActionButton
                      icon={<UserPlus className="h-5 w-5" />}
                      label="Tambah User"
                      onClick={() => router.push('/admin/users')}
                    />
                    <QuickActionButton
                      icon={<Eye className="h-5 w-5" />}
                      label="Lihat Audit Log"
                      onClick={() => router.push('/admin/audit-logs')}
                    />
                    <QuickActionButton
                      icon={<RefreshCw className="h-5 w-5" />}
                      label="Refresh Data"
                      onClick={loadSystemStats}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin-managers' && (
              <AdminManagersTab />
            )}

            {activeTab === 'master-products' && (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-neutral-300 dark:text-neutral-700 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
                  Master Products
                </h2>
                <p className="text-neutral-500 dark:text-neutral-400 mb-6">
                  Redirecting to Master Products page...
                </p>
                <button
                  onClick={() => router.push('/admin/master-products')}
                  className="px-6 py-3 bg-violet-500 text-white rounded-xl font-medium hover:bg-violet-600 transition-colors inline-flex items-center gap-2"
                >
                  <Package className="h-5 w-5" />
                  Go to Master Products
                </button>
              </div>
            )}

            {activeTab === 'audit-logs' && (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-neutral-300 dark:text-neutral-700 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
                  Audit Logs
                </h2>
                <p className="text-neutral-500 dark:text-neutral-400 mb-6">
                  Redirecting to Audit Logs page...
                </p>
                <button
                  onClick={() => router.push('/admin/audit-logs')}
                  className="px-6 py-3 bg-violet-500 text-white rounded-xl font-medium hover:bg-violet-600 transition-colors inline-flex items-center gap-2"
                >
                  <FileText className="h-5 w-5" />
                  Go to Audit Logs
                </button>
              </div>
            )}
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
  color: 'blue' | 'emerald' | 'amber' | 'purple' | 'pink' | 'cyan';
}) {
  const colors = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-500',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-500',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-500',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-500',
    pink: 'from-pink-500/10 to-pink-500/5 border-pink-500/20 text-pink-500',
    cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20 text-cyan-500',
  };

  const bgColors = {
    blue: 'bg-blue-500/20',
    emerald: 'bg-emerald-500/20',
    amber: 'bg-amber-500/20',
    purple: 'bg-purple-500/20',
    pink: 'bg-pink-500/20',
    cyan: 'bg-cyan-500/20',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-2xl p-5 border`}>
      <div className={`w-10 h-10 ${bgColors[color]} rounded-xl flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-1">
        {value}
      </div>
      <div className="text-sm text-neutral-600 dark:text-neutral-400">{label}</div>
      {subtitle && <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>}
    </div>
  );
}

// Tab Button Component
function TabButton({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
        active
          ? 'text-violet-500 bg-violet-50 dark:bg-violet-950/30'
          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

// Action Link Component
function ActionLink({
  href,
  icon,
  title,
  description
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 bg-white dark:bg-neutral-900/50 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-violet-500 dark:hover:border-violet-500 transition-colors group"
    >
      <div className="text-neutral-600 dark:text-neutral-400 group-hover:text-violet-500 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white group-hover:text-violet-500 transition-colors">
          {title}
        </h3>
        <p className="text-xs text-neutral-600 dark:text-neutral-400">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-neutral-400 group-hover:text-violet-500 transition-colors" />
    </Link>
  );
}

// Quick Action Button Component
function QuickActionButton({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-neutral-800 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors group border border-neutral-200 dark:border-neutral-700"
    >
      <div className="w-10 h-10 bg-violet-500/10 dark:bg-violet-500/20 rounded-xl flex items-center justify-center text-violet-500 group-hover:bg-violet-500 group-hover:text-white transition-all">
        {icon}
      </div>
      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 text-center">
        {label}
      </span>
    </button>
  );
}
