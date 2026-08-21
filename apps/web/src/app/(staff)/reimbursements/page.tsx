'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Camera, CircleDollarSign, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { accountingApi, type Account } from '@/lib/accountingApi';
import { cashBankApi, type CashBankAccount } from '@/lib/cashBankApi';
import { assertCaughtError } from '@/lib/caughtError';
import { reimbursementApi, type Reimbursement } from '@/lib/reimbursementApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

type Branch = { id: string; branchCode: string; name: string };

const rupiah = (value: string | number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
const statusLabel: Record<Reimbursement['status'], string> = {
  DRAFT: 'Draft', PENDING_APPROVAL: 'Menunggu approval', REVISION_REQUIRED: 'Perlu perbaikan',
  APPROVED: 'Siap dibayar', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan', PAID: 'Dibayar',
};

export default function ReimbursementsPage() {
  const user = useAuthStore((state) => state.user);
  const [rows, setRows] = useState<Reimbursement[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [permissions, setPermissions] = useState(new Set<string>());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashBankAccount[]>([]);
  const [editing, setEditing] = useState<Reimbursement | null>(null);
  const [paying, setPaying] = useState<Reimbursement | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [claims, branchResponse, accessResponse] = await Promise.all([
        reimbursementApi.list(), api.get('/branches/all'), api.get('/iam/me'),
      ]);
      const nextPermissions = new Set<string>(accessResponse.data.data?.permissions || []);
      setRows(claims);
      setBranches(branchResponse.data.data || []);
      setPermissions(nextPermissions);
      if (nextPermissions.has('REIMBURSEMENT.PAY')) {
        const [coa, cash] = await Promise.all([accountingApi.accounts(), cashBankApi.listAccounts({ isActive: 'true' })]);
        setAccounts(coa.filter((item) => item.type === 'EXPENSE' && item.allowPosting && item.isActive));
        setCashAccounts(cash);
      }
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat reimburse.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (operation: () => Promise<unknown>, success: string) => {
    try { await operation(); showToast.success(success); await load(); }
    catch (error) { assertCaughtError(error); showToast.error(error.response?.data?.error?.message || 'Proses reimburse gagal.'); }
  };

  const openEvidence = async (row: Reimbursement, attachmentId: string) => {
    try {
      const result = await reimbursementApi.attachment(row.id, attachmentId);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) { assertCaughtError(error); showToast.error(error.response?.data?.error?.message || 'Bukti tidak dapat dibuka.'); }
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><CircleDollarSign /> Reimburse</h1><p className="mt-1 text-sm text-neutral-500">Ajukan biaya, lampirkan foto bukti, pantau approval, dan status pembayaran.</p></div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw size={16} /> Muat ulang</button>
        {permissions.has('REIMBURSEMENT.CREATE') && <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black"><Plus size={16} /> Ajukan reimburse</button>}
      </div>
    </header>

    {(showForm || editing) && <ReimbursementForm
      row={editing}
      branches={branches}
      defaultBranchId={user?.branchId || ''}
      onClose={() => { setShowForm(false); setEditing(null); }}
      onSaved={async () => { setShowForm(false); setEditing(null); await load(); }}
    />}

    {paying && <PaymentForm row={paying} accounts={accounts} cashAccounts={cashAccounts} onClose={() => setPaying(null)} onPaid={async () => { setPaying(null); await load(); }} />}

    {loading ? <p>Memuat…</p> : <div className="overflow-x-auto rounded-xl border bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <table className="w-full min-w-[980px] text-sm"><thead><tr className="text-left text-xs uppercase text-neutral-500">
        <th className="p-3">Dokumen</th><th className="p-3">Pengaju</th><th className="p-3">Pengeluaran</th><th className="p-3 text-right">Jumlah</th><th className="p-3">Bukti</th><th className="p-3">Status</th><th className="p-3">Aksi</th>
      </tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t align-top dark:border-neutral-800">
        <td className="p-3"><strong>{row.reimbursementNumber}</strong><small className="block text-neutral-500">{row.branch.branchCode} · {new Date(row.expenseDate).toLocaleDateString('id-ID')}</small></td>
        <td className="p-3">{row.claimant.profile?.fullName || row.claimant.email}<small className="block text-neutral-500">{row.claimant.staffCode || row.claimant.email}</small></td>
        <td className="max-w-xs p-3">{row.description}<small className="block text-neutral-500">{row.category} · {row.paymentMethod === 'BANK_TRANSFER' ? 'Transfer' : 'Tunai'}</small></td>
        <td className="p-3 text-right font-semibold">{rupiah(row.amount)}</td>
        <td className="p-3"><div className="flex flex-wrap gap-1">{row.attachments.map((item, index) => <button key={item.id} type="button" onClick={() => void openEvidence(row, item.id)} className="flex items-center gap-1 rounded border px-2 py-1 text-xs"><Camera size={13} /> Foto {index + 1}</button>)}</div></td>
        <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : row.status === 'REJECTED' || row.status === 'REVISION_REQUIRED' ? 'bg-red-100 text-red-700' : row.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800'}`}>{statusLabel[row.status]}</span>{(row.revisionNote || row.rejectionReason) && <small className="mt-2 block max-w-xs text-red-600">{row.revisionNote || row.rejectionReason}</small>}{row.journalEntry && <small className="mt-1 block">{row.journalEntry.journalNumber}</small>}</td>
        <td className="p-3"><div className="flex flex-wrap gap-1">
          {(row.status === 'DRAFT' || row.status === 'REVISION_REQUIRED' || row.status === 'REJECTED') && row.claimantUserId === user?.id && <Small onClick={() => { setShowForm(false); setEditing(row); }}>Perbaiki</Small>}
          {row.status === 'DRAFT' && row.claimantUserId === user?.id && <Small onClick={() => void run(() => reimbursementApi.submit(row.id), 'Reimburse masuk ke Approval Inbox.')}>Ajukan</Small>}
          {(row.status === 'DRAFT' || row.status === 'REVISION_REQUIRED') && row.claimantUserId === user?.id && <Small onClick={() => { if (window.confirm('Batalkan reimburse ini?')) void run(() => reimbursementApi.cancel(row.id), 'Reimburse dibatalkan.'); }}>Batalkan</Small>}
          {row.status === 'APPROVED' && permissions.has('REIMBURSEMENT.PAY') && <Small onClick={() => setPaying(row)}>Bayar</Small>}
        </div></td>
      </tr>)}</tbody></table>{rows.length === 0 && <p className="p-8 text-center text-neutral-500">Belum ada pengajuan reimburse.</p>}
    </div>}
  </div>;
}

function ReimbursementForm({ row, branches, defaultBranchId, onClose, onSaved }: { row: Reimbursement | null; branches: Branch[]; defaultBranchId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    branchId: row?.branchId || defaultBranchId,
    expenseDate: row?.expenseDate.slice(0, 10) || new Date().toISOString().slice(0, 10),
    category: row?.category || '', description: row?.description || '', amount: row?.amount || '',
    paymentMethod: row?.paymentMethod || 'BANK_TRANSFER', recipientBankName: row?.recipientBankName || '',
    recipientAccountNumber: row?.recipientAccountNumber || '', recipientAccountHolder: row?.recipientAccountHolder || '',
  });
  const [evidence, setEvidence] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      if (!row && evidence.length === 0) throw new Error('Minimal satu foto bukti wajib dipilih.');
      if (evidence.length > 5) throw new Error('Maksimal lima foto bukti.');
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.append(key, value));
      evidence.forEach((file) => data.append('evidence', file));
      if (row) await reimbursementApi.update(row.id, data);
      else { data.append('postingKey', crypto.randomUUID()); await reimbursementApi.create(data); }
      showToast.success(row ? 'Perbaikan disimpan sebagai draft.' : 'Draft reimburse dibuat.');
      await onSaved();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || error.message || 'Gagal menyimpan reimburse.');
    } finally { setSaving(false); }
  };
  return <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-900">
    <div className="md:col-span-3"><strong>{row ? `Perbaiki ${row.reimbursementNumber}` : 'Reimburse baru'}</strong><p className="text-xs text-neutral-500">Simpan draft dahulu, kemudian klik Ajukan setelah data benar.</p></div>
    <Field label="Cabang"><select required disabled={Boolean(row)} value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })}><option value="">Pilih cabang</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} — {branch.name}</option>)}</select></Field>
    <Field label="Tanggal pengeluaran"><input required type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} /></Field>
    <Field label="Kategori"><input required placeholder="Transportasi, konsumsi, operasional…" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></Field>
    <Field label="Jumlah reimburse"><input required inputMode="numeric" placeholder="150000" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value.replace(/[^0-9.]/g, '') })} /></Field>
    <Field label="Metode penerimaan"><select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as 'CASH' | 'BANK_TRANSFER' })}><option value="BANK_TRANSFER">Transfer bank</option><option value="CASH">Tunai</option></select></Field>
    <Field label="Keterangan"><input required placeholder="Keperluan pengeluaran" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
    {form.paymentMethod === 'BANK_TRANSFER' && <>
      <Field label="Nama bank"><input required value={form.recipientBankName} onChange={(event) => setForm({ ...form, recipientBankName: event.target.value })} /></Field>
      <Field label="Nomor rekening"><input required inputMode="numeric" value={form.recipientAccountNumber} onChange={(event) => setForm({ ...form, recipientAccountNumber: event.target.value.replace(/[^0-9]/g, '') })} /></Field>
      <Field label="Nama pemilik rekening"><input required value={form.recipientAccountHolder} onChange={(event) => setForm({ ...form, recipientAccountHolder: event.target.value })} /></Field>
    </>}
    <Field label={row ? 'Ganti seluruh foto bukti (opsional)' : 'Foto bukti'}><input required={!row} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => setEvidence(Array.from(event.target.files || []))} /><small className="text-neutral-500">1–5 foto, maksimal 5 MB per foto.</small></Field>
    {row && <div className="self-end text-xs text-neutral-500">Tanpa memilih foto baru, {row.attachments.length} foto lama tetap digunakan.</div>}
    <div className="flex items-end justify-end gap-2 md:col-span-3"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Batal</button><button disabled={saving} className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-black disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan draft'}</button></div>
  </form>;
}

