'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Image as ImageIcon, LogOut, MessageCircle, QrCode, RefreshCw, RotateCcw, Send, ServerCog, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';
import { assertCaughtError } from '@/lib/caughtError';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

type BackgroundKey = 'RAHO_RED' | 'HEALTH_GREEN' | 'PREMIUM_GOLD' | 'CLEAN_LIGHT';
type StatusData = {
  enabled: boolean;
  provider: string;
  workerEnabled: boolean;
  ready: boolean;
  qrCode?: string | null;
  connection: {
    status: string;
    phoneMasked?: string | null;
    defaultBackgroundKey?: BackgroundKey;
    lastConnectedAt?: string | null;
    lastErrorSanitized?: string | null;
  };
};
type Delivery = {
  id: string;
  status: string;
  recipientMasked: string;
  memberName: string;
  sessionCode: string;
  branchName: string;
  attempts: number;
  maxAttempts: number;
  requestedAt: string;
  sentAt?: string | null;
  lastErrorSanitized?: string | null;
  canRetry: boolean;
};
type DeliveryData = {
  deliveries: Delivery[];
  summary: Record<string, number>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type SetupStep = {
  title: string;
  description: string;
  state: 'done' | 'active' | 'waiting';
};

const BACKGROUNDS: Array<{ key: BackgroundKey; name: string; colors: string }> = [
  { key: 'RAHO_RED', name: 'Merah RAHO', colors: 'linear-gradient(135deg,#7e171b,#f7faf8)' },
  { key: 'HEALTH_GREEN', name: 'Hijau Sehat', colors: 'linear-gradient(135deg,#145c43,#eef8f3)' },
  { key: 'PREMIUM_GOLD', name: 'Emas Premium', colors: 'linear-gradient(135deg,#5e4817,#faf6ea)' },
  { key: 'CLEAN_LIGHT', name: 'Minimal Terang', colors: 'linear-gradient(135deg,#253142,#f6f7f9)' },
];

export default function WhatsAppSettingsPage() {
  const { user } = useAuthStore();
  const [status, setStatus] = useState<StatusData | null>(null);
  const [background, setBackground] = useState<BackgroundKey>('RAHO_RED');
  const [busy, setBusy] = useState(false);
  const qrRequestStarted = useRef(false);
  const [deliveryData, setDeliveryData] = useState<DeliveryData>({ deliveries: [], summary: {}, pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  const [deliveryFilter, setDeliveryFilter] = useState('');

  const load = useCallback(async () => {
    const [connectionResponse, deliveryResponse] = await Promise.all([
      api.get<{ data: StatusData }>('/integrations/whatsapp/connection'),
      api.get<{ data: DeliveryData }>('/integrations/whatsapp/deliveries', { params: deliveryFilter ? { status: deliveryFilter } : undefined }),
    ]);
    setStatus(connectionResponse.data.data);
    setBackground(connectionResponse.data.data.connection.defaultBackgroundKey || 'RAHO_RED');
    setDeliveryData(deliveryResponse.data.data);
  }, [deliveryFilter]);

  useEffect(() => { if (user?.role === 'SUPER_ADMIN') void load(); }, [user?.role, load]);

  const perform = async (action: () => Promise<void>, success: string) => {
    try {
      setBusy(true);
      await action();
      await load();
      showToast.success(success);
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || error.message || 'Proses gagal');
    } finally { setBusy(false); }
  };

  const connected = status?.ready === true;
  const systemReady = status?.enabled === true && status.provider === 'BAILEYS';
  const connectionStatus = status?.connection.status || 'DISCONNECTED';
  const pairingRequested = Boolean(status?.qrCode) || connectionStatus === 'PAIRING';
  const connectionPending = pairingRequested || ['CONNECTING', 'RECONNECTING'].includes(connectionStatus);
  const verificationInProgress = pairingRequested || connectionStatus === 'RECONNECTING';
  const deliveryReady = connected && status?.workerEnabled === true;
  const setupSteps: SetupStep[] = [
    {
      title: 'Kesiapan sistem',
      description: systemReady ? 'Provider Baileys sudah aktif.' : 'Feature flag dan provider harus diaktifkan oleh admin server.',
      state: systemReady ? 'done' : 'active',
    },
    {
      title: 'Pindai QR pengirim',
      description: connected
        ? 'Nomor WhatsApp sudah tertaut.'
        : pairingRequested
          ? 'QR pairing siap dipindai.'
          : 'Tunggu QR pairing muncul.',
      state: connected ? 'done' : systemReady ? 'active' : 'waiting',
    },
    {
      title: 'Verifikasi koneksi',
      description: connected
        ? 'Socket Baileys sudah terhubung.'
        : connectionStatus === 'RECONNECTING'
          ? 'Menunggu koneksi WhatsApp pulih.'
          : 'Pindai QR melalui menu Perangkat tertaut di ponsel.',
      state: connected ? 'done' : verificationInProgress ? 'active' : 'waiting',
    },
    {
      title: 'Siap mengirim',
      description: deliveryReady
        ? 'Koneksi dan worker pengiriman sudah aktif.'
        : connected
          ? 'Aktifkan worker pada server, lalu restart API.'
          : 'Selesaikan pairing sebelum mengaktifkan pengiriman.',
      state: deliveryReady ? 'done' : connected ? 'active' : 'waiting',
    },
  ];

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN' || connected || !connectionPending) return;
    const timer = window.setInterval(() => { void load(); }, 3_000);
    return () => window.clearInterval(timer);
  }, [user?.role, connected, connectionPending, load]);

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN' || !status || !systemReady || connected || status.qrCode || qrRequestStarted.current) return;
    qrRequestStarted.current = true;
    void api.post('/integrations/whatsapp/connection/qr')
      .then(() => load())
      .catch((error) => {
        qrRequestStarted.current = false;
        assertCaughtError(error);
        showToast.error(error.response?.data?.error?.message || error.message || 'QR WhatsApp gagal dibuat');
      });
  }, [user?.role, status, systemReady, connected, load]);

  if (user?.role !== 'SUPER_ADMIN') {
    return <div className="card" style={{ padding: 24 }}>Pengaturan WhatsApp hanya dapat diakses Super Admin.</div>;
  }

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', padding: '28px 20px 48px' }}>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 26, fontWeight: 800 }}>
          <MessageCircle color="#22c55e" /> Pengaturan WhatsApp
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Nomor pengirim dan tampilan laporan dikelola terpusat oleh Super Admin.</p>
      </header>

      <section className="card" style={{ padding: 22, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 750, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ServerCog size={20} /> Alur Setup Super Admin
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>
              Ikuti langkah berikut sampai koneksi dan worker siap mengirim laporan sesi.
            </p>
          </div>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void perform(async () => undefined, 'Status WhatsApp diperbarui')}>
            <RefreshCw size={16} /> Periksa status
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10, marginTop: 18 }}>
          {setupSteps.map((step, index) => {
            const color = step.state === 'done' ? '#16a34a' : step.state === 'active' ? '#f59e0b' : 'var(--text-muted)';
            return (
              <div key={step.title} style={{ padding: 14, borderRadius: 12, border: `1px solid ${step.state === 'active' ? '#f59e0b' : 'var(--surface-border)'}`, background: step.state === 'active' ? 'rgba(245, 158, 11, 0.06)' : 'var(--surface-input)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, fontSize: 12, fontWeight: 750 }}>
                  {step.state === 'done' ? <CheckCircle2 size={17} /> : <span style={{ width: 18, height: 18, borderRadius: 999, border: `1px solid ${color}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{index + 1}</span>}
                  {step.state === 'done' ? 'SELESAI' : step.state === 'active' ? 'LANGKAH AKTIF' : 'MENUNGGU'}
                </div>
                <strong style={{ display: 'block', marginTop: 9, fontSize: 14 }}>{index + 1}. {step.title}</strong>
                <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>{step.description}</p>
              </div>
            );
          })}
        </div>

        {!systemReady && status && (
          <div role="alert" style={{ display: 'flex', gap: 9, marginTop: 15, padding: 12, borderRadius: 10, background: 'rgba(245, 158, 11, 0.1)', color: '#b45309', fontSize: 12 }}>
            <AlertTriangle size={17} style={{ flexShrink: 0 }} />
            <span>Setup belum dapat dimulai. Minta admin server mengaktifkan <strong>WHATSAPP_ENABLED</strong>, memilih provider <strong>BAILEYS</strong>, dan menyiapkan encryption key.</span>
          </div>
        )}
        {connected && !status?.workerEnabled && (
          <div role="alert" style={{ display: 'flex', gap: 9, marginTop: 15, padding: 12, borderRadius: 10, background: 'rgba(245, 158, 11, 0.1)', color: '#b45309', fontSize: 12 }}>
            <AlertTriangle size={17} style={{ flexShrink: 0 }} />
            <span>Nomor sudah terhubung, tetapi worker belum aktif. Aktifkan <strong>WHATSAPP_WORKER_ENABLED</strong> pada server dan restart API agar antrean dapat dikirim.</span>
          </div>
        )}
        {deliveryReady && (
          <div role="status" style={{ display: 'flex', gap: 9, marginTop: 15, padding: 12, borderRadius: 10, background: 'rgba(22, 163, 74, 0.1)', color: '#15803d', fontSize: 12 }}>
            <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
            <span>Setup selesai. WhatsApp siap memproses antrean laporan sesi.</span>
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18 }}>
        <section className="card" style={{ padding: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 750, display: 'flex', gap: 8 }}><QrCode size={19} /> QR WhatsApp Pengirim</h2>
          <div style={{ marginTop: 15, padding: 14, borderRadius: 12, background: 'var(--surface-input)' }}>
            <strong style={{ color: connected ? '#22c55e' : '#f59e0b' }}>{status?.connection.status || 'Memuat...'}</strong>
            <p style={{ marginTop: 5, fontSize: 13 }}>{status?.connection.phoneMasked || 'Belum ada nomor tertaut'}</p>
          </div>
          {!connected && (
            <div style={{ marginTop: 16, padding: 16, border: '1px solid #22c55e', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 750, fontSize: 13 }}><QrCode size={17} /> Pindai dengan WhatsApp</div>
              <ol style={{ margin: '10px 0 0', paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.7 }}>
                <li>Buka WhatsApp di ponsel pengirim.</li>
                <li>Pilih <strong>Perangkat tertaut</strong> lalu <strong>Tautkan perangkat</strong>.</li>
                <li>Pindai QR di bawah sebelum kedaluwarsa.</li>
              </ol>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 256, marginTop: 12, padding: 12, borderRadius: 10, background: '#fff' }}>
                {!systemReady ? (
                  <div style={{ color: '#4b5563', textAlign: 'center', fontSize: 12 }}>Aktifkan provider Baileys untuk membuat QR.</div>
                ) : status?.qrCode ? (
                  <QRCodeSVG value={status.qrCode} size={224} level="M" marginSize={2} title="QR pairing WhatsApp" />
                ) : (
                  <div style={{ color: '#4b5563', textAlign: 'center', fontSize: 12 }}>
                    <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 9px' }} />
                    Menyiapkan QR pairing...
                  </div>
                )}
              </div>
              <p style={{ margin: '10px 0 0', color: '#f59e0b', fontSize: 11 }}><RefreshCw size={12} className="animate-spin" style={{ display: 'inline', marginRight: 5 }} />QR dan status diperbarui otomatis setiap 3 detik.</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 9, marginTop: 16, flexWrap: 'wrap' }}>
            {!connected && <button className="btn btn-secondary" disabled={busy || !systemReady} onClick={() => void perform(async () => { qrRequestStarted.current = true; await api.post('/integrations/whatsapp/connection/qr'); }, 'QR WhatsApp dibuat ulang')}><RefreshCw size={16} /> Buat ulang QR</button>}
            {connected && <button className="btn btn-secondary" disabled={busy} onClick={() => void perform(async () => { await api.post('/integrations/whatsapp/connection/logout'); qrRequestStarted.current = false; }, 'Nomor WhatsApp dilepas')}><LogOut size={16} /> Logout nomor</button>}
          </div>
        </section>

        <section className="card" style={{ padding: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 750, display: 'flex', gap: 8 }}><ImageIcon size={19} /> Background Pesan</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>Pilihan ini berlaku untuk semua laporan baru.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
            {BACKGROUNDS.map((item) => (
              <button key={item.key} type="button" onClick={() => setBackground(item.key)} style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: background === item.key ? '2px solid #22c55e' : '1px solid var(--surface-border)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
                <div style={{ height: 78, background: item.colors }} />
                <div style={{ padding: 9, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 650 }}>{item.name}{background === item.key && <CheckCircle2 size={15} color="#22c55e" />}</div>
              </button>
            ))}
          </div>
          <button className="btn btn-primary" disabled={busy || background === status?.connection.defaultBackgroundKey} style={{ marginTop: 15 }} onClick={() => void perform(async () => { await api.put('/integrations/whatsapp/config', { backgroundKey: background }); }, 'Background WhatsApp disimpan')}><ShieldCheck size={16} /> Simpan background</button>
        </section>
      </div>

      <section className="card" style={{ padding: 22, marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 750, display: 'flex', gap: 8 }}><Send size={19} /> Monitoring Pengiriman</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>Hanya nomor tersamarkan dan error aman yang ditampilkan.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="form-control" value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)} aria-label="Filter status pengiriman">
              <option value="">Semua status</option>
              {['PENDING', 'PROCESSING', 'RETRY', 'SENT', 'FAILED', 'DEAD_LETTER', 'CANCELLED'].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <button className="btn btn-secondary" disabled={busy} onClick={() => void perform(async () => undefined, 'Antrean diperbarui')}><RefreshCw size={16} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 15 }}>
          {Object.entries(deliveryData.summary).map(([key, value]) => <span key={key} style={{ padding: '6px 9px', borderRadius: 999, background: 'var(--surface-input)', fontSize: 11 }}>{key}: <strong>{value}</strong></span>)}
          <span style={{ padding: '6px 9px', fontSize: 11 }}>Total: <strong>{deliveryData.pagination.total}</strong></span>
        </div>

        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          {deliveryData.deliveries.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada pengiriman pada filter ini.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760, fontSize: 12 }}>
              <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--surface-border)' }}><th style={{ padding: 10 }}>Sesi/Member</th><th>Cabang</th><th>Tujuan</th><th>Status</th><th>Percobaan</th><th>Error aman</th><th>Aksi</th></tr></thead>
              <tbody>{deliveryData.deliveries.map((delivery) => (
                <tr key={delivery.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <td style={{ padding: 10 }}><strong>{delivery.sessionCode}</strong><br /><span style={{ color: 'var(--text-muted)' }}>{delivery.memberName}</span></td>
                  <td>{delivery.branchName}</td>
                  <td>{delivery.recipientMasked}</td>
                  <td><span style={{ color: delivery.status === 'SENT' ? '#22c55e' : ['FAILED', 'DEAD_LETTER'].includes(delivery.status) ? '#ef4444' : '#f59e0b' }}>{delivery.status === 'SENT' ? <CheckCircle2 size={14} style={{ display: 'inline', marginRight: 4 }} /> : ['FAILED', 'DEAD_LETTER'].includes(delivery.status) ? <AlertTriangle size={14} style={{ display: 'inline', marginRight: 4 }} /> : null}{delivery.status}</span></td>
                  <td>{delivery.attempts}/{delivery.maxAttempts}</td>
                  <td style={{ maxWidth: 230, color: 'var(--text-muted)' }}>{delivery.lastErrorSanitized || '-'}</td>
                  <td>{delivery.canRetry ? <button className="btn btn-secondary" disabled={busy} onClick={() => void perform(async () => { await api.post(`/integrations/whatsapp/deliveries/${delivery.id}/retry`); }, 'Delivery masuk antrean ulang')}><RotateCcw size={14} /> Retry</button> : '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
