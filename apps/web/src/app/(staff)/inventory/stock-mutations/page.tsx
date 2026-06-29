'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { doctorBranchApi } from '@/lib/api/doctorBranchApi';
import { useAuthStore } from '@/stores/authStore';
import { Package, ArrowRight, Calendar, Building2, TrendingUp, Filter as FilterIcon, AlertTriangle } from 'lucide-react';
import { PageLoading } from '@/components/ui/LoadingSpinner';

type ShipmentStatus = 'PREPARING' | 'SHIPPED' | 'RECEIVED' | 'RECEIVED_WITH_ISSUE' | 'APPROVED';

interface TransferShipment {
  id: string;
  shipmentCode: string;
  fromBranchId: string;
  fromBranchName: string;
  fromBranchCode?: string;
  toBranchId: string;
  toBranchName: string;
  toBranchCode?: string;
  status: ShipmentStatus | string;
  shippedAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    productCategory?: string;
    sentQty: number;
    receivedQty?: number | null;
    stockBefore?: number | null;
    stockAfter?: number | null;
    unit: string;
  }>;
  stockRequest?: {
    requestCode?: string;
  } | null;
}

interface ManagedBranch {
  branchId: string;
  branchName: string;
  branchCode: string;
}

const STATUS_LABELS: Record<string, string> = {
  PREPARING: 'Disiapkan',
  SHIPPED: 'Dikirim',
  RECEIVED: 'Diterima',
  RECEIVED_WITH_ISSUE: 'Diterima Bermasalah',
  APPROVED: 'Disetujui',
};

const STATUS_COLORS: Record<string, string> = {
  PREPARING: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  SHIPPED: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
  RECEIVED: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30',
  RECEIVED_WITH_ISSUE: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/30',
  APPROVED: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
};

const FALLBACK_STATUS_COLOR = 'bg-neutral-100 dark:bg-neutral-500/20 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-500/30';

