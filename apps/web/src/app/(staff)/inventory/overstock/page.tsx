'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { inventoryApi, OverstockSummary } from '@/lib/api/inventoryApi';
import { branchesApi } from '@/lib/api/branchesApi';
import { 
  Package, 
  RefreshCw, 
  Calendar, 
  ChevronDown,
  Building2,
  Info,
  ArrowLeft
} from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  branchCode: string;
}

export default function OverstockPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [overstockSummary, setOverstockSummary] = useState<OverstockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  const isManager = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';

  const fetchBranches = useCallback(async () => {
    if (!isManager) return;
    
    try {
      const response = await branchesApi.listBranches();
      if (response.data?.data) {
        const branchList = Array.isArray(response.data.data) 
          ? response.data.data 
          : response.data.data.data || [];
        setBranches(branchList);
        if (branchList.length > 0 && !selectedBranchId) {
          setSelectedBranchId(branchList[0].id);
        }
      }
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to fetch branches:', error);
    }
  }, [isManager, selectedBranchId]);

  const fetchOverstockSummary = useCallback(async () => {
    const branchId = isManager ? selectedBranchId : user?.branchId;
    if (!accessToken || !branchId) return;
    
    try {
      setLoading(true);
      const response = await inventoryApi.getOverstockSummary(branchId);
      if (response.data?.data) {
        setOverstockSummary(response.data.data);
      }
    } catch (error) {
      assertCaughtError(error);
      devError('Overstock fetch error:', error);
      showToast.error('Gagal memuat data overstock');
      setOverstockSummary([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, isManager, selectedBranchId, user?.branchId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    fetchBranches();
  }, [mounted, user, accessToken, router, fetchBranches]);

  useEffect(() => {
    if (!mounted) return;
    const branchId = isManager ? selectedBranchId : user?.branchId;
    if (branchId) {
      fetchOverstockSummary();
    }
  }, [mounted, isManager, selectedBranchId, user?.branchId, fetchOverstockSummary]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const totalOverstock = overstockSummary.reduce((sum, item) => sum + item.totalQuantity, 0);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-amber-500 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </button>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
            <Package className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Overstock Cabang
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Lihat stok berlebih yang tersedia untuk dikurangi dari request berikutnya
            </p>
          </div>
        </div>
      </div>

      {/* Branch Selector (for managers) */}
      {isManager && branches.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Pilih Cabang
          </label>
          <div className="relative w-full max-w-xs">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none cursor-pointer"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.branchCode})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Tentang Overstock</p>
            <p className="text-xs text-amber-400/80 mt-1">
              Overstock adalah kelebihan stok yang dikirim melebihi jumlah yang diminta. 
              Overstock akan otomatis dikurangi dari request stok berikutnya menggunakan metode FIFO (First In First Out).
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {!loading && overstockSummary.length > 0 && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Produk</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
              {overstockSummary.length}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Total Overstock</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {totalOverstock.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <p className="text-sm text-blue-600 dark:text-blue-400">Total Record</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {overstockSummary.reduce((sum, item) => sum + item.records.length, 0)}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCw className="h-12 w-12 text-amber-500 animate-spin mb-4" />
          <p className="text-neutral-500 dark:text-neutral-400">Memuat data...</p>
        </div>
      ) : overstockSummary.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-20 h-20 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center mb-6">
            <Package className="h-10 w-10 text-neutral-400" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            Tidak Ada Overstock
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-center mb-6 max-w-md">
            Belum ada overstock yang tersedia untuk cabang ini. Overstock akan muncul ketika Admin Manager mengirim lebih banyak dari jumlah yang diminta.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {overstockSummary.map((item) => (
            <div
              key={item.masterProductId}
              className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-5 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-neutral-900 dark:text-white truncate">
                      {item.productName}
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                      {item.productCategory} • {item.unit}
                    </p>
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {item.totalQuantity} {item.unit}
                  </span>
                </div>
              </div>

              {/* Card Body - Records */}
              <div className="p-5 space-y-3">
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Riwayat Overstock ({item.records.length})
                </p>
                
                {item.records.slice(0, 3).map((record) => (
                  <div
                    key={record.id}
                    className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        +{record.quantity} {item.unit}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(record.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 line-clamp-2">
                      {record.reason}
                    </p>
                  </div>
                ))}
                
                {item.records.length > 3 && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center py-2">
                    +{item.records.length - 3} record lainnya
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
