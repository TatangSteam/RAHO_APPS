'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, CheckCircle2, CircleAlert, ExternalLink, Loader2, PlugZap, RefreshCw, Unplug } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

type Connection = {
  id: string;
  organizationId: string;
  organizationName: string;
  dataCenter: string;
  isActive: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
};
type Status = {
  configured: boolean;
  redirectUri: string | null;
  connected: boolean;
  connections: Connection[];
};

export default function ZohoIntegrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get<{ data: Status }>('/integrations/zoho/status');
      setStatus(response.data.data);
    } catch {
      toast.error('Gagal memuat status integrasi Zoho.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') router.replace('/dashboard');
  }, [router, user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const result = searchParams.get('zoho');
    if (!result) return;
    if (result === 'success') toast.success('Zoho Books berhasil dihubungkan.');
    else toast.error(searchParams.get('message') || 'Koneksi Zoho gagal.');
    router.replace('/admin/integrations/zoho');
    void load();
  }, [load, router, searchParams]);

  async function connect() {
    setAction('connect');
    try {
      const response = await api.get<{ data: { authorizationUrl: string } }>('/integrations/zoho/connect');
      window.location.assign(response.data.data.authorizationUrl);
    } catch {
      toast.error('Tidak dapat memulai otorisasi. Periksa konfigurasi server.');
      setAction(null);
    }
  }

  async function testConnection() {
    setAction('test');
    try {
      await api.post('/integrations/zoho/test');
      toast.success('Koneksi Zoho aktif dan dapat digunakan.');
      await load();
    } catch {
      toast.error('Pemeriksaan koneksi Zoho gagal.');
    } finally { setAction(null); }
  }

  async function activate(id: string) {
    setAction(id);
    try {
      await api.post(`/integrations/zoho/organizations/${id}/activate`);
      toast.success('Organisasi aktif diperbarui.');
      await load();
    } catch {
      toast.error('Gagal memilih organisasi.');
    } finally { setAction(null); }
  }

  async function disconnect() {
    if (!window.confirm('Putuskan koneksi Zoho Books? Sinkronisasi akan berhenti.')) return;
    setAction('disconnect');
    try {
      await api.delete('/integrations/zoho/connection');
      toast.success('Koneksi Zoho telah diputus.');
      await load();
    } catch {
      toast.error('Gagal memutus koneksi Zoho.');
    } finally { setAction(null); }
  }

  if (loading) return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-neutral-900 dark:text-white">
          <PlugZap className="text-blue-600" /> Integrasi Zoho Books
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Hubungkan organisasi Zoho Books untuk proses sinkronisasi data finance RAHO.
        </p>
      </div>

      {!status?.configured && (
        <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <CircleAlert className="shrink-0" />
          <div>
            <p className="font-semibold">Konfigurasi server belum lengkap</p>
            <p className="mt-1 text-sm">Isi ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REDIRECT_URI, dan ZOHO_TOKEN_ENCRYPTION_KEY lalu restart API.</p>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 md:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            {status?.connected ? <CheckCircle2 className="text-emerald-600" size={30} /> : <PlugZap className="text-neutral-400" size={30} />}
            <div>
              <p className="font-semibold text-neutral-900 dark:text-white">{status?.connected ? 'Zoho Books terhubung' : 'Belum terhubung'}</p>
              <p className="text-sm text-neutral-500">{status?.connected ? 'Token disimpan terenkripsi di backend.' : 'Otorisasi dilakukan pada halaman resmi Zoho.'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {status?.connected && (
              <button onClick={testConnection} disabled={!!action} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
                <RefreshCw size={16} className={action === 'test' ? 'animate-spin' : ''} /> Periksa koneksi
              </button>
            )}
            <button onClick={connect} disabled={!status?.configured || !!action} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {action === 'connect' ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
              {status?.connected ? 'Hubungkan ulang' : 'Hubungkan Zoho Books'}
            </button>
            {status?.connected && (
              <button onClick={disconnect} disabled={!!action} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                <Unplug size={16} /> Putuskan
              </button>
            )}
          </div>
        </div>
        {status?.redirectUri && (
          <div className="mt-5 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Authorized Redirect URI di Zoho Console</p>
            <code className="mt-1 block break-all text-sm text-neutral-800 dark:text-neutral-200">{status.redirectUri}</code>
          </div>
        )}
      </section>

      {!!status?.connections.length && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 md:p-6">
          <h2 className="font-semibold text-neutral-900 dark:text-white">Organisasi yang tersedia</h2>
          <div className="mt-4 space-y-3">
            {status.connections.map((connection) => (
              <div key={connection.id} className={`flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${connection.isActive ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20' : 'border-neutral-200 dark:border-neutral-700'}`}>
                <div className="flex items-start gap-3">
                  <Building2 className={connection.isActive ? 'text-blue-600' : 'text-neutral-400'} />
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-white">{connection.organizationName}</p>
                    <p className="text-xs text-neutral-500">ID {connection.organizationId} · {connection.dataCenter}</p>
                    {connection.lastError && <p className="mt-1 text-xs text-red-600">{connection.lastError}</p>}
                  </div>
                </div>
                {connection.isActive ? (
                  <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Aktif</span>
                ) : (
                  <button onClick={() => activate(connection.id)} disabled={!!action} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
                    {action === connection.id ? 'Memilih…' : 'Gunakan organisasi ini'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
