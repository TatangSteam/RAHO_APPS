'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  materialUsageHistoryApi,
  type MaterialCategory,
  type MaterialUsageHistoryItem,
  type StaffMember,
  type BranchGroup,
} from '@/lib/api/materialUsageHistoryApi';
import { showToast } from '@/lib/toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Calendar, ChevronDown, ChevronRight, Filter, Package, RefreshCw, User, Users } from 'lucide-react';

const FILTER_STORAGE_KEY = 'raho-material-usage-history-filters';

type GroupBy = 'none' | 'branch' | 'category' | 'date';

interface PersistedFilters {
  branchId: string;
  staffId: string;
  staffGroupId: string;
  startDate: string;
  endDate: string;
  productName: string;
  category: '' | MaterialCategory;
  groupBy: GroupBy;
}

const DEFAULT_FILTERS: PersistedFilters = {
  branchId: '',
  staffId: '',
  staffGroupId: '',
  startDate: '',
  endDate: '',
  productName: '',
  category: '',
  groupBy: 'none',
};

const MATERIAL_CATEGORIES: Array<{ value: MaterialCategory; label: string }> = [
  { value: 'MEDICINE', label: 'Obat' },
  { value: 'DEVICE', label: 'Alat' },
  { value: 'CONSUMABLE', label: 'Consumable' },
];

const GROUP_OPTIONS: Array<{ value: GroupBy; label: string }> = [
  { value: 'none', label: 'Tanpa grouping' },
  { value: 'branch', label: 'Cabang' },
  { value: 'category', label: 'Kategori Material' },
  { value: 'date', label: 'Tanggal' },
];

function getCategoryLabel(category: MaterialCategory | string) {
  return MATERIAL_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

function getFiltersFromSearchParams(searchParams: URLSearchParams): Partial<PersistedFilters> {
  const groupBy = searchParams.get('groupBy');
  const category = searchParams.get('category');

  return {
    branchId: searchParams.get('branchId') ?? '',
    staffId: searchParams.get('staffId') ?? '',
    staffGroupId: searchParams.get('staffGroupId') ?? '',
    startDate: searchParams.get('startDate') ?? '',
    endDate: searchParams.get('endDate') ?? '',
    productName: searchParams.get('productName') ?? '',
    category: MATERIAL_CATEGORIES.some((item) => item.value === category) ? (category as MaterialCategory) : '',
    groupBy: GROUP_OPTIONS.some((item) => item.value === groupBy) ? (groupBy as GroupBy) : 'none',
  };
}

function getStoredFilters(): Partial<PersistedFilters> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = window.localStorage.getItem(FILTER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function buildQueryString(filters: PersistedFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && !(key === 'groupBy' && value === 'none')) {
      params.set(key, value);
    }
  });
  return params.toString();
}

