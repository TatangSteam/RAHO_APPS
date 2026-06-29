'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  materialUsageHistoryApi,
  type MaterialUsageHistoryItem,
  type StaffMember,
  type BranchGroup,
} from '@/lib/api/materialUsageHistoryApi';
import { showToast } from '@/lib/toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Search, Filter, X, Calendar, User, Users, Package, RefreshCw } from 'lucide-react';

export default function MaterialUsageHistoryPage() {
  const { user } = useAuthStore();
  const userBranchId = user?.branchId ?? undefined;
  
  // Data state
  const [historyData, setHistoryData] = useState<MaterialUsageHistoryItem[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [branchGroups, setBranchGroups] = useState<BranchGroup[]>([]);
  
  // Loading state
  const [loading, setLoading] = useState(true);
  const [loadingFilters, setLoadingFilters] = useState(true);
  
  // Filter state
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);

  // Load filter data
  useEffect(() => {
    const loadFilters = async () => {
      try {
        setLoadingFilters(true);
        const [staff, groups] = await Promise.all([
          materialUsageHistoryApi.getStaffList(userBranchId),
          materialUsageHistoryApi.getBranchGroups(),
        ]);
        setStaffList(staff);
        setBranchGroups(groups);
      } catch (error) {
        console.error('Error loading filters:', error);
        showToast.error('Gagal memuat data filter');
      } finally {
        setLoadingFilters(false);
      }
    };

    void loadFilters();
  }, [userBranchId]);

  // Load history data
  const loadHistory = async () => {
    try {
      setLoading(true);
      const filters = {
        branchId: userBranchId,
        staffId: selectedStaffId || undefined,
        staffGroupId: selectedGroupId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        productName: productSearch || undefined,
      };
      
      const data = await materialUsageHistoryApi.getHistory(filters);
      setHistoryData(data);
    } catch (error) {
      console.error('Error loading history:', error);
      showToast.error('Gagal memuat riwayat penggunaan barang');
    } finally {
      setLoading(false);
    }
  };

  // Load history on mount and when filters change
  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userBranchId]);

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
    void loadHistory();
    setShowFilters(false);
  };

  // Handle reset filters
  const handleResetFilters = () => {
    setSelectedStaffId('');
    setSelectedGroupId('');
    setStartDate('');
    setEndDate('');
    setProductSearch('');
    setShowFilters(false);
    // Reload with empty filters
    setTimeout(() => {
      void loadHistory();
    }, 100);
  };

  // Calculate active filter count
  const activeFilterCount = [
    selectedStaffId,
    selectedGroupId,
    startDate,
    endDate,
    productSearch,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Riwayat Penggunaan Barang
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
                Lihat riwayat penggunaan barang inventaris dengan filter staf dan grup
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
                      Nama Barang
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      Jumlah
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      Nama Staf
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      Grup Staf
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                      Kode Sesi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-900 divide-y divide-gray-200 dark:divide-neutral-800">
                  {historyData.map((item) => (
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
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-neutral-400">
                        {item.staffGroup}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-neutral-400">
                        {item.sessionCode}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
