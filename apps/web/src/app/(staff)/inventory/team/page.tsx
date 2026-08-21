'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Download,
  Handshake,
  Pencil,
  Package,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import { PageLoading } from '@/components/ui/LoadingSpinner';
import { inventoryApi } from '@/lib/api/inventoryApi';
import type { HomecareBag, HomecareBagStockDetail, HomecareTeam, HomecareTeamLoan, HomecareTeamLoanOptions } from '@/lib/api/inventoryApi';
import type { HomecareUsageHistoryResponse } from '@/lib/api/inventoryApi';
import { devError } from '@/lib/logger';
import { showToast } from '@/lib/toast';
import { assertCaughtError } from '@/lib/caughtError';
import { useAuthStore } from '@/stores/authStore';

const SELECTED_BAG_KEY = 'raho.inventory-team.selected-bag';

function unwrapData<T>(response: { data?: unknown }, fallback: T): T {
  const payload = typeof response.data === 'object' && response.data !== null
    ? (response.data as { data?: unknown }).data
    : undefined;
  return (payload ?? fallback) as T;
}

function roleLabel(role: string) {
  if (role === 'ADMIN_LAYANAN') return 'Admin Layanan/MSO';
  if (role === 'DOCTOR') return 'Dokter';
  if (role === 'NURSE') return 'Nakes';
  return role;
}

