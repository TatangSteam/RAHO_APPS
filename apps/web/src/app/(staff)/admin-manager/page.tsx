'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  UserCog, Building2, Users, ChevronRight, Loader2, 
  ArrowLeft,
  Shield, MapPin
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { BranchAdminsTab } from '@/components/admin/BranchAdminsTab';

export default function AdminManagerPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!user || !accessToken) {
      router.push('/login');
      return;
    }

    if (user.role !== 'ADMIN_MANAGER') {
      showToast.error('Akses ditolak - Hanya untuk Admin Manager');
      router.push('/dashboard');
      return;
    }
  }, [mounted, user, accessToken, router]);

  if (!mounted) return null;

  if (!user || user.role !== 'ADMIN_MANAGER') {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/admin-manager"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
            </Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30">
              <UserCog className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                Kelola Admin Cabang
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Kelola dan impersonate Admin Cabang di cabang Anda
              </p>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 dark:from-amber-500/20 dark:to-orange-500/10 rounded-2xl border border-amber-500/20 p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
                Fitur Impersonation
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Anda dapat login sebagai Admin Cabang untuk membantu troubleshooting atau melakukan tugas atas nama mereka. 
                Semua aktivitas akan tercatat di audit log.
              </p>
            </div>
          </div>
        </div>

        {/* Branch Admins Tab */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 md:p-6">
          <BranchAdminsTab />
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
          <Link 
            href="/dashboard/admin-manager"
            className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-violet-500/50 transition-colors"
          >
            <div className="w-10 h-10 bg-violet-500/15 rounded-xl flex items-center justify-center">
              <Building2 className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <div className="font-medium text-neutral-900 dark:text-white text-sm">Dashboard</div>
              <div className="text-xs text-neutral-500">Overview cabang</div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400 ml-auto" />
          </Link>

          <Link 
            href="/branches"
            className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/50 transition-colors"
          >
            <div className="w-10 h-10 bg-cyan-500/15 rounded-xl flex items-center justify-center">
              <MapPin className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <div className="font-medium text-neutral-900 dark:text-white text-sm">Cabang</div>
              <div className="text-xs text-neutral-500">Kelola cabang</div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400 ml-auto" />
          </Link>

          <Link 
            href="/members"
            className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 transition-colors"
          >
            <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="font-medium text-neutral-900 dark:text-white text-sm">Member</div>
              <div className="text-xs text-neutral-500">Semua member</div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400 ml-auto" />
          </Link>
        </div>
      </div>
    </div>
  );
}
