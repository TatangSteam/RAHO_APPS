'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  Activity,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { branchesApi, type Branch } from '@/lib/api/branchesApi';
import { devError } from '@/lib/logger';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface AuditChangedField {
  field: string;
  before: unknown;
  after: unknown;
}

interface AuditLog {
  id: string;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  branchId: string | null;
  branchName: string | null;
  branchCode: string | null;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  entityCode: string | null;
  resource: string;
  resourceId: string | null;
  description: string;
  beforeData: unknown;
  afterData: unknown;
  changedFields: AuditChangedField[];
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
}

interface AuditLogListResponse {
  success: boolean;
  data: {
    logs: AuditLog[];
    pagination: Pagination;
  };
}

interface AuditLogDetailResponse {
  success: boolean;
  data: AuditLog;
}

const ACTION_OPTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'VERIFY_PAYMENT',
  'REJECT_PAYMENT',
  'UPLOAD_FILE',
  'STATUS_CHANGE',
  'ASSIGN',
  'CANCEL',
  'COMPLETE',
  'STOCK_REQUEST',
  'SHIPMENT',
  'RECEIVE_SHIPMENT',
  'STOCK_ADJUSTMENT',
  'ACCESS_DENIED',
];

const MODULE_OPTIONS = [
  'AUTH',
  'MEMBER',
  'PAKET_TERAPI',
  'SESI_TERAPI',
  'DIAGNOSIS',
  'THERAPY_PLAN',
  'INVENTORY',
  'MASTER_PRODUCT',
  'USER_MANAGEMENT',
  'CABANG',
  'HARGA_PAKET',
  'REFERRAL',
  'UPLOAD_DOCUMENT',
  'IAM',
  'ACCOUNTING',
  'CASH_BANK',
  'EXPENSE',
  'PURCHASING',
  'ACCOUNTS_PAYABLE',
  'REVENUE',
  'PLATFORM',
];

