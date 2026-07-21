'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarRange, Landmark, Link2 } from 'lucide-react';
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

  return <div className="mx-auto max-w-7xl space-y-5">
    <header>
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><Landmark /> Accounting Foundation</h1>
      <p className="mt-1 text-sm text-neutral-500">Chart of Accounts, periode, jurnal balanced, dan traceability source document.</p>
    </header>
    <div className="flex gap-2 border-b dark:border-neutral-800">
      <TabButton active={tab === 'accounts'} onClick={() => setTab('accounts')}><BookOpen size={16} /> COA</TabButton>
      <TabButton active={tab === 'periods'} onClick={() => setTab('periods')}><CalendarRange size={16} /> Periode</TabButton>
      <TabButton active={tab === 'journals'} onClick={() => setTab('journals')}><Link2 size={16} /> Jurnal</TabButton>
    </div>
    {loading ? <p className="text-sm text-neutral-500">Memuat ledger…</p> : <>
      {tab === 'accounts' && <section className="space-y-4">
        <ActionHeader title={`${accounts.length} account`} action={canManageAccounts ? 'Tambah account' : undefined} onClick={() => setShowAccountForm((value) => !value)} />
        {showAccountForm && <AccountForm accounts={accounts} onSaved={async () => { setShowAccountForm(false); await reload(); }} />}
        <div className="overflow-x-auto rounded-xl border bg-white dark:border-neutral-800 dark:bg-neutral-900"><table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-950"><tr><Th>Kode</Th><Th>Nama</Th><Th>Tipe</Th><Th>Normal</Th><Th>Posting</Th><Th>Status</Th></tr></thead>
          <tbody>{accounts.map((account) => <tr key={account.id} className="border-t dark:border-neutral-800">
            <Td><code>{account.code}</code></Td><Td><span style={{ paddingLeft: `${Math.max(0, account.level - 1) * 16}px` }}>{account.name}</span></Td><Td>{account.type}</Td><Td>{account.normalBalance}</Td><Td>{account.allowPosting ? 'Ya' : 'Header'}</Td><Td>{account.isActive ? 'Aktif' : 'Nonaktif'}</Td>
          </tr>)}</tbody>
        </table></div>
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
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), branchId: '', description: '', debitCode: '', creditCode: '', amount: '', sourceType: 'MANUAL_JOURNAL', sourceId: '' });
  const submit = async (event: FormEvent) => { event.preventDefault(); try { const result = await accountingApi.postJournal({ postingKey: `${form.sourceType}:${form.sourceId}`, transactionDate: form.date, branchId: form.branchId, description: form.description, lines: [{ accountCode: form.debitCode, debit: form.amount }, { accountCode: form.creditCode, credit: form.amount }], sourceLinks: [{ sourceType: form.sourceType, sourceId: form.sourceId }] }); showToast.success(result.idempotentReplay ? 'Retry idempotent: jurnal lama dikembalikan.' : 'Jurnal balanced berhasil diposting.'); onSaved(); } catch (error: any) { showToast.error(error.response?.data?.error?.message || 'Gagal posting jurnal.'); } };
  const accountLabels = Object.fromEntries(accounts.map((account) => [account.code, `${account.code} — ${account.name}`]));
  return <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-900"><Input label="Tanggal" type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} /><Select label="Cabang" value={form.branchId} options={['', ...branches.map((branch) => branch.id)]} labels={Object.fromEntries(branches.map((branch) => [branch.id, `${branch.branchCode} — ${branch.name}`]))} onChange={(value) => setForm({ ...form, branchId: value })} /><Input label="Deskripsi" value={form.description} onChange={(value) => setForm({ ...form, description: value })} /><Select label="Account debit" value={form.debitCode} options={['', ...accounts.map((account) => account.code)]} labels={accountLabels} onChange={(value) => setForm({ ...form, debitCode: value })} /><Select label="Account kredit" value={form.creditCode} options={['', ...accounts.map((account) => account.code)]} labels={accountLabels} onChange={(value) => setForm({ ...form, creditCode: value })} /><Input label="Nominal (string decimal)" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} /><Input label="Source type" value={form.sourceType} onChange={(value) => setForm({ ...form, sourceType: value })} /><Input label="Source ID" value={form.sourceId} onChange={(value) => setForm({ ...form, sourceId: value })} /><button className="self-end rounded-lg bg-blue-600 px-4 py-2 text-white">Post journal</button></form>;
}

function ActionHeader({ title, action, onClick }: { title: string; action?: string; onClick: () => void }) { return <div className="flex items-center justify-between"><h2 className="font-semibold">{title}</h2>{action && <button onClick={onClick} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">{action}</button>}</div>; }
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500'}`}>{children}</button>; }
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="grid gap-1 text-sm">{label}<input required className="rounded-lg border bg-transparent px-3 py-2" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function Select({ label, value, options, labels = {}, required = true, onChange }: { label: string; value: string; options: string[]; labels?: Record<string,string>; required?: boolean; onChange: (value: string) => void }) { return <label className="grid gap-1 text-sm">{label}<select required={required} className="rounded-lg border bg-transparent px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{labels[option] || option || 'GLOBAL / pilih'}</option>)}</select></label>; }
function Status({ value }: { value: string }) { return <span className={`rounded-full px-2 py-1 text-xs ${value === 'OPEN' ? 'bg-green-100 text-green-700' : value === 'LOCKED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{value}</span>; }
function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className="rounded border px-2 py-1 text-xs dark:border-neutral-700">{children}</button>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 font-medium">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-4 py-3">{children}</td>; }
