'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Ban,
  Building2,
  CheckCircle2,
  CircleAlert,
  Database,
  ExternalLink,
  Eye,
  List,
  Loader2,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Unplug,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

type Tab = 'connection' | 'queue' | 'discovery' | 'contacts';
type EventStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'DRY_RUN' | 'DEAD_LETTER' | 'IGNORED';

type Connection = {
  id: string;
  organizationId: string;
  organizationName: string;
  dataCenter: string;
  isActive: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  missingScopes: string[];
  reconnectRequired: boolean;
  organizationCurrencyCode: string | null;
  discoveryLastRunAt: string | null;
  contactSyncReady: boolean;
};
type Status = {
  configured: boolean;
  redirectUri: string | null;
  connected: boolean;
  dryRun: boolean;
  workerEnabled: boolean;
  connections: Connection[];
};
type SyncAttempt = {
  id: string;
  attemptNo: number;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
};
type SyncEvent = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  branchId: string | null;
  status: EventStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  availableAt: string;
  occurredAt: string;
  payload: unknown;
  syncAttempts: SyncAttempt[];
};
type QueueData = {
  items: SyncEvent[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type DiscoveryItem = {
  id: string;
  resourceType: string;
  zohoId: string;
  name: string;
  code: string | null;
  isActive: boolean;
};
type DiscoveryData = {
  organizationId: string;
  lastRunAt: string | null;
  counts: Record<string, number>;
  items: DiscoveryItem[];
  contactExternalIdField: {
    fieldId: string | null;
    apiName: string | null;
    isUnique: boolean | null;
    ready: boolean;
  };
};
type ContactCandidate = {
  contact_id: string;
  contact_name: string;
  contact_type: string;
  email?: string;
  phone?: string;
};
type ContactReview = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  candidates: ContactCandidate[];
};
type ContactMappingRow = {
  entityType: 'MEMBER' | 'SUPPLIER';
  id: string;
  code: string;
  name: string;
  email: string | null;
  isActive: boolean;
  mapping: { zohoEntityId: string; status: string; lastSyncedAt: string | null } | null;
  review: ContactReview | null;
};
type ContactData = {
  items: ContactMappingRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const eventStatuses: Array<EventStatus | ''> = [
  '',
  'PENDING',
  'PROCESSING',
  'DRY_RUN',
  'PROCESSED',
  'FAILED',
  'DEAD_LETTER',
  'IGNORED',
];

const badge: Record<EventStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  PROCESSED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
  DRY_RUN: 'bg-violet-100 text-violet-800',
  DEAD_LETTER: 'bg-rose-200 text-rose-900',
  IGNORED: 'bg-neutral-200 text-neutral-700',
};

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  const message = error.response?.data?.error?.message;
  return typeof message === 'string' ? message : fallback;
}

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString('id-ID') : '-';
}

