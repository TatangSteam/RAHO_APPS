'use client';

import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, RefreshCw, Scale, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { financeReportApi, type FinanceDashboard, type LedgerEntry, type ReportAccount } from '@/lib/financeReportApi';
import { showToast } from '@/lib/toast';

type Tab = 'profit-loss' | 'trial-balance' | 'general-ledger' | 'cash-bank' | 'deferred-revenue';
interface Branch { id: string; branchCode: string; name: string }

const rupiah = (value: string) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 }).format(Number(value || 0));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const monthStart = `${today.slice(0, 8)}01`;

export default function FinanceReportsPage() {
  const [tab, setTab] = useState<Tab>('profit-loss');
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);
  const [report, setReport] = useState<any>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filters, setFilters] = useState({ branchId: '', startDate: monthStart, endDate: today, accountCode: '' });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const params = { branchId: filters.branchId || undefined, startDate: filters.startDate, endDate: filters.endDate };
    try {
      const [summary, detail] = await Promise.all([
        financeReportApi.dashboard(params),
        tab === 'profit-loss' ? financeReportApi.profitLoss(params)
          : tab === 'trial-balance' ? financeReportApi.trialBalance(params)
          : tab === 'general-ledger' ? financeReportApi.generalLedger({ ...params, accountCode: filters.accountCode || undefined })
          : tab === 'cash-bank' ? financeReportApi.cashBank(params)
          : financeReportApi.deferredRevenue(params),
      ]);
      setDashboard(summary); setReport(detail);
    } catch (error: any) { showToast.error(error.response?.data?.error?.message || 'Gagal memuat laporan finance.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { api.get('/branches/all').then((response) => setBranches(response.data.data || [])).catch(() => undefined); }, []);
  useEffect(() => { void load(); }, [tab]);

  return <div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><BarChart3 /> Finance Dashboard & Ledger Reports</h1><p className="mt-1 text-sm text-neutral-500">P&L, General Ledger, Trial Balance, kas/bank, dan deferred revenue dari satu sumber: posted journal lines.</p></div><button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Rekonsiliasi</button></header>
    <section className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-900">
      <label className="grid gap-1 text-sm">Cabang<select className="rounded-lg border bg-transparent px-3 py-2" value={filters.branchId} onChange={(e) => setFilters({ ...filters, branchId: e.target.value })}><option value="">Semua cabang dalam scope</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} — {branch.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Mulai<input type="date" className="rounded-lg border bg-transparent px-3 py-2" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></label>
      <label className="grid gap-1 text-sm">Selesai<input type="date" className="rounded-lg border bg-transparent px-3 py-2" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></label>
      <button onClick={load} className="self-end rounded-lg border px-4 py-2 text-sm font-medium">Terapkan filter</button>
    </section>
    {dashboard && <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Object.entries({ Omzet: dashboard.summary.revenue, Beban: dashboard.summary.expense, 'Laba Bersih': dashboard.summary.netProfit, 'Kas/Bank': dashboard.summary.cashBank, 'Deferred Revenue': dashboard.summary.deferredRevenue }).map(([label, value]) => <article key={label} className="rounded-xl border bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><p className="text-xs text-neutral-500">{label}</p><strong className="mt-2 block font-mono text-lg">{rupiah(value)}</strong></article>)}</section>
    <section className={`flex items-center gap-3 rounded-xl border p-4 ${dashboard.reconciliation.reconciled ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'}`}>{dashboard.reconciliation.reconciled ? <CheckCircle2 /> : <XCircle />}<div><strong>{dashboard.reconciliation.reconciled ? 'Dashboard direkonsiliasi ke ledger' : 'Ditemukan selisih rekonsiliasi'}</strong><p className="text-xs">Journal {dashboard.reconciliation.journalBalanced ? 'balanced' : 'selisih'} · Kas/bank {dashboard.reconciliation.cashBank ? 'cocok' : 'selisih'} · Deferred {dashboard.reconciliation.deferredRevenue ? 'cocok' : 'selisih'} · {dashboard.source}</p></div></section></>}
    <nav className="flex flex-wrap gap-2">{(['profit-loss','trial-balance','general-ledger','cash-bank','deferred-revenue'] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-3 py-2 text-sm ${tab === item ? 'bg-blue-600 text-white' : 'border'}`}>{({ 'profit-loss': 'P&L', 'trial-balance': 'Trial Balance', 'general-ledger': 'General Ledger', 'cash-bank': 'Kas & Bank', 'deferred-revenue': 'Deferred Revenue' } as Record<Tab,string>)[item]}</button>)}</nav>
    {tab === 'general-ledger' && <input className="rounded-lg border bg-transparent px-3 py-2 text-sm" placeholder="Filter kode account (opsional)" value={filters.accountCode} onChange={(e) => setFilters({ ...filters, accountCode: e.target.value })} />}
    {loading ? <p className="text-sm text-neutral-500">Menghitung dari ledger…</p> : <ReportTable tab={tab} report={report} />}
  </div>;
}

function ReportTable({ tab, report }: { tab: Tab; report: any }) {
  if (!report) return null;
  if (tab === 'general-ledger') return <Table headers={['Tanggal','Jurnal / Source','Account','Debit','Kredit','Saldo']} rows={(report.data as LedgerEntry[]).map((row) => [new Date(row.date).toLocaleDateString('id-ID'), <span key={row.id}>{row.journalNumber}<small className="block text-neutral-500">{row.sources.map((s) => s.sourceNumber || s.sourceType).join(', ')}</small></span>, `${row.account.code} — ${row.account.name}`, rupiah(row.debit), rupiah(row.credit), rupiah(row.runningBalance)])} />;
  if (tab === 'cash-bank') return <Table headers={['Rekening','COA','Saldo Ledger','Saldo Subledger','Selisih','Status']} rows={report.accounts.map((row: any) => [`${row.code} — ${row.name}`, row.coaAccountCode, rupiah(row.ledgerBalance), rupiah(row.subledgerBalance), rupiah(row.difference), row.reconciled ? 'Cocok' : 'Selisih'])} />;
  if (tab === 'deferred-revenue') return <Table headers={['Account','Movement','Saldo Ledger','Saldo Subledger','Selisih','Status']} rows={report.accounts.map((row: any) => [row.accountCode, row.movementCount, rupiah(row.ledgerBalance), rupiah(row.subledgerBalance), rupiah(row.difference), row.reconciled ? 'Cocok' : 'Selisih'])} />;
  const accounts = report.accounts as ReportAccount[];
  if (tab === 'profit-loss') return <><Table headers={['Kode','Account','Tipe','Nominal']} rows={accounts.map((row) => [row.code, row.name, row.type, rupiah(row.amount || '0')])} /><p className="mt-3 text-right font-semibold">Omzet {rupiah(report.totalRevenue)} · Beban {rupiah(report.totalExpense)} · Laba Bersih {rupiah(report.netProfit)}</p></>;
  return <><Table headers={['Kode','Account','Opening','Debit','Kredit','Ending']} rows={accounts.map((row) => [row.code, row.name, rupiah(row.openingBalance || '0'), rupiah(row.debit || '0'), rupiah(row.credit || '0'), rupiah(row.endingBalance || '0')])} /><p className="mt-3 flex items-center justify-end gap-2 font-semibold"><Scale size={16} /> Debit {rupiah(report.totalDebit)} · Kredit {rupiah(report.totalCredit)} · {report.balanced ? 'Balanced' : `Selisih ${rupiah(report.difference)}`}</p></>;
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) { return <div className="overflow-x-auto rounded-xl border bg-white dark:border-neutral-800 dark:bg-neutral-900"><table className="w-full text-sm"><thead><tr className="bg-neutral-50 text-left dark:bg-neutral-950">{headers.map((header) => <th key={header} className="p-3">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t dark:border-neutral-800">{row.map((cell, cellIndex) => <td key={cellIndex} className={`p-3 ${cellIndex >= row.length - 3 ? 'font-mono' : ''}`}>{cell}</td>)}</tr>)}</tbody></table>{rows.length === 0 && <p className="p-6 text-center text-neutral-500">Tidak ada posting pada filter ini.</p>}</div>; }
