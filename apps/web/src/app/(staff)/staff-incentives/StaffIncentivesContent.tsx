'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeDollarSign, Building2, CalendarDays, CheckCircle2, Download, Droplets, Loader2, Stethoscope, Target, Users } from 'lucide-react';
import { branchesApi } from '@/lib/api/branchesApi';
import { doctorBranchApi, type ManagedBranch } from '@/lib/api/doctorBranchApi';
import { assertCaughtError } from '@/lib/caughtError';
import { formatCurrency } from '@/lib/formatNumber';
import { showToast } from '@/lib/toast';
import { usersApi, type StaffMonthlyIncentiveResponse } from '@/lib/usersApi';
import { useAuthStore } from '@/stores/authStore';
import { CoordinatorAssignmentManager } from './CoordinatorAssignmentManager';
import { DoctorHeadAssignmentManager } from './DoctorHeadAssignmentManager';

type Branch = { id: string; name: string; branchCode: string };
type IncentiveView = 'all' | 'nakes' | 'mso' | 'coordinator' | 'doctor-head';

interface StaffIncentivesPageProps {
  view?: IncentiveView;
}

function jakartaMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}

function StatusBadge({ reached, children }: { reached: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
      reached
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
    }`}>
      {reached && <CheckCircle2 size={12} />}
      {children}
    </span>
  );
}

export function StaffIncentivesContent({ view = 'all' }: StaffIncentivesPageProps) {
  const user = useAuthStore((state) => state.user);
  const [month, setMonth] = useState(jakartaMonth);
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [data, setData] = useState<StaffMonthlyIncentiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdminManager = user?.role === 'ADMIN_MANAGER';
  const isFinanceController = user?.role === 'FINANCE_LOGISTICS_CONTROLLER';
  const canManageCoordinator = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'].includes(user?.role || '');
  const canSelectBranch = isSuperAdmin || isAdminManager || isFinanceController;

  useEffect(() => {
    if (canSelectBranch) setBranchId('all');
    else if (user?.branchId) setBranchId(user.branchId);
  }, [canSelectBranch, user?.branchId]);

  useEffect(() => {
    if (!canSelectBranch) return;
    const loadBranches = async () => {
      try {
        if (isAdminManager) {
          const result = await doctorBranchApi.getManagedBranches(false);
          const managed = result.map((branch: ManagedBranch) => ({
            id: branch.branchId,
            name: branch.branchName,
            branchCode: branch.branchCode,
          }));
          setBranches(managed);
          return;
        }
        const response = await branchesApi.getAllBranches();
        setBranches(response?.data?.data || []);
      } catch (error) {
        assertCaughtError(error);
        showToast.error(error.response?.data?.error?.message || 'Gagal memuat daftar cabang.');
      }
    };
    void loadBranches();
  }, [canSelectBranch, isAdminManager]);

  const load = useCallback(async () => {
    if (!month) return;
    try {
      setLoading(true);
      const result = await usersApi.getMonthlyStaffIncentives({
        month,
        branchId: canSelectBranch ? branchId || undefined : undefined,
      });
      setData(result);
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menghitung insentif bulanan.');
    } finally {
      setLoading(false);
    }
  }, [branchId, canSelectBranch, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportExcel = async () => {
    try {
      setExporting(true);
      const blob = await usersApi.exportMonthlyStaffIncentives({
        month,
        branchId: canSelectBranch ? branchId || undefined : undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `insentif-lengkap-${month}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast.success('Laporan Excel berhasil diunduh.');
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal mengekspor laporan insentif.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-6 dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/25">
              <BadgeDollarSign className="h-7 w-7 text-black" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                {view === 'nakes'
                  ? 'Insentif Nakes'
                  : view === 'mso'
                    ? 'Insentif MSO'
                    : view === 'coordinator'
                      ? 'Insentif Koordinator CHS'
                      : view === 'doctor-head'
                        ? 'Insentif Dokter Head'
                        : 'Insentif Nakes, MSO, Koordinator CHS & Dokter Head'}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {view === 'nakes'
                  ? 'Perhitungan bulanan berdasarkan infus yang selesai dan tidak dibatalkan.'
                  : view === 'mso'
                    ? 'Perhitungan bulanan berdasarkan visit dan penjualan Air Nano yang sudah lunas.'
                    : view === 'coordinator'
                      ? 'Target tim/cabang, infus berbayar, Team HO, dan tusukan pribadi Koordinator CHS.'
                      : view === 'doctor-head'
                        ? 'Target tim/cabang, dokter Homecare, partnership, dan Treatment Review Dokter Head.'
                        : 'Perhitungan bulanan berdasarkan sesi selesai, penjualan lunas, dan target organisasi.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void exportExcel()}
              disabled={exporting || loading || !data}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export Excel
            </button>
            {canSelectBranch && (
              <label className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-8 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
                  <option value="all">{isAdminManager ? 'Semua Cabang Dikelola' : 'Semua Cabang'}</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
            )}
            <label className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Periode insentif" className="rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" />
            </label>
          </div>
        </header>

        {view === 'coordinator' && canManageCoordinator && (
          <CoordinatorAssignmentManager month={month} onChanged={() => void load()} />
        )}
        {view === 'doctor-head' && isSuperAdmin && (
          <DoctorHeadAssignmentManager month={month} onChanged={() => void load()} />
        )}

        {loading && !data ? (
          <div className="flex min-h-72 items-center justify-center gap-3 text-neutral-500"><Loader2 className="animate-spin" /> Menghitung insentif...</div>
        ) : data && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ...((view === 'all' || view === 'nakes') ? [{ label: 'Total Nakes', value: data.summary.nakesTotalAmount, detail: `${data.summary.nakesRecipients} penerima`, icon: Droplets, tone: 'text-emerald-500' }] : []),
                ...((view === 'all' || view === 'mso') ? [{ label: 'Total MSO', value: data.summary.msoTotalAmount, detail: `${data.summary.msoRecipients} penerima`, icon: Users, tone: 'text-blue-500' }] : []),
                ...((view === 'all' || view === 'coordinator') ? [{ label: 'Total Koordinator CHS', value: data.summary.coordinatorTotalAmount, detail: `${data.summary.coordinatorRecipients} penerima`, icon: Target, tone: 'text-violet-500' }] : []),
                ...((view === 'all' || view === 'doctor-head') ? [{ label: 'Total Dokter Head', value: data.summary.doctorHeadTotalAmount, detail: `${data.summary.doctorHeadRecipients} penerima`, icon: Stethoscope, tone: 'text-cyan-500' }] : []),
                ...(view === 'all' ? [{ label: 'Total Keseluruhan', value: data.summary.grandTotalAmount, detail: `Periode ${data.period.month}`, icon: BadgeDollarSign, tone: 'text-amber-500' }] : []),
              ].map(({ label, value, detail, icon: Icon, tone }) => (
                <article key={label} className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p><strong className="mt-2 block text-2xl text-neutral-900 dark:text-white">{formatCurrency(value)}</strong><small className="text-neutral-500">{detail}</small></div><Icon className={tone} /></div>
                </article>
              ))}
            </section>

            {(view === 'all' || view === 'nakes') && <section className="rounded-2xl border border-emerald-200 bg-white dark:border-emerald-500/20 dark:bg-neutral-900">
              <div className="border-b border-neutral-200 p-5 dark:border-neutral-800"><h2 className="font-bold text-neutral-900 dark:text-white">Insentif Nakes</h2><p className="text-sm text-neutral-500">Rp10.000 per infus selesai + bonus Rp2.000.000 satu kali jika mencapai minimal 100 infus.</p></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-neutral-500 dark:bg-neutral-800/70"><tr><th className="px-5 py-3 text-left">Nakes</th><th className="px-5 py-3 text-right">Infus</th><th className="px-5 py-3 text-right">Per Infus</th><th className="px-5 py-3 text-center">Bonus &gt;=100</th><th className="px-5 py-3 text-right">Total</th></tr></thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {data.nakes.map((row) => <tr key={row.id}><td className="px-5 py-4"><strong className="text-neutral-900 dark:text-white">{row.fullName}</strong><small className="block text-neutral-500">{row.staffCode || row.email}</small></td><td className="px-5 py-4 text-right font-semibold">{row.infusionCount}</td><td className="px-5 py-4 text-right">{formatCurrency(row.baseAmount)}</td><td className="px-5 py-4 text-center"><StatusBadge reached={row.targetReached}>{row.targetReached ? formatCurrency(row.targetBonus) : `${row.infusionCount}/100`}</StatusBadge></td><td className="px-5 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(row.totalAmount)}</td></tr>)}
                    {data.nakes.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-neutral-500">Belum ada infus selesai pada periode ini.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>}

            {(view === 'all' || view === 'mso') && <section className="rounded-2xl border border-blue-200 bg-white dark:border-blue-500/20 dark:bg-neutral-900">
              <div className="border-b border-neutral-200 p-5 dark:border-neutral-800"><h2 className="font-bold text-neutral-900 dark:text-white">Insentif MSO</h2><p className="text-sm text-neutral-500">Bonus visit Rp2.000.000 jika visit &gt;=100 dan Air Nano lunas &gt;=5 dus, ditambah Rp90.000 untuk setiap dus lunas.</p></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-neutral-500 dark:bg-neutral-800/70"><tr><th className="px-5 py-3 text-left">MSO</th><th className="px-5 py-3 text-right">Visit</th><th className="px-5 py-3 text-right">Dus lunas</th><th className="px-5 py-3 text-right">Air Nano</th><th className="px-5 py-3 text-center">Bonus visit</th><th className="px-5 py-3 text-right">Total</th></tr></thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {data.mso.map((row) => <tr key={row.id}><td className="px-5 py-4"><strong className="text-neutral-900 dark:text-white">{row.fullName}</strong><small className="block text-neutral-500">{row.staffCode || row.email}</small></td><td className="px-5 py-4 text-right font-semibold">{row.visitCount}</td><td className="px-5 py-4 text-right font-semibold">{row.paidAirNanoBoxes}</td><td className="px-5 py-4 text-right">{formatCurrency(row.airNanoAmount)}</td><td className="px-5 py-4 text-center"><StatusBadge reached={row.visitBonusEligible}>{row.visitBonusEligible ? formatCurrency(row.visitBonus) : `${row.visitCount}/100 | ${row.paidAirNanoBoxes}/5 dus`}</StatusBadge></td><td className="px-5 py-4 text-right font-bold text-blue-600 dark:text-blue-400">{formatCurrency(row.totalAmount)}</td></tr>)}
                    {data.mso.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-neutral-500">Belum ada visit atau penjualan Air Nano lunas pada periode ini.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>}

            {(view === 'all' || view === 'coordinator') && <section className="rounded-2xl border border-violet-200 bg-white dark:border-violet-500/20 dark:bg-neutral-900">
              <div className="border-b border-neutral-200 p-5 dark:border-neutral-800">
                <h2 className="font-bold text-neutral-900 dark:text-white">Insentif Koordinator CHS</h2>
                <p className="text-sm text-neutral-500">Bonus Rp500.000 per tim HC dan Rp250.000 per cabang yang mencapai target; Rp1.000 per infus berbayar, Rp10.000 per infus Team HO, serta tusukan pribadi.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-neutral-500 dark:bg-neutral-800/70"><tr><th className="px-5 py-3 text-left">Koordinator</th><th className="px-5 py-3 text-left">Target scope</th><th className="px-5 py-3 text-right">Bonus tim</th><th className="px-5 py-3 text-right">Bonus cabang</th><th className="px-5 py-3 text-right">Infus Rp1.000</th><th className="px-5 py-3 text-right">Team HO</th><th className="px-5 py-3 text-right">Tusukan pribadi</th><th className="px-5 py-3 text-center">Bonus pribadi</th><th className="px-5 py-3 text-right">Total</th></tr></thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {data.coordinators.map((row) => <tr key={row.id}>
                      <td className="px-5 py-4"><strong className="text-neutral-900 dark:text-white">{row.fullName}</strong><small className="block text-neutral-500">{row.staffCode || row.email}</small></td>
                      <td className="px-5 py-4"><div className="space-y-1">{row.scopes.map((scope) => <div key={scope.assignmentId} className="flex items-center gap-2"><StatusBadge reached={scope.qualifierPassed}>{scope.incentiveType === 'HO' ? 'TEAM HO' : scope.qualifierPassed ? 'PASS' : 'BELUM'}</StatusBadge><span className="text-xs text-neutral-500">{scope.scopeName} · {scope.totalInfusions}{scope.qualifierTarget ? `/${scope.qualifierTarget}` : ''}</span></div>)}</div></td>
                      <td className="px-5 py-4 text-right"><strong>{row.qualifiedHomecareTeams}</strong><small className="block text-neutral-500">{formatCurrency(row.homecareTeamTargetBonus)}</small></td>
                      <td className="px-5 py-4 text-right"><strong>{row.qualifiedBranches}</strong><small className="block text-neutral-500">{formatCurrency(row.branchTargetBonus)}</small></td>
                      <td className="px-5 py-4 text-right"><strong>{row.eligiblePaidInfusions}</strong><small className="block text-neutral-500">{formatCurrency(row.paidInfusionAmount)}</small></td>
                      <td className="px-5 py-4 text-right"><strong>{row.hoPaidInfusions}</strong><small className="block text-neutral-500">{formatCurrency(row.hoInfusionAmount)}</small></td>
                      <td className="px-5 py-4 text-right"><strong>{row.personalInfusions}</strong><small className="block text-neutral-500">{formatCurrency(row.personalInfusionAmount)}</small></td>
                      <td className="px-5 py-4 text-center"><StatusBadge reached={row.personalTargetReached}>{row.personalTargetReached ? formatCurrency(row.personalTargetBonus) : `${row.personalInfusions}/100`}</StatusBadge></td>
                      <td className="px-5 py-4 text-right font-bold text-violet-600 dark:text-violet-400">{formatCurrency(row.totalAmount)}</td>
                    </tr>)}
                    {data.coordinators.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-neutral-500">Belum ada assignment Koordinator CHS aktif pada periode ini.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>}

            {(view === 'all' || view === 'doctor-head') && <section className="rounded-2xl border border-cyan-200 bg-white dark:border-cyan-500/20 dark:bg-neutral-900">
              <div className="border-b border-neutral-200 p-5 dark:border-neutral-800">
                <h2 className="font-bold text-neutral-900 dark:text-white">Insentif Dokter Head</h2>
                <p className="text-sm text-neutral-500">Bonus target tim dan cabang, omzet tim HC saat merangkap dokter, serta omzet Partnership. Treatment Review ditampilkan terpisah karena ketentuan nominalnya belum dikonfigurasi.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-neutral-500 dark:bg-neutral-800/70"><tr><th className="px-5 py-3 text-left">Dokter Head</th><th className="px-5 py-3 text-left">Target cabang</th><th className="px-5 py-3 text-right">Bonus tim HC</th><th className="px-5 py-3 text-right">Bonus cabang</th><th className="px-5 py-3 text-right">Dokter tim HC</th><th className="px-5 py-3 text-right">Partnership</th><th className="px-5 py-3 text-center">Treatment Review</th><th className="px-5 py-3 text-right">Total</th></tr></thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {data.doctorHeads.map((row) => <tr key={row.id}>
                      <td className="px-5 py-4"><strong className="text-neutral-900 dark:text-white">{row.fullName}</strong><small className="block text-neutral-500">{row.staffCode || row.email}</small></td>
                      <td className="px-5 py-4"><div className="space-y-1">{row.scopes.map((scope) => <div key={scope.assignmentId} className="flex items-center gap-2"><StatusBadge reached={scope.qualifierPassed}>{scope.qualifierPassed ? 'PASS' : 'BELUM'}</StatusBadge><span className="text-xs text-neutral-500">{scope.branchName} · {scope.totalInfusions}/{scope.qualifierTarget}</span></div>)}</div></td>
                      <td className="px-5 py-4 text-right"><strong>{row.qualifiedHomecareTeams} tim</strong><small className="block text-neutral-500">{formatCurrency(row.homecareTeamTargetBonus)}</small></td>
                      <td className="px-5 py-4 text-right"><strong>{row.qualifiedBranches} cabang</strong><small className="block text-neutral-500">{formatCurrency(row.branchTargetBonus)}</small></td>
                      <td className="px-5 py-4 text-right"><strong>{row.homecareDoctorPaidInfusions} infus lunas</strong><small className="block text-neutral-500">{formatCurrency(row.homecareDoctorAmount)}</small></td>
                      <td className="px-5 py-4 text-right"><StatusBadge reached={row.partnershipTargetReached}>{row.partnershipTargetReached ? 'PASS' : `${row.partnershipTotalInfusions}/1500`}</StatusBadge><small className="mt-1 block text-neutral-500">{row.partnershipPaidInfusions} lunas · {formatCurrency(row.partnershipAmount)}</small></td>
                      <td className="px-5 py-4 text-center"><StatusBadge reached={false}>Belum dikonfigurasi</StatusBadge></td>
                      <td className="px-5 py-4 text-right font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(row.totalAmount)}</td>
                    </tr>)}
                    {data.doctorHeads.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-neutral-500">Belum ada assignment Dokter Head aktif pada periode ini.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>}

            <aside className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
              <Target className="mt-0.5 h-5 w-5 flex-none" />
              <p>
                {view === 'nakes'
                  ? 'Bonus target Nakes dibayar satu kali per bulan dan tidak berlaku kelipatan.'
                  : view === 'mso'
                    ? 'Bonus visit MSO dibayar satu kali per bulan setelah syarat visit dan penjualan lunas terpenuhi.'
                    : view === 'coordinator'
                      ? 'Free, sosial, dan diskon di atas 40% tidak masuk komponen Rp1.000, tetapi tetap masuk tusukan pribadi. Semua bonus target hanya satu kali per bulan.'
                      : view === 'doctor-head'
                        ? 'Bonus tim dan cabang dihitung per scope yang mencapai target. Treatment Review belum masuk total sampai ketentuannya dikonfigurasi.'
                        : 'Bonus target dihitung satu kali untuk setiap scope yang memenuhi ketentuan dan tidak berlaku kelipatan.'}{' '}
                Halaman ini merupakan kalkulasi operasional; pencairan tetap mengikuti verifikasi dan proses Finance.
              </p>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
