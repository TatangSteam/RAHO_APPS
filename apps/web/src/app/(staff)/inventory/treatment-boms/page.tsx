'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, ListTree, Loader2, Plus, Power, Trash2, X } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { packagesApi } from '@/lib/packagesApi';
import {
  treatmentBomApi,
  type CreateTreatmentBomInput,
  type TreatmentBom,
  type TreatmentBomItemInput,
} from '@/lib/treatmentBomApi';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';

interface PricingOption {
  id: string;
  name: string;
  productCode?: string | null;
  packageType: 'BASIC' | 'BOOSTER';
  totalSessions: number;
}

interface ProductOption {
  id: string;
  sku?: string | null;
  name: string;
  usageUnit: string;
  isActive: boolean;
}

const emptyItem = (): TreatmentBomItemInput => ({
  masterProductId: '',
  recommendedQuantity: '',
  tolerancePercent: 0,
  isRequired: true,
  sortOrder: 0,
});

const emptyForm = (): CreateTreatmentBomInput => ({
  packagePricingId: '',
  notes: '',
  items: [emptyItem()],
});

export default function TreatmentBomsPage() {
  const { user } = useAuthStore();
  const [boms, setBoms] = useState<TreatmentBom[]>([]);
  const [pricings, setPricings] = useState<PricingOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateTreatmentBomInput>(emptyForm());

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [bomResponse, pricingResponse, productResponse] = await Promise.all([
        treatmentBomApi.list(user?.branchId ? { branchId: user.branchId } : undefined),
        packagesApi.getPackagePricings(user?.branchId || undefined),
        inventoryApi.getMasterProducts(),
      ]);
      const productPayload = productResponse.data?.data || productResponse.data || [];
      setBoms(bomResponse.data);
      setPricings(pricingResponse);
      setProducts((Array.isArray(productPayload) ? productPayload : productPayload.data || []).filter((product: ProductOption) => product.isActive !== false));
    } catch (error) {
      devError('Failed to load Treatment BOM:', error);
      showToast.error('Gagal memuat Treatment BOM');
    } finally {
      setLoading(false);
    }
  }, [user?.branchId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const openNew = (source?: TreatmentBom) => {
    setForm(source
      ? {
          packagePricingId: source.packagePricingId,
          branchId: source.branchId,
          notes: source.notes || '',
          items: source.items.map((item, index) => ({
            masterProductId: item.masterProductId,
            recommendedQuantity: item.recommendedQuantity,
            tolerancePercent: Number(item.tolerancePercent),
            isRequired: item.isRequired,
            sortOrder: index,
            notes: item.notes || undefined,
          })),
        }
      : {
          ...emptyForm(),
          branchId: user?.role === 'ADMIN_CABANG' ? user.branchId : undefined,
        });
    setShowForm(true);
  };

  const updateItem = (index: number, patch: Partial<TreatmentBomItemInput>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  };

  const removeItem = (index: number) => {
    setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.packagePricingId || form.items.some((item) => !item.masterProductId || Number(item.recommendedQuantity) <= 0)) {
      showToast.error('Paket, material, dan quantity wajib diisi');
      return;
    }
    try {
      setSubmitting(true);
      await treatmentBomApi.create({
        ...form,
        items: form.items.map((item, index) => ({ ...item, sortOrder: index })),
      });
      showToast.success('Draft Treatment BOM berhasil dibuat');
      setShowForm(false);
      setForm(emptyForm());
      await loadData();
    } catch (error: any) {
      devError('Failed to create Treatment BOM:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal membuat Treatment BOM');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (bom: TreatmentBom) => {
    if (!window.confirm(`Aktifkan ${bom.bomCode}? Versi aktif sebelumnya akan ditutup.`)) return;
    try {
      setActivatingId(bom.id);
      await treatmentBomApi.activate(bom.id);
      showToast.success('Treatment BOM berhasil diaktifkan');
      await loadData();
    } catch (error: any) {
      devError('Failed to activate Treatment BOM:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal mengaktifkan Treatment BOM');
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-700">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-neutral-900 dark:text-white">
            <ListTree className="h-5 w-5 text-emerald-500" /> Treatment BOM
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Versi material standar per paket treatment</p>
        </div>
        <button
          type="button"
          onClick={() => openNew()}
          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" /> Buat Draft
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-56 items-center justify-center text-neutral-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : boms.length === 0 ? (
        <div className="border-y border-neutral-200 py-14 text-center text-sm text-neutral-500 dark:border-neutral-700">Belum ada Treatment BOM.</div>
      ) : (
        <div className="overflow-x-auto border-y border-neutral-200 dark:border-neutral-700">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-neutral-100 text-xs uppercase text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-3">Kode</th>
                <th className="px-3 py-3">Paket</th>
                <th className="px-3 py-3">Scope</th>
                <th className="px-3 py-3">Versi</th>
                <th className="px-3 py-3">Material</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {boms.map((bom) => (
                <tr key={bom.id} className="text-neutral-700 dark:text-neutral-200">
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{bom.bomCode}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{bom.packagePricing.name}</p>
                    <p className="text-xs text-neutral-500">{bom.packagePricing.productCode || bom.packagePricing.packageType}</p>
                  </td>
                  <td className="px-3 py-3">{bom.branch?.name || 'Global'}</td>
                  <td className="px-3 py-3">v{bom.version}</td>
                  <td className="px-3 py-3">{bom.items.length}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${
                      bom.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : bom.status === 'DRAFT'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                          : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                    }`}>
                      {bom.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openNew(bom)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        title="Buat versi baru"
                        aria-label={`Buat versi baru ${bom.bomCode}`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      {bom.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => handleActivate(bom)}
                          disabled={activatingId === bom.id}
                          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-emerald-500 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                        >
                          {activatingId === bom.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                          Aktifkan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="bom-form-title">
          <form onSubmit={handleCreate} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-neutral-300 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
              <h2 id="bom-form-title" className="text-base font-semibold text-neutral-900 dark:text-white">Draft Treatment BOM</h2>
              <button type="button" onClick={() => setShowForm(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Tutup">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Paket
                  <select
                    value={form.packagePricingId}
                    onChange={(event) => setForm((current) => ({ ...current, packagePricingId: event.target.value }))}
                    className="mt-2 min-h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                    required
                  >
                    <option value="">Pilih paket</option>
                    {pricings.map((pricing) => (
                      <option key={pricing.id} value={pricing.id}>{pricing.productCode || pricing.packageType} - {pricing.name} ({pricing.totalSessions} sesi)</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Catatan versi
                  <input
                    value={form.notes || ''}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    maxLength={2000}
                    className="mt-2 min-h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                  />
                </label>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Material</h3>
                  <button type="button" onClick={() => setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }))} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-neutral-300 px-3 text-xs font-semibold hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800">
                    <Plus className="h-4 w-4" /> Tambah Baris
                  </button>
                </div>
                <div className="divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
                  {form.items.map((item, index) => {
                    const selectedProduct = productById.get(item.masterProductId);
                    return (
                      <div key={`${index}-${item.masterProductId}`} className="grid gap-3 py-3 md:grid-cols-[minmax(240px,1fr)_140px_110px_90px_40px] md:items-end">
                        <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Product
                          <select value={item.masterProductId} onChange={(event) => updateItem(index, { masterProductId: event.target.value })} className="mt-1 min-h-10 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-600 dark:bg-neutral-800" required>
                            <option value="">Pilih material</option>
                            {products.map((product) => <option key={product.id} value={product.id}>{product.sku || '-'} - {product.name}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Quantity {selectedProduct ? `(${selectedProduct.usageUnit})` : ''}
                          <input type="number" min="0.0001" step="0.0001" value={item.recommendedQuantity} onChange={(event) => updateItem(index, { recommendedQuantity: event.target.value })} className="mt-1 min-h-10 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-600 dark:bg-neutral-800" required />
                        </label>
                        <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Toleransi %
                          <input type="number" min="0" max="100" step="0.01" value={item.tolerancePercent} onChange={(event) => updateItem(index, { tolerancePercent: Number(event.target.value) })} className="mt-1 min-h-10 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-600 dark:bg-neutral-800" />
                        </label>
                        <label className="flex min-h-10 items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          <input type="checkbox" checked={item.isRequired} onChange={(event) => updateItem(index, { isRequired: event.target.checked })} /> Wajib
                        </label>
                        <button type="button" onClick={() => removeItem(index)} disabled={form.items.length === 1} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-500/10" title="Hapus baris">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-5 py-4 dark:border-neutral-700">
              <button type="button" onClick={() => setShowForm(false)} className="min-h-10 rounded-md border border-neutral-300 px-4 text-sm font-semibold dark:border-neutral-600">Batal</button>
              <button type="submit" disabled={submitting} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Simpan Draft
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
