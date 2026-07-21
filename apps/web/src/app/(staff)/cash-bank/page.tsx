'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { api } from '@/lib/api';
import { cashBankApi, type CashBankAccount } from '@/lib/cashBankApi';
import { showToast } from '@/lib/toast';

interface Branch { id: string; branchCode: string; name: string }
interface CashTransaction {
  id: string;
  transactionNumber: string;
  transactionDate: string;
  amount: string;
  description: string;
  sourceNumber?: string;
  cashBankAccount: { code: string; name: string };
  journalEntry: { journalNumber: string };
}

export default function CashBankPage() {
  const [accounts, setAccounts] = useState<CashBankAccount[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const [accountRows, transactionResult, branchResult, accessResult] = await Promise.all([
        cashBankApi.listAccounts(),
        cashBankApi.listTransactions({ limit: 100 }),
        api.get('/branches/all'),
        api.get('/iam/me'),
      ]);
      setAccounts(accountRows);
      setTransactions(transactionResult.data || []);
      setBranches(branchResult.data.data || []);
      setPermissions(new Set(accessResult.data.data?.permissions || []));
    } catch (error: any) {
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat kas/bank.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex items-start justify-between gap-4">
      <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><Landmark /> Kas & Bank</h1><p className="mt-1 text-sm text-neutral-500">Master rekening dan ledger penerimaan yang traceable ke jurnal.</p></div>
      {permissions.has('CASH_BANK.MANAGE') && <button onClick={() => setShowForm((value) => !value)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Tambah rekening</button>}
    </header>
    {showForm && <AccountForm branches={branches} onSaved={async () => { setShowForm(false); await reload(); }} />}
    {loading ? <p>Memuat…</p> : <>
      <section><h2 className="mb-3 font-semibold">Master rekening</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{accounts.map((account) => <article key={account.id} className="rounded-xl border bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><div className="flex justify-between"><strong>{account.code}</strong><span className="text-xs">{account.type}</span></div><p>{account.name}</p><p className="mt-2 text-xs text-neutral-500">COA {account.coaAccount.code} — {account.coaAccount.name}</p></article>)}</div></section>
      <section><h2 className="mb-3 font-semibold">Ledger penerimaan</h2><div className="overflow-x-auto rounded-xl border bg-white dark:border-neutral-800 dark:bg-neutral-900"><table className="w-full text-sm"><thead><tr className="text-left"><th className="p-3">Nomor</th><th className="p-3">Tanggal</th><th className="p-3">Rekening</th><th className="p-3">Source</th><th className="p-3">Jurnal</th><th className="p-3 text-right">Nominal</th></tr></thead><tbody>{transactions.map((row) => <tr key={row.id} className="border-t dark:border-neutral-800"><td className="p-3">{row.transactionNumber}</td><td className="p-3">{new Date(row.transactionDate).toLocaleString('id-ID')}</td><td className="p-3">{row.cashBankAccount.code}</td><td className="p-3">{row.sourceNumber || row.description}</td><td className="p-3">{row.journalEntry.journalNumber}</td><td className="p-3 text-right font-mono">Rp {row.amount}</td></tr>)}</tbody></table>{transactions.length === 0 && <p className="p-6 text-center text-sm text-neutral-500">Belum ada transaksi posted.</p>}</div></section>
    </>}
  </div>;
}

function AccountForm({ branches, onSaved }: { branches: Branch[]; onSaved: () => void }) {
  const [form, setForm] = useState({ code: '', name: '', type: 'CASH' as 'CASH' | 'BANK', branchId: '', coaAccountCode: '1110', currency: 'IDR', bankName: '', accountNumber: '', accountHolderName: '', requiresReference: false });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try { await cashBankApi.createAccount(form); showToast.success('Rekening kas/bank dibuat.'); onSaved(); }
    catch (error: any) { showToast.error(error.response?.data?.error?.message || 'Gagal membuat rekening.'); }
  };
  return <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-900">
    <Field label="Kode"><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
    <Field label="Nama"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
    <Field label="Tipe"><select value={form.type} onChange={(e) => { const type = e.target.value as 'CASH' | 'BANK'; setForm({ ...form, type, coaAccountCode: type === 'CASH' ? '1110' : '1120' }); }}><option>CASH</option><option>BANK</option></select></Field>
    <Field label="Cabang"><select required value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}><option value="">Pilih cabang</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} — {branch.name}</option>)}</select></Field>
    <Field label="Kode COA"><input required value={form.coaAccountCode} onChange={(e) => setForm({ ...form, coaAccountCode: e.target.value })} /></Field>
    <Field label="Nama bank"><input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></Field>
    <Field label="Nomor rekening"><input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /></Field>
    <Field label="Pemilik rekening"><input value={form.accountHolderName} onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })} /></Field>
    <label className="flex items-center gap-2 self-end py-2 text-sm"><input type="checkbox" checked={form.requiresReference} onChange={(e) => setForm({ ...form, requiresReference: e.target.checked })} /> Referensi wajib</label>
    <button className="rounded-lg bg-blue-600 px-4 py-2 text-white md:col-start-3">Simpan rekening</button>
  </form>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-sm [&_input]:rounded-lg [&_input]:border [&_input]:bg-transparent [&_input]:px-3 [&_input]:py-2 [&_select]:rounded-lg [&_select]:border [&_select]:bg-transparent [&_select]:px-3 [&_select]:py-2">{label}{children}</label>; }
