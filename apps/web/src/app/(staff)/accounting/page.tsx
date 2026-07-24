'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarRange, CheckCircle2, Landmark, Layers3, Link2, Plus, Search, WalletCards } from 'lucide-react';
import { accountingApi, Account, AccountingPeriod, Journal } from '@/lib/accountingApi';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';

type Tab = 'accounts' | 'periods' | 'journals';
interface Branch { id: string; branchCode: string; name: string }

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>('accounts');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [permissionCodes, setPermissionCodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountType, setAccountType] = useState<'ALL' | Account['type']>('ALL');

  const reload = async () => {
    setLoading(true);
    try {
      const [accountRows, periodRows, journalRows, branchResponse, accessResponse] = await Promise.all([
        accountingApi.accounts(), accountingApi.periods(), accountingApi.journals(), api.get('/branches/all'), api.get('/iam/me'),
      ]);
      setAccounts(accountRows); setPeriods(periodRows); setJournals(journalRows);
      setBranches(branchResponse.data.data || []);
      setPermissionCodes(new Set(accessResponse.data.data?.permissions || []));
    } catch (error: any) {
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat accounting foundation.');
    } finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, []);
  const postableAccounts = useMemo(() => accounts.filter((account) => account.isActive && account.allowPosting), [accounts]);
  const canManageAccounts = permissionCodes.has('ACCOUNT.MANAGE');
  const canManagePeriods = permissionCodes.has('ACCOUNTING_PERIOD.MANAGE');
  const canPostJournal = permissionCodes.has('JOURNAL.POST');
  const filteredAccounts = useMemo(() => accounts.filter((account) => {
    const matchesSearch = `${account.code} ${account.name}`.toLowerCase().includes(accountSearch.toLowerCase());
    return matchesSearch && (accountType === 'ALL' || account.type === accountType);
  }), [accounts, accountSearch, accountType]);
  const activeAccounts = accounts.filter((account) => account.isActive).length;
  const postingAccounts = accounts.filter((account) => account.isActive && account.allowPosting).length;
  const openPeriods = periods.filter((period) => period.status === 'OPEN').length;

  return <div className="mx-auto max-w-7xl space-y-6 pb-10">
    <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-br from-white via-blue-50/50 to-indigo-50 p-6 shadow-sm dark:border-neutral-800 dark:from-neutral-900 dark:via-blue-950/20 dark:to-neutral-900 md:p-8">
      <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <div className="rounded-2xl bg-blue-600 p-3 text-white shadow-lg shadow-blue-600/20"><Landmark size={26}/></div>
        <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Finance workspace</p>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white md:text-3xl">Accounting Foundation</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-300">Kelola struktur akun, periode akuntansi, dan jurnal dalam satu ruang kerja yang terhubung.</p>
        </div>
      </div>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={<Layers3 size={20}/>} label="Total akun" value={accounts.length} hint="Seluruh chart of accounts" tone="blue"/>
      <MetricCard icon={<CheckCircle2 size={20}/>} label="Akun aktif" value={activeAccounts} hint={`${accounts.length - activeAccounts} akun nonaktif`} tone="emerald"/>
      <MetricCard icon={<WalletCards size={20}/>} label="Siap posting" value={postingAccounts} hint="Akun detail aktif" tone="violet"/>
      <MetricCard icon={<CalendarRange size={20}/>} label="Periode terbuka" value={openPeriods} hint={`${journals.length} jurnal tercatat`} tone="amber"/>
    </div>

    <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100/80 p-1 dark:border-neutral-800 dark:bg-neutral-900">
      <TabButton active={tab === 'accounts'} onClick={() => setTab('accounts')}><BookOpen size={16} /> COA</TabButton>
      <TabButton active={tab === 'periods'} onClick={() => setTab('periods')}><CalendarRange size={16} /> Periode</TabButton>
      <TabButton active={tab === 'journals'} onClick={() => setTab('journals')}><Link2 size={16} /> Jurnal</TabButton>
    </div>
    {loading ? <p className="text-sm text-neutral-500">Memuat ledger…</p> : <>
      {tab === 'accounts' && <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-lg font-semibold text-neutral-950 dark:text-white">Chart of Accounts</h2><p className="text-sm text-neutral-500">{filteredAccounts.length} dari {accounts.length} akun ditampilkan</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16}/><input value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Cari kode atau nama…" className="h-10 w-full rounded-xl border border-neutral-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-900 sm:w-64"/></div>
            <select value={accountType} onChange={(event) => setAccountType(event.target.value as typeof accountType)} className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900"><option value="ALL">Semua tipe</option>{(['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'] as const).map((type) => <option key={type}>{type}</option>)}</select>
            {canManageAccounts && <button onClick={() => setShowAccountForm((value) => !value)} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"><Plus size={16}/> Tambah akun</button>}
          </div>
        </div>
        {showAccountForm && <AccountForm accounts={accounts} onSaved={async () => { setShowAccountForm(false); await reload(); }} />}
        <div className="max-h-[640px] overflow-auto rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"><table className="w-full min-w-[760px] text-sm">
          <thead className="sticky top-0 z-10 bg-neutral-50/95 text-left text-[11px] uppercase tracking-wider text-neutral-500 backdrop-blur dark:bg-neutral-950/95"><tr><Th>Kode</Th><Th>Nama akun</Th><Th>Tipe</Th><Th>Saldo normal</Th><Th>Kebijakan posting</Th><Th>Status</Th></tr></thead>
          <tbody>{filteredAccounts.map((account) => <tr key={account.id} className="group border-t border-neutral-100 transition-colors hover:bg-blue-50/60 dark:border-neutral-800 dark:hover:bg-blue-950/20">
            <Td><code className="rounded-md bg-neutral-100 px-2 py-1 font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">{account.code}</code></Td>
            <Td><div className="flex items-center gap-2" style={{ paddingLeft: `${Math.max(0, account.level - 1) * 18}px` }}>{account.level > 1 && <span className="h-px w-3 bg-neutral-300 dark:bg-neutral-600"/>}<span className={account.allowPosting ? 'font-medium' : 'font-semibold text-neutral-950 dark:text-white'}>{account.name}</span></div></Td>
            <Td><TypeBadge type={account.type}/></Td><Td><span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{account.normalBalance}</span></Td>
            <Td>{account.allowPosting ? <Badge label="Posting aktif" tone="green"/> : <Badge label="Header" tone="slate"/>}</Td>
            <Td>{account.isActive ? <Badge label="Aktif" tone="blue"/> : <Badge label="Nonaktif" tone="red"/>}</Td>
          </tr>)}</tbody>
        </table>{filteredAccounts.length === 0 && <div className="p-10 text-center text-sm text-neutral-500">Tidak ada akun yang cocok dengan pencarian.</div>}</div>
      </section>}

      {tab === 'periods' && <section className="space-y-4">
        <ActionHeader title={`${periods.length} periode`} action={canManagePeriods ? 'Tambah periode' : undefined} onClick={() => setShowPeriodForm((value) => !value)} />
        {showPeriodForm && <PeriodForm branches={branches} onSaved={async () => { setShowPeriodForm(false); await reload(); }} />}
        <div className="grid gap-3 md:grid-cols-2">{periods.map((period) => <div key={period.id} className="rounded-xl border bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-start justify-between"><div><h3 className="font-semibold">{period.name}</h3><p className="text-xs text-neutral-500">{period.branch ? `${period.branch.branchCode} — ${period.branch.name}` : 'GLOBAL'}</p></div><Status value={period.status} /></div>
          <p className="mt-3 text-sm">{new Date(period.startDate).toLocaleDateString('id-ID')} – {new Date(period.endDate).toLocaleDateString('id-ID')}</p>
          {canManagePeriods && <div className="mt-3 flex gap-2">{period.status === 'OPEN' && <SmallButton onClick={async () => { await accountingApi.setPeriodStatus(period.id, 'CLOSED', 'Ditutup melalui halaman accounting'); await reload(); }}>Tutup</SmallButton>}{period.status === 'CLOSED' && <><SmallButton onClick={async () => { await accountingApi.setPeriodStatus(period.id, 'OPEN', 'Dibuka kembali melalui halaman accounting'); await reload(); }}>Buka</SmallButton><SmallButton onClick={async () => { await accountingApi.setPeriodStatus(period.id, 'LOCKED', 'Dikunci permanen melalui halaman accounting'); await reload(); }}>Lock</SmallButton></>}</div>}
        </div>)}</div>
      </section>}

      {tab === 'journals' && <section className="space-y-4">
        <ActionHeader title={`${journals.length} journal entry`} action={canPostJournal ? 'Posting manual' : undefined} onClick={() => setShowJournalForm((value) => !value)} />
        {showJournalForm && <JournalForm accounts={postableAccounts} branches={branches} onSaved={async () => { setShowJournalForm(false); await reload(); }} />}
        <div className="space-y-3">{journals.map((journal) => <details key={journal.id} className="rounded-xl border bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <summary className="cursor-pointer list-none"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="font-semibold">{journal.journalNumber}</span><p className="text-sm text-neutral-500">{journal.description}</p></div><div className="text-right"><p className="font-mono text-sm">Rp {journal.totalDebit}</p><p className="text-xs text-neutral-500">{journal.branch.branchCode} · {journal.accountingPeriod.name}</p></div></div></summary>
          <div className="mt-4 border-t pt-3 dark:border-neutral-800"><div className="mb-3 flex flex-wrap gap-2">{journal.sourceLinks.map((source) => <code key={source.id} className="rounded bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">{source.sourceType}:{source.sourceNumber || source.sourceId}</code>)}</div>
          {journal.lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_auto_auto] gap-3 border-t py-2 text-sm dark:border-neutral-800"><span>{line.account.code} — {line.account.name}</span><span className="font-mono">D {line.debit}</span><span className="font-mono">K {line.credit}</span></div>)}</div>
        </details>)}</div>
      </section>}
    </>}
  </div>;
}