export default function TeamInventoryPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [teams, setTeams] = useState<HomecareTeam[]>([]);
  const [bags, setBags] = useState<HomecareBag[]>([]);
  const [selectedBagId, setSelectedBagId] = useState('');
  const [bagStock, setBagStock] = useState<HomecareBagStockDetail | null>(null);
  const [history, setHistory] = useState<HomecareUsageHistoryResponse>({ items: [], total: 0, page: 1, limit: 25, usageCount: 0 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTeamId, setHistoryTeamId] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [editingTeam, setEditingTeam] = useState<HomecareTeam | null>(null);
  const [teamDraft, setTeamDraft] = useState({ name: '', description: '', isActive: true });
  const [editingBag, setEditingBag] = useState<HomecareBag | null>(null);
  const [bagDraft, setBagDraft] = useState({ name: '', status: 'ACTIVE', notes: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [loans, setLoans] = useState<HomecareTeamLoan[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loanOptions, setLoanOptions] = useState<HomecareTeamLoanOptions | null>(null);
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [loanDraft, setLoanDraft] = useState({ fromBagId: '', masterProductId: '', quantity: '1', reason: '' });
  const canManage = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK'].includes(user?.role || '');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamResponse, bagResponse] = await Promise.all([
        inventoryApi.getHomecareTeams(),
        inventoryApi.getHomecareBags(),
      ]);
      const nextTeams = unwrapData<HomecareTeam[]>(teamResponse, []);
      const nextBags = unwrapData<HomecareBag[]>(bagResponse, []);
      setTeams(nextTeams);
      setBags(nextBags);
      const savedBagId = typeof window === 'undefined' ? '' : sessionStorage.getItem(SELECTED_BAG_KEY) || '';
      setSelectedBagId((current) => {
        const preferred = current || savedBagId;
        return nextBags.some((bag) => bag.id === preferred) ? preferred : nextBags[0]?.id || '';
      });
    } catch (error) {
      devError('Gagal memuat Inventory Tim', error);
      showToast.error('Inventory Tim gagal dimuat. Periksa hak akses atau koneksi API.');
      setTeams([]);
      setBags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedBagId) {
      setBagStock(null);
      return;
    }
    sessionStorage.setItem(SELECTED_BAG_KEY, selectedBagId);
    setStockLoading(true);
    inventoryApi.getHomecareBagStock(selectedBagId)
      .then((response) => setBagStock(unwrapData<HomecareBagStockDetail | null>(response, null)))
      .catch((error) => {
        devError('Gagal memuat stok tas tim', error);
        setBagStock(null);
      })
      .finally(() => setStockLoading(false));
  }, [selectedBagId]);

  const loadLoans = useCallback(async () => {
    setLoansLoading(true);
    try {
      const response = await inventoryApi.getHomecareTeamLoans();
      setLoans(unwrapData<HomecareTeamLoan[]>(response, []));
    } catch (error) {
      devError('Gagal memuat peminjaman antar tim', error);
      setLoans([]);
    } finally {
      setLoansLoading(false);
    }
  }, []);

  useEffect(() => { void loadLoans(); }, [loadLoans]);

  useEffect(() => {
    if (!selectedBagId) {
      setLoanOptions(null);
      return;
    }
    inventoryApi.getHomecareTeamLoanOptions(selectedBagId)
      .then((response) => {
        const options = unwrapData<HomecareTeamLoanOptions | null>(response, null);
        setLoanOptions(options);
        setLoanDraft((current) => {
          const lenderExists = options?.lenderBags.some((bag) => bag.id === current.fromBagId);
          return lenderExists ? current : { ...current, fromBagId: options?.lenderBags[0]?.id || '', masterProductId: '' };
        });
      })
      .catch((error) => {
        devError('Gagal memuat pilihan peminjaman', error);
        setLoanOptions(null);
      });
  }, [selectedBagId]);

  const selectedLenderBag = loanOptions?.lenderBags.find((bag) => bag.id === loanDraft.fromBagId) || null;

  const refreshSelectedBagStock = useCallback(async () => {
    if (!selectedBagId) return;
    const response = await inventoryApi.getHomecareBagStock(selectedBagId);
    setBagStock(unwrapData<HomecareBagStockDetail | null>(response, null));
  }, [selectedBagId]);

  const submitLoan = async () => {
    const quantity = Number(loanDraft.quantity);
    if (!selectedBagId || !loanDraft.fromBagId || !loanDraft.masterProductId || !Number.isFinite(quantity) || quantity <= 0 || !loanDraft.reason.trim()) {
      showToast.error('Pilih tim pemberi, barang, jumlah, dan isi alasan peminjaman');
      return;
    }
    const availableStock = selectedLenderBag?.stocks.find((stock) => stock.masterProductId === loanDraft.masterProductId)?.stock || 0;
    if (quantity > availableStock) {
      showToast.error(`Jumlah melebihi stok tim pemberi (${availableStock})`);
      return;
    }
    try {
      setLoanSubmitting(true);
      await inventoryApi.createHomecareTeamLoan({
        fromBagId: loanDraft.fromBagId,
        toBagId: selectedBagId,
        reason: loanDraft.reason.trim(),
        items: [{ masterProductId: loanDraft.masterProductId, quantity }],
      });
      setLoanDraft((current) => ({ ...current, masterProductId: '', quantity: '1', reason: '' }));
      await loadLoans();
      showToast.success('Permintaan pinjaman berhasil dikirim ke tim pemberi');
    } catch (error) {
      assertCaughtError(error);
      devError('Gagal mengajukan pinjaman', error);
      showToast.error(error.response?.data?.error?.message || 'Permintaan pinjaman gagal dikirim');
    } finally {
      setLoanSubmitting(false);
    }
  };

  const reviewLoan = async (loan: HomecareTeamLoan, decision: 'APPROVE' | 'REJECT') => {
    const notes = decision === 'REJECT' ? window.prompt('Tuliskan alasan penolakan:') : window.prompt('Catatan persetujuan (opsional):', '') || '';
    if (decision === 'REJECT' && !notes?.trim()) return;
    try {
      setLoanSubmitting(true);
      await inventoryApi.reviewHomecareTeamLoan(loan.id, decision, notes?.trim());
      await Promise.all([loadLoans(), refreshSelectedBagStock()]);
      showToast.success(decision === 'APPROVE' ? 'Pinjaman disetujui dan stok sudah dipindahkan' : 'Permintaan pinjaman ditolak');
    } catch (error) {
      assertCaughtError(error);
      devError('Gagal memproses pinjaman', error);
      showToast.error(error.response?.data?.error?.message || 'Pinjaman gagal diproses. Periksa hak akses dan ketersediaan stok.');
    } finally {
      setLoanSubmitting(false);
    }
  };

  const returnLoan = async (loan: HomecareTeamLoan) => {
    if (!window.confirm(`Kembalikan seluruh barang pinjaman ${loan.loanCode}?`)) return;
    try {
      setLoanSubmitting(true);
      await inventoryApi.returnHomecareTeamLoan(loan.id, `Pengembalian ${loan.loanCode}`);
      await Promise.all([loadLoans(), refreshSelectedBagStock()]);
      showToast.success('Barang pinjaman sudah dikembalikan');
    } catch (error) {
      assertCaughtError(error);
      devError('Gagal mengembalikan pinjaman', error);
      showToast.error(error.response?.data?.error?.message || 'Pengembalian gagal. Pastikan stok pada tas peminjam masih mencukupi.');
    } finally {
      setLoanSubmitting(false);
    }
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await inventoryApi.getHomecareUsageHistory({
        teamId: historyTeamId || undefined,
        search: historySearch || undefined,
        startDate: historyStartDate || undefined,
        endDate: historyEndDate || undefined,
        limit: 100,
      });
      setHistory(response.data.data);
    } catch (error) {
      devError('Gagal memuat history penggunaan inventori tim', error);
      showToast.error('History penggunaan barang gagal dimuat');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyEndDate, historySearch, historyStartDate, historyTeamId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const exportHistory = async () => {
    try {
      setExporting(true);
      const blob = await inventoryApi.exportHomecareUsageHistory({
        teamId: historyTeamId || undefined,
        search: historySearch || undefined,
        startDate: historyStartDate || undefined,
        endDate: historyEndDate || undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `history-penggunaan-inventori-tim-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast.success('History penggunaan berhasil diekspor');
    } catch (error) {
      devError('Gagal export history penggunaan', error);
      showToast.error('Export Excel gagal');
    } finally {
      setExporting(false);
    }
  };

  const startEditTeam = (team: HomecareTeam) => {
    setEditingTeam(team);
    setTeamDraft({ name: team.name, description: team.description || '', isActive: team.isActive });
  };

  const saveTeam = async () => {
    if (!editingTeam || !teamDraft.name.trim()) return;
    try {
      setSaving(true);
      await inventoryApi.updateHomecareTeam(editingTeam.id, teamDraft);
      setEditingTeam(null);
      await loadData();
      showToast.success('Tim berhasil diperbarui');
    } catch (error) {
      devError('Gagal memperbarui tim', error);
      showToast.error('Tim gagal diperbarui');
    } finally { setSaving(false); }
  };

  const startEditBag = (bag: HomecareBag) => {
    setEditingBag(bag);
    setBagDraft({ name: bag.name, status: bag.status, notes: bag.notes || '', isActive: true });
  };

  const saveBag = async () => {
    if (!editingBag || !bagDraft.name.trim()) return;
    try {
      setSaving(true);
      await inventoryApi.updateHomecareBag(editingBag.id, bagDraft);
      setEditingBag(null);
      await loadData();
      showToast.success('Tas tim berhasil diperbarui');
    } catch (error) {
      devError('Gagal memperbarui tas', error);
      showToast.error('Tas tim gagal diperbarui');
    } finally { setSaving(false); }
  };

  const operationalTeams = useMemo(() => teams.filter((team) => team.isOperational), [teams]);
  const totalTeamStock = useMemo(
    () => bags.reduce((total, bag) => total + Number(bag.totalStockQty || 0), 0),
    [bags],
  );

  if (loading) return <PageLoading text="Memuat Inventory Tim..." />;

  return (
    <main className="min-h-screen bg-neutral-50 p-4 text-neutral-900 dark:bg-neutral-950 dark:text-white md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 dark:border-amber-500/20 dark:from-amber-500/10 dark:via-neutral-900 dark:to-emerald-500/10 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-black">
                  <UsersRound size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Aktif</p>
                  <h1 className="text-2xl font-bold md:text-3xl">Inventori Tim</h1>
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                Saat menyelesaikan sesi, petugas dapat memilih Stok Cabang atau Stok Tim. Jika stok tim kurang, barang dapat dipinjam dari tim lain melalui alur permintaan, persetujuan, dan pengembalian yang tercatat.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-bold hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              <RefreshCw size={16} /> Segarkan
            </button>
            {canManage && (
              <Link href="/inventory/homecare-bags" className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400">
                Kelola Tim & Tas
              </Link>
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Tim Terlihat', value: teams.length, icon: UsersRound, color: 'text-blue-500' },
            { label: 'Tim Siap', value: operationalTeams.length, icon: CheckCircle2, color: 'text-emerald-500' },
            { label: 'Tas Aktif', value: bags.length, icon: Package, color: 'text-amber-500' },
            { label: 'Total Unit Tim', value: totalTeamStock.toLocaleString('id-ID'), icon: Boxes, color: 'text-purple-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <article key={label} className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <Icon className={color} size={20} />
              <p className="mt-3 text-2xl font-black">{value}</p>
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p>
            </article>
          ))}
        </section>

        {teams.length === 0 ? (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-500/20 dark:bg-blue-500/10">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-blue-600" size={21} />
              <div>
                <h2 className="font-bold">Belum ada assignment Inventory Tim</h2>
                <p className="mt-2 text-sm leading-6 text-blue-900/80 dark:text-blue-100/80">
                  Ini kondisi yang aman: seluruh sesi Anda tetap memakai stok cabang. Assignment tim dapat dibuat oleh Admin Logistik/Manager melalui menu Tas Homecare.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[1.1fr_1.4fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Assignment Tim</h2>
                <Link href="/inventory/homecare-bags" className="text-sm font-bold text-amber-600 hover:underline">Kelola tas</Link>
              </div>
              {teams.map((team) => (
                <article key={team.id} className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-amber-600">{team.teamCode}</p>
                      <h3 className="mt-1 font-bold">{team.name}</h3>
                      <p className="mt-1 text-xs text-neutral-500">{team.branchName || team.branchCode || 'Cabang'}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${team.isOperational
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                      : 'border-red-500/30 bg-red-500/10 text-red-500'}`}>
                      {team.isOperational ? 'Siap' : 'Belum siap'}
                    </span>
                    {canManage && (
                      <button type="button" onClick={() => startEditTeam(team)} className="rounded-lg border border-neutral-300 p-2 hover:border-amber-500 dark:border-neutral-700" title="Edit tim">
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                  <div className="mt-4 space-y-2">
                    {team.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{member.fullName}</span>
                        <span className="shrink-0 text-xs text-neutral-500">{roleLabel(member.role)}</span>
                      </div>
                    ))}
                  </div>
                  {!team.isOperational && (
                    <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
                      <AlertTriangle className="mt-0.5 shrink-0" size={14} />
                      Assignment belum lengkap: {team.missingRoles.join(' dan ')}. Sesi akan memakai stok cabang sampai tim lengkap.
                    </p>
                  )}
                </article>
              ))}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold">Stok Tim per Tas</h2>
                  <p className="mt-1 text-sm text-neutral-500">Stok ini yang diprioritaskan ketika assignment sesi cocok.</p>
                </div>
                <select
                  value={selectedBagId}
                  onChange={(event) => setSelectedBagId(event.target.value)}
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                >
                  {bags.map((bag) => <option key={bag.id} value={bag.id}>{bag.bagCode} — {bag.name}</option>)}
                </select>
                {canManage && selectedBagId && (
                  <button type="button" onClick={() => { const bag = bags.find((item) => item.id === selectedBagId); if (bag) startEditBag(bag); }} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-bold hover:border-amber-500 dark:border-neutral-700">
                    <Pencil size={14} /> Edit Tas
                  </button>
                )}
              </div>
              {stockLoading ? (
                <p className="py-10 text-center text-sm text-neutral-500">Memuat stok...</p>
              ) : !bagStock ? (
                <p className="py-10 text-center text-sm text-neutral-500">Pilih tas aktif untuk melihat stok.</p>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500 dark:border-neutral-800">
                      <tr><th className="pb-3">Produk</th><th className="pb-3">SKU</th><th className="pb-3 text-right">Stok Tim</th><th className="pb-3 text-right">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {bagStock.stocks.map((stock) => {
                        const quantity = Number(stock.stock || 0);
                        const isLow = quantity <= Number(stock.minThreshold || 0);
                        return (
                          <tr key={stock.id}>
                            <td className="py-3 font-medium">{stock.productName || stock.masterProductId}</td>
                            <td className="py-3 text-neutral-500">{stock.sku || '-'}</td>
                            <td className="py-3 text-right font-bold">{quantity.toLocaleString('id-ID', { maximumFractionDigits: 4 })} {stock.baseUnit || ''}</td>
                            <td className={`py-3 text-right text-xs font-bold ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>{isLow ? 'Rendah' : 'Tersedia'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-violet-200 bg-white p-5 dark:border-violet-500/20 dark:bg-neutral-900">
          <div className="flex items-start gap-3">
            <Handshake className="mt-0.5 shrink-0 text-violet-600" size={22} />
            <div>
              <h2 className="text-lg font-bold">Pinjam Barang dari Tim Lain</h2>
              <p className="mt-1 text-sm text-neutral-500">Alurnya singkat: ajukan → tim pemberi menyetujui → barang masuk ke stok tim Anda → kembalikan.</p>
            </div>
          </div>

          {bags.length === 0 ? (
            <p className="mt-5 rounded-xl bg-neutral-100 p-4 text-sm text-neutral-500 dark:bg-neutral-800">Anda belum memiliki tas tim aktif untuk menerima pinjaman.</p>
          ) : (
            <div className="mt-5 grid gap-3 lg:grid-cols-5">
              <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Tas penerima
                <select value={selectedBagId} onChange={(event) => setSelectedBagId(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950">
                  {bags.map((bag) => <option key={bag.id} value={bag.id}>{bag.bagCode} — {bag.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Pinjam dari
                <select value={loanDraft.fromBagId} onChange={(event) => setLoanDraft((draft) => ({ ...draft, fromBagId: event.target.value, masterProductId: '' }))} className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950">
                  <option value="">Pilih tim pemberi</option>
                  {loanOptions?.lenderBags.map((bag) => <option key={bag.id} value={bag.id}>{bag.teamName} — {bag.bagCode}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Barang
                <select value={loanDraft.masterProductId} onChange={(event) => setLoanDraft((draft) => ({ ...draft, masterProductId: event.target.value }))} className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950">
                  <option value="">Pilih barang</option>
                  {selectedLenderBag?.stocks.map((stock) => <option key={stock.masterProductId} value={stock.masterProductId}>{stock.product?.name || stock.masterProductId} (tersedia {stock.stock})</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Jumlah
                <input type="number" min="0.0001" step="0.0001" value={loanDraft.quantity} onChange={(event) => setLoanDraft((draft) => ({ ...draft, quantity: event.target.value }))} className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
              </label>
              <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Keperluan
                <input value={loanDraft.reason} onChange={(event) => setLoanDraft((draft) => ({ ...draft, reason: event.target.value }))} placeholder="Contoh: kebutuhan sesi hari ini" className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
              </label>
              <div className="flex justify-end lg:col-span-5">
                <button type="button" onClick={() => void submitLoan()} disabled={loanSubmitting || !loanOptions?.lenderBags.length} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">Ajukan Pinjaman</button>
              </div>
            </div>
          )}

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500 dark:border-neutral-800"><tr><th className="pb-3">Kode / Status</th><th className="pb-3">Dari → Ke</th><th className="pb-3">Barang</th><th className="pb-3">Keperluan</th><th className="pb-3 text-right">Aksi</th></tr></thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {loansLoading ? <tr><td colSpan={5} className="py-8 text-center text-neutral-500">Memuat pinjaman...</td></tr>
                  : loans.length === 0 ? <tr><td colSpan={5} className="py-8 text-center text-neutral-500">Belum ada peminjaman antar tim.</td></tr>
                    : loans.map((loan) => {
                      const lenderAccessible = canManage || (user?.role === 'ADMIN_LAYANAN' && bags.some((bag) => bag.teamId === loan.lenderTeamId));
                      const borrowerAccessible = canManage || (user?.role === 'ADMIN_LAYANAN' && bags.some((bag) => bag.teamId === loan.borrowerTeamId));
                      const statusLabel = loan.status === 'PENDING' ? 'Menunggu' : loan.status === 'ACTIVE' ? 'Dipinjam' : loan.status === 'RETURNED' ? 'Dikembalikan' : 'Ditolak';
                      return <tr key={loan.id}>
                        <td className="py-3"><p className="font-bold">{loan.loanCode}</p><span className="mt-1 inline-flex rounded-full bg-violet-500/10 px-2 py-1 text-xs font-bold text-violet-600">{statusLabel}</span></td>
                        <td className="py-3"><p>{loan.lenderTeam.name}</p><p className="text-xs text-neutral-500">→ {loan.borrowerTeam.name}</p></td>
                        <td className="py-3">{loan.items.map((item) => <p key={item.id}>{item.masterProduct.name}: <strong>{item.approvedQty ?? item.requestedQty}</strong> {item.masterProduct.baseUnit}</p>)}</td>
                        <td className="max-w-[260px] py-3"><p>{loan.reason}</p>{loan.reviewNotes && <p className="mt-1 text-xs text-neutral-500">Catatan: {loan.reviewNotes}</p>}</td>
                        <td className="py-3 text-right">
                          {loan.status === 'PENDING' && lenderAccessible && <div className="flex justify-end gap-2"><button disabled={loanSubmitting} onClick={() => void reviewLoan(loan, 'REJECT')} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600">Tolak</button><button disabled={loanSubmitting} onClick={() => void reviewLoan(loan, 'APPROVE')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Setujui</button></div>}
                          {loan.status === 'ACTIVE' && borrowerAccessible && <button disabled={loanSubmitting} onClick={() => void returnLoan(loan)} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">Kembalikan</button>}
                          {!((loan.status === 'PENDING' && lenderAccessible) || (loan.status === 'ACTIVE' && borrowerAccessible)) && <span className="text-xs text-neutral-400">—</span>}
                        </td>
                      </tr>;
                    })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-start gap-3">
            <Stethoscope className="mt-0.5 shrink-0 text-emerald-500" size={20} />
            <div>
              <h2 className="font-bold">Aturan saat sesi diselesaikan</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                Petugas memilih sumber stok sebelum menekan Selesaikan Sesi. Pilihan Stok Cabang mengurangi stok cabang; pilihan Stok Tim mengurangi tas tim yang sesuai assignment. Jika tim atau stok tidak cukup, sesi ditolak tanpa fallback otomatis agar sumber stok tetap jelas dan tidak pernah terpotong ganda.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">History Penggunaan Barang Global</h2>
              <p className="mt-1 text-sm text-neutral-500">Pilih tim untuk history per tim, atau Semua Tim untuk history global.</p>
            </div>
            <button type="button" onClick={() => void exportHistory()} disabled={exporting || historyLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
              <Download size={16} /> {exporting ? 'Mengekspor...' : 'Export Excel'}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select value={historyTeamId} onChange={(event) => setHistoryTeamId(event.target.value)} className="rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950">
              <option value="">Semua Tim (Global)</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.teamCode} — {team.name}</option>)}
            </select>
            <input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Cari kode/catatan..." className="rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
            <input type="date" value={historyStartDate} onChange={(event) => setHistoryStartDate(event.target.value)} aria-label="Tanggal mulai history" className="rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
            <input type="date" value={historyEndDate} onChange={(event) => setHistoryEndDate(event.target.value)} aria-label="Tanggal akhir history" className="rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500 dark:border-neutral-800"><tr>
                <th className="pb-3">Tanggal</th><th className="pb-3">Tim / Tas</th><th className="pb-3">Produk</th><th className="pb-3 text-right">Jumlah</th><th className="pb-3">Sesi / Member</th><th className="pb-3">Digunakan Oleh</th><th className="pb-3">Catatan</th>
              </tr></thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {historyLoading ? <tr><td colSpan={7} className="py-10 text-center text-neutral-500">Memuat history...</td></tr>
                  : history.items.length === 0 ? <tr><td colSpan={7} className="py-10 text-center text-neutral-500">Belum ada penggunaan barang untuk filter ini.</td></tr>
                    : history.items.map((item) => <tr key={item.id}>
                      <td className="py-3 whitespace-nowrap">{new Date(item.usageDate).toLocaleString('id-ID')}</td>
                      <td className="py-3"><p className="font-medium">{item.teamName}</p><p className="text-xs text-neutral-500">{item.bagCode}</p></td>
                      <td className="py-3"><p className="font-medium">{item.productName}</p><p className="text-xs text-neutral-500">{item.sku || '-'}</p></td>
                      <td className="py-3 text-right font-bold">{item.quantity.toLocaleString('id-ID', { maximumFractionDigits: 4 })} {item.unit || ''}</td>
                      <td className="py-3"><p>{item.sessionCode || '-'}</p><p className="text-xs text-neutral-500">{item.memberName || item.memberNo || '-'}</p></td>
                      <td className="py-3">{item.usedByName}</td><td className="py-3 max-w-[260px] truncate" title={item.notes}>{item.notes}</td>
                    </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
            <h2 className="text-xl font-bold">Edit Tim {editingTeam.teamCode}</h2>
            <label className="mt-5 block text-sm font-semibold">Nama Tim<input value={teamDraft.name} onChange={(e) => setTeamDraft((d) => ({ ...d, name: e.target.value }))} className="mt-2 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>
            <label className="mt-4 block text-sm font-semibold">Deskripsi<textarea value={teamDraft.description} onChange={(e) => setTeamDraft((d) => ({ ...d, description: e.target.value }))} className="mt-2 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={teamDraft.isActive} onChange={(e) => setTeamDraft((d) => ({ ...d, isActive: e.target.checked }))} /> Tim aktif</label>
            <div className="mt-6 flex justify-end gap-2"><button onClick={() => setEditingTeam(null)} className="rounded-xl border px-4 py-2">Batal</button><button onClick={() => void saveTeam()} disabled={saving} className="rounded-xl bg-amber-500 px-4 py-2 font-bold text-black disabled:opacity-50">Simpan</button></div>
          </div>
        </div>
      )}
      {editingBag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
            <h2 className="text-xl font-bold">Edit Tas {editingBag.bagCode}</h2>
            <label className="mt-5 block text-sm font-semibold">Nama Tas<input value={bagDraft.name} onChange={(e) => setBagDraft((d) => ({ ...d, name: e.target.value }))} className="mt-2 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>
            <label className="mt-4 block text-sm font-semibold">Status<select value={bagDraft.status} onChange={(e) => setBagDraft((d) => ({ ...d, status: e.target.value }))} className="mt-2 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950"><option value="ACTIVE">Aktif</option><option value="INACTIVE">Tidak Aktif</option><option value="IN_CHECKING">Dalam Pemeriksaan</option><option value="DAMAGED">Rusak</option><option value="LOST">Hilang</option></select></label>
            <label className="mt-4 block text-sm font-semibold">Catatan<textarea value={bagDraft.notes} onChange={(e) => setBagDraft((d) => ({ ...d, notes: e.target.value }))} className="mt-2 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>
            <div className="mt-6 flex justify-end gap-2"><button onClick={() => setEditingBag(null)} className="rounded-xl border px-4 py-2">Batal</button><button onClick={() => void saveBag()} disabled={saving} className="rounded-xl bg-amber-500 px-4 py-2 font-bold text-black disabled:opacity-50">Simpan</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
