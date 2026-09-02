'use client';

import { assertCaughtError } from '@/lib/caughtError';
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
  Settings2,
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
  description?: string | null;
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
  isComplimentary: boolean;
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
  isComplimentary: false,
  isActive: true,
};

function sortMasterTypes(types: MasterType[]): MasterType[] {
  return [...types]
    .filter((type) => type.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

function pricingKey(pricing: Pick<PackagePricing, 'packageType' | 'boosterType' | 'serviceType' | 'totalSessions' | 'productCode'>): string {
  if (pricing.productCode?.trim()) return `PRODUCT:${pricing.productCode.trim().toUpperCase()}`;
  return [
    'ATTR',
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

function getMasterType(types: MasterType[], code: string): MasterType | undefined {
  return types.find((type) => type.code === code);
}

function getDefaultName(
  form: PricingFormState,
  branches: Branch[],
  boosterTypes: MasterType[],
  serviceTypes: MasterType[],
): string {
  const branch = form.branchId ? branches.find((item) => item.id === form.branchId) : null;
  const scope = branch ? ` - ${branch.branchCode}` : '';
  const service = getMasterType(serviceTypes, form.serviceType);

  if (form.packageType === 'BOOSTER') {
    const booster = getMasterType(boosterTypes, form.boosterType);
    const boosterLabel = booster
      ? `${booster.code}${booster.name !== booster.code ? ` (${booster.name})` : ''}`
      : 'Booster';
    const serviceLabel = service?.name || form.serviceType || 'Layanan';
    return `Booster ${boosterLabel} ${form.totalSessions}X - ${serviceLabel}${scope}`;
  }

  const serviceLabel = service?.name ? ` ${service.name}` : '';
  return `Terapi Nano Bubble ${form.totalSessions}X${serviceLabel}${scope}`;
}

function getDefaultProductCode(form: PricingFormState): string {
  const service = form.serviceType || 'GEN';
  if (form.packageType === 'BOOSTER') {
    return form.boosterType
      ? `BST-${form.boosterType}-P${form.totalSessions}-${service}`
      : '';
  }

  return `TNB-P${form.totalSessions}-${service}`;
}

function getPackageTotal(form: PricingFormState): number {
  return form.packageType === 'BOOSTER'
    ? form.price * form.totalSessions
    : form.price;
}

function formatPriceInput(value: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value || 0);
}

function parsePriceInput(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits ? Math.min(Number(digits), 100_000_000) : 0;
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
    productCode: form.productCode.trim() || null,
    serviceType: form.serviceType.trim() || null,
  };

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
  const [allServiceTypes, setAllServiceTypes] = useState<MasterType[]>(SERVICE_FALLBACKS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [packageTypeFilter, setPackageTypeFilter] = useState<'all' | PackageType>('all');
  const [branchFilter, setBranchFilter] = useState<BranchFilter>(initialBranchId);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [showServiceTypeManager, setShowServiceTypeManager] = useState(false);
  const [editingPricing, setEditingPricing] = useState<PackagePricing | null>(null);
  const [form, setForm] = useState<PricingFormState>(emptyForm);

  const isAdminCabang = user?.role === 'ADMIN_CABANG';
  const canSelectBranch = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER' || user?.role === 'ADMIN_CABANG';
  const canManageServiceTypes = user?.role === 'SUPER_ADMIN';

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

      if (serviceResponse.status === 'fulfilled' && Array.isArray(serviceResponse.value.data.data?.types)) {
        const allTypes = [...serviceResponse.value.data.data.types]
          .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
        setAllServiceTypes(allTypes);
        setServiceTypes(sortMasterTypes(allTypes));
      }
    } catch {
      setBoosterTypes(BOOSTER_FALLBACKS);
      setServiceTypes(SERVICE_FALLBACKS);
      setAllServiceTypes(SERVICE_FALLBACKS);
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
      assertCaughtError(error);
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
      isComplimentary: pricing.price === 0,
      isActive: pricing.isActive,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setShowServiceTypeManager(false);
    resetForm();
  };

  const handlePackageTypeChange = (packageType: PackageType) => {
    setForm((current) => current.packageType === packageType ? current : ({
      ...current,
      packageType,
      boosterType: '',
      serviceType: '',
      productCode: '',
      name: '',
      totalSessions: packageType === 'BOOSTER' ? 1 : 7,
      price: 0,
      isComplimentary: false,
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

    if (form.price === 0 && !form.isComplimentary) {
      showToast.error('Isi harga paket atau tandai sebagai paket gratis');
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
      assertCaughtError(error);
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
      assertCaughtError(error);
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
      assertCaughtError(error);
      showToast.error(getApiErrorMessage(error));
    }
  };

  const applySuggestedValues = () => {
    setForm((current) => {
      const service = getMasterType(serviceTypes, current.serviceType);
      return {
        ...current,
        name: getDefaultName(current, branches, boosterTypes, serviceTypes),
        productCode: getDefaultProductCode(current),
        price: current.packageType === 'BOOSTER'
          ? current.price || Number(service?.price || 0)
          : current.price,
        isComplimentary: current.packageType === 'BOOSTER' && Number(service?.price || 0) > 0
          ? false
          : current.isComplimentary,
      };
    });
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
                    <th className="px-4 py-3 text-right font-semibold">Harga katalog</th>
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
          applySuggestedValues={applySuggestedValues}
          canManageServiceTypes={canManageServiceTypes}
          onManageServiceTypes={() => setShowServiceTypeManager(true)}
        />
      )}

      {showServiceTypeManager && (
        <ServiceTypeManager
          types={allServiceTypes}
          canDelete={user?.role === 'SUPER_ADMIN'}
          onClose={() => setShowServiceTypeManager(false)}
          onChanged={async (unavailableCode) => {
            await loadMasterTypes();
            if (unavailableCode) {
              setForm((current) => current.serviceType === unavailableCode
                ? { ...current, serviceType: '', price: 0, isComplimentary: false }
                : current);
            }
          }}
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
        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {pricing.packageType === 'BOOSTER'
            ? `${formatCurrency(pricing.price * pricing.totalSessions)} total paket`
            : 'total paket'}
        </div>
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
  applySuggestedValues,
  canManageServiceTypes,
  onManageServiceTypes,
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
  applySuggestedValues: () => void;
  canManageServiceTypes: boolean;
  onManageServiceTypes: () => void;
}) {
  const isEditing = Boolean(editingPricing);
  const [mounted, setMounted] = useState(false);
  const selectedService = getMasterType(serviceTypes, form.serviceType);
  const priceUnitLabel = form.packageType === 'BASIC'
    ? 'Harga total paket'
    : 'Harga per sesi';
  const canApplySuggestion = form.packageType === 'BASIC'
    || Boolean(form.boosterType && form.serviceType);
  const canSubmit = form.name.trim().length >= 3
    && form.totalSessions >= 1
    && form.totalSessions <= 100
    && (form.price > 0 || form.isComplimentary)
    && (form.packageType === 'BASIC' || Boolean(form.boosterType && form.serviceType));

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
              <div className="mb-5 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 sm:grid-cols-3">
                <div><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] text-black">1</span>Pilih paket & layanan</div>
                <div><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] text-black">2</span>Isi sesi & harga</div>
                <div><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] text-black">3</span>Periksa total</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tipe paket *">
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

                <Field label="Scope harga *">
                  {canSelectBranch && !isEditing ? (
                    <select
                      value={form.branchId}
                      onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}
                      className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    >
                      <option value="">Global — fallback semua cabang</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.branchCode} - {branch.name} — override Global
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
                  <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {form.branchId
                      ? 'Harga cabang menggantikan produk Global dengan kode produk yang sama.'
                      : 'Harga Global menjadi fallback untuk cabang yang tidak memiliki override.'}
                  </p>
                </Field>

                {form.packageType === 'BOOSTER' && (
                  <Field label="Tipe booster *">
                    <select
                      value={form.boosterType}
                      disabled={isEditing}
                      onChange={(event) => setForm((current) => ({ ...current, boosterType: event.target.value }))}
                      className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-70 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:disabled:bg-neutral-900"
                    >
                      <option value="">Pilih booster</option>
                      {boosterTypes.map((booster) => (
                        <option key={booster.id} value={booster.code}>
                          {booster.code}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label={form.packageType === 'BOOSTER' ? 'Tipe layanan *' : 'Tipe layanan'}>
                  <select
                    value={form.serviceType}
                    onChange={(event) => {
                      const serviceType = event.target.value;
                      const service = getMasterType(serviceTypes, serviceType);
                      setForm((current) => ({
                        ...current,
                        serviceType,
                        price: !isEditing && current.packageType === 'BOOSTER'
                          ? Number(service?.price || 0)
                          : current.price,
                        isComplimentary: !isEditing && current.packageType === 'BOOSTER' && Number(service?.price || 0) > 0
                          ? false
                          : current.isComplimentary,
                      }));
                    }}
                    className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                    <option value="">{form.packageType === 'BOOSTER' ? 'Pilih layanan' : 'Tanpa layanan'}</option>
                    {form.serviceType && !selectedService && (
                      <option value={form.serviceType}>{form.serviceType} — data lama</option>
                    )}
                    {serviceTypes.map((service) => (
                      <option key={service.id} value={service.code}>
                        {service.code} - {service.name}
                      </option>
                    ))}
                  </select>
                  {form.packageType === 'BOOSTER' && selectedService?.price != null && (
                    <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                      Rekomendasi master layanan: {formatCurrency(Number(selectedService.price))}
                      {' '}per sesi.
                    </p>
                  )}
                  {canManageServiceTypes && !isEditing && (
                    <button
                      type="button"
                      onClick={onManageServiceTypes}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-600 dark:text-amber-300"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Tambah atau kelola tipe layanan
                    </button>
                  )}
                </Field>

                <Field label="Nama paket *" className="md:col-span-2">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      value={form.name}
                      maxLength={100}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      className="h-10 min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                      placeholder="Nama paket"
                    />
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={applySuggestedValues}
                        disabled={!canApplySuggestion}
                        className="h-10 rounded-lg border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      >
                        Isi otomatis
                      </button>
                    )}
                  </div>
                </Field>

                <Field label="Kode produk">
                  <input
                    value={form.productCode}
                    maxLength={50}
                    onChange={(event) => setForm((current) => ({ ...current, productCode: event.target.value.toUpperCase() }))}
                    className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    placeholder="TNB-P7-PM"
                  />
                  <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    Opsional. Isi otomatis mengikuti tipe, jumlah sesi, dan layanan.
                  </p>
                </Field>

                <Field label="Jumlah sesi *">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.totalSessions}
                    onChange={(event) => setForm((current) => ({ ...current, totalSessions: Number(event.target.value) || 0 }))}
                    className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  />
                </Field>

                <Field label={`${priceUnitLabel} *`} className="md:col-span-2">
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatPriceInput(form.price)}
                      disabled={form.isComplimentary}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        price: parsePriceInput(event.target.value),
                        isComplimentary: false,
                      }))}
                      className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3 text-base font-semibold text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:disabled:bg-neutral-800"
                      aria-label={priceUnitLabel}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {form.packageType === 'BOOSTER'
                      ? `Harga ini dikalikan dengan ${form.totalSessions || 0} sesi.`
                      : 'Harga BASIC adalah harga untuk seluruh sesi dalam satu paket.'}
                    {' '}Paket gratis harus dipilih secara eksplisit.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-700">
                    <input
                      type="checkbox"
                      checked={form.isComplimentary}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        isComplimentary: event.target.checked,
                        price: event.target.checked ? 0 : current.price,
                      }))}
                      className="h-4 w-4 rounded border-neutral-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Paket gratis (harga Rp 0)</span>
                  </label>
                </Field>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10 md:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Ringkasan harga yang dipakai</div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="text-sm text-emerald-900 dark:text-emerald-100">
                      {form.packageType === 'BOOSTER'
                        ? `${formatCurrency(form.price)} × ${form.totalSessions || 0} sesi`
                        : `${form.totalSessions || 0} sesi dalam satu paket`}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-emerald-700 dark:text-emerald-300">Total per paket</div>
                      <div className="text-xl font-bold text-emerald-950 dark:text-white">{formatCurrency(getPackageTotal(form))}</div>
                    </div>
                  </div>
                  {isEditing && (
                    <p className="mt-3 border-t border-emerald-200 pt-3 text-xs text-emerald-800 dark:border-emerald-500/20 dark:text-emerald-200">
                      Perubahan katalog hanya berlaku untuk assignment baru; paket member yang sudah ada tidak ikut berubah.
                    </p>
                  )}
                </div>

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
                disabled={saving || !canSubmit}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan Harga Paket
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

