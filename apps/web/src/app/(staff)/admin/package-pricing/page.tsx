'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  Edit2,
  Filter,
  Globe2,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/formatNumber';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

type PackageType = 'BASIC' | 'BOOSTER';
type ActiveFilter = 'all' | 'active' | 'inactive';
type BranchFilter = 'all' | 'global' | string;

interface Branch {
  id: string;
  name: string;
  branchCode: string;
  isActive?: boolean;
}

interface PackagePricing {
  id: string;
  packageType: PackageType;
  boosterType: string | null;
  serviceType: string | null;
  productCode: string | null;
  name: string;
  totalSessions: number;
  price: number;
  isActive: boolean;
  branchId: string | null;
  branch: Pick<Branch, 'id' | 'name' | 'branchCode'> | null;
  createdAt: string;
  updatedAt: string;
}

interface MasterType {
  id: string;
  code: string;
  name: string;
  price?: number | null;
  isActive: boolean;
  sortOrder: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface PricingListResponse {
  pricings: PackagePricing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface PricingFormState {
  packageType: PackageType;
  branchId: string;
  boosterType: string;
  serviceType: string;
  productCode: string;
  name: string;
  totalSessions: number;
  price: number;
  isActive: boolean;
}

const BOOSTER_FALLBACKS: MasterType[] = [
  { id: 'NO', code: 'NO', name: 'Nitric Oxide', isActive: true, sortOrder: 10 },
  { id: 'GT', code: 'GT', name: 'GasoTransmitter', isActive: true, sortOrder: 20 },
  { id: 'MB', code: 'MB', name: 'Methylene Blue', isActive: true, sortOrder: 30 },
  { id: 'KCL', code: 'KCL', name: 'Potassium Chloride', isActive: true, sortOrder: 40 },
  { id: 'H2S', code: 'H2S', name: 'Hydrogen Sulfide', isActive: true, sortOrder: 50 },
  { id: 'HK', code: 'HK', name: 'H20Konsentrat', isActive: true, sortOrder: 60 },
  { id: 'O3', code: 'O3', name: 'Ozone', isActive: true, sortOrder: 70 },
];

const SERVICE_FALLBACKS: MasterType[] = [
  { id: 'PM', code: 'PM', name: 'Premier', price: 1000000, isActive: true, sortOrder: 10 },
  { id: 'PS', code: 'PS', name: 'Partnership', price: 650000, isActive: true, sortOrder: 20 },
  { id: 'PHC', code: 'PHC', name: 'Partnership Homecare', price: 750000, isActive: true, sortOrder: 30 },
  { id: 'PTY', code: 'PTY', name: 'Partnership Attiya', price: 600000, isActive: true, sortOrder: 40 },
  { id: 'PDA', code: 'PDA', name: 'Partnership Dr. Abhi', price: 65000, isActive: true, sortOrder: 50 },
];

const emptyForm: PricingFormState = {
  packageType: 'BASIC',
  branchId: '',
  boosterType: '',
  serviceType: '',
  productCode: '',
  name: '',
  totalSessions: 7,
  price: 0,
  isActive: true,
};

function sortMasterTypes(types: MasterType[]): MasterType[] {
  return [...types]
    .filter((type) => type.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

function pricingKey(pricing: Pick<PackagePricing, 'packageType' | 'boosterType' | 'serviceType' | 'totalSessions'>): string {
  return [
    pricing.packageType,
    pricing.boosterType || '',
    pricing.serviceType || '',
    pricing.totalSessions,
  ].join('|');
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getDefaultName(form: PricingFormState, branches: Branch[]): string {
  const branch = form.branchId ? branches.find((item) => item.id === form.branchId) : null;
  const scope = branch ? ` - ${branch.branchCode}` : '';

  if (form.packageType === 'BOOSTER') {
    const service = form.serviceType ? ` ${form.serviceType}` : '';
    const booster = form.boosterType || 'Booster';
    return `${booster}${service} ${form.totalSessions} Sesi${scope}`;
  }

  const service = form.serviceType ? ` - ${form.serviceType}` : '';
  return `Basic ${form.totalSessions} Sesi${service}${scope}`;
}

function buildCreatePayload(form: PricingFormState, forceBranchId?: string | null) {
  const payload: Record<string, unknown> = {
    packageType: form.packageType,
    name: form.name.trim(),
    totalSessions: form.totalSessions,
    price: form.price,
    isActive: form.isActive,
  };

  if (form.productCode.trim()) payload.productCode = form.productCode.trim();
  if (form.serviceType.trim()) payload.serviceType = form.serviceType.trim();
  if (form.packageType === 'BOOSTER') payload.boosterType = form.boosterType.trim();

  if (forceBranchId) {
    payload.branchId = forceBranchId;
  } else if (form.branchId) {
    payload.branchId = form.branchId;
  }

  return payload;
}

function buildUpdatePayload(form: PricingFormState) {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    totalSessions: form.totalSessions,
    price: form.price,
    isActive: form.isActive,
  };

  if (form.productCode.trim()) payload.productCode = form.productCode.trim();
  if (form.serviceType.trim()) payload.serviceType = form.serviceType.trim();
  if (form.packageType === 'BOOSTER' && form.boosterType.trim()) {
    payload.boosterType = form.boosterType.trim();
  }

  return payload;
}

export default function PackagePricingPage() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const initialBranchId = searchParams.get('branchId') || 'all';
  const [pricings, setPricings] = useState<PackagePricing[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [boosterTypes, setBoosterTypes] = useState<MasterType[]>(BOOSTER_FALLBACKS);
  const [serviceTypes, setServiceTypes] = useState<MasterType[]>(SERVICE_FALLBACKS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [packageTypeFilter, setPackageTypeFilter] = useState<'all' | PackageType>('all');
  const [branchFilter, setBranchFilter] = useState<BranchFilter>(initialBranchId);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingPricing, setEditingPricing] = useState<PackagePricing | null>(null);
  const [form, setForm] = useState<PricingFormState>(emptyForm);

  const isAdminCabang = user?.role === 'ADMIN_CABANG';
  const canSelectBranch = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER' || user?.role === 'ADMIN_CABANG';

  const ownBranchId = user?.branchId || null;

  const loadBranches = useCallback(async () => {
    try {
      const { data } = await api.get<ApiResponse<Branch[]>>('/admin/branches');
      setBranches(data.data || []);
    } catch {
      setBranches([]);
    }
  }, []);

  const loadMasterTypes = useCallback(async () => {
    try {
      const [boosterResponse, serviceResponse] = await Promise.allSettled([
        api.get<ApiResponse<{ types: MasterType[] }>>('/admin/master/booster-types'),
        api.get<ApiResponse<{ types: MasterType[] }>>('/admin/master/service-types'),
      ]);

      if (boosterResponse.status === 'fulfilled' && boosterResponse.value.data.data?.types?.length) {
        setBoosterTypes(sortMasterTypes(boosterResponse.value.data.data.types));
      }

      if (serviceResponse.status === 'fulfilled' && serviceResponse.value.data.data?.types?.length) {
        setServiceTypes(sortMasterTypes(serviceResponse.value.data.data.types));
      }
    } catch {
      setBoosterTypes(BOOSTER_FALLBACKS);
      setServiceTypes(SERVICE_FALLBACKS);
    }
  }, []);

  const loadPricings = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<ApiResponse<PricingListResponse>>('/admin/package-pricing', {
        params: { limit: 1000 },
      });
      setPricings(data.data?.pricings || []);
    } catch (error) {
      showToast.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadPricings();
    void loadMasterTypes();
    void loadBranches();
  }, [loadBranches, loadMasterTypes, loadPricings, user]);

  useEffect(() => {
    if (isAdminCabang && ownBranchId) {
      setBranchFilter(ownBranchId);
    }
  }, [isAdminCabang, ownBranchId]);

  const globalByKey = useMemo(() => {
    const map = new Map<string, PackagePricing>();
    pricings.forEach((pricing) => {
      if (!pricing.branchId) map.set(pricingKey(pricing), pricing);
    });
    return map;
  }, [pricings]);

  const filteredPricings = useMemo(() => {
    const q = search.trim().toLowerCase();

    return pricings.filter((pricing) => {
      if (packageTypeFilter !== 'all' && pricing.packageType !== packageTypeFilter) return false;

      if (branchFilter === 'global' && pricing.branchId) return false;
      if (branchFilter !== 'all' && branchFilter !== 'global' && pricing.branchId !== branchFilter) return false;

      if (activeFilter === 'active' && !pricing.isActive) return false;
      if (activeFilter === 'inactive' && pricing.isActive) return false;

      if (!q) return true;

      const haystack = [
        pricing.name,
        pricing.productCode,
        pricing.packageType,
        pricing.boosterType,
        pricing.serviceType,
        pricing.branch?.branchCode,
        pricing.branch?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [activeFilter, branchFilter, packageTypeFilter, pricings, search]);

  const stats = useMemo(() => {
    const active = pricings.filter((pricing) => pricing.isActive).length;
    return {
      total: pricings.length,
      global: pricings.filter((pricing) => !pricing.branchId).length,
      branchSpecific: pricings.filter((pricing) => pricing.branchId).length,
      inactive: pricings.length - active,
    };
  }, [pricings]);

  const resetForm = () => {
    setEditingPricing(null);
    setForm({
      ...emptyForm,
      branchId: canSelectBranch ? '' : ownBranchId || '',
    });
  };

  const openCreateModal = () => {
    setEditingPricing(null);
    const defaultBranch = canSelectBranch
      ? branchFilter !== 'all' && branchFilter !== 'global'
        ? branchFilter
        : ''
      : ownBranchId || '';
    setForm({ ...emptyForm, branchId: defaultBranch });
    setShowModal(true);
  };

  const openEditModal = (pricing: PackagePricing) => {
    setEditingPricing(pricing);
    setForm({
      packageType: pricing.packageType,
      branchId: pricing.branchId || '',
      boosterType: pricing.boosterType || '',
      serviceType: pricing.serviceType || '',
      productCode: pricing.productCode || '',
      name: pricing.name,
      totalSessions: pricing.totalSessions,
      price: pricing.price,
      isActive: pricing.isActive,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    resetForm();
  };

  const handlePackageTypeChange = (packageType: PackageType) => {
    setForm((current) => ({
      ...current,
      packageType,
      boosterType: packageType === 'BOOSTER' ? current.boosterType : '',
      totalSessions: packageType === 'BOOSTER' ? 1 : current.totalSessions || 7,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      showToast.error('Nama paket wajib diisi');
      return;
    }

    if (form.totalSessions < 1) {
      showToast.error('Jumlah sesi minimal 1');
      return;
    }

    if (form.price < 0) {
      showToast.error('Harga tidak boleh negatif');
      return;
    }

    if (form.packageType === 'BOOSTER' && !form.boosterType.trim()) {
      showToast.error('Tipe booster wajib diisi');
      return;
    }

    if (form.packageType === 'BOOSTER' && !form.serviceType.trim()) {
      showToast.error('Tipe layanan wajib diisi untuk booster');
      return;
    }

    try {
      setSaving(true);
      if (editingPricing) {
        await api.patch(`/admin/package-pricing/${editingPricing.id}`, buildUpdatePayload(form));
        showToast.success('Harga paket berhasil diperbarui');
      } else {
        await api.post('/admin/package-pricing', buildCreatePayload(form, isAdminCabang ? ownBranchId : undefined));
        showToast.success('Harga paket berhasil dibuat');
      }
      setShowModal(false);
      resetForm();
      await loadPricings();
    } catch (error) {
      showToast.error(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (pricing: PackagePricing) => {
    try {
      await api.patch(`/admin/package-pricing/${pricing.id}`, { isActive: !pricing.isActive });
      showToast.success(pricing.isActive ? 'Harga paket dinonaktifkan' : 'Harga paket diaktifkan');
      await loadPricings();
    } catch (error) {
      showToast.error(getApiErrorMessage(error));
    }
  };

  const handleDelete = async (pricing: PackagePricing) => {
    const ok = window.confirm(`Hapus harga "${pricing.name}"?`);
    if (!ok) return;

    try {
      await api.delete(`/admin/package-pricing/${pricing.id}`);
      showToast.success('Harga paket berhasil dihapus');
      await loadPricings();
    } catch (error) {
      showToast.error(getApiErrorMessage(error));
    }
  };

  const setGeneratedName = () => {
    setForm((current) => ({ ...current, name: getDefaultName(current, branches) }));
  };

  if (!canManage) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-6 dark:bg-neutral-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-5 w-5" />
              Akses tidak tersedia
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-6 text-neutral-900 dark:bg-neutral-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-500 text-black">
              <BadgeDollarSign className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-neutral-950 dark:text-white">
                Harga Paket
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <span>Global dan cabang</span>
                {isAdminCabang && user?.branchCode && (
                  <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    Cabang {user.branchCode}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadPricings()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
            >
              <Plus className="h-4 w-4" />
              Tambah Harga
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatPanel icon={<Package className="h-5 w-5" />} label="Total pricing" value={stats.total} />
          <StatPanel icon={<Globe2 className="h-5 w-5" />} label="Global" value={stats.global} />
          <StatPanel icon={<Building2 className="h-5 w-5" />} label="Cabang" value={stats.branchSpecific} />
          <StatPanel icon={<AlertCircle className="h-5 w-5" />} label="Nonaktif" value={stats.inactive} tone="amber" />
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_170px_220px_170px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, kode, cabang"
                className="h-10 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              />
            </div>

            <select
              value={packageTypeFilter}
              onChange={(event) => setPackageTypeFilter(event.target.value as 'all' | PackageType)}
              className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            >
              <option value="all">Semua paket</option>
              <option value="BASIC">BASIC</option>
              <option value="BOOSTER">BOOSTER</option>
            </select>

            <select
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              disabled={!canSelectBranch}
              className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            >
              {canSelectBranch ? (
                <>
                  <option value="all">Semua scope</option>
                  <option value="global">Global</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.branchCode} - {branch.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value={ownBranchId || ''}>{user?.branchCode || 'Cabang saya'}</option>
              )}
            </select>

            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
              className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            >
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
              <Filter className="h-4 w-4 text-amber-500" />
              {filteredPricings.length} pricing
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
            </div>
          ) : filteredPricings.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Belum ada pricing</h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Filter saat ini tidak memiliki data.</p>
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
              >
                <Plus className="h-4 w-4" />
                Tambah Harga
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
                <thead className="bg-neutral-100 text-xs uppercase text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Scope</th>
                    <th className="px-4 py-3 font-semibold">Paket</th>
                    <th className="px-4 py-3 font-semibold">Kombinasi</th>
                    <th className="px-4 py-3 text-right font-semibold">Harga</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Update</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredPricings.map((pricing) => {
                    const globalPricing = pricing.branchId ? globalByKey.get(pricingKey(pricing)) : null;
                    return (
                      <PricingRow
                        key={pricing.id}
                        pricing={pricing}
                        globalPricing={globalPricing || null}
                        onEdit={openEditModal}
                        onToggle={handleToggleActive}
                        onDelete={handleDelete}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <PricingModal
          branches={branches}
          boosterTypes={boosterTypes}
          serviceTypes={serviceTypes}
          canSelectBranch={canSelectBranch}
          editingPricing={editingPricing}
          form={form}
          saving={saving}
          userBranchCode={user?.branchCode || null}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onPackageTypeChange={handlePackageTypeChange}
          setForm={setForm}
          setGeneratedName={setGeneratedName}
        />
      )}
    </main>
  );
}

function StatPanel({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'neutral' | 'amber';
}) {
  const toneClass = tone === 'amber'
    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
    : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-950 dark:text-white">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}>{icon}</div>
      </div>
    </div>
  );
}

function PricingRow({
  pricing,
  globalPricing,
  onEdit,
  onToggle,
  onDelete,
}: {
  pricing: PackagePricing;
  globalPricing: PackagePricing | null;
  onEdit: (pricing: PackagePricing) => void;
  onToggle: (pricing: PackagePricing) => void;
  onDelete: (pricing: PackagePricing) => void;
}) {
  const isGlobal = !pricing.branchId;
  const delta = globalPricing ? pricing.price - globalPricing.price : null;

  return (
    <tr className="bg-white transition-colors hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/70">
      <td className="px-4 py-4 align-top">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isGlobal ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
            {isGlobal ? <Globe2 className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
          </div>
          <div>
            <div className="font-semibold text-neutral-900 dark:text-white">
              {isGlobal ? 'Global' : pricing.branch?.branchCode || 'Cabang'}
            </div>
            <div className="max-w-[180px] truncate text-xs text-neutral-500 dark:text-neutral-400">
              {isGlobal ? 'Semua cabang' : pricing.branch?.name || pricing.branchId}
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-4 align-top">
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${pricing.packageType === 'BASIC' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-300' : 'bg-violet-500/10 text-violet-600 dark:text-violet-300'}`}>
            {pricing.packageType === 'BASIC' ? <Package className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
            {pricing.packageType}
          </span>
          <div>
            <div className="font-semibold text-neutral-900 dark:text-white">{pricing.name}</div>
            {pricing.productCode && (
              <div className="mt-1 font-mono text-xs text-neutral-500 dark:text-neutral-400">{pricing.productCode}</div>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-4 align-top">
        <div className="flex flex-wrap gap-1.5">
          {pricing.boosterType && <Pill>{pricing.boosterType}</Pill>}
          {pricing.serviceType && <Pill>{pricing.serviceType}</Pill>}
          <Pill>{pricing.totalSessions} sesi</Pill>
        </div>
      </td>

      <td className="px-4 py-4 text-right align-top">
        <div className="font-semibold text-neutral-950 dark:text-white">{formatCurrency(pricing.price)}</div>
        {globalPricing && (
          <div className={`mt-1 text-xs ${delta === 0 ? 'text-neutral-500 dark:text-neutral-400' : delta && delta > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
            Global {formatCurrency(globalPricing.price)}
          </div>
        )}
      </td>

      <td className="px-4 py-4 align-top">
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${pricing.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-red-500/10 text-red-600 dark:text-red-300'}`}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          {pricing.isActive ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>

      <td className="px-4 py-4 align-top text-xs text-neutral-500 dark:text-neutral-400">
        {formatDateTime(pricing.updatedAt)}
      </td>

      <td className="px-4 py-4 align-top">
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onEdit(pricing)}
            title="Edit"
            aria-label="Edit harga paket"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onToggle(pricing)}
            title={pricing.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            aria-label={pricing.isActive ? 'Nonaktifkan harga paket' : 'Aktifkan harga paket'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {pricing.isActive ? <X className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => onDelete(pricing)}
            title="Hapus"
            aria-label="Hapus harga paket"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-300 text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
      {children}
    </span>
  );
}

function PricingModal({
  branches,
  boosterTypes,
  serviceTypes,
  canSelectBranch,
  editingPricing,
  form,
  saving,
  userBranchCode,
  onClose,
  onSubmit,
  onPackageTypeChange,
  setForm,
  setGeneratedName,
}: {
  branches: Branch[];
  boosterTypes: MasterType[];
  serviceTypes: MasterType[];
  canSelectBranch: boolean;
  editingPricing: PackagePricing | null;
  form: PricingFormState;
  saving: boolean;
  userBranchCode: string | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onPackageTypeChange: (packageType: PackageType) => void;
  setForm: React.Dispatch<React.SetStateAction<PricingFormState>>;
  setGeneratedName: () => void;
}) {
  const isEditing = Boolean(editingPricing);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mounted, onClose]);

  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pricing-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500 text-black shadow-lg shadow-amber-500/25">
                <BadgeDollarSign className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 id="pricing-modal-title" className="truncate text-lg font-bold text-neutral-950 dark:text-white">
                  {isEditing ? 'Edit Harga Paket' : 'Tambah Harga Paket'}
                </h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {isEditing
                    ? editingPricing?.branch
                      ? editingPricing.branch.branchCode
                      : 'Global'
                    : 'Atur harga paket terapi'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              aria-label="Tutup modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tipe paket">
                  <div className="grid grid-cols-2 gap-2">
                    <SegmentButton
                      active={form.packageType === 'BASIC'}
                      disabled={isEditing}
                      onClick={() => onPackageTypeChange('BASIC')}
                    >
                      BASIC
                    </SegmentButton>
                    <SegmentButton
                      active={form.packageType === 'BOOSTER'}
                      disabled={isEditing}
                      onClick={() => onPackageTypeChange('BOOSTER')}
                    >
                      BOOSTER
                    </SegmentButton>
                  </div>
                </Field>

                <Field label="Scope">
                  {canSelectBranch && !isEditing ? (
                    <select
                      value={form.branchId}
                      onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}
                      className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    >
                      <option value="">Global</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.branchCode} - {branch.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex h-10 items-center rounded-lg border border-neutral-300 bg-neutral-100 px-3 text-sm font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                      {editingPricing?.branch
                        ? `${editingPricing.branch.branchCode} - ${editingPricing.branch.name}`
                        : editingPricing
                          ? 'Global'
                          : userBranchCode
                            ? `Cabang ${userBranchCode}`
                            : 'Cabang saya'}
                    </div>
                  )}
                </Field>

                {form.packageType === 'BOOSTER' && (
                  <Field label="Tipe booster">
                    <select
                      value={form.boosterType}
                      disabled={isEditing}
                      onChange={(event) => setForm((current) => ({ ...current, boosterType: event.target.value }))}
                      className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-70 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:disabled:bg-neutral-900"
                    >
                      <option value="">Pilih booster</option>
                      {boosterTypes.map((booster) => (
                        <option key={booster.id} value={booster.code}>
                          {booster.code} - {booster.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label="Tipe layanan">
                  <select
                    value={form.serviceType}
                    onChange={(event) => setForm((current) => ({ ...current, serviceType: event.target.value }))}
                    className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                    <option value="">{form.packageType === 'BOOSTER' ? 'Pilih layanan' : 'Tanpa layanan'}</option>
                    {serviceTypes.map((service) => (
                      <option key={service.id} value={service.code}>
                        {service.code} - {service.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Nama paket" className="md:col-span-2">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      className="h-10 min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                      placeholder="Nama paket"
                    />
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={setGeneratedName}
                        className="h-10 rounded-lg border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      >
                        Isi Nama
                      </button>
                    )}
                  </div>
                </Field>

                <Field label="Kode produk">
                  <input
                    value={form.productCode}
                    onChange={(event) => setForm((current) => ({ ...current, productCode: event.target.value.toUpperCase() }))}
                    className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    placeholder="TNB-P7-PM"
                  />
                </Field>

                <Field label="Jumlah sesi">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.totalSessions}
                    onChange={(event) => setForm((current) => ({ ...current, totalSessions: Number(event.target.value) || 0 }))}
                    className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  />
                </Field>

                <Field label="Harga" className="md:col-span-2">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={form.price}
                      onChange={(event) => setForm((current) => ({ ...current, price: Number(event.target.value) || 0 }))}
                      className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    />
                    <div className="rounded-lg bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                      {formatCurrency(form.price)}
                    </div>
                  </div>
                </Field>

                <label className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-3 dark:border-neutral-800 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                    className="h-4 w-4 rounded border-neutral-300 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Aktif</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="h-10 rounded-lg border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-neutral-700 dark:text-neutral-200">{label}</span>
      {children}
    </label>
  );
}

function SegmentButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-10 rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
        active
          ? 'border-amber-500 bg-amber-500 text-black'
          : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-800'
      }`}
    >
      {children}
    </button>
  );
}
