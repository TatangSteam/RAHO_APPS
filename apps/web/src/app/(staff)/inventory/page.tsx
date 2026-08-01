'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { api } from '@/lib/api';
import { 
  Package, Search, AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, 
  ClipboardList, Truck, Building2, RefreshCw, X, Edit3, ShoppingCart, MapPin,
  ArrowUpDown, Save
} from 'lucide-react';
import { PageLoading, ButtonLoading } from '@/components/ui/LoadingSpinner';

interface InventoryItem {
  id: string;
  masterProductId: string;
  branchId: string;
  stock: number;
  minThreshold: number;
  storageLocation?: string;
  masterProduct: {
    id: string;
    name: string;
    category: string;
    baseUnit: string;
    usageUnit: string;
    conversionFactor: number;
  };
  stockInfo: {
    baseStock: number;
    baseUnit: string;
    usageStock: number;
    usageUnit: string;
    minThresholdBase: number;
    minThresholdUsage: number;
    isLowStock: boolean;
    displayText: string;
    displayShort: string;
  };
}

interface Branch {
  id: string;
  branchCode: string;
  name: string;
  type: string;
}

function toFiniteNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeInventoryItem(item: InventoryItem): InventoryItem {
  return {
    ...item,
    stock: toFiniteNumber(item.stock),
    minThreshold: toFiniteNumber(item.minThreshold),
    masterProduct: {
      ...item.masterProduct,
      conversionFactor: toFiniteNumber(item.masterProduct.conversionFactor),
    },
    stockInfo: {
      ...item.stockInfo,
      baseStock: toFiniteNumber(item.stockInfo.baseStock),
      usageStock: toFiniteNumber(item.stockInfo.usageStock),
      minThresholdBase: toFiniteNumber(item.stockInfo.minThresholdBase),
      minThresholdUsage: toFiniteNumber(item.stockInfo.minThresholdUsage),
    },
  };
}

