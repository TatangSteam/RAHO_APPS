'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { api } from '@/lib/api';
import { accountingApi, type Account } from '@/lib/accountingApi';
import { cashBankApi, type CashBankAccount } from '@/lib/cashBankApi';
import { expenseApi, type Expense } from '@/lib/expenseApi';
import { showToast } from '@/lib/toast';

type Branch = { id: string; branchCode: string; name: string };

export default function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashBankAccount[]>([]);
  const [permissions, setPermissions] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [expenses, branchResponse, coa, cash, access] = await Promise.all([
        expenseApi.list(), api.get('/branches/all'), accountingApi.accounts(), cashBankApi.listAccounts({ isActive: 'true' }), api.get('/iam/me'),
      ]);
      setRows(expenses); setBranches(branchResponse.data.data || []); setAccounts(coa.filter((row) => row.type === 'EXPENSE' && row.allowPosting)); setCashAccounts(cash);
      setPermissions(new Set(access.data.data?.permissions || []));
    } catch (error: any) { showToast.error(error.response?.data?.error?.message || 'Gagal memuat expense.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);

  const action = async (operation: () => Promise<unknown>, message: string) => {
    try { await operation(); showToast.success(message); await reload(); }
    catch (error: any) { showToast.error(error.response?.data?.error?.message || 'Aksi gagal.'); }
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex items-start justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><ReceiptText /> Expense</h1><p className="mt-1 text-sm text-neutral-500">Maker-checker, evidence terlindungi, pembayaran kas/bank, dan jurnal otomatis.</p></div>{permissions.has('EXPENSE.CREATE') && <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white" onClick={() => setShowForm((value) => !value)}>Buat expense</button>}</header>
    {showForm && <ExpenseForm branches={branches} accounts={accounts} cashAccounts={cashAccounts} onSaved={async () => { setShowForm(false); await reload(); }} />}
    {loading ? <p>Memuat…</p> : <div className="overflow-x-auto rounded-xl border bg-white dark:border-neutral-800 dark:bg-neutral-900"><table className="w-full text-sm"><thead><tr className="text-left"><th className="p-3">Dokumen</th><th className="p-3">Tanggal</th><th className="p-3">Keterangan</th><th className="p-3">Status</th><th className="p-3 text-right">Nominal</th><th className="p-3">Aksi</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t align-top dark:border-neutral-800"><td className="p-3"><strong>{row.expenseNumber}</strong><div className="text-xs text-neutral-500">{row.branch.branchCode} · {row.expenseAccount.code}</div></td><td className="p-3">{new Date(row.expenseDate).toLocaleDateString('id-ID')}</td><td className="p-3">{row.description}<div className="text-xs text-neutral-500">{row.category}</div></td><td className="p-3">{row.status}{row.journalEntry && <div className="text-xs">{row.journalEntry.journalNumber}</div>}</td><td className="p-3 text-right font-mono">Rp {row.amount}</td><td className="p-3"><div className="flex flex-wrap gap-2">{row.status === 'DRAFT' && permissions.has('EXPENSE.CREATE') && <Small onClick={() => action(() => expenseApi.submit(row.id), 'Expense diajukan.')}>Ajukan</Small>}{row.status === 'SUBMITTED' && permissions.has('EXPENSE.APPROVE') && <><Small onClick={() => action(() => expenseApi.approve(row.id), 'Expense disetujui.')}>Setujui</Small><Small onClick={() => { const reason = window.prompt('Alasan penolakan'); if (reason) void action(() => expenseApi.reject(row.id, reason), 'Expense ditolak.'); }}>Tolak</Small></>}{row.status === 'APPROVED' && permissions.has('EXPENSE.PAY') && <Small onClick={() => action(() => expenseApi.pay(row.id), 'Expense dibayar dan diposting.')}>Bayar</Small>}{row.evidenceFileUrl && <Small onClick={() => action(async () => { const result = await expenseApi.evidence(row.id); window.open(result.url, '_blank', 'noopener,noreferrer'); }, 'Evidence dibuka.')}>Evidence</Small>}</div></td></tr>)}</tbody></table>{rows.length === 0 && <p className="p-6 text-center text-neutral-500">Belum ada expense.</p>}</div>}
  </div>;
}

function ExpenseForm({ branches, accounts, cashAccounts, onSaved }: { branches: Branch[]; accounts: Account[]; cashAccounts: CashBankAccount[]; onSaved: () => void }) {
  const [form, setForm] = useState({ branchId: '', expenseDate: new Date().toISOString().slice(0, 10), category: '', description: '', amount: '', expenseAccountCode: '', cashBankAccountId: '' });
  const [evidence, setEvidence] = useState<File | null>(null);
  const submit = async (event: FormEvent) => { event.preventDefault(); try { const data = new FormData(); Object.entries(form).forEach(([key, value]) => data.append(key, value)); data.append('postingKey', crypto.randomUUID()); if (evidence) data.append('evidence', evidence); await expenseApi.create(data); showToast.success('Draft expense dibuat.'); onSaved(); } catch (error: any) { showToast.error(error.response?.data?.error?.message || 'Gagal membuat expense.'); } };
  return <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-900"><Field label="Cabang"><select required value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, cashBankAccountId: '' })}><option value="">Pilih</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} — {branch.name}</option>)}</select></Field><Field label="Tanggal"><input required type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} /></Field><Field label="Kategori"><input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field><Field label="Akun beban"><select required value={form.expenseAccountCode} onChange={(e) => setForm({ ...form, expenseAccountCode: e.target.value })}><option value="">Pilih</option>{accounts.map((account) => <option key={account.id} value={account.code}>{account.code} — {account.name}</option>)}</select></Field><Field label="Kas/bank"><select required value={form.cashBankAccountId} onChange={(e) => setForm({ ...form, cashBankAccountId: e.target.value })}><option value="">Pilih</option>{cashAccounts.filter((account) => account.branchId === form.branchId).map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></Field><Field label="Nominal"><input required inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field><Field label="Keterangan"><input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field><Field label="Evidence"><input required type="file" accept="image/*,application/pdf" onChange={(e) => setEvidence(e.target.files?.[0] || null)} /></Field><button className="self-end rounded-lg bg-blue-600 px-4 py-2 text-white">Simpan draft</button></form>;
}

function Small({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button onClick={onClick} className="rounded border px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">{children}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-sm [&_input]:rounded-lg [&_input]:border [&_input]:bg-transparent [&_input]:px-3 [&_input]:py-2 [&_select]:rounded-lg [&_select]:border [&_select]:bg-transparent [&_select]:px-3 [&_select]:py-2">{label}{children}</label>; }