function AccountForm({ accounts, onSaved }: { accounts: Account[]; onSaved: () => void }) {
  const [form, setForm] = useState({ code: '', name: '', type: 'ASSET', normalBalance: 'DEBIT', parentId: '', allowPosting: true });
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await accountingApi.createAccount({ ...form, parentId: form.parentId || null }); showToast.success('Account dibuat.'); onSaved(); } catch (error: any) { showToast.error(error.response?.data?.error?.message || 'Gagal membuat account.'); } };
  return <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-900"><Input label="Kode" value={form.code} onChange={(value) => setForm({ ...form, code: value })} /><Input label="Nama" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Select label="Tipe" value={form.type} options={['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE']} onChange={(value) => setForm({ ...form, type: value, normalBalance: ['ASSET','EXPENSE'].includes(value) ? 'DEBIT' : 'CREDIT' })} /><Select label="Parent" value={form.parentId} options={['', ...accounts.filter((item) => item.type === form.type && !item.allowPosting).map((item) => item.id)]} labels={Object.fromEntries(accounts.map((item) => [item.id, `${item.code} — ${item.name}`]))} required={false} onChange={(value) => setForm({ ...form, parentId: value })} /><Select label="Normal balance" value={form.normalBalance} options={['DEBIT','CREDIT']} onChange={(value) => setForm({ ...form, normalBalance: value })} /><button className="self-end rounded-lg bg-blue-600 px-4 py-2 text-white">Simpan account</button></form>;
}

