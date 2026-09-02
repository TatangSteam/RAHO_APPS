'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  ClipboardList,
  Copy,
  Download,
  Gift,
  History,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  TicketPercent,
  UserPlus,
} from 'lucide-react';
import { api } from '@/lib/api';
import { assertCaughtError } from '@/lib/caughtError';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { usePathname } from 'next/navigation';

type Campaign = {
  id: string;
  code: string;
  title: string;
  description: string;
  quota: number;
  issuedCount: number;
  claimedCount: number;
  remainingQuota: number;
  generatedCount: number;
  availableCount: number;
  remainingToGenerate: number;
  basicSessions: number;
  boosterSessions: number;
  totalPrice: number | null;
  status: string;
};

type Location = { id: string; code: string; displayName: string; city: string; partnerName?: string | null };
type Voucher = {
  id: string;
  maskedCode: string;
  status: string;
  recipientName: string;
  maskedNik: string;
  issuedAt: string;
  claimedAt?: string | null;
  campaign: { code: string; title: string; basicSessions: number; boosterSessions: number };
  allowedLocation?: Pick<Location, 'id' | 'displayName' | 'city'> | null;
  claimedLocation?: Pick<Location, 'id' | 'displayName' | 'city'> | null;
};
type Operator = { id: string; username: string; fullName: string; isActive: boolean; lastLoginAt?: string | null; locations: Location[] };
type Dashboard = { campaigns: Campaign[]; locations: Location[]; recentVouchers: Voucher[]; operators: Operator[] };
type ClaimResult = Voucher & {
  idempotentReplay: boolean;
};

type VoucherView = 'claim' | 'history' | 'registry' | 'campaigns' | 'locations' | 'operators';

function getVoucherView(pathname: string): VoucherView {
  if (pathname.endsWith('/history')) return 'history';
  if (pathname.endsWith('/registry')) return 'registry';
  if (pathname.endsWith('/campaigns')) return 'campaigns';
  if (pathname.endsWith('/locations')) return 'locations';
  if (pathname.endsWith('/operators')) return 'operators';
  return 'claim';
}

const fieldStyle: CSSProperties = {
  width: '100%',
  minHeight: 42,
  borderRadius: 9,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  padding: '9px 11px',
};
const labelStyle: CSSProperties = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 650 };

function errorMessage(error: unknown): string {
  assertCaughtError(error);
  return error.response?.data?.error?.message || error.message || 'Proses gagal. Silakan coba lagi.';
}