export default function BranchTransfersPage() {
  const { user, accessToken } = useAuthStore();
  const [shipments, setShipments] = useState<TransferShipment[]>([]);
  const [branches, setBranches] = useState<ManagedBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isAdminManager = user?.role === 'ADMIN_MANAGER';

  const fetchBranches = useCallback(async () => {
    if (!isAdminManager) {
      setBranches([]);
      return;
    }

    try {
      const response = await doctorBranchApi.getManagedBranches(false);
      const payload = response as any;
      const data = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      setBranches(data);
    } catch (error) {
      console.error('Error fetching managed branches:', error);
      setBranches([]);
    }
  }, [isAdminManager]);

  const fetchShipments = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: {
        branchId?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
      } = {};

      if (branchFilter) params.branchId = branchFilter;
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await inventoryApi.getShipments(params);
      const body = response.data as any;
      const payload = body?.data ?? body;
      const data = Array.isArray(payload?.shipments)
        ? payload.shipments
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : [];

      setShipments(data);
    } catch (err) {
      console.error('Failed to load stock transfers:', err);
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, branchFilter, statusFilter, startDate, endDate]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const pageSubtitle = isAdminManager
    ? 'Lihat transfer barang pada cabang yang Anda kelola'
    : 'Lihat semua transfer barang antar cabang';

  const statusOptions = useMemo(
    () => [
      { value: '', label: 'Semua Status' },
      { value: 'PREPARING', label: 'Disiapkan' },
      { value: 'SHIPPED', label: 'Dikirim' },
      { value: 'RECEIVED', label: 'Diterima' },
      { value: 'RECEIVED_WITH_ISSUE', label: 'Diterima Bermasalah' },
    ],
    []
  );

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTotalItems = (shipment: TransferShipment) => (
    shipment.items.reduce((sum, item) => sum + Number(item.sentQty || 0), 0)
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-6">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/30">
            <Package className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Mutasi Transfer Stok</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{pageSubtitle}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {isAdminManager && branches.length > 0 && (
              <div className="relative min-w-[200px]">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Semua Cabang</option>
                  {branches.map((branch) => (
                    <option key={branch.branchId} value={branch.branchId}>
                      {branch.branchName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative min-w-[190px]">
              <FilterIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all appearance-none cursor-pointer"
              >
                {statusOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-auto pl-10 pr-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
              </div>
              <span className="hidden sm:block text-neutral-400 text-sm">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-auto px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>
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

      {loading ? (
        <PageLoading text="Memuat data transfer" />
      ) : shipments.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-20 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
              <Package className="h-8 w-8 text-neutral-400" />
            </div>
            <div>
              <p className="text-neutral-900 dark:text-white font-semibold">Tidak ada data transfer</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Belum ada transfer barang yang sesuai dengan filter.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {shipments.map((shipment) => (
            <div
              key={shipment.id}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-500/20 dark:to-blue-600/20">
                    <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-neutral-900 dark:text-white truncate">{shipment.shipmentCode}</h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Dibuat: {formatDate(shipment.createdAt)}
                      {shipment.stockRequest?.requestCode ? ` - ${shipment.stockRequest.requestCode}` : ''}
                    </p>
                  </div>
                </div>
                <span className={`w-fit inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${STATUS_COLORS[shipment.status] || FALLBACK_STATUS_COLOR}`}>
                  {STATUS_LABELS[shipment.status] || shipment.status}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-neutral-400" />
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Dari</span>
                  </div>
                  <p className="font-semibold text-neutral-900 dark:text-white truncate">{shipment.fromBranchName}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{shipment.fromBranchCode || shipment.fromBranchId}</p>
                </div>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20 self-center">
                  <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400 rotate-90 sm:rotate-0" />
                </div>

                <div className="flex-1 min-w-0 sm:text-right">
                  <div className="flex items-center gap-2 mb-1 sm:justify-end">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Ke</span>
                    <Building2 className="h-4 w-4 text-neutral-400" />
                  </div>
                  <p className="font-semibold text-neutral-900 dark:text-white truncate">{shipment.toBranchName}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{shipment.toBranchCode || shipment.toBranchId}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Item yang Ditransfer ({shipment.items.length} item)</span>
                </div>
                {shipment.items.slice(0, 3).map((item) => {
                  const hasReceived = item.receivedQty !== undefined && item.receivedQty !== null;
                  const hasDifference = hasReceived && item.receivedQty !== item.sentQty;
                  
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700"
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 dark:text-white truncate">{item.productName}</p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.productCategory || '-'}</p>
                        </div>
                      </div>
                      
                      {/* Mutasi Stok */}
                      <div className="mt-3 space-y-2">
                        {/* Stok Sebelum dan Sesudah (jika sudah diterima dan ada data) */}
                        {hasReceived && item.stockBefore !== null && item.stockBefore !== undefined && (
                          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 border border-violet-200 dark:border-violet-500/30">
                            <div className="text-center">
                              <p className="text-xs text-violet-600 dark:text-violet-400 mb-1">Stok Sebelum</p>
                              <p className="text-base font-bold text-violet-700 dark:text-violet-300">
                                {item.stockBefore} <span className="text-xs font-normal">{item.unit}</span>
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Penambahan</p>
                              <p className="text-base font-bold text-blue-700 dark:text-blue-300">
                                +{item.receivedQty} <span className="text-xs font-normal">{item.unit}</span>
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Stok Sesudah</p>
                              <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                                {item.stockAfter} <span className="text-xs font-normal">{item.unit}</span>
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {/* Jumlah Penambahan (fallback jika tidak ada data stok sebelum/sesudah) */}
                        {(!hasReceived || item.stockBefore === null || item.stockBefore === undefined) && (
                          <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                              {hasReceived ? 'Jumlah Diterima' : 'Jumlah Akan Ditambahkan'}
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                                +{hasReceived ? item.receivedQty : item.sentQty}
                              </span>
                              <span className="text-xs text-blue-500 dark:text-blue-400">{item.unit}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Status Detail */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded bg-neutral-100 dark:bg-neutral-800">
                            <p className="text-neutral-500 dark:text-neutral-400 mb-0.5">Dikirim dari cabang</p>
                            <p className="font-semibold text-neutral-900 dark:text-white">{item.sentQty} {item.unit}</p>
                          </div>
                          {hasReceived ? (
                            <div className={`p-2 rounded ${hasDifference ? 'bg-orange-50 dark:bg-orange-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}>
                              <p className="text-neutral-500 dark:text-neutral-400 mb-0.5">Diterima di cabang</p>
                              <p className={`font-semibold ${hasDifference ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {item.receivedQty} {item.unit}
                              </p>
                            </div>
                          ) : (
                            <div className="p-2 rounded bg-neutral-100 dark:bg-neutral-800">
                              <p className="text-neutral-500 dark:text-neutral-400 mb-0.5">Status</p>
                              <p className="font-semibold text-neutral-500 dark:text-neutral-400">Dalam perjalanan</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Catatan Selisih */}
                        {hasDifference && (
                          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-orange-600 dark:text-orange-400">⚠️ Ada Selisih</span>
                              <span className={`text-xs font-bold ${(item.receivedQty || 0) - item.sentQty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {(item.receivedQty || 0) - item.sentQty > 0 ? '+' : ''}
                                {(item.receivedQty || 0) - item.sentQty} {item.unit}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {shipment.items.length > 3 && (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-2">
                    + {shipment.items.length - 3} item lainnya
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                  <Package className="h-4 w-4" />
                  <span>
                    Total: <strong className="text-neutral-900 dark:text-white">{getTotalItems(shipment)}</strong> unit
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {shipment.shippedAt && <span>Dikirim: {formatDate(shipment.shippedAt)}</span>}
                  {shipment.receivedAt && <span>Diterima: {formatDate(shipment.receivedAt)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