function PeriodForm({ branches, onSaved }: { branches: Branch[]; onSaved: () => void }) {
  const now = new Date(); const [form, setForm] = useState({ name: '', fiscalYear: now.getFullYear(), periodNo: now.getMonth() + 1, startDate: '', endDate: '', branchId: '' });
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await accountingApi.createPeriod({ ...form, fiscalYear: Number(form.fiscalYear), periodNo: Number(form.periodNo), branchId: form.branchId || null }); showToast.success('Periode dibuat.'); onSaved(); } catch (error: any) { showToast.error(error.response?.data?.error?.message || 'Gagal membuat periode.'); } };
  return <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-900"><Input label="Nama" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Input label="Tahun fiskal" type="number" value={String(form.fiscalYear)} onChange={(value) => setForm({ ...form, fiscalYear: Number(value) })} /><Input label="Nomor periode" type="number" value={String(form.periodNo)} onChange={(value) => setForm({ ...form, periodNo: Number(value) })} /><Input label="Mulai" type="date" value={form.startDate} onChange={(value) => setForm({ ...form, startDate: value })} /><Input label="Selesai" type="date" value={form.endDate} onChange={(value) => setForm({ ...form, endDate: value })} /><Select label="Scope" value={form.branchId} options={['', ...branches.map((branch) => branch.id)]} labels={Object.fromEntries(branches.map((branch) => [branch.id, `${branch.branchCode} — ${branch.name}`]))} required={false} onChange={(value) => setForm({ ...form, branchId: value })} /><button className="rounded-lg bg-blue-600 px-4 py-2 text-white md:col-start-3">Simpan periode</button></form>;
}