function formatCurrency(value: number | null): string {
  if (value === null) return 'Belum ditetapkan';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

function formatVoucherType(campaign: Voucher['campaign']): string {
  const benefits: string[] = [];
  if (campaign.basicSessions > 0) benefits.push(`${campaign.basicSessions}× BASIC`);
  if (campaign.boosterSessions > 0) benefits.push(`${campaign.boosterSessions}× BOOSTER`);
  return benefits.join(' + ') || 'Tanpa manfaat';
}

function cleanVoucherCodeInput(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/["'“”]/g, '')
    .toUpperCase();
}

function localDateInputValue(date = new Date()): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

export default function VoucherPartnershipPage() {
  const pathname = usePathname();
  const view = getVoucherView(pathname);
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAllowed = isSuperAdmin || user?.role === 'VOUCHER_OPERATOR';
  const isViewAllowed = isSuperAdmin || view === 'claim' || view === 'history';
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [issueForm, setIssueForm] = useState({ campaignId: '', code: '', recipientName: '', nik: '', dateOfBirth: '', allowedLocationId: '' });
  const [claimForm, setClaimForm] = useState({ code: '', recipientName: '', nik: '', dateOfBirth: '', locationId: '' });
  const [operatorForm, setOperatorForm] = useState({ fullName: '', username: '', password: '', locationIds: [] as string[] });
  const [registryFilter, setRegistryFilter] = useState({ campaignId: '', status: 'AVAILABLE' });
  const maximumBirthDate = useMemo(() => localDateInputValue(), []);

  const load = useCallback(async () => {
    try {
      const response = await api.get<{ data: Dashboard }>('/vouchers/dashboard');
      setDashboard(response.data.data);
      setIssueForm((current) => ({ ...current, campaignId: current.campaignId || response.data.data.campaigns.find((item) => item.status === 'ACTIVE')?.id || '' }));
      setClaimForm((current) => ({ ...current, locationId: current.locationId || response.data.data.locations[0]?.id || '' }));
    } catch (error) {
      showToast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAllowed) void load(); else setLoading(false); }, [isAllowed, load]);

  const totals = useMemo(() => (dashboard?.campaigns ?? []).reduce((result, campaign) => ({
    quota: result.quota + campaign.quota,
    issued: result.issued + campaign.issuedCount,
    claimed: result.claimed + campaign.claimedCount,
  }), { quota: 0, issued: 0, claimed: 0 }), [dashboard?.campaigns]);
  const filteredVouchers = useMemo(() => (dashboard?.recentVouchers ?? []).filter((voucher) => (
    (!registryFilter.campaignId || dashboard?.campaigns.find((campaign) => campaign.id === registryFilter.campaignId)?.code === voucher.campaign.code) &&
    (!registryFilter.status || voucher.status === registryFilter.status)
  )), [dashboard?.campaigns, dashboard?.recentVouchers, registryFilter]);
  const claimHistory = useMemo(() => (dashboard?.recentVouchers ?? []).filter((voucher) => (
    ['CLAIMED', 'EXHAUSTED', 'EXPIRED'].includes(voucher.status)
  )), [dashboard?.recentVouchers]);

  const pageCopy: Record<VoucherView, { title: string; description: string }> = {
    claim: { title: 'Klaim Voucher', description: 'Verifikasi identitas penerima dan aktifkan manfaat voucher pada lokasi yang ditugaskan.' },
    history: { title: 'Riwayat Klaim', description: 'Lihat klaim voucher sesuai lokasi yang menjadi scope akun Anda.' },
    registry: { title: 'Daftar Voucher', description: 'Terbitkan voucher, pantau status, dan export kode lengkap untuk proses cetak.' },
    campaigns: { title: 'Campaign Voucher', description: 'Pantau kuota, manfaat, nilai komersial, dan ketersediaan kode setiap campaign.' },
    locations: { title: 'Lokasi Klaim', description: 'Daftar cabang dan partner yang dapat digunakan sebagai tempat klaim voucher.' },
    operators: { title: 'Akun Pengelola', description: 'Buat akun operator dan tentukan satu atau beberapa lokasi yang boleh dikelola.' },
  };

  async function submitClaim(event: FormEvent) {
    event.preventDefault();
    try {
      setBusy('claim');
      const response = await api.post<{ data: ClaimResult }>('/vouchers/claim', {
        ...claimForm,
        requestId: crypto.randomUUID(),
      });
      setClaimResult(response.data.data);
      setClaimForm((current) => ({ ...current, code: '', recipientName: '', nik: '', dateOfBirth: '' }));
      showToast.success('Voucher berhasil diklaim dan manfaat sudah diaktifkan.');
      await load();
    } catch (error) {
      showToast.error(errorMessage(error));
    } finally { setBusy(null); }
  }

  async function submitIssue(event: FormEvent) {
    event.preventDefault();
    try {
      setBusy('issue');
      const response = await api.post<{ data: Voucher & { code: string } }>('/vouchers/issue', {
        ...issueForm,
        code: issueForm.code || undefined,
        allowedLocationId: issueForm.allowedLocationId || null,
      });
      setIssuedCode(response.data.data.code);
      setIssueForm((current) => ({ ...current, code: '', recipientName: '', nik: '', dateOfBirth: '' }));
      showToast.success('Voucher berhasil diterbitkan. Simpan kode yang tampil sekarang.');
      await load();
    } catch (error) {
      showToast.error(errorMessage(error));
    } finally { setBusy(null); }
  }

  async function submitOperator(event: FormEvent) {
    event.preventDefault();
    try {
      setBusy('operator');
      await api.post('/vouchers/operators', operatorForm);
      setOperatorForm({ fullName: '', username: '', password: '', locationIds: [] });
      showToast.success('Akun Pengelola Voucher berhasil dibuat.');
      await load();
    } catch (error) {
      showToast.error(errorMessage(error));
    } finally { setBusy(null); }
  }

  async function toggleOperator(operator: Operator) {
    try {
      setBusy(operator.id);
      await api.patch(`/vouchers/operators/${operator.id}`, { isActive: !operator.isActive });
      showToast.success(`Akun ${operator.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`);
      await load();
    } catch (error) {
      showToast.error(errorMessage(error));
    } finally { setBusy(null); }
  }

  async function exportCodes() {
    try {
      setBusy('export');
      const response = await api.get<Blob>('/vouchers/export', {
        params: {
          campaignId: registryFilter.campaignId || undefined,
          status: registryFilter.status || undefined,
        },
        responseType: 'blob',
      });
      const contentDisposition = String(response.headers['content-disposition'] || '');
      const filename = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1] || `voucher-codes-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast.success('Daftar kode voucher berhasil diexport.');
    } catch (error) {
      showToast.error(errorMessage(error));
    } finally { setBusy(null); }
  }

  async function generateCodes(campaign: Campaign) {
    if (campaign.remainingToGenerate <= 0) return;
    try {
      setBusy(`generate-${campaign.id}`);
      await api.post(`/vouchers/campaigns/${campaign.id}/generate`, { count: campaign.remainingToGenerate });
      showToast.success(`${campaign.remainingToGenerate} kode ${campaign.code} berhasil dibuat dan siap diexport.`);
      setRegistryFilter({ campaignId: campaign.id, status: 'AVAILABLE' });
      await load();
    } catch (error) {
      showToast.error(errorMessage(error));
    } finally { setBusy(null); }
  }

  function renderVoucherTable(vouchers: Voucher[], emptyMessage: string) {
    return (
      <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: 12 }}>
              {['Kode', 'Campaign', 'Tipe Voucher', 'Penerima', 'NIK', 'Status', 'Lokasi', 'Waktu'].map((item) => (
                <th key={item} style={{ padding: '9px 8px', borderBottom: '1px solid var(--border-color)' }}>{item}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vouchers.map((voucher) => (
              <tr key={voucher.id}>
                <td style={{ padding: 9, borderBottom: '1px solid var(--border-color)' }}><strong>{voucher.maskedCode}</strong></td>
                <td style={{ padding: 9, borderBottom: '1px solid var(--border-color)' }}>{voucher.campaign.code}</td>
                <td style={{ padding: 9, borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}><span style={{ display: 'inline-block', border: '1px solid rgba(245,158,11,.4)', background: 'rgba(245,158,11,.1)', color: '#f59e0b', borderRadius: 999, padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>{formatVoucherType(voucher.campaign)}</span></td>
                <td style={{ padding: 9, borderBottom: '1px solid var(--border-color)' }}>{voucher.recipientName}</td>
                <td style={{ padding: 9, borderBottom: '1px solid var(--border-color)' }}>{voucher.maskedNik}</td>
                <td style={{ padding: 9, borderBottom: '1px solid var(--border-color)' }}>{voucher.status}</td>
                <td style={{ padding: 9, borderBottom: '1px solid var(--border-color)' }}>{voucher.claimedLocation?.displayName || voucher.allowedLocation?.displayName || 'Semua lokasi'}</td>
                <td style={{ padding: 9, borderBottom: '1px solid var(--border-color)' }}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(voucher.claimedAt || voucher.issuedAt))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {vouchers.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 30 }}>{emptyMessage}</p>}
      </div>
    );
  }

  if (!isAllowed || !isViewAllowed) return <div className="card" style={{ padding: 24 }}>Anda tidak memiliki akses ke halaman Voucher Partnership ini.</div>;
  if (loading || !dashboard) return <div style={{ minHeight: 420, display: 'grid', placeItems: 'center' }}><Loader2 className="animate-spin" /></div>;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 50px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 750, marginBottom: 5 }}>Voucher Partnership</div>
          <h1 style={{ fontSize: 27, fontWeight: 850, display: 'flex', alignItems: 'center', gap: 10 }}><TicketPercent color="#f59e0b" /> {pageCopy[view].title}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>{pageCopy[view].description}</p>
        </div>
        <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={() => void load()}><RefreshCw size={16} /> Perbarui</button>
      </header>

      {view === 'claim' && isSuperAdmin && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 18 }}>
          {[
            ['Kapasitas awal', totals.quota, <Gift key="quota" size={19} />],
            ['Sudah diterbitkan', totals.issued, <TicketPercent key="issued" size={19} />],
            ['Sudah diklaim', totals.claimed, <BadgeCheck key="claimed" size={19} />],
            ['Lokasi aktif', dashboard.locations.length, <MapPin key="locations" size={19} />],
          ].map(([label, value, icon]) => <div className="card" style={{ padding: 18 }} key={String(label)}><div style={{ display: 'flex', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>{icon}{label}</div><div style={{ fontSize: 28, fontWeight: 850, marginTop: 8 }}>{value}</div></div>)}
        </section>
      )}

      {view === 'claim' && <section style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,620px)', gap: 16, alignItems: 'start', marginBottom: 18 }}>
        <form className="card" style={{ padding: 21, display: 'grid', gap: 13 }} onSubmit={submitClaim}>
          <div><h2 style={{ fontSize: 19, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center' }}><BadgeCheck size={20} color="#22c55e" /> Klaim Voucher</h2><p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 5 }}>Kode AVAILABLE dapat langsung diklaim dengan identitas penerima. Klaim ini tidak membuat member, paket, atau sesi terapi.</p></div>
          <label style={labelStyle}>Lokasi aktual<select required style={fieldStyle} value={claimForm.locationId} onChange={(event) => setClaimForm({ ...claimForm, locationId: event.target.value })}><option value="">Pilih lokasi</option>{dashboard.locations.map((location) => <option value={location.id} key={location.id}>{location.displayName} — {location.city}</option>)}</select></label>
          <label style={labelStyle}>Kode voucher<input required autoComplete="off" style={fieldStyle} value={claimForm.code} onChange={(event) => setClaimForm({ ...claimForm, code: cleanVoucherCodeInput(event.target.value) })} placeholder="RAHO-..." /><small style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>Tanda kutip dari hasil copy CSV akan dibersihkan otomatis.</small></label>
          <label style={labelStyle}>Nama penerima<input required autoComplete="name" maxLength={150} style={fieldStyle} value={claimForm.recipientName} onChange={(event) => setClaimForm({ ...claimForm, recipientName: event.target.value })} placeholder="Nama lengkap penerima voucher" /></label>
          <label style={labelStyle}>NIK penerima<input required inputMode="numeric" maxLength={16} style={fieldStyle} value={claimForm.nik} onChange={(event) => setClaimForm({ ...claimForm, nik: event.target.value.replace(/\D/g, '') })} placeholder="16 digit" /></label>
          <label style={labelStyle}>Tanggal lahir<input required type="date" max={maximumBirthDate} style={fieldStyle} value={claimForm.dateOfBirth} onChange={(event) => setClaimForm({ ...claimForm, dateOfBirth: event.target.value })} /><small style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>Tidak boleh tanggal hari mendatang.</small></label>
          <button className="btn btn-primary" disabled={busy !== null || !claimForm.locationId}>{busy === 'claim' ? <Loader2 size={17} className="animate-spin" /> : <BadgeCheck size={17} />} Verifikasi dan klaim</button>
          {claimResult && <div style={{ border: '1px solid #22c55e', background: 'rgba(34,197,94,.08)', borderRadius: 10, padding: 14 }}><strong>Voucher berhasil diklaim oleh {claimResult.recipientName}</strong><div style={{ fontSize: 13, marginTop: 5 }}>{claimResult.campaign.basicSessions}× BASIC{claimResult.campaign.boosterSessions > 0 ? ` + ${claimResult.campaign.boosterSessions}× BOOSTER` : ''}. Tidak dibuat paket atau sesi terapi.</div></div>}
        </form>
      </section>}

      {view === 'registry' && <>
        <form className="card" style={{ padding: 21, display: 'grid', gap: 13, maxWidth: 760, marginBottom: 18 }} onSubmit={submitIssue}>
          <div><h2 style={{ fontSize: 19, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center' }}><Gift size={20} color="#f59e0b" /> Terbitkan Voucher</h2><p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 5 }}>Penerima tidak harus menjadi member. Identitas disimpan khusus untuk verifikasi voucher.</p></div>
          <label style={labelStyle}>Campaign<select required style={fieldStyle} value={issueForm.campaignId} onChange={(event) => setIssueForm({ ...issueForm, campaignId: event.target.value })}>{dashboard.campaigns.filter((item) => item.status === 'ACTIVE' && item.remainingQuota > 0).map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.code} — sisa {campaign.remainingQuota}</option>)}</select></label>
          <label style={labelStyle}>Kode pada voucher cetak <small style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(tempel kode AVAILABLE dari hasil export, atau kosongkan untuk mengambil kode berikutnya)</small><input style={fieldStyle} value={issueForm.code} onChange={(event) => setIssueForm({ ...issueForm, code: cleanVoucherCodeInput(event.target.value) })} /></label>
          <label style={labelStyle}>Nama penerima<input required style={fieldStyle} value={issueForm.recipientName} onChange={(event) => setIssueForm({ ...issueForm, recipientName: event.target.value })} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label style={labelStyle}>NIK<input required inputMode="numeric" maxLength={16} style={fieldStyle} value={issueForm.nik} onChange={(event) => setIssueForm({ ...issueForm, nik: event.target.value.replace(/\D/g, '') })} /></label><label style={labelStyle}>Tanggal lahir<input required type="date" max={maximumBirthDate} style={fieldStyle} value={issueForm.dateOfBirth} onChange={(event) => setIssueForm({ ...issueForm, dateOfBirth: event.target.value })} /></label></div>
          <label style={labelStyle}>Berlaku di<select style={fieldStyle} value={issueForm.allowedLocationId} onChange={(event) => setIssueForm({ ...issueForm, allowedLocationId: event.target.value })}><option value="">Semua lokasi aktif</option>{dashboard.locations.map((location) => <option value={location.id} key={location.id}>{location.displayName} — {location.city}</option>)}</select></label>
          <button className="btn btn-primary" disabled={busy !== null}>{busy === 'issue' ? <Loader2 size={17} className="animate-spin" /> : <TicketPercent size={17} />} Terbitkan kode</button>
          {issuedCode && <div style={{ border: '1px solid #f59e0b', background: 'rgba(245,158,11,.09)', borderRadius: 10, padding: 14 }}><small>Kode lengkap hanya ditampilkan setelah penerbitan:</small><div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 7 }}><strong style={{ fontSize: 18, overflowWrap: 'anywhere' }}>{issuedCode}</strong><button type="button" className="btn btn-secondary" onClick={() => { void navigator.clipboard.writeText(issuedCode); showToast.success('Kode disalin.'); }}><Copy size={15} /></button></div></div>}
        </form>
        <section className="card" style={{ padding: 21 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div><h2 style={{ fontSize: 19, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center' }}><ClipboardList size={20} /> Registry Voucher</h2><p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 5 }}>Kode dan NIK pada layar selalu tersamarkan.</p></div>
            <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void exportCodes()}>{busy === 'export' ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />} Export kode untuk print (CSV)</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10, marginTop: 15 }}><label style={labelStyle}>Filter campaign<select style={fieldStyle} value={registryFilter.campaignId} onChange={(event) => setRegistryFilter({ ...registryFilter, campaignId: event.target.value })}><option value="">Semua campaign</option>{dashboard.campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.code}</option>)}</select></label><label style={labelStyle}>Filter status<select style={fieldStyle} value={registryFilter.status} onChange={(event) => setRegistryFilter({ ...registryFilter, status: event.target.value })}><option value="">Semua status</option>{['AVAILABLE', 'ISSUED', 'CLAIMED', 'EXHAUSTED', 'EXPIRED', 'CANCELLED'].map((status) => <option value={status} key={status}>{status}</option>)}</select></label></div>
          {renderVoucherTable(filteredVouchers, 'Belum ada voucher pada filter ini.')}
        </section>
      </>}

      {view === 'history' && <section className="card" style={{ padding: 21 }}>
        <div><h2 style={{ fontSize: 19, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center' }}><History size={20} /> Riwayat Klaim</h2><p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 5 }}>{isSuperAdmin ? 'Menampilkan klaim dari seluruh lokasi.' : 'Hanya klaim dari lokasi yang ditugaskan kepada akun Anda.'}</p></div>
        {renderVoucherTable(claimHistory, 'Belum ada riwayat klaim pada scope lokasi ini.')}
      </section>}

      {view === 'campaigns' && <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(285px,1fr))', gap: 12 }}>
        {dashboard.campaigns.map((campaign) => (
          <article className="card" style={{ padding: 18 }} key={campaign.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong style={{ color: '#f59e0b' }}>{campaign.code}</strong><span style={{ fontSize: 12 }}>{campaign.status}</span></div>
            <h2 style={{ fontWeight: 800, marginTop: 9, lineHeight: 1.35 }}>{campaign.title}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8, minHeight: 55 }}>{campaign.description}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, marginTop: 13 }}><span>{campaign.basicSessions}× BASIC</span><span>{campaign.boosterSessions}× BOOSTER</span><strong>{formatCurrency(campaign.totalPrice)}</strong></div>
            <div style={{ marginTop: 13 }}><div style={{ height: 7, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, campaign.generatedCount / campaign.quota * 100)}%`, background: '#f59e0b' }} /></div><small style={{ color: 'var(--text-secondary)' }}>{campaign.generatedCount}/{campaign.quota} kode dibuat · {campaign.availableCount} AVAILABLE · {campaign.issuedCount} diterbitkan</small>{campaign.remainingToGenerate > 0 && <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }} disabled={busy !== null} onClick={() => void generateCodes(campaign)}>{busy === `generate-${campaign.id}` ? <Loader2 size={16} className="animate-spin" /> : <TicketPercent size={16} />} Generate sisa {campaign.remainingToGenerate} kode</button>}</div>
          </article>
        ))}
      </section>}

      {view === 'locations' && <section className="card" style={{ padding: 21 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10 }}>
          {dashboard.locations.map((location) => <article key={location.id} style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 14 }}><div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}><MapPin size={18} color="#f59e0b" /><div><strong>{location.displayName}</strong><div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 3 }}>{location.code} · {location.city}</div>{location.partnerName && <div style={{ fontSize: 13, marginTop: 5 }}>Partner: {location.partnerName}</div>}</div></div></article>)}
        </div>
      </section>}

      {view === 'operators' && <section className="card" style={{ padding: 21 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center' }}><UserPlus size={20} /> Buat Akun Pengelola</h2>
        <form onSubmit={submitOperator} style={{ display: 'grid', gap: 12, marginTop: 15 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}><label style={labelStyle}>Nama lengkap<input required style={fieldStyle} value={operatorForm.fullName} onChange={(event) => setOperatorForm({ ...operatorForm, fullName: event.target.value })} /></label><label style={labelStyle}>Username<input required style={fieldStyle} value={operatorForm.username} onChange={(event) => setOperatorForm({ ...operatorForm, username: event.target.value.toLowerCase() })} /></label><label style={labelStyle}>Password awal<input required type="password" minLength={8} style={fieldStyle} value={operatorForm.password} onChange={(event) => setOperatorForm({ ...operatorForm, password: event.target.value })} /></label></div>
          <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 12 }}><legend style={{ padding: '0 7px', fontSize: 13, fontWeight: 700 }}>Lokasi yang dikelola</legend><div style={{ display: 'flex', gap: 8, marginBottom: 10 }}><button type="button" className="btn btn-secondary" onClick={() => setOperatorForm((current) => ({ ...current, locationIds: dashboard.locations.map((location) => location.id) }))}>Pilih semua lokasi</button><button type="button" className="btn btn-secondary" onClick={() => setOperatorForm((current) => ({ ...current, locationIds: [] }))}>Kosongkan</button></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(245px,1fr))', gap: 8, maxHeight: 290, overflowY: 'auto' }}>{dashboard.locations.map((location) => <label key={location.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}><input type="checkbox" checked={operatorForm.locationIds.includes(location.id)} onChange={(event) => setOperatorForm((current) => ({ ...current, locationIds: event.target.checked ? [...current.locationIds, location.id] : current.locationIds.filter((id) => id !== location.id) }))} /><span>{location.displayName}<small style={{ display: 'block', color: 'var(--text-secondary)' }}>{location.city}</small></span></label>)}</div></fieldset>
          <button className="btn btn-primary" disabled={busy !== null || operatorForm.locationIds.length === 0}>{busy === 'operator' ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />} Buat akun pengelola</button>
        </form>
        {dashboard.operators.length > 0 && <div style={{ display: 'grid', gap: 9, marginTop: 18 }}>{dashboard.operators.map((operator) => <div key={operator.id} style={{ borderTop: '1px solid var(--border-color)', paddingTop: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><strong>{operator.fullName}</strong><div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>@{operator.username} · {operator.locations.length} lokasi</div><small style={{ color: 'var(--text-secondary)' }}>{operator.locations.map((item) => item.code).join(', ')}</small></div><button type="button" className="btn btn-secondary" disabled={busy === operator.id} onClick={() => void toggleOperator(operator)}>{operator.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button></div>)}</div>}
      </section>}
    </div>
  );
}
