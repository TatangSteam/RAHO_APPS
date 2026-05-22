'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Check, RefreshCw, Trash2, Package, Search, Filter, AlertTriangle, Info, Truck, Clock } from 'lucide-react';
import { MasterProduct, RequestItem } from '../types';
import { inventoryApi, OverstockPreviewItem } from '@/lib/api/inventoryApi';
import { useAuthStore } from '@/stores/authStore';

interface PendingInfo {
  hasPendingShipments: boolean;
  hasPendingRequests: boolean;
  pendingShipments: Array<{ shipmentCode: string; status: string }>;
  pendingRequests: Array<{ requestCode: string; status: string }>;
}

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems: MasterProduct[];
  onCreateRequest: (items: RequestItem[], notes: string) => Promise<void>;
  onRefreshInventory: () => void;
  loading: boolean;
}

export default function CreateRequestModal({
  isOpen,
  onClose,
  inventoryItems,
  onCreateRequest,
  onRefreshInventory,
  loading
}: CreateRequestModalProps) {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [filteredItems, setFilteredItems] = useState<MasterProduct[]>([]);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [requestNotes, setRequestNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [touched, setTouched] = useState(false);
  const [overstockPreview, setOverstockPreview] = useState<OverstockPreviewItem[]>([]);
  const [loadingOverstock, setLoadingOverstock] = useState(false);
  const [pendingInfo, setPendingInfo] = useState<PendingInfo | null>(null);
  const [loadingPendingInfo, setLoadingPendingInfo] = useState(false);

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Fetch pending shipments and requests when modal opens
  useEffect(() => {
    const fetchPendingInfo = async () => {
      if (!isOpen || !user?.branchId) return;
      
      try {
        setLoadingPendingInfo(true);
        
        // Fetch pending shipments
        const shipmentsResponse = await inventoryApi.getShipments({ status: 'PREPARING' });
        const shippedResponse = await inventoryApi.getShipments({ status: 'SHIPPED' });
        
        let pendingShipments: Array<{ shipmentCode: string; status: string }> = [];
        
        // Extract shipments for this branch
        const extractShipments = (response: any) => {
          const data = response.data?.data;
          if (Array.isArray(data)) {
            return data
              .filter((s: any) => s.toBranchId === user.branchId)
              .map((s: any) => ({ shipmentCode: s.shipmentCode, status: s.status }));
          }
          return [];
        };
        
        pendingShipments = [
          ...extractShipments(shipmentsResponse),
          ...extractShipments(shippedResponse),
        ];
        
        // Fetch pending requests
        const requestsResponse = await inventoryApi.getStockRequests({});
        let pendingRequests: Array<{ requestCode: string; status: string }> = [];
        
        const requestsData = requestsResponse.data?.data;
        if (Array.isArray(requestsData)) {
          pendingRequests = requestsData
            .filter((r: any) => 
              r.branchId === user.branchId && 
              ['PENDING', 'WAITING_PAYMENT', 'PAYMENT_UPLOADED', 'APPROVED', 'SHIPPED'].includes(r.status)
            )
            .map((r: any) => ({ requestCode: r.requestCode, status: r.status }));
        }
        
        setPendingInfo({
          hasPendingShipments: pendingShipments.length > 0,
          hasPendingRequests: pendingRequests.length > 0,
          pendingShipments,
          pendingRequests,
        });
      } catch (error) {
        console.error('Failed to fetch pending info:', error);
        setPendingInfo(null);
      } finally {
        setLoadingPendingInfo(false);
      }
    };
    
    fetchPendingInfo();
  }, [isOpen, user?.branchId]);

  // Filter items
  useEffect(() => {
    let filtered = inventoryItems.filter(item => item.isActive);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }

    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    setFilteredItems(filtered);
  }, [inventoryItems, searchQuery, categoryFilter]);

  // Fetch overstock preview when items change
  useEffect(() => {
    const fetchOverstockPreview = async () => {
      if (!user?.branchId || requestItems.length === 0) {
        setOverstockPreview([]);
        return;
      }

      try {
        setLoadingOverstock(true);
        const items = requestItems.map(item => ({
          masterProductId: item.masterProductId,
          requestedQty: item.requestedQty,
        }));
        
        const response = await inventoryApi.previewOverstockDeduction(user.branchId, items);
        if (response.data?.data) {
          setOverstockPreview(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch overstock preview:', error);
        setOverstockPreview([]);
      } finally {
        setLoadingOverstock(false);
      }
    };

    // Debounce the fetch
    const timeoutId = setTimeout(fetchOverstockPreview, 500);
    return () => clearTimeout(timeoutId);
  }, [requestItems, user?.branchId]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const getCategories = useCallback(() => {
    const categories = Array.from(new Set(inventoryItems.map(item => item.category)));
    return categories.sort();
  }, [inventoryItems]);

  const addRequestItem = (item: MasterProduct) => {
    if (requestItems.some(ri => ri.masterProductId === item.id)) return;

    let defaultQty = 10;
    const unit = item.baseUnit.toLowerCase();
    if (unit.includes('ml') || unit.includes('liter')) defaultQty = 100;
    else if (unit.includes('box') || unit.includes('pack')) defaultQty = 1;

    setRequestItems(prev => [...prev, {
      masterProductId: item.id,
      productName: item.name,
      requestedQty: defaultQty,
      unit: item.baseUnit,
      notes: '',
    }]);
  };

  const updateRequestItem = (masterProductId: string, field: keyof RequestItem, value: string | number) => {
    setRequestItems(prev => prev.map(item => {
      if (item.masterProductId === masterProductId) {
        if (field === 'requestedQty') {
          return { ...item, [field]: Math.max(1, Number(value)) };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const removeRequestItem = (masterProductId: string) => {
    setRequestItems(prev => prev.filter(item => item.masterProductId !== masterProductId));
  };

  const resetForm = () => {
    setRequestItems([]);
    setRequestNotes('');
    setSearchQuery('');
    setCategoryFilter('ALL');
    setTouched(false);
    setOverstockPreview([]);
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (requestItems.length === 0 || !requestNotes.trim()) return;
    await onCreateRequest(requestItems, requestNotes);
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isFormValid = requestItems.length > 0 && requestNotes.trim() !== '';

  // Get overstock info for a specific item
  const getOverstockInfo = (masterProductId: string): OverstockPreviewItem | undefined => {
    return overstockPreview.find(o => o.masterProductId === masterProductId);
  };

  // Check if any item has overstock deduction
  const hasOverstockDeductions = overstockPreview.some(o => o.deductedQty > 0);

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-6xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl transform transition-all max-h-[90vh] flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 id="modal-title" className="text-xl font-bold text-neutral-900 dark:text-white">
                  Buat Request Stok Baru
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Pilih produk dan tentukan jumlah yang dibutuhkan
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
            {/* Pending Warning Banner */}
            {(pendingInfo?.hasPendingShipments || pendingInfo?.hasPendingRequests) && (
              <div className="absolute top-20 left-0 right-0 z-10 mx-6 mt-2">
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-400 mb-2">
                        Tidak dapat membuat request baru
                      </p>
                      {pendingInfo?.hasPendingShipments && (
                        <div className="mb-2">
                          <p className="text-xs text-red-300 mb-1 flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            Pengiriman yang belum selesai:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {pendingInfo.pendingShipments.map((s, i) => (
                              <span key={i} className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-300">
                                {s.shipmentCode} ({s.status})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {pendingInfo?.hasPendingRequests && (
                        <div>
                          <p className="text-xs text-red-300 mb-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Request yang belum selesai:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {pendingInfo.pendingRequests.map((r, i) => (
                              <span key={i} className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-300">
                                {r.requestCode} ({r.status})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-red-300/70 mt-2">
                        Harap selesaikan pengiriman atau request yang ada terlebih dahulu.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Pending Info */}
            {loadingPendingInfo && (
              <div className="absolute top-20 left-0 right-0 z-10 mx-6 mt-2">
                <div className="p-4 rounded-xl bg-neutral-500/10 border border-neutral-500/30 flex items-center gap-3">
                  <RefreshCw className="h-4 w-4 text-neutral-400 animate-spin" />
                  <span className="text-sm text-neutral-400">Memeriksa status pengiriman...</span>
                </div>
              </div>
            )}

            {/* Left Panel - Product Selection */}
            <div className={`flex-1 flex flex-col p-6 border-b lg:border-b-0 lg:border-r border-neutral-200 dark:border-neutral-700 min-h-0 overflow-hidden ${(pendingInfo?.hasPendingShipments || pendingInfo?.hasPendingRequests) ? 'pt-32' : ''}`}>
              <div className="flex-shrink-0 mb-4">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-500" />
                  Pilih Produk
                </h3>

                {/* Search & Filter */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nama produk, SKU..."
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="pl-10 pr-8 py-2.5 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                    >
                      <option value="ALL">Semua Kategori</option>
                      {getCategories().map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">
                  Menampilkan {filteredItems.length} dari {inventoryItems.length} produk
                </p>
              </div>

              {/* Product List */}
              <div className="flex-1 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                {filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 px-4">
                    <div className="w-16 h-16 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center mb-4">
                      <Package className="w-8 h-8 text-neutral-400" />
                    </div>
                    {inventoryItems.length === 0 ? (
                      <>
                        <p className="text-neutral-600 dark:text-neutral-300 font-medium mb-2">Tidak ada produk tersedia</p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Klik tombol di bawah untuk memuat ulang</p>
                        <button
                          onClick={onRefreshInventory}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/25"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Muat Ulang
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-neutral-600 dark:text-neutral-300 font-medium">Tidak ada hasil</p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">Coba ubah kata kunci pencarian</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {filteredItems.map((item) => {
                      const isAdded = requestItems.some(ri => ri.masterProductId === item.id);
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-4 p-4 rounded-xl transition-all cursor-pointer ${
                            isAdded
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-500 shadow-sm'
                              : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md'
                          }`}
                          onClick={() => !isAdded && addRequestItem(item)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                              {item.category} • {item.baseUnit}
                              {item.sku && <span className="ml-1 text-neutral-400">• SKU: {item.sku}</span>}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isAdded) addRequestItem(item);
                            }}
                            disabled={isAdded}
                            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                              isAdded
                                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30'
                            }`}
                          >
                            {isAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                            {isAdded ? 'Ditambahkan' : 'Tambah'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Selected Items */}
            <div className="flex-1 flex flex-col p-6 min-h-0 overflow-hidden">
              <div className="flex-shrink-0 mb-4">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" />
                  Item yang Diminta
                  <span className="ml-2 inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                    {requestItems.length}
                  </span>
                </h3>
              </div>

              {/* Overstock Info Banner */}
              {hasOverstockDeductions && (
                <div className="flex-shrink-0 mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-400">Overstock Tersedia</p>
                      <p className="text-xs text-emerald-400/80 mt-0.5">
                        Beberapa item memiliki overstock yang akan otomatis dikurangi dari jumlah request.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Selected Items List */}
              <div className="flex-1 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 mb-4">
                {requestItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 px-4">
                    <div className="w-16 h-16 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center mb-4">
                      <Package className="w-8 h-8 text-neutral-400" />
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-300 font-medium">Belum ada item dipilih</p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Pilih produk dari daftar di sebelah kiri</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-3">
                    {requestItems.map((item) => {
                      const overstockInfo = getOverstockInfo(item.masterProductId);
                      const hasOverstock = overstockInfo && overstockInfo.deductedQty > 0;

                      return (
                        <div
                          key={item.masterProductId}
                          className={`p-4 rounded-xl border shadow-sm ${
                            hasOverstock
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight">
                              {item.productName}
                            </h4>
                            <button
                              type="button"
                              onClick={() => removeRequestItem(item.masterProductId)}
                              className="flex-shrink-0 p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-3 mb-3">
                            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Jumlah:</label>
                            <input
                              type="number"
                              min="1"
                              value={item.requestedQty}
                              onChange={(e) => updateRequestItem(item.masterProductId, 'requestedQty', e.target.value)}
                              className="w-24 px-3 py-1.5 text-sm font-medium rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            />
                            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{item.unit}</span>
                          </div>

                          {/* Overstock Deduction Info */}
                          {hasOverstock && overstockInfo && (
                            <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                              <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                  Overstock: -{overstockInfo.deductedQty} {item.unit}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-neutral-500 dark:text-neutral-400">Jumlah final yang dikirim:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {overstockInfo.finalQty} {item.unit}
                                </span>
                              </div>
                            </div>
                          )}

                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => updateRequestItem(item.masterProductId, 'notes', e.target.value)}
                            placeholder="Catatan item (opsional)"
                            className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700/50 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Request Notes - Required */}
              <div className="flex-shrink-0">
                <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">
                  Keterangan Request <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="Jelaskan alasan atau keperluan request stok ini..."
                  rows={3}
                  className={`w-full px-4 py-3 text-sm rounded-xl border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none transition-all ${
                    touched && !requestNotes.trim()
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-neutral-300 dark:border-neutral-600'
                  }`}
                />
                {touched && !requestNotes.trim() && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
                    Keterangan wajib diisi
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-4 px-6 py-5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex-shrink-0">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              {requestItems.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{requestItems.length} item dipilih</span>
                  {hasOverstockDeductions && (
                    <span className="text-xs text-emerald-500">
                      {loadingOverstock ? (
                        <span className="flex items-center gap-1">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          Menghitung overstock...
                        </span>
                      ) : (
                        `Overstock akan dikurangi dari ${overstockPreview.filter(o => o.deductedQty > 0).length} item`
                      )}
                    </span>
                  )}
                </div>
              ) : (
                'Pilih minimal 1 item'
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !isFormValid || pendingInfo?.hasPendingShipments || pendingInfo?.hasPendingRequests}
                className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-all inline-flex items-center gap-2 ${
                  isFormValid && !pendingInfo?.hasPendingShipments && !pendingInfo?.hasPendingRequests
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/40'
                    : 'bg-neutral-300 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Membuat...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Buat Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at document body level
  return createPortal(modalContent, document.body);
}