export default function MaterialUsageHistoryPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userBranchId = user?.branchId ?? undefined;
  const canSelectBranch = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';
  
  // Data state
  const [historyData, setHistoryData] = useState<MaterialUsageHistoryItem[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [branchGroups, setBranchGroups] = useState<BranchGroup[]>([]);
  
  // Loading state
  const [loading, setLoading] = useState(true);
  const [loadingFilters, setLoadingFilters] = useState(true);
  
  // Filter state
  const [initialized, setInitialized] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<'' | MaterialCategory>('');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);

  const currentFilters = useCallback((): PersistedFilters => ({
    branchId: canSelectBranch ? selectedBranchId : userBranchId ?? '',
    staffId: selectedStaffId,
    staffGroupId: selectedGroupId,
    startDate,
    endDate,
    productName: productSearch,
    category: selectedCategory,
    groupBy,
  }), [
    canSelectBranch,
    endDate,
    groupBy,
    productSearch,
    selectedBranchId,
    selectedCategory,
    selectedGroupId,
    selectedStaffId,
    startDate,
    userBranchId,
  ]);

  const persistFilters = useCallback((filters: PersistedFilters) => {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));

    const query = buildQueryString(filters);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    if (!user) return;

    const hasQuery = Array.from(searchParams.keys()).length > 0;
    const saved = hasQuery ? getFiltersFromSearchParams(searchParams) : getStoredFilters();
    const filters = { ...DEFAULT_FILTERS, ...saved };

    setSelectedBranchId(canSelectBranch ? filters.branchId : userBranchId ?? '');
    setSelectedStaffId(filters.staffId);
    setSelectedGroupId(filters.staffGroupId);
    setStartDate(filters.startDate);
    setEndDate(filters.endDate);
    setProductSearch(filters.productName);
    setSelectedCategory(filters.category);
    setGroupBy(filters.groupBy);
    setInitialized(true);
  }, [canSelectBranch, searchParams, user, userBranchId]);

  // Load filter data
  useEffect(() => {
    if (!initialized) return;

    const loadFilters = async () => {
      try {
        setLoadingFilters(true);
        const groups = await materialUsageHistoryApi.getBranchGroups();
        setBranchGroups(groups);

        let branchForStaff = canSelectBranch ? selectedBranchId || undefined : userBranchId;
        if (canSelectBranch && selectedBranchId && !groups.some((branch) => branch.id === selectedBranchId)) {
          setSelectedBranchId('');
          setSelectedStaffId('');
          branchForStaff = undefined;
        }

        const staff = await materialUsageHistoryApi.getStaffList(branchForStaff);
        setStaffList(staff);
      } catch (error) {
        console.error('Error loading filters:', error);
        showToast.error('Gagal memuat data filter');
      } finally {
        setLoadingFilters(false);
      }
    };

    void loadFilters();
  }, [canSelectBranch, initialized, selectedBranchId, userBranchId]);

  // Load history data
  const loadHistory = useCallback(async (filtersOverride?: PersistedFilters) => {
    try {
      setLoading(true);
      const filters = filtersOverride ?? currentFilters();
      
      const data = await materialUsageHistoryApi.getHistory({
        branchId: filters.branchId || undefined,
        staffId: filters.staffId || undefined,
        staffGroupId: filters.staffGroupId || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        productName: filters.productName || undefined,
        category: filters.category || undefined,
      });
      setHistoryData(data);
    } catch (error) {
      console.error('Error loading history:', error);
      showToast.error('Gagal memuat riwayat penggunaan barang');
    } finally {
      setLoading(false);
    }
  }, [currentFilters]);

  // Load history on mount and when filters change
  useEffect(() => {
    if (!initialized) return;
    void loadHistory(currentFilters());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  // Filter staff list based on selected group
  const filteredStaffList = useMemo(() => {
    if (!selectedGroupId) return staffList;
    
    return staffList.filter(staff => {
      return staff.branchCode === selectedGroupId ||
             staff.staffBranches.some(sb => sb.branchCode === selectedGroupId);
    });
  }, [staffList, selectedGroupId]);

  // Handle apply filters
  const handleApplyFilters = () => {
    const filters = currentFilters();
    persistFilters(filters);
    setCollapsedGroups(new Set());
    void loadHistory(filters);
    setShowFilters(false);
  };

  // Handle reset filters
  const handleResetFilters = () => {
    const resetFilters = {
      ...DEFAULT_FILTERS,
      branchId: canSelectBranch ? '' : userBranchId ?? '',
    };

    setSelectedBranchId(resetFilters.branchId);
    setSelectedStaffId('');
    setSelectedGroupId('');
    setStartDate('');
    setEndDate('');
    setProductSearch('');
    setSelectedCategory('');
    setGroupBy('none');
    setCollapsedGroups(new Set());
    setShowFilters(false);
    window.localStorage.removeItem(FILTER_STORAGE_KEY);
    router.replace(pathname, { scroll: false });
    void loadHistory(resetFilters);
  };

  // Calculate active filter count
  const activeFilterCount = [
    canSelectBranch ? selectedBranchId : '',
    selectedStaffId,
    selectedGroupId,
    startDate,
    endDate,
    productSearch,
    selectedCategory,
    groupBy !== 'none' ? groupBy : '',
  ].filter(Boolean).length;

  const groupedData = useMemo(() => {
    if (groupBy === 'none') return [];

    const groups = new Map<string, {
      key: string;
      label: string;
      rows: MaterialUsageHistoryItem[];
      totals: Map<string, number>;
    }>();

    historyData.forEach((item) => {
      const key =
        groupBy === 'branch'
          ? item.branchId
          : groupBy === 'category'
            ? item.productCategory
            : format(new Date(item.date), 'yyyy-MM-dd');

      const label =
        groupBy === 'branch'
          ? `${item.branchName} (${item.branchCode})`
          : groupBy === 'category'
            ? getCategoryLabel(item.productCategory)
            : format(new Date(item.date), 'dd MMM yyyy', { locale: idLocale });

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label,
          rows: [],
          totals: new Map<string, number>(),
        });
      }

      const group = groups.get(key)!;
      group.rows.push(item);
      group.totals.set(item.unit, (group.totals.get(item.unit) ?? 0) + item.quantity);
    });

    return Array.from(groups.values());
  }, [groupBy, historyData]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatTotals = (totals: Map<string, number>) => {
    return Array.from(totals.entries())
      .map(([unit, total]) => `${total.toFixed(2)} ${unit}`)
      .join(', ');
  };

  const renderDataRow = (item: MaterialUsageHistoryItem) => (
    <tr
      key={item.id}
      className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
    >
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        {format(new Date(item.date), 'dd MMM yyyy, HH:mm', {
          locale: idLocale,
        })}
      </td>
      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
        <div className="font-medium">{item.branchName}</div>
        <div className="text-xs text-gray-500 dark:text-neutral-400">{item.branchCode}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-neutral-300">
        {getCategoryLabel(item.productCategory)}
      </td>
      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
        {item.productName}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
        {item.quantity.toFixed(2)} {item.unit}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        <div>
          <div className="font-medium">{item.staffName}</div>
          <div className="text-xs text-gray-500 dark:text-neutral-400">
            {item.staffRole}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-neutral-400">
        {item.sessionCode}
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Penggunaan Material
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
                Pantau penggunaan material dengan filter cabang, kategori, tanggal, dan grouping
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
              >
                <Filter size={18} />
                Filter
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => void loadHistory()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Cabang Filter */}
              {canSelectBranch ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                    <Users size={16} className="inline mr-2" />
                    Cabang
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => {
                      setSelectedBranchId(e.target.value);
                      setSelectedStaffId('');
                    }}
                    disabled={loadingFilters}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-transparent disabled:opacity-50"
                  >
                    <option value="">Semua Cabang</option>
                    {branchGroups.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.branchCode})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                    <Users size={16} className="inline mr-2" />
                    Cabang
                  </label>
                  <div className="w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-700 dark:text-neutral-300">
                    {branchGroups[0] ? `${branchGroups[0].name} (${branchGroups[0].branchCode})` : 'Cabang Anda'}
                  </div>
                </div>
              )}

              {/* Grup Staf Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                  <Users size={16} className="inline mr-2" />
                  Grup Staf / Cabang
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => {
                    setSelectedGroupId(e.target.value);
                    // Reset staff selection when group changes
                    setSelectedStaffId('');
                  }}
                  disabled={loadingFilters}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-transparent disabled:opacity-50"
                >
                  <option value="">Semua Grup</option>
                  {branchGroups.map((group) => (
                    <option key={group.id} value={group.branchCode}>
                      {group.name} ({group.branchCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                  <Package size={16} className="inline mr-2" />
                  Kategori Material
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as '' | MaterialCategory)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-transparent"
                >
                  <option value="">Semua Kategori</option>
                  {MATERIAL_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Staf Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                  <User size={16} className="inline mr-2" />
                  Staf
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  disabled={loadingFilters}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-transparent disabled:opacity-50"
                >
                  <option value="">Semua Staf</option>
                  {filteredStaffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} - {staff.roleLabel}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                  <Package size={16} className="inline mr-2" />
                  Nama Barang
                </label>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Cari nama barang..."
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-transparent"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                  <Calendar size={16} className="inline mr-2" />
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-transparent"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                  <Calendar size={16} className="inline mr-2" />
                  Tanggal Akhir
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-transparent"
                />
              </div>

              {/* Grouping */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                  <Filter size={16} className="inline mr-2" />
                  Grouping
                </label>
                <select
                  value={groupBy}
                  onChange={(e) => {
                    setGroupBy(e.target.value as GroupBy);
                    setCollapsedGroups(new Set());
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-transparent"
                >
                  {GROUP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors font-medium"
              >
                Terapkan Filter
              </button>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-300 rounded-lg transition-colors font-medium"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-neutral-400">Total Riwayat</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {historyData.length}
              </p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
              <Package size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
              <span className="ml-3 text-gray-600 dark:text-neutral-400">Memuat data...</span>
            </div>
          ) : historyData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package size={48} className="text-gray-400 dark:text-neutral-600 mb-4" />
              <p className="text-gray-600 dark:text-neutral-400 text-center">
                Tidak ada riwayat penggunaan barang
                <br />
                <span className="text-sm">Coba ubah filter untuk melihat data lainnya</span>
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      Tanggal & Waktu
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      Cabang
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      Kategori
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      Nama Barang
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      Jumlah
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      Nama Staf
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      Kode Sesi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-900 divide-y divide-gray-200 dark:divide-neutral-800">
                  {groupBy === 'none'
                    ? historyData.map(renderDataRow)
                    : groupedData.map((group) => {
                      const collapsed = collapsedGroups.has(group.key);
                      return (
                        <Fragment key={group.key}>
                          <tr className="bg-amber-50 dark:bg-amber-500/10">
                            <td colSpan={7} className="px-6 py-3">
                              <button
                                type="button"
                                onClick={() => toggleGroup(group.key)}
                                className="flex w-full items-center justify-between text-left"
                              >
                                <span className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                                  {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                  {group.label}
                                  <span className="text-xs font-medium text-amber-700/70 dark:text-amber-200/70">
                                    {group.rows.length} data
                                  </span>
                                </span>
                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                  Subtotal: {formatTotals(group.totals)}
                                </span>
                              </button>
                            </td>
                          </tr>
                          {!collapsed && group.rows.map(renderDataRow)}
                        </Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
