'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Loader2,
  SearchCheck,
  Upload,
  Users,
} from 'lucide-react';
import { branchesApi, type Branch } from '@/lib/api/branchesApi';
import {
  memberHistoricalImportApi,
  type HistoricalImportDryRunResult,
  type HistoricalImportExecuteResult,
  type HistoricalImportStaffPreview,
} from '@/lib/api/memberHistoricalImportApi';
import { getApiErrorMessage } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

const ROLE_ALLOWED = ['SUPER_ADMIN', 'ADMIN_MANAGER'];

export default function MemberHistoricalImportPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [dryRun, setDryRun] = useState<HistoricalImportDryRunResult | null>(null);
  const [executeResult, setExecuteResult] = useState<HistoricalImportExecuteResult | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!ROLE_ALLOWED.includes(user.role)) {
      showToast.error('Akses ditolak');
      router.push('/dashboard');
      return;
    }

    void loadBranches();
  }, [router, user]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === branchId),
    [branches, branchId],
  );

  const canDryRun = Boolean(file && branchId && !dryRunLoading && !executeLoading);
  const canExecute = Boolean(file && branchId && dryRun?.canImport && !dryRunLoading && !executeLoading);

  async function loadBranches() {
    try {
      setLoadingBranches(true);
      const response = await branchesApi.getAllBranches();
      const data = Array.isArray(response.data.data) ? response.data.data : [];
      setBranches(data);
      if (data.length === 1) setBranchId(data[0].id);
    } catch (error) {
      assertCaughtError(error);
      showToast.error(getApiErrorMessage(error));
    } finally {
      setLoadingBranches(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setDryRun(null);
    setExecuteResult(null);
  }

  async function handleDryRun() {
    if (!file || !branchId) return;

    try {
      setDryRunLoading(true);
      setExecuteResult(null);
      const result = await memberHistoricalImportApi.dryRun(file, branchId);
      setDryRun(result);
      showToast.success('Dry-run selesai');
    } catch (error) {
      assertCaughtError(error);
      showToast.error(getApiErrorMessage(error));
    } finally {
      setDryRunLoading(false);
    }
  }

  async function handleExecute() {
    if (!file || !branchId || !dryRun?.canImport) return;
    const confirmed = window.confirm(
      `Import data ke cabang ${selectedBranch?.name || dryRun.branch.name}? Data existing tidak akan dibuat ulang.`,
    );
    if (!confirmed) return;

    try {
      setExecuteLoading(true);
      const result = await memberHistoricalImportApi.execute(file, branchId, {
        markSessionsCompleted: true,
        createPlaceholderStaff: true,
        skipMaterialUsage: true,
      });
      setExecuteResult(result);
      showToast.success('Import selesai');
    } catch (error) {
      assertCaughtError(error);
      showToast.error(getApiErrorMessage(error));
    } finally {
      setExecuteLoading(false);
    }
  }

  if (!user || !ROLE_ALLOWED.includes(user.role)) return null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-neutral-950 dark:text-white">
              Import Data Historis Member
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Super Admin dan Admin Manager
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Cabang tujuan</span>
            <select
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setDryRun(null);
                setExecuteResult(null);
              }}
              disabled={loadingBranches}
              className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            >
              <option value="">Pilih cabang</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branchCode} - {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">File Excel</span>
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="block h-11 w-full rounded-lg border border-neutral-300 bg-white text-sm text-neutral-900 file:mr-4 file:h-full file:border-0 file:bg-neutral-100 file:px-4 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:file:bg-neutral-800 dark:file:text-neutral-200"
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
            <button
              type="button"
              onClick={handleDryRun}
              disabled={!canDryRun}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
            >
              {dryRunLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
              Dry-run
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={!canExecute}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {executeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import
            </button>
          </div>
        </div>
      </section>

      {dryRun && (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">Preview Import</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {dryRun.fileName} ke {dryRun.branch.branchCode} - {dryRun.branch.name}
                </p>
              </div>
              <StatusBadge ok={dryRun.canImport} />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <CountTile label="Member" value={dryRun.counts.members} icon={<Users className="h-4 w-4" />} />
              <CountTile label="Paket" value={dryRun.counts.packages} icon={<Database className="h-4 w-4" />} />
              <CountTile label="Plan" value={dryRun.counts.therapyPlans} icon={<FileSpreadsheet className="h-4 w-4" />} />
              <CountTile label="Sesi" value={dryRun.counts.sessions} icon={<Activity className="h-4 w-4" />} />
              <CountTile label="Completed" value={dryRun.counts.completedSessions} icon={<CheckCircle2 className="h-4 w-4" />} />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <SummaryLine label="Member baru" value={dryRun.memberMatching.willCreateMembers} />
              <SummaryLine label="Member existing dipakai ulang" value={dryRun.memberMatching.willReuseMembers} />
              <SummaryLine label="Vital rows" value={dryRun.counts.vitals} />
              <SummaryLine label="Infus aktual rows" value={dryRun.counts.infusions} />
              <SummaryLine label="Evaluasi rows" value={dryRun.counts.evaluations} />
              <SummaryLine label="Material usage dilewati" value={dryRun.counts.materials} />
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="mb-4 text-lg font-semibold text-neutral-950 dark:text-white">Validasi</h2>
            <InfoList title="Error" items={dryRun.errors.map((item) => `${item.field}: ${item.message}`)} tone="red" />
            <InfoList title="Warning" items={dryRun.warnings} tone="amber" />
            <DuplicateSummary dryRun={dryRun} />
          </div>
        </section>
      )}

      {dryRun && (
        <section className="grid gap-4 lg:grid-cols-3">
          <StaffPanel title="Dokter" items={dryRun.staffPreview.doctors} />
          <StaffPanel title="Perawat" items={dryRun.staffPreview.nurses} />
          <StaffPanel title="Admin Layanan" items={dryRun.staffPreview.adminLayanan} />
        </section>
      )}

      {dryRun?.memberMatching.existing.length ? (
        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="mb-4 text-lg font-semibold text-neutral-950 dark:text-white">Member Existing</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Kode Excel</th>
                  <th className="px-3 py-2">Nama Import</th>
                  <th className="px-3 py-2">Matched by</th>
                  <th className="px-3 py-2">Member No</th>
                  <th className="px-3 py-2">Nama Existing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {dryRun.memberMatching.existing.map((item) => (
                  <tr key={`${item.rowNumber}-${item.memberCode}`}>
                    <td className="px-3 py-2 text-neutral-500">{item.rowNumber}</td>
                    <td className="px-3 py-2 font-mono text-xs">{item.memberCode}</td>
                    <td className="px-3 py-2">{item.importedName}</td>
                    <td className="px-3 py-2">{item.matchedBy}</td>
                    <td className="px-3 py-2 font-mono text-xs">{item.existingMemberNo}</td>
                    <td className="px-3 py-2">{item.existingName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {executeResult && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Import Selesai</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            {Object.entries(executeResult.imported).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-white/70 p-3 dark:bg-neutral-950/40">
                <div className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-300">
                  {formatKey(key)}
                </div>
                <div className="mt-1 text-2xl font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
      ok
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
        : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
    }`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {ok ? 'Siap import' : 'Perlu koreksi'}
    </span>
  );
}

function CountTile({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex items-center justify-between text-neutral-500 dark:text-neutral-400">
        <span className="text-xs font-medium">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-semibold text-neutral-950 dark:text-white">{value}</div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-900">
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
      <span className="font-semibold text-neutral-950 dark:text-white">{value}</span>
    </div>
  );
}

function InfoList({ title, items, tone }: { title: string; items: string[]; tone: 'red' | 'amber' }) {
  if (items.length === 0) return null;
  const classes = tone === 'red'
    ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'
    : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100';

  return (
    <div className={`mb-3 rounded-lg border p-3 ${classes}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </div>
      <div className="space-y-1 text-sm">
        {items.map((item, index) => (
          <p key={`${title}-${index}`} className="break-words">{item}</p>
        ))}
      </div>
    </div>
  );
}

function DuplicateSummary({ dryRun }: { dryRun: HistoricalImportDryRunResult }) {
  const total =
    dryRun.duplicates.byNik.length +
    dryRun.duplicates.byNameBirthNik.length +
    dryRun.duplicates.byNameBirth.length;

  if (total === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
        Tidak ada duplikasi internal file dari NIK atau nama + tanggal lahir.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <div className="mb-2 font-semibold">Duplikasi internal file: {total} grup</div>
      {[...dryRun.duplicates.byNik, ...dryRun.duplicates.byNameBirthNik, ...dryRun.duplicates.byNameBirth].map((group) => (
        <p key={`${group.key}-${group.rows.join('-')}`} className="break-words">
          Row {group.rows.join(', ')}: {group.names.join(', ') || group.memberCodes.join(', ')}
        </p>
      ))}
    </div>
  );
}

function StaffPanel({ title, items }: { title: string; items: HistoricalImportStaffPreview[] }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="mb-4 text-lg font-semibold text-neutral-950 dark:text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Tidak ada data.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={`${title}-${item.name}`} className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="break-words text-sm font-semibold text-neutral-950 dark:text-white">{item.name}</div>
                  <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {item.matched ? item.matchedName : 'Akan dibuat placeholder'}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                  item.matched
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                }`}>
                  {item.matched ? 'Match' : 'Baru'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatKey(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase());
}