const ROLE_OPTIONS = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'];
const PAGE_LIMIT = 25;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function compactId(value?: string | null): string {
  if (!value) return '-';
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getActionClass(action: string): string {
  if (['DELETE', 'REJECT_PAYMENT', 'LOGIN_FAILED', 'CANCEL', 'ACCESS_DENIED'].includes(action)) {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';
  }
  if (['CREATE', 'VERIFY_PAYMENT', 'COMPLETE', 'RECEIVE_SHIPMENT'].includes(action)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (['LOGIN_SUCCESS', 'LOGOUT', 'ASSIGN'].includes(action)) {
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300';
  }
  if (['STOCK_REQUEST', 'SHIPMENT', 'STOCK_ADJUSTMENT'].includes(action)) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
  }
  return 'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
}

function getModuleClass(module: string): string {
  if (['INVENTORY', 'MASTER_PRODUCT'].includes(module)) {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300';
  }
  if (['PAKET_TERAPI', 'SESI_TERAPI', 'THERAPY_PLAN'].includes(module)) {
    return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300';
  }
  if (['AUTH', 'USER_MANAGEMENT'].includes(module)) {
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300';
  }
  if (['MEMBER', 'DIAGNOSIS', 'UPLOAD_DOCUMENT'].includes(module)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  return 'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
}

function parseBranchList(payload: unknown): Branch[] {
  if (Array.isArray(payload)) return payload as Branch[];
  const data = payload as { branches?: Branch[]; data?: Branch[] } | undefined;
  if (Array.isArray(data?.branches)) return data.branches;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
      {formatJsonValue(value)}
    </pre>
  );
}

function DetailModal({
  log,
  loading,
  onClose,
}: {
  log: AuditLog | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (!log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5 dark:border-neutral-800">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={clsx('rounded-full border px-2.5 py-1 text-xs font-semibold', getActionClass(log.action))}>
                  {log.action}
                </span>
                <span className={clsx('rounded-full border px-2.5 py-1 text-xs font-semibold', getModuleClass(log.module))}>
                  {log.module}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-semibold tracking-normal text-neutral-950 dark:text-white">
                {log.description}
              </h2>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {formatDateTime(log.createdAt)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-red-200 hover:text-red-600 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-red-500/30 dark:hover:text-red-300"
            title="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Memuat detail audit...
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                    <UserRound className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                    Pelaku
                  </h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500 dark:text-neutral-400">Nama</dt>
                      <dd className="text-right font-medium text-neutral-900 dark:text-neutral-100">{log.userName || '-'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500 dark:text-neutral-400">Email</dt>
                      <dd className="text-right font-medium text-neutral-900 dark:text-neutral-100">{log.userEmail || '-'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500 dark:text-neutral-400">Role</dt>
                      <dd className="text-right font-medium text-neutral-900 dark:text-neutral-100">{log.userRole || '-'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                    <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    Cabang
                  </h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500 dark:text-neutral-400">Nama</dt>
                      <dd className="text-right font-medium text-neutral-900 dark:text-neutral-100">{log.branchName || '-'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500 dark:text-neutral-400">Kode</dt>
                      <dd className="text-right font-medium text-neutral-900 dark:text-neutral-100">{log.branchCode || '-'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                    <Database className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                    Data
                  </h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500 dark:text-neutral-400">Entity</dt>
                      <dd className="text-right font-medium text-neutral-900 dark:text-neutral-100">{log.entityType}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500 dark:text-neutral-400">Kode/ID</dt>
                      <dd className="text-right font-medium text-neutral-900 dark:text-neutral-100">{log.entityCode || compactId(log.entityId)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500 dark:text-neutral-400">IP</dt>
                      <dd className="text-right font-medium text-neutral-900 dark:text-neutral-100">{log.ipAddress || '-'}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                    <FileText className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                    Perubahan Field
                  </h3>
                  {log.changedFields?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <thead className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
                          <tr>
                            <th className="py-2 pr-3">Field</th>
                            <th className="px-3 py-2">Sebelum</th>
                            <th className="py-2 pl-3">Sesudah</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                          {log.changedFields.map((item) => (
                            <tr key={`${log.id}-${item.field}`}>
                              <td className="py-2 pr-3 font-medium text-neutral-900 dark:text-neutral-100">{item.field}</td>
                              <td className="max-w-[220px] px-3 py-2 text-neutral-600 dark:text-neutral-300">
                                <span className="line-clamp-3 whitespace-pre-wrap break-words">{formatJsonValue(item.before)}</span>
                              </td>
                              <td className="max-w-[220px] py-2 pl-3 text-neutral-600 dark:text-neutral-300">
                                <span className="line-clamp-3 whitespace-pre-wrap break-words">{formatJsonValue(item.after)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Tidak ada diff field yang tercatat.</p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-950 dark:text-white">Before</h3>
                    <JsonBlock value={log.beforeData} />
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-950 dark:text-white">After</h3>
                    <JsonBlock value={log.afterData} />
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-neutral-950 dark:text-white">Metadata</h3>
                  <JsonBlock value={log.metadata} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [canAccess, setCanAccess] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: PAGE_LIMIT,
    totalPages: 1,
  });

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [module, setModule] = useState('');
  const [actor, setActor] = useState('');
  const [resource, setResource] = useState('');
  const [role, setRole] = useState('');
  const [branchId, setBranchId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = {
      page,
      limit: PAGE_LIMIT,
    };
    if (search) params.search = search;
    if (action) params.action = action;
    if (module) params.module = module;
    if (actor) params.actor = actor;
    if (resource) params.resource = resource;
    if (role) params.role = role;
    if (branchId) params.branchId = branchId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return params;
  }, [action, actor, branchId, endDate, module, page, resource, role, search, startDate]);

  const exportParams = useMemo(() => {
    const params = { ...queryParams };
    delete params.page;
    delete params.limit;
    return params;
  }, [queryParams]);

  const loadBranches = useCallback(async () => {
    try {
      const response = await branchesApi.getAllBranches();
      setBranches(parseBranchList(response.data?.data));
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading branches for audit filter:', error);
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    if (!accessChecked || !canAccess) return;

    try {
      setLoading(true);
      const response = await api.get<AuditLogListResponse>('/audit-logs', {
        params: queryParams,
      });
      setLogs(response.data.data.logs);
      setPagination(response.data.data.pagination);
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading audit logs:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat audit log');
    } finally {
      setLoading(false);
    }
  }, [accessChecked, canAccess, queryParams]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!user || !accessToken) {
      router.push('/login');
      return;
    }

    let cancelled = false;
    void api.get('/iam/me').then((response) => {
      if (cancelled) return;
      const allowed = (response.data?.data?.permissions || []).includes('AUDIT.READ');
      setCanAccess(allowed);
      setAccessChecked(true);
      if (!allowed) {
        showToast.error('Permission AUDIT.READ diperlukan');
        router.push('/dashboard');
        return;
      }
      void loadBranches();
    }).catch((error) => {
      if (cancelled) return;
      setAccessChecked(true);
      showToast.error(error.response?.data?.error?.message || 'Gagal memeriksa akses audit log');
      router.push('/dashboard');
    });

    return () => { cancelled = true; };
  }, [accessToken, loadBranches, mounted, router, user]);

  useEffect(() => {
    if (mounted && accessChecked && canAccess) {
      loadAuditLogs();
    }
  }, [accessChecked, canAccess, loadAuditLogs, mounted]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setAction('');
    setModule('');
    setActor('');
    setResource('');
    setRole('');
    setBranchId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const openDetail = async (log: AuditLog) => {
    setSelectedLog(log);
    setDetailLoading(true);
    try {
      const response = await api.get<AuditLogDetailResponse>(`/audit-logs/${log.id}`);
      setSelectedLog(response.data.data);
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading audit detail:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat detail audit');
    } finally {
      setDetailLoading(false);
    }
  };

  const exportCsv = async () => {
    try {
      setExporting(true);
      const response = await api.get('/audit-logs/export', {
        params: exportParams,
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast.success('Audit log berhasil diexport');
    } catch (error) {
      assertCaughtError(error);
      devError('Error exporting audit logs:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal export audit log');
    } finally {
      setExporting(false);
    }
  };

  if (!mounted || !accessChecked || !canAccess) return null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            <Activity className="h-4 w-4" />
            <span>{pagination.total} aktivitas tercatat</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-neutral-950 dark:text-white">
            Audit Log
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadAuditLogs}
            disabled={loading}
            className={clsx(
              'inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors',
              'border-neutral-200 bg-white text-neutral-700 hover:border-amber-300 hover:text-amber-700',
              'dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-amber-500/40 dark:hover:text-amber-400',
              loading && 'cursor-not-allowed opacity-70',
            )}
          >
            <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className={clsx(
              'inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors',
              'border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700',
              'dark:border-emerald-500/30 dark:bg-emerald-500 dark:hover:bg-emerald-400',
              exporting && 'cursor-not-allowed opacity-70',
            )}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export CSV
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
          <Filter className="h-4 w-4 text-amber-600 dark:text-amber-300" />
          Filter
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && applySearch()}
                placeholder="Cari user, entity, kode, atau deskripsi"
                className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-amber-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-amber-500"
              />
            </div>
            <button
              type="button"
              onClick={applySearch}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
            >
              Cari
            </button>
          </div>

          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-amber-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-amber-500"
          >
            <option value="">Semua action</option>
            {ACTION_OPTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select
            value={module}
            onChange={(event) => {
              setModule(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-amber-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-amber-500"
          >
            <option value="">Semua modul</option>
            {MODULE_OPTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-amber-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-amber-500"
          >
            <option value="">Semua role</option>
            {ROLE_OPTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={actor}
              onChange={(event) => {
                setActor(event.target.value);
                setPage(1);
              }}
              placeholder="Actor / email"
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-amber-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-amber-500"
            />
          </div>

          <div className="relative">
            <Database className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={resource}
              onChange={(event) => {
                setResource(event.target.value);
                setPage(1);
              }}
              placeholder="Resource, contoh Warehouse"
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-amber-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-amber-500"
            />
          </div>

          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <select
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 outline-none focus:border-amber-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-amber-500"
            >
              <option value="">Semua cabang</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 outline-none focus:border-amber-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-amber-500"
            />
          </div>

          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 outline-none focus:border-amber-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-amber-500"
            />
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 transition-colors hover:border-red-200 hover:text-red-600 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-red-500/30 dark:hover:text-red-300"
          >
            <X className="h-4 w-4" />
            Reset
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950" aria-busy={loading}>
        {loading && logs.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Memuat audit log...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center p-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              <FileText className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-neutral-950 dark:text-white">
              Tidak ada audit log
            </h2>
            <p className="mt-1 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
              Aktivitas belum tercatat untuk kombinasi filter saat ini.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400">
                  <tr>
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3">Pelaku</th>
                    <th className="px-4 py-3">Cabang</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Modul</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Deskripsi</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/40">
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <CalendarDays className="h-4 w-4 text-neutral-400" />
                          {formatDateTime(log.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-[170px]">
                          <p className="font-medium text-neutral-950 dark:text-white">{log.userName || '-'}</p>
                          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{log.userRole || '-'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-[150px]">
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">{log.branchName || '-'}</p>
                          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{log.branchCode || '-'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold', getActionClass(log.action))}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold', getModuleClass(log.module))}>
                          {log.module}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-[140px]">
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">{log.entityType}</p>
                          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{log.entityCode || compactId(log.entityId)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="line-clamp-2 max-w-[320px] text-neutral-700 dark:text-neutral-300">
                          {log.description}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                        <div className="flex min-w-[120px] items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-neutral-400" />
                          {log.ipAddress || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openDetail(log)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:border-amber-300 hover:text-amber-700 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-amber-500/40 dark:hover:text-amber-300"
                          title="Lihat detail"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-neutral-600 dark:text-neutral-400">
                Halaman {pagination.page} dari {Math.max(pagination.totalPages, 1)} · {pagination.total} log
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-neutral-200 px-3 font-semibold text-neutral-700 transition-colors hover:border-amber-300 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-amber-500/40 dark:hover:text-amber-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Sebelumnya
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(Math.max(pagination.totalPages, 1), current + 1))}
                  disabled={page >= Math.max(pagination.totalPages, 1)}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-neutral-200 px-3 font-semibold text-neutral-700 transition-colors hover:border-amber-300 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-amber-500/40 dark:hover:text-amber-300"
                >
                  Selanjutnya
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <DetailModal log={selectedLog} loading={detailLoading} onClose={() => setSelectedLog(null)} />
    </div>
  );
}