function ServiceTypeManager({
  types,
  canDelete,
  onClose,
  onChanged,
}: {
  types: MasterType[];
  canDelete: boolean;
  onClose: () => void;
  onChanged: (unavailableCode?: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [savingTypeId, setSavingTypeId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.trim().length < 2 || name.trim().length < 2) {
      showToast.error('Kode dan nama layanan minimal 2 karakter');
      return;
    }

    try {
      setCreating(true);
      await api.post('/admin/master/service-types', {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        price,
      });
      await onChanged();
      setCode('');
      setName('');
      setPrice(0);
      showToast.success('Tipe layanan berhasil ditambahkan');
    } catch (error) {
      assertCaughtError(error);
      showToast.error(getApiErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (type: MasterType) => {
    try {
      setSavingTypeId(type.id);
      await api.patch(`/admin/master/service-types/${type.id}`, { isActive: !type.isActive });
      await onChanged(type.isActive ? type.code : undefined);
      showToast.success(type.isActive ? 'Tipe layanan dinonaktifkan' : 'Tipe layanan diaktifkan');
    } catch (error) {
      assertCaughtError(error);
      showToast.error(getApiErrorMessage(error));
    } finally {
      setSavingTypeId(null);
    }
  };

  const handleDeleteType = async (type: MasterType) => {
    if (!window.confirm(`Hapus tipe layanan ${type.code} - ${type.name}?`)) return;

    try {
      setSavingTypeId(type.id);
      await api.delete(`/admin/master/service-types/${type.id}`);
      await onChanged(type.code);
      showToast.success('Tipe layanan berhasil dihapus');
    } catch (error) {
      assertCaughtError(error);
      showToast.error(getApiErrorMessage(error));
    } finally {
      setSavingTypeId(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <div>
            <h3 className="text-lg font-bold text-neutral-950 dark:text-white">Kelola Tipe Layanan</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Master ini berlaku global dan dapat digunakan oleh seluruh scope harga.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <form onSubmit={handleCreate} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/60">
            <div className="mb-3 text-sm font-bold text-neutral-900 dark:text-white">Tambah layanan baru</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kode layanan *">
                <input
                  value={code}
                  maxLength={20}
                  onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                  placeholder="Contoh: HC"
                  className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm text-neutral-900 outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                />
              </Field>
              <Field label="Nama layanan *">
                <input
                  value={name}
                  maxLength={100}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Contoh: Homecare"
                  className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                />
              </Field>
              <Field label="Rekomendasi harga per sesi" className="sm:col-span-2">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-neutral-500">Rp</span>
                  <input
                    value={formatPriceInput(price)}
                    inputMode="numeric"
                    onChange={(event) => setPrice(parsePriceInput(event.target.value))}
                    className="h-10 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3 text-sm font-semibold text-neutral-900 outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                  />
                </div>
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={creating || code.trim().length < 2 || name.trim().length < 2}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Tambahkan
              </button>
            </div>
          </form>

          <div className="mt-5 space-y-2">
            {types.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 p-5 text-center text-sm text-neutral-500 dark:border-neutral-700">Belum ada tipe layanan.</div>
            ) : types.map((type) => (
              <div key={type.id} className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-neutral-100 px-2 py-1 font-mono text-xs font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">{type.code}</span>
                    <span className="font-semibold text-neutral-900 dark:text-white">{type.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${type.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'}`}>
                      {type.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Rekomendasi {formatCurrency(Number(type.price || 0))} per sesi</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={savingTypeId === type.id}
                    onClick={() => void handleToggle(type)}
                    className="h-9 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    {type.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      disabled={savingTypeId === type.id}
                      onClick={() => void handleDeleteType(type)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                      aria-label={`Hapus ${type.name}`}
                      title="Hapus permanen jika belum digunakan paket"
                    >
                      {savingTypeId === type.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-neutral-200 px-5 py-4 text-right dark:border-neutral-800">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">Selesai</button>
        </div>
      </div>
    </div>,
    document.body,
  );
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