function JournalForm({ accounts, branches, onSaved }: { accounts: Account[]; branches: Branch[]; onSaved: () => void }) {
  const [form, setForm] = useState({ requestId: crypto.randomUUID(), date: new Date().toISOString().slice(0,10), branchId: '', description: '', debitCode: '', creditCode: '', amount: '' });
  const submit = async (event: FormEvent) => { event.preventDefault(); try { const result = await accountingApi.postJournal({ requestId: form.requestId, transactionDate: form.date, branchId: form.branchId, description: form.description, lines: [{ accountCode: form.debitCode, debit: form.amount }, { accountCode: form.creditCode, credit: form.amount }] }); showToast.success(result.idempotentReplay ? 'Retry idempotent: jurnal lama dikembalikan.' : `Jurnal ${result.journal.journalNumber} berhasil diposting.`); onSaved(); } catch (error: any) { showToast.error(error.response?.data?.error?.message || 'Gagal posting jurnal.'); } };
  const accountLabels = Object.fromEntries(accounts.map((account) => [account.code, `${account.code} — ${account.name}`]));
  return <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-900"><Input label="Tanggal" type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} /><Select label="Cabang" value={form.branchId} options={['', ...branches.map((branch) => branch.id)]} labels={Object.fromEntries(branches.map((branch) => [branch.id, `${branch.branchCode} — ${branch.name}`]))} onChange={(value) => setForm({ ...form, branchId: value })} /><Input label="Deskripsi" value={form.description} onChange={(value) => setForm({ ...form, description: value })} /><Select label="Account debit" value={form.debitCode} options={['', ...accounts.map((account) => account.code)]} labels={accountLabels} onChange={(value) => setForm({ ...form, debitCode: value })} /><Select label="Account kredit" value={form.creditCode} options={['', ...accounts.map((account) => account.code)]} labels={accountLabels} onChange={(value) => setForm({ ...form, creditCode: value })} /><CurrencyInput label="Nominal (Rp)" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} /><div className="self-end rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">Source dan nomor jurnal dibuat otomatis.</div><button className="self-end rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white">Post journal</button></form>;
}

function ActionHeader({ title, action, onClick }: { title: string; action?: string; onClick: () => void }) { return <div className="flex items-center justify-between"><h2 className="font-semibold">{title}</h2>{action && <button onClick={onClick} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">{action}</button>}</div>; }
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${active ? 'bg-white text-blue-600 shadow-sm dark:bg-neutral-800 dark:text-blue-400' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'}`}>{children}</button>; }
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="grid gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200">{label}<input required className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-950" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function CurrencyInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const formattedValue = value ? new Intl.NumberFormat('id-ID').format(Number(value)) : '';
  return <label className="grid gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200">{label}<div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">Rp</span><input required inputMode="numeric" autoComplete="off" placeholder="0" className="h-11 w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-3 text-sm font-semibold tabular-nums outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-950" value={formattedValue} onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))} /></div></label>;
}
function Select({ label, value, options, labels = {}, required = true, onChange }: { label: string; value: string; options: string[]; labels?: Record<string,string>; required?: boolean; onChange: (value: string) => void }) { return <label className="grid gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200">{label}<select required={required} className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-950" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{labels[option] || option || 'GLOBAL / pilih'}</option>)}</select></label>; }
function Status({ value }: { value: string }) { return <span className={`rounded-full px-2 py-1 text-xs ${value === 'OPEN' ? 'bg-green-100 text-green-700' : value === 'LOCKED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{value}</span>; }
function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className="rounded border px-2 py-1 text-xs dark:border-neutral-700">{children}</button>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 font-medium">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-4 py-3">{children}</td>; }

function MetricCard({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: number; hint: string; tone: 'blue' | 'emerald' | 'violet' | 'amber' }) {
  const tones = { blue: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400', emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400', violet: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400', amber: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400' };
  return <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-neutral-500">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">{value}</p></div><div className={`rounded-xl p-2.5 ${tones[tone]}`}>{icon}</div></div><p className="mt-3 text-xs text-neutral-500">{hint}</p></div>;
}
function Badge({ label, tone }: { label: string; tone: 'green' | 'blue' | 'slate' | 'red' }) {
  const tones = { green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', slate: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300', red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{label}</span>;
}
function TypeBadge({ type }: { type: Account['type'] }) {
  const tones: Record<Account['type'], string> = { ASSET: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', LIABILITY: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', EQUITY: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300', REVENUE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', EXPENSE: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' };
  return <span className={`inline-flex rounded-lg px-2 py-1 text-[11px] font-bold tracking-wide ${tones[type]}`}>{type}</span>;
}