export default function InventoryPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'LOW_STOCK'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  // Branch selector for Super Admin and Admin Manager
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [loadingBranches, setLoadingBranches] = useState(false);
  
  // Edit stock modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustment, setAdjustment] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [reason, setReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [conversionFactor, setConversionFactor] = useState('');

  // Check if user can access stock requests and shipments
  const canAccessStockRequests = user?.role && ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'].includes(user.role);
  
  const canEditStock = user?.role === 'SUPER_ADMIN';
  
  // Check if user can select branches (Super Admin or Admin Manager)
  const canSelectBranch = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch branches for Super Admin and Admin Manager
  const fetchBranches = useCallback(async () => {
    if (!canSelectBranch || !accessToken) return;
    
    try {
      setLoadingBranches(true);
      const response = await api.get('/branches', {
        params: { isActive: true, limit: 100 },
      });
      const branchesData = response.data?.data || [];
      setBranches(branchesData);
      
      if (user?.branchId) {
        setSelectedBranchId(user.branchId);
      } else if (branchesData.length > 0) {
        setSelectedBranchId(branchesData[0].id);
      }
    } catch (error) {
      devError('Failed to fetch branches:', error);
    } finally {
      setLoadingBranches(false);
    }
  }, [canSelectBranch, accessToken, user?.branchId]);

  useEffect(() => {
    if (!mounted) return;
    
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    
    if (canSelectBranch) {
      fetchBranches();
    } else {
      if (user.branchId) {
        setSelectedBranchId(user.branchId);
      }
    }
  }, [mounted, user, accessToken, canSelectBranch, fetchBranches]);

  useEffect(() => {
    if (selectedBranchId && accessToken) {
      fetchInventoryItems(selectedBranchId);
    }
  }, [selectedBranchId, accessToken]);

  const fetchInventoryItems = async (branchId: string) => {
    try {
      setLoading(true);
      
      if (!accessToken) {
        showToast.error('Token tidak ditemukan. Silakan login kembali.');
        router.push('/login');
        return;
      }

      if (!branchId) {
        showToast.error('Pilih cabang terlebih dahulu.');
        return;
      }

      const response = await inventoryApi.getAvailableItems(branchId);
      const inventoryItems = (response.data.data || []) as InventoryItem[];
      setItems(inventoryItems.map(normalizeInventoryItem));
    } catch (error) {
      showToast.error('Gagal memuat data inventori');
      devError('Inventory fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      if (!accessToken) {
        showToast.error('Token tidak ditemukan. Silakan login kembali.');
        return;
      }

      const loadingToast = showToast.loading(`Mengunduh file ${format.toUpperCase()}...`);

      const endpoint = format === 'csv' ? '/api/inventory/export/csv' : '/api/inventory/export/excel';
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        showToast.dismiss(loadingToast);
        throw new Error(`HTTP ${response.status}`);
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `inventori-${Date.now()}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) filename = filenameMatch[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast.dismiss(loadingToast);
      showToast.success(`File ${format.toUpperCase()} berhasil diunduh!`);
    } catch (error) {
      showToast.error(`Gagal mengunduh file ${format.toUpperCase()}`);
      devError('Export error:', error);
    }
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    if (!canEditStock) {
      showToast.error('Hanya Super Admin yang dapat mengedit stok secara langsung');
      return;
    }

    setSelectedItem(item);
    setAdjustment('');
    setUnitCost('');
    setReason('');
    setConversionFactor(item.masterProduct.conversionFactor.toString());
    setEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setSelectedItem(null);
    setAdjustment('');
    setUnitCost('');
    setReason('');
    setConversionFactor('');
  };

  const handleAdjustStock = async () => {
    if (!selectedItem) return;

    const adjustmentNum = parseFloat(adjustment);
    if (isNaN(adjustmentNum) || adjustmentNum === 0) {
      showToast.error('Masukkan jumlah penyesuaian yang valid');
      return;
    }

    if (!reason.trim()) {
      showToast.error('Alasan penyesuaian harus diisi');
      return;
    }

    const unitCostNum = parseFloat(unitCost);
    if (isNaN(unitCostNum) || unitCostNum <= 0) {
      showToast.error('Harga pokok per satuan harus lebih dari 0');
      return;
    }

    const stockAfter = selectedItem.stockInfo.baseStock + adjustmentNum;

    if (stockAfter < 0) {
      showToast.error('Stok setelah penyesuaian tidak boleh negatif');
      return;
    }

    const hasSeparateUsageUnit = selectedItem.stockInfo.baseUnit !== selectedItem.stockInfo.usageUnit;
    const conversionFactorNum = hasSeparateUsageUnit ? parseFloat(conversionFactor) : selectedItem.masterProduct.conversionFactor;
    const hasConversionChange = hasSeparateUsageUnit && conversionFactorNum !== selectedItem.masterProduct.conversionFactor;
    
    if (hasConversionChange && (isNaN(conversionFactorNum) || conversionFactorNum <= 0)) {
      showToast.error('Faktor konversi harus berupa angka positif');
      return;
    }

    try {
      setAdjusting(true);
      
      if (hasConversionChange) {
        await api.patch(`/inventory/master-products/${selectedItem.masterProductId}`, {
          conversionFactor: conversionFactorNum,
        });
      }
      
      await inventoryApi.adjustStock(selectedItem.id, {
        idempotencyKey: crypto.randomUUID(),
        adjustment: adjustmentNum,
        unitCost: unitCostNum,
        notes: reason.trim(),
      });

      showToast.success('Stok berhasil disesuaikan');
      handleCloseEditModal();
      fetchInventoryItems(selectedBranchId);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 'Gagal menyesuaikan stok';
      showToast.error(errorMessage);
      devError('Adjust stock error:', error);
    } finally {
      setAdjusting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesFilter = filter === 'ALL' || (filter === 'LOW_STOCK' && item.stockInfo.isLowStock);
    const matchesSearch =
      item.masterProduct.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.masterProduct.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, { icon: string; color: string; bg: string }> = {
      MEDICINE: { icon: '💊', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-500/20' },
      DEVICE: { icon: '🔧', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/20' },
      CONSUMABLE: { icon: '📦', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20' },
    };
    return icons[category] || icons.CONSUMABLE;
  };

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      MEDICINE: 'OBAT',
      DEVICE: 'ALAT',
      CONSUMABLE: 'KONSUMABEL',
    };
    return names[category] || category;
  };

  // Calculate statistics
  const totalItems = items.length;
  const lowStockItems = items.filter((i) => i.stockInfo.isLowStock).length;
  const normalStockItems = totalItems - lowStockItems;

  if (!mounted) return null;

  // Edit Stock Modal
    const EditStockModal = () => {
    if (!editModalOpen || !selectedItem) return null;

    const adjustmentNum = parseFloat(adjustment);
    const hasValidAdjustment = !isNaN(adjustmentNum) && adjustmentNum !== 0;
    const stockAfter = hasValidAdjustment ? selectedItem.stockInfo.baseStock + adjustmentNum : selectedItem.stockInfo.baseStock;
    const wouldBeNegative = hasValidAdjustment && stockAfter < 0;
    const hasSeparateUsageUnit = selectedItem.stockInfo.baseUnit !== selectedItem.stockInfo.usageUnit;
    const conversionFactorNum = parseFloat(conversionFactor);
    const conversionInvalid = hasSeparateUsageUnit && (isNaN(conversionFactorNum) || conversionFactorNum <= 0);
    const unitCostNum = parseFloat(unitCost);
    const unitCostInvalid = isNaN(unitCostNum) || unitCostNum <= 0;

    const modalContent = (
      <div className="fixed inset-0 z-[9999] overflow-hidden">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleCloseEditModal} />
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/30">
                  <Edit3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Edit Stok</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">{selectedItem.masterProduct.name}</p>
                </div>
              </div>
              <button onClick={handleCloseEditModal} className="rounded-xl p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Current Stock Info */}
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Stok Saat Ini</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {selectedItem.stockInfo.baseStock.toFixed(2)} {selectedItem.stockInfo.baseUnit}
                </p>
                {selectedItem.stockInfo.baseUnit !== selectedItem.stockInfo.usageUnit && (
                  <p className="text-sm text-blue-600 dark:text-blue-400/80">
                    ({selectedItem.stockInfo.usageStock.toFixed(0)} {selectedItem.stockInfo.usageUnit})
                  </p>
                )}
              </div>

              {hasSeparateUsageUnit ? (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    Konversi (1 {selectedItem.stockInfo.baseUnit} = {conversionFactor || '?'} {selectedItem.stockInfo.usageUnit})
                  </label>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={conversionFactor}
                    onChange={(e) => setConversionFactor(e.target.value)}
                    className={`w-full px-4 py-3 text-sm rounded-xl border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${
                      conversionInvalid
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-neutral-300 dark:border-neutral-600 focus:ring-blue-500'
                    }`}
                  />
                  {conversionInvalid && (
                    <p className="text-xs font-medium text-red-500">Faktor konversi harus lebih dari 0</p>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">Satuan Stok</p>
                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    Produk ini memakai satuan yang sama: {selectedItem.stockInfo.baseUnit}
                  </p>
                </div>
              )}

              {/* Stock Adjustment */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Penyesuaian Stok ({selectedItem.stockInfo.baseUnit}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                  placeholder="Contoh: 10 untuk tambah, -5 untuk kurang"
                  className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Harga Pokok per {selectedItem.stockInfo.baseUnit} (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="Contoh: 25000"
                  className={`w-full px-4 py-3 text-sm rounded-xl border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 transition-all ${
                    unitCost && unitCostInvalid
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-neutral-300 dark:border-neutral-600 focus:ring-blue-500'
                  }`}
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Digunakan untuk valuasi persediaan dan jurnal penyesuaian.
                </p>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Catatan / Alasan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Koreksi stok fisik, Barang rusak, dll"
                  rows={3}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                />
              </div>

              {/* Live Preview */}
              {hasValidAdjustment && (
                <div className={`p-4 rounded-xl border ${
                  wouldBeNegative
                    ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
                    : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                }`}>
                  <p className={`text-xs font-semibold mb-1 ${
                    wouldBeNegative
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>Preview Stok Setelah Penyesuaian:</p>
                  <p className={`text-xl font-bold ${
                    wouldBeNegative
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {stockAfter.toFixed(2)} {selectedItem.stockInfo.baseUnit}
                  </p>
                  {wouldBeNegative && (
                    <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                      Stok tidak boleh kurang dari 0. Maksimal pengurangan: -{selectedItem.stockInfo.baseStock.toFixed(2)} {selectedItem.stockInfo.baseUnit}.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={handleCloseEditModal}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleAdjustStock}
                disabled={adjusting || !hasValidAdjustment || !reason.trim() || unitCostInvalid || wouldBeNegative || conversionInvalid}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {adjusting ? (
                  <ButtonLoading text="Menyimpan" />
                ) : (
                  <><Save className="h-4 w-4" /> Simpan Perubahan</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  };

  return (
    <>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
                <Package className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Inventori Stok</h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Kelola dan monitor stok barang {canSelectBranch ? '' : 'di cabang Anda'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Branch Selector */}
              {canSelectBranch && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-neutral-500" />
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={loadingBranches}
                    className="px-4 py-2.5 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all min-w-[200px]"
                  >
                    {loadingBranches ? (
                      <option>Memuat cabang...</option>
                    ) : branches.length === 0 ? (
                      <option value="">Tidak ada cabang</option>
                    ) : (
                      branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} ({branch.branchCode})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              {canAccessStockRequests && (
                <>
                  <button
                    onClick={() => router.push('/inventory/stock-requests')}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Request Stok
                  </button>
                  <button
                    onClick={() => router.push('/inventory/shipments')}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
                  >
                    <Truck className="h-4 w-4" />
                    Pengiriman
                  </button>
                  <button
                    onClick={() => router.push('/inventory/overstock')}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                  >
                    <Package className="h-4 w-4" />
                    Overstock
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-1">
                ⚠️ Perhatian Penting
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                Jika terjadi perubahan stok atau kesalahan input, segera hubungi <span className="font-bold">Admin Manager</span> untuk verifikasi dan perbaikan data.
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 shadow-lg shadow-purple-500/30">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Item</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{totalItems}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-red-600 shadow-lg shadow-red-500/30">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Stok Rendah</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{lowStockItems}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-green-500/30">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Stok Normal</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{normalStockItems}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 border border-neutral-200 dark:border-neutral-800 shadow-sm mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Cari produk..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-neutral-700 transition-all"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                  filter === 'ALL'
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                Semua ({items.length})
              </button>
              <button
                onClick={() => setFilter('LOW_STOCK')}
                className={`px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                  filter === 'LOW_STOCK'
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                Stok Rendah ({lowStockItems})
              </button>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
              >
                <FileText className="h-4 w-4" />
                CSV
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <PageLoading text="Memuat data inventori" />
        ) : !selectedBranchId && canSelectBranch ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-4">
              <Building2 className="h-8 w-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Pilih Cabang</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Pilih cabang terlebih dahulu untuk melihat data inventori</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-4">
              <Package className="h-8 w-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
              {searchTerm ? 'Tidak Ditemukan' : 'Belum Ada Item'}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              {searchTerm
                ? `Tidak ada item yang cocok dengan pencarian "${searchTerm}"`
                : 'Belum ada item inventori yang terdaftar di cabang ini'}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-all"
              >
                Reset Pencarian
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                        Produk
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                        Kategori
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                        Stok
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                        Konversi
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {filteredItems.map((item) => {
                      const categoryStyle = getCategoryIcon(item.masterProduct.category);
                      return (
                        <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${categoryStyle.bg} text-lg flex-shrink-0`}>
                                {categoryStyle.icon}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-neutral-900 dark:text-white">
                                  {item.masterProduct.name}
                                </div>
                                {item.storageLocation && (
                                  <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                    <MapPin className="h-3 w-3" />
                                    {item.storageLocation}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-neutral-700 dark:text-neutral-300">
                              {getCategoryName(item.masterProduct.category)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className={`font-bold ${item.stockInfo.isLowStock ? 'text-red-600 dark:text-red-400' : 'text-neutral-900 dark:text-white'}`}>
                                {item.stockInfo.baseStock.toFixed(2)} {item.stockInfo.baseUnit}
                              </div>
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                ({item.stockInfo.usageStock.toFixed(0)} {item.stockInfo.usageUnit})
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs text-neutral-600 dark:text-neutral-400">
                              1 {item.stockInfo.baseUnit} = {item.masterProduct.conversionFactor} {item.stockInfo.usageUnit}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.stockInfo.isLowStock ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30">
                                <AlertTriangle className="h-3 w-3" />
                                Rendah
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                                <CheckCircle2 className="h-3 w-3" />
                                Normal
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              {item.stockInfo.isLowStock && canAccessStockRequests && (
                                <button
                                  onClick={() => router.push('/inventory/stock-requests')}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-all"
                                >
                                  <ShoppingCart className="h-3.5 w-3.5" />
                                  Request
                                </button>
                              )}
                              {canEditStock && (
                                <button
                                  onClick={() => handleOpenEditModal(item)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredItems.map((item) => {
                const categoryStyle = getCategoryIcon(item.masterProduct.category);
                return (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-neutral-900 rounded-2xl border shadow-sm overflow-hidden transition-all ${
                      item.stockInfo.isLowStock
                        ? 'border-red-200 dark:border-red-500/30'
                        : 'border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="p-4 flex items-start gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${categoryStyle.bg} text-xl flex-shrink-0`}>
                        {categoryStyle.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-neutral-900 dark:text-white">{item.masterProduct.name}</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">{getCategoryName(item.masterProduct.category)}</p>
                      </div>
                      {item.stockInfo.isLowStock ? (
                        <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          Rendah
                        </span>
                      ) : (
                        <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Normal
                        </span>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">Stok Saat Ini</span>
                        <div className="text-right">
                          <span className={`text-lg font-bold ${item.stockInfo.isLowStock ? 'text-red-600 dark:text-red-400' : 'text-neutral-900 dark:text-white'}`}>
                            {item.stockInfo.baseStock.toFixed(2)} {item.stockInfo.baseUnit}
                          </span>
                          <span className="text-xs text-neutral-400 dark:text-neutral-500 ml-1">
                            ({item.stockInfo.usageStock.toFixed(0)} {item.stockInfo.usageUnit})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">Konversi</span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          1 {item.stockInfo.baseUnit} = {item.masterProduct.conversionFactor} {item.stockInfo.usageUnit}
                        </span>
                      </div>

                      {item.storageLocation && (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                          <MapPin className="h-3 w-3" />
                          {item.storageLocation}
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    {(item.stockInfo.isLowStock && canAccessStockRequests) || canEditStock ? (
                      <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
                        {item.stockInfo.isLowStock && canAccessStockRequests && (
                          <button
                            onClick={() => router.push('/inventory/stock-requests')}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-all"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            Request Stok
                          </button>
                        )}
                        {canEditStock && (
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit Stok
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Edit Stock Modal */}
      <EditStockModal />
    </>
  );
}