function PaymentForm({ row, accounts, cashAccounts, onClose, onPaid }: { row: Reimbursement; accounts: Account[]; cashAccounts: CashBankAccount[]; onClose: () => void; onPaid: () => Promise<void> }) {
  const availableCash = cashAccounts.filter((item) => item.branchId === row.branchId);
  const [form, setForm] = useState({ expenseAccountCode: '', cashBankAccountId: '', paymentDate: new Date().toISOString().slice(0, 10), paymentReference: '' });
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { await reimbursementApi.pay(row.id, form); showToast.success('Reimburse dibayar dan jurnal telah diposting.'); await onPaid(); }
    catch (error) { assertCaughtError(error); showToast.error(error.response?.data?.error?.message || 'Pembayaran gagal.'); }
    finally { setSaving(false); }
  };
  return <form onSubmit={submit} className="grid gap-3 rounded-xl border border-emerald-500/40 bg-emerald-50 p-4 md:grid-cols-3 dark:bg-emerald-950/20">
    <div className="md:col-span-3"><strong>Bayar {row.reimbursementNumber} — {rupiah(row.amount)}</strong><p className="text-xs text-neutral-500">Pengaju: {row.claimant.profile?.fullName || row.claimant.email}</p></div>
    <Field label="Akun beban"><select required value={form.expenseAccountCode} onChange={(event) => setForm({ ...form, expenseAccountCode: event.target.value })}><option value="">Pilih akun</option>{accounts.map((item) => <option key={item.id} value={item.code}>{item.code} — {item.name}</option>)}</select></Field>
    <Field label="Sumber kas/bank"><select required value={form.cashBankAccountId} onChange={(event) => setForm({ ...form, cashBankAccountId: event.target.value })}><option value="">Pilih rekening</option>{availableCash.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></Field>
    <Field label="Tanggal pembayaran"><input required type="date" value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} /></Field>
    <Field label="Referensi transfer"><input value={form.paymentReference} onChange={(event) => setForm({ ...form, paymentReference: event.target.value })} /></Field>
    <div className="flex items-end justify-end gap-2 md:col-span-3"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Batal</button><button disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Memproses…' : 'Bayar & posting'}</button></div>
  </form>;
}

function Small({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="rounded border px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">{children}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-sm [&_input]:rounded-lg [&_input]:border [&_input]:bg-transparent [&_input]:px-3 [&_input]:py-2 [&_select]:rounded-lg [&_select]:border [&_select]:bg-transparent [&_select]:px-3 [&_select]:py-2">{label}{children}</label>; }
