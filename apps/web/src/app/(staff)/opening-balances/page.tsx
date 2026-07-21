'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { api } from '@/lib/api';
import { openingBalanceApi, type OpeningBalance, type OpeningLine } from '@/lib/openingBalanceApi';
import { showToast } from '@/lib/toast';

type Branch = { id: string; branchCode: string; name: string };
const exampleLines: OpeningLine[] = [
  { type: 'CASH_BANK', accountCode: '1110', description: 'Saldo awal kas', debit: '1000000.00', credit: '0', cashBankAccountId: 'ISI_ID_REKENING' },
  { type: 'GENERAL', accountCode: '3100', description: 'Modal saldo awal', debit: '0', credit: '1000000.00' },
];

export default function OpeningBalancesPage() {
  const [rows, setRows] = useState<OpeningBalance[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [permissions, setPermissions] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [opening, branchResponse, access] = await Promise.all([openingBalanceApi.list(), api.get('/branches/all'), api.get('/iam/me')]);
      setRows(opening); setBranches(branchResponse.data.data || []); setPermissions(new Set(access.data.data?.permissions || []));
    } catch (error: any) { showToast.error(error.response?.data?.error?.message || 'Gagal memuat opening balance.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);
  const action = async (operation: () => Promise<unknown>, message: string) => { try { await operation(); showToast.success(message); await reload(); } catch (error: any) { showToast.error(error.response?.data?.error?.message || 'Aksi gagal.'); } };

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex items-start justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><Scale /> Opening Balance</h1><p className="mt-1 text-sm text-neutral-500">Saldo awal finance dan stok diposting atomik, traceable ke jurnal serta FIFO cost layer.</p></div>{permissions.has('OPENING_BALANCE.MANAGE') && <button onClick={() => setShowForm((value) => !value)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Buat opening</button>}</header>
    {showForm && <OpeningForm branches={branches} onSaved={async () => { setShowForm(false); await reload(); }} />}
    {loading ? <p>Memuat…</p> : <div className="space-y-3">{rows.map((row) => <article key={row.id} className="rounded-xl border bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{row.documentNumber}</strong><p className="text-sm text-neutral-500">{row.branch.branchCode} · {new Date(row.balanceDate).toLocaleDateString('id-ID')} · {row.description}</p></div><div className="text-right"><span className="rounded bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">{row.status}</span><p className="mt-2 font-mono text-sm">Dr/Cr Rp {row.totalDebit}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{row.status === 'DRAFT' && permissions.has('OPENING_BALANCE.MANAGE') && <Small onClick={() => action(() => openingBalanceApi.submit(row.id), 'Opening balance diajukan.')}>Ajukan</Small>}{row.status === 'SUBMITTED' && permissions.has('OPENING_BALANCE.POST') && <><Small onClick={() => action(() => openingBalanceApi.post(row.id), 'Opening balance dan cost layer diposting.')}>Posting</Small><Small onClick={() => { const reason = window.prompt('Alasan penolakan'); if (reason) void action(() => openingBalanceApi.reject(row.id, reason), 'Opening balance ditolak.'); }}>Tolak</Small></>}{row.journalEntry && <span className="text-xs text-neutral-500">Jurnal {row.journalEntry.journalNumber}</span>}</div><details className="mt-3 text-sm"><summary className="cursor-pointer">{row.lines.length} line</summary><div className="mt-2 space-y-1">{row.lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_auto_auto] gap-3 border-t py-2"><span>{line.accountCode} — {line.description}{line.inventoryPosting && <small className="ml-2 text-neutral-500">{line.inventoryPosting.postingNumber}</small>}</span><span className="font-mono">Dr {line.debit}</span><span className="font-mono">Cr {line.credit}</span></div>)}</div></details></article>)}{rows.length === 0 && <p className="rounded-xl border p-6 text-center text-neutral-500">Belum ada opening balance.</p>}</div>}
  </div>;
}

function OpeningForm({ branches, onSaved }: { branches: Branch[]; onSaved: () => void }) {
  const [form, setForm] = useState({ branchId: '', balanceDate: new Date().toISOString().slice(0, 10), description: 'Opening balance go-live' });
  const [lines, setLines] = useState(JSON.stringify(exampleLines, null, 2));
  const submit = async (event: FormEvent) => { event.preventDefault(); try { const parsed = JSON.parse(lines) as OpeningLine[]; await openingBalanceApi.create({ ...form, postingKey: crypto.randomUUID(), lines: parsed }); showToast.success('Draft opening balance dibuat.'); onSaved(); } catch (error: any) { showToast.error(error instanceof SyntaxError ? 'JSON line tidak valid.' : error.response?.data?.error?.message || 'Gagal membuat opening balance.'); } };
  return <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><div className="grid gap-3 md:grid-cols-3"><Field label="Cabang"><select required value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}><option value="">Pilih cabang</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} — {branch.name}</option>)}</select></Field><Field label="Tanggal saldo"><input required type="date" value={form.balanceDate} onChange={(e) => setForm({ ...form, balanceDate: e.target.value })} /></Field><Field label="Keterangan"><input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div><label className="grid gap-1 text-sm">Lines JSON <span className="text-xs text-neutral-500">Untuk INVENTORY isi inventoryItemId, stockLocationId, quantity, unitCost, dan batchNumber bila tracking batch aktif.</span><textarea required rows={12} value={lines} onChange={(e) => setLines(e.target.value)} className="rounded-lg border bg-transparent p-3 font-mono text-xs" /></label><div className="flex justify-end"><button className="rounded-lg bg-blue-600 px-4 py-2 text-white">Simpan draft</button></div></form>;
}

function Small({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button onClick={onClick} className="rounded border px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">{children}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-sm [&_input]:rounded-lg [&_input]:border [&_input]:bg-transparent [&_input]:px-3 [&_input]:py-2 [&_select]:rounded-lg [&_select]:border [&_select]:bg-transparent [&_select]:px-3 [&_select]:py-2">{label}{children}</label>; }
