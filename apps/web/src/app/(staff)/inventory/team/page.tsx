'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Package,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import { PageLoading } from '@/components/ui/LoadingSpinner';
import { inventoryApi } from '@/lib/api/inventoryApi';
import type { HomecareBag, HomecareBagStockDetail, HomecareTeam } from '@/lib/api/inventoryApi';
import { devError } from '@/lib/logger';
import { showToast } from '@/lib/toast';

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
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [teams, setTeams] = useState<HomecareTeam[]>([]);
  const [bags, setBags] = useState<HomecareBag[]>([]);
  const [selectedBagId, setSelectedBagId] = useState('');
  const [bagStock, setBagStock] = useState<HomecareBagStockDetail | null>(null);

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
                Berlaku untuk semua jenis sesi. Sistem memakai stok tim hanya jika Admin Layanan/MSO dan minimal satu nakes sesi aktif pada tim yang sama. Tanpa assignment yang cocok, stok otomatis diambil dari cabang.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-bold hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              <RefreshCw size={16} /> Segarkan
            </button>
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

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-start gap-3">
            <Stethoscope className="mt-0.5 shrink-0 text-emerald-500" size={20} />
            <div>
              <h2 className="font-bold">Aturan saat sesi diselesaikan</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                Assignment cocok → stok tas tim berkurang. Tidak ada assignment cocok → stok cabang berkurang. Tim yang sudah ter-assign tetapi stoknya kurang akan menghasilkan error dan tidak diam-diam mengambil stok cabang, sehingga sumber stok tetap dapat diaudit dan tidak pernah terpotong ganda.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