export default function ZohoIntegrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const canManageConnection = user?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<Tab>('connection');
  const [status, setStatus] = useState<Status | null>(null);
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [discovery, setDiscovery] = useState<DiscoveryData | null>(null);
  const [contacts, setContacts] = useState<ContactData | null>(null);
  const [contactEntityType, setContactEntityType] = useState<'MEMBER' | 'SUPPLIER'>('MEMBER');
  const [contactSearch, setContactSearch] = useState('');
  const [contactPreview, setContactPreview] = useState<{
    snapshot: { displayName: string; externalKey: string };
    payload: unknown;
    excludedFields: string[];
    liveCreateReady: boolean;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<EventStatus | ''>('');
  const [selectedEvent, setSelectedEvent] = useState<SyncEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const response = await api.get<{ data: Status }>('/integrations/zoho/status');
    setStatus(response.data.data);
  }, []);

  const loadQueue = useCallback(async () => {
    const response = await api.get<{ data: QueueData }>('/integrations/zoho/events', {
      params: { limit: 50, ...(statusFilter ? { status: statusFilter } : {}) },
    });
    setQueue(response.data.data);
  }, [statusFilter]);

  const loadDiscovery = useCallback(async () => {
    const response = await api.get<{ data: DiscoveryData }>('/integrations/zoho/discovery');
    setDiscovery(response.data.data);
  }, []);

  const loadContacts = useCallback(async () => {
    const response = await api.get<{ data: ContactData }>('/integrations/zoho/contacts', {
      params: {
        entityType: contactEntityType,
        limit: 50,
        ...(contactSearch.trim() ? { search: contactSearch.trim() } : {}),
      },
    });
    setContacts(response.data.data);
  }, [contactEntityType, contactSearch]);

  useEffect(() => {
    if (user && !['SUPER_ADMIN', 'FINANCE_LOGISTICS_CONTROLLER'].includes(user.role)) router.replace('/dashboard');
  }, [router, user]);

  useEffect(() => {
    void loadStatus()
      .catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat status integrasi Zoho.')))
      .finally(() => setLoading(false));
  }, [loadStatus]);

  useEffect(() => {
    if (tab === 'queue') void loadQueue().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat antrean Zoho.')));
    if (tab === 'discovery') void loadDiscovery().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat master Zoho.')));
    if (tab === 'contacts') void loadContacts().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat mapping contact.')));
  }, [loadContacts, loadDiscovery, loadQueue, tab]);

  useEffect(() => {
    const result = searchParams.get('zoho');
    if (!result) return;
    if (result === 'success') toast.success('Zoho Books berhasil dihubungkan.');
    else toast.error(searchParams.get('message') || 'Koneksi Zoho gagal.');
    router.replace('/admin/integrations/zoho');
    void loadStatus();
  }, [loadStatus, router, searchParams]);

  async function connect() {
    setAction('connect');
    try {
      const response = await api.get<{ data: { authorizationUrl: string } }>('/integrations/zoho/connect');
      window.location.assign(response.data.data.authorizationUrl);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Tidak dapat memulai otorisasi Zoho.'));
      setAction(null);
    }
  }

  async function testConnection() {
    setAction('test');
    try {
      await api.post('/integrations/zoho/test');
      toast.success('Koneksi Zoho aktif.');
      await loadStatus();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Pemeriksaan koneksi Zoho gagal.'));
    } finally { setAction(null); }
  }

  async function activate(id: string) {
    setAction(id);
    try {
      await api.post(`/integrations/zoho/organizations/${id}/activate`);
      toast.success('Organisasi aktif diperbarui.');
      await loadStatus();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Gagal memilih organisasi.'));
    } finally { setAction(null); }
  }

  async function disconnect() {
    if (!window.confirm('Putuskan koneksi Zoho Books? Sinkronisasi akan berhenti.')) return;
    setAction('disconnect');
    try {
      await api.delete('/integrations/zoho/connection');
      toast.success('Koneksi Zoho diputus.');
      await loadStatus();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Gagal memutus koneksi Zoho.'));
    } finally { setAction(null); }
  }

  async function retryEvent(event: SyncEvent) {
    setAction(event.id);
    try {
      await api.post(`/integrations/zoho/events/${event.id}/retry`);
      toast.success('Event dimasukkan kembali ke antrean.');
      setSelectedEvent(null);
      await loadQueue();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Event tidak dapat diulang.'));
    } finally { setAction(null); }
  }

  async function ignoreEvent(event: SyncEvent) {
    const reason = window.prompt('Alasan mengabaikan event (minimal 5 karakter):');
    if (!reason) return;
    setAction(event.id);
    try {
      await api.post(`/integrations/zoho/events/${event.id}/ignore`, { reason });
      toast.success('Event ditandai diabaikan.');
      setSelectedEvent(null);
      await loadQueue();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Event tidak dapat diabaikan.'));
    } finally { setAction(null); }
  }

  async function runDiscovery() {
    setAction('discovery');
    try {
      const response = await api.post<{ data: DiscoveryData }>('/integrations/zoho/discovery/run');
      setDiscovery(response.data.data);
      await loadStatus();
      toast.success('Master Zoho berhasil diperbarui.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Discovery Zoho gagal.'));
    } finally { setAction(null); }
  }

  async function previewContact(row: ContactMappingRow) {
    setAction(`preview:${row.id}`);
    try {
      const response = await api.get<{ data: typeof contactPreview }>(
        `/integrations/zoho/contacts/${row.entityType}/${row.id}/preview`,
      );
      setContactPreview(response.data.data);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Preview contact gagal.'));
    } finally { setAction(null); }
  }

  async function findContactMatch(row: ContactMappingRow) {
    setAction(`match:${row.id}`);
    try {
      const response = await api.post<{ data: { decision: { kind: string } } }>(
        `/integrations/zoho/contacts/${row.entityType}/${row.id}/match`,
      );
      toast.success(response.data.data.decision.kind === 'REVIEW'
        ? 'Kandidat ditemukan dan menunggu review.'
        : response.data.data.decision.kind === 'AUTO_MATCH'
          ? 'External RAHO ID cocok.'
          : 'Tidak ada kandidat; contact baru dapat dibuat.');
      await loadContacts();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Pencarian contact Zoho gagal.'));
    } finally { setAction(null); }
  }

  async function enqueueContact(row: ContactMappingRow) {
    setAction(`sync:${row.id}`);
    try {
      await api.post(`/integrations/zoho/contacts/${row.entityType}/${row.id}/enqueue`);
      toast.success(status?.dryRun ? 'Contact masuk antrean dry-run.' : 'Contact masuk antrean sinkronisasi.');
      await loadContacts();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Contact gagal dimasukkan ke antrean.'));
    } finally { setAction(null); }
  }

  async function approveReview(row: ContactMappingRow, zohoContactId: string) {
    if (!row.review) return;
    setAction(`review:${row.id}`);
    try {
      await api.post(`/integrations/zoho/contacts/reviews/${row.review.id}/approve`, { zohoContactId });
      toast.success('Mapping disetujui dan update contact masuk antrean.');
      await loadContacts();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Mapping tidak dapat disetujui.'));
    } finally { setAction(null); }
  }

  async function rejectReview(row: ContactMappingRow) {
    if (!row.review) return;
    setAction(`review:${row.id}`);
    try {
      await api.post(`/integrations/zoho/contacts/reviews/${row.review.id}/reject`);
      toast.success('Kandidat ditolak. Contact dapat dibuat baru melalui antrean.');
      await loadContacts();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Review tidak dapat ditolak.'));
    } finally { setAction(null); }
  }

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-neutral-900 dark:text-white">
          <PlugZap className="text-blue-600" /> Integrasi Zoho Books
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Koneksi, antrean sinkronisasi, dan master finance/logistik Zoho.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-neutral-200 dark:border-neutral-700">
        {([
          ['connection', 'Koneksi', PlugZap],
          ['queue', 'Antrean Sinkronisasi', List],
          ['discovery', 'Master Zoho', Database],
          ['contacts', 'Customer & Vendor', Users],
        ] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${
              tab === value ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500'
            }`}
          >
            <Icon size={17} /> {label}
          </button>
        ))}
      </div>

      {tab === 'connection' && (
        <>
          {!status?.configured && (
            <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
              <CircleAlert className="shrink-0" />
              <div>
                <p className="font-semibold">Konfigurasi server belum lengkap</p>
                <p className="mt-1 text-sm">Isi credential dan kunci enkripsi Zoho, lalu restart API.</p>
              </div>
            </div>
          )}

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 md:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                {status?.connected ? <CheckCircle2 className="text-emerald-600" size={30} /> : <PlugZap className="text-neutral-400" size={30} />}
                <div>
                  <p className="font-semibold text-neutral-900 dark:text-white">{status?.connected ? 'Zoho Books terhubung' : 'Belum terhubung'}</p>
                  <p className="text-sm text-neutral-500">
                    {status?.dryRun ? 'Mode aman dry-run aktif: belum ada penulisan ke Zoho.' : 'Mode live aktif.'}
                    {' '}Worker {status?.workerEnabled ? 'aktif' : 'nonaktif'}.
                  </p>
                </div>
              </div>
              {canManageConnection && (
                <div className="flex flex-wrap gap-2">
                  {status?.connected && (
                    <button onClick={testConnection} disabled={!!action} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-neutral-700">
                      <RefreshCw size={16} className={action === 'test' ? 'animate-spin' : ''} /> Tes
                    </button>
                  )}
                  <button onClick={connect} disabled={!status?.configured || !!action} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {action === 'connect' ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                    {status?.connected ? 'Hubungkan ulang' : 'Hubungkan Zoho'}
                  </button>
                  {status?.connected && (
                    <button onClick={disconnect} disabled={!!action} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
                      <Unplug size={16} /> Putuskan
                    </button>
                  )}
                </div>
              )}
            </div>
            {status?.redirectUri && (
              <div className="mt-5 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Authorized Redirect URI</p>
                <code className="mt-1 block break-all text-sm">{status.redirectUri}</code>
              </div>
            )}
          </section>

          {!!status?.connections.length && (
            <section className="space-y-3">
              {status.connections.map((connection) => (
                <div key={connection.id} className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="flex gap-3">
                      <Building2 className={connection.isActive ? 'text-blue-600' : 'text-neutral-400'} />
                      <div>
                        <p className="font-semibold">{connection.organizationName}</p>
                        <p className="text-xs text-neutral-500">
                          ID {connection.organizationId} · {connection.organizationCurrencyCode || '-'} · discovery {when(connection.discoveryLastRunAt)}
                        </p>
                        {connection.reconnectRequired && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Hubungkan ulang untuk scope baru: {connection.missingScopes.join(', ') || 'versi izin terbaru'}
                          </p>
                        )}
                        {!connection.contactSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Contact live belum siap: buat custom field contact unik “RAHO External ID”, lalu jalankan discovery.
                          </p>
                        )}
                        {connection.lastError && <p className="mt-1 text-xs text-red-600">{connection.lastError}</p>}
                      </div>
                    </div>
                    {connection.isActive ? (
                      <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Aktif</span>
                    ) : canManageConnection ? (
                      <button onClick={() => activate(connection.id)} disabled={!!action} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-neutral-700">
                        Gunakan organisasi ini
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {tab === 'queue' && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Antrean sinkronisasi</h2>
              <p className="text-sm text-neutral-500">{queue?.pagination.total || 0} event ditemukan.</p>
            </div>
            <div className="flex gap-2">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EventStatus | '')} className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700">
                {eventStatuses.map((value) => <option key={value} value={value}>{value || 'Semua status'}</option>)}
              </select>
              <button onClick={() => void loadQueue()} className="rounded-lg border p-2 dark:border-neutral-700" title="Muat ulang"><RefreshCw size={18} /></button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-neutral-500">
                <tr><th className="p-3">Event</th><th className="p-3">Aggregate</th><th className="p-3">Status</th><th className="p-3">Percobaan</th><th className="p-3">Waktu</th><th className="p-3">Aksi</th></tr>
              </thead>
              <tbody>
                {queue?.items.map((event) => (
                  <tr key={event.id} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="p-3 font-medium">{event.eventType}</td>
                    <td className="p-3"><span className="block">{event.aggregateType}</span><span className="text-xs text-neutral-500">{event.aggregateId}</span></td>
                    <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge[event.status]}`}>{event.status}</span></td>
                    <td className="p-3">{event.attempts}/{event.maxAttempts}</td>
                    <td className="p-3 text-xs">{when(event.occurredAt)}</td>
                    <td className="p-3"><button onClick={() => setSelectedEvent(event)} className="inline-flex items-center gap-1 text-blue-600"><Eye size={16} /> Detail</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!queue?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Belum ada event pada filter ini.</p>}
          </div>
        </section>
      )}

      {tab === 'discovery' && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Master read-only dari Zoho</h2>
              <p className="text-sm text-neutral-500">Terakhir diperbarui: {when(discovery?.lastRunAt || null)}</p>
            </div>
            <button onClick={runDiscovery} disabled={!status?.connected || action === 'discovery'} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <RefreshCw size={16} className={action === 'discovery' ? 'animate-spin' : ''} /> Ambil ulang dari Zoho
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(discovery?.counts || {}).map(([resource, count]) => (
              <div key={resource} className="rounded-xl border p-4 dark:border-neutral-700">
                <p className="text-xs font-semibold text-neutral-500">{resource.replaceAll('_', ' ')}</p>
                <p className="mt-1 text-2xl font-bold">{count}</p>
              </div>
            ))}
          </div>
          {discovery && !discovery.contactExternalIdField.ready && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Custom field contact unik “RAHO External ID” belum ditemukan. Field ini wajib agar retry tidak membuat customer/vendor ganda.
            </div>
          )}
          {!!discovery?.items.length && (
            <div className="mt-5 max-h-96 overflow-auto rounded-xl border dark:border-neutral-700">
              {discovery.items.map((item) => (
                <div key={item.id} className="flex justify-between border-b p-3 text-sm last:border-b-0 dark:border-neutral-700">
                  <div><span className="font-medium">{item.name}</span><span className="ml-2 text-xs text-neutral-500">{item.code}</span></div>
                  <span className={item.isActive ? 'text-emerald-600' : 'text-red-600'}>{item.resourceType} · {item.isActive ? 'aktif' : 'nonaktif'}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'contacts' && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">Mapping Customer dan Vendor</h2>
              <p className="text-sm text-neutral-500">
                Member menjadi customer; supplier menjadi vendor. Data klinis tidak dikirim.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={contactEntityType}
                onChange={(event) => setContactEntityType(event.target.value as 'MEMBER' | 'SUPPLIER')}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              >
                <option value="MEMBER">Member / Customer</option>
                <option value="SUPPLIER">Supplier / Vendor</option>
              </select>
              <input
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void loadContacts(); }}
                placeholder="Cari nama, kode, email"
                className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              />
              <button onClick={() => void loadContacts()} className="rounded-lg border p-2 dark:border-neutral-700"><RefreshCw size={18} /></button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-neutral-500">
                <tr><th className="p-3">ERP</th><th className="p-3">Mapping Zoho</th><th className="p-3">Review</th><th className="p-3">Aksi</th></tr>
              </thead>
              <tbody>
                {contacts?.items.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                    <td className="p-3">
                      <span className="block font-semibold">{row.name}</span>
                      <span className="block text-xs text-neutral-500">{row.code} · {row.email || '-'}</span>
                    </td>
                    <td className="p-3">
                      {row.mapping ? (
                        <>
                          <span className="block font-mono text-xs">{row.mapping.zohoEntityId}</span>
                          <span className="text-xs text-emerald-600">{row.mapping.status}</span>
                        </>
                      ) : <span className="text-xs text-neutral-500">Belum dipetakan</span>}
                    </td>
                    <td className="min-w-64 p-3">
                      {row.review?.status === 'PENDING' ? (
                        <div className="space-y-2">
                          <p className="text-xs text-amber-700">{row.review.reason}</p>
                          {row.review.candidates.map((candidate) => (
                            <div key={candidate.contact_id} className="flex items-center justify-between gap-2 rounded border p-2 dark:border-neutral-700">
                              <span className="text-xs">{candidate.contact_name}<br />{candidate.email || candidate.phone || candidate.contact_id}</span>
                              <button onClick={() => void approveReview(row, String(candidate.contact_id))} disabled={!!action} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">Pilih</button>
                            </div>
                          ))}
                          <button onClick={() => void rejectReview(row)} disabled={!!action} className="text-xs font-semibold text-red-600">Tolak semua kandidat</button>
                        </div>
                      ) : <span className="text-xs text-neutral-500">{row.review?.status || '-'}</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex min-w-52 flex-wrap gap-2">
                        <button onClick={() => void previewContact(row)} disabled={!!action} className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700">Preview</button>
                        {!row.mapping && row.review?.status !== 'PENDING' && (
                          <button onClick={() => void findContactMatch(row)} disabled={!!action} className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700">Cari Zoho</button>
                        )}
                        {row.review?.status !== 'PENDING' && (
                          <button onClick={() => void enqueueContact(row)} disabled={!!action} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
                            {status?.dryRun ? 'Dry-run' : 'Sinkronkan'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!contacts?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Tidak ada data contact.</p>}
          </div>
        </section>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setSelectedEvent(null)}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-between gap-3">
              <div><h3 className="text-lg font-bold">{selectedEvent.eventType}</h3><p className="text-xs text-neutral-500">{selectedEvent.id}</p></div>
              <span className={`h-fit rounded-full px-2 py-1 text-xs font-semibold ${badge[selectedEvent.status]}`}>{selectedEvent.status}</span>
            </div>
            {selectedEvent.lastError && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{selectedEvent.lastError}</div>}
            <p className="mt-4 text-sm font-semibold">Payload ERP</p>
            <pre className="mt-2 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-800">{JSON.stringify(selectedEvent.payload, null, 2)}</pre>
            <p className="mt-4 text-sm font-semibold">Riwayat percobaan</p>
            <div className="mt-2 space-y-2">
              {selectedEvent.syncAttempts.map((attempt) => (
                <div key={attempt.id} className="rounded-lg border p-3 text-xs dark:border-neutral-700">
                  #{attempt.attemptNo} · {attempt.status} · {when(attempt.startedAt)}
                  {attempt.errorMessage && <p className="mt-1 text-red-600">{attempt.errorCode}: {attempt.errorMessage}</p>}
                </div>
              ))}
              {!selectedEvent.syncAttempts.length && <p className="text-xs text-neutral-500">Belum pernah diproses worker.</p>}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {['FAILED', 'DEAD_LETTER', 'DRY_RUN', 'IGNORED'].includes(selectedEvent.status) && (
                <button onClick={() => void retryEvent(selectedEvent)} disabled={!!action} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  <RotateCcw size={16} /> Ulang
                </button>
              )}
              {!['PROCESSED', 'PROCESSING', 'IGNORED'].includes(selectedEvent.status) && (
                <button onClick={() => void ignoreEvent(selectedEvent)} disabled={!!action} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
                  <Ban size={16} /> Abaikan
                </button>
              )}
              <button onClick={() => setSelectedEvent(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold dark:border-neutral-700">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {contactPreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setContactPreview(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold">Preview contact: {contactPreview.snapshot.displayName}</h3>
            <p className="mt-1 font-mono text-xs text-neutral-500">{contactPreview.snapshot.externalKey}</p>
            {!contactPreview.liveCreateReady && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Live create diblok sampai ZOHO_CONTACT_RAHO_ID_CUSTOM_FIELD_ID diisi.
              </div>
            )}
            <p className="mt-4 text-sm font-semibold">Payload yang boleh dikirim</p>
            <pre className="mt-2 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-800">{JSON.stringify(contactPreview.payload, null, 2)}</pre>
            <p className="mt-4 text-sm font-semibold">Field yang sengaja dilarang</p>
            <p className="mt-1 text-xs text-red-600">{contactPreview.excludedFields.join(', ')}</p>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setContactPreview(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold dark:border-neutral-700">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
