'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { inventoryApi, type Shipment, type ReceiveShipmentInput, type ShipShipmentInput, type ShipmentIssueDecision, type UpdateShipmentInput } from '@/lib/api/inventoryApi';
import { Truck, Package, RefreshCw, Calendar, Send, Inbox, AlertTriangle, FileText, ChevronRight, Edit3 } from 'lucide-react';
import { ShipModal, ReceiveModal, DetailModal, NotesModal, SendShortageModal, EditShipmentModal } from './components';
import { PageLoading } from '@/components/ui/LoadingSpinner';

type ShipmentStatus = 'ALL' | 'PREPARING' | 'SHIPPED' | 'RECEIVED' | 'RECEIVED_WITH_ISSUE';
type ShipmentQueryParams = NonNullable<Parameters<typeof inventoryApi.getShipments>[0]>;
type ApiErrorLike = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const STATUS_LABELS: Record<string, string> = {
  PREPARING: 'Sedang Disiapkan',
  SHIPPED: 'Dikirim',
  RECEIVED: 'Diterima',
  RECEIVED_WITH_ISSUE: 'Diterima (Ada Masalah)',
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as ApiErrorLike).response;
    if (typeof response?.data?.message === 'string') {
      return response.data.message;
    }
  }

  return fallback;
};

export default function ShipmentsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ShipmentStatus>('ALL');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [modalAction, setModalAction] = useState<'ship' | 'receive' | 'detail' | 'edit' | null>(null);
  const [issueReviewDecision, setIssueReviewDecision] = useState<ShipmentIssueDecision | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fetchShipments = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      setLoading(true);
      const params: ShipmentQueryParams = {};
      if (filter !== 'ALL') {
        params.status = filter;
      }

      const response = await inventoryApi.getShipments(params);
      const responseBody = response.data;
      
      let shipmentsData: Shipment[] = [];
      
      if (responseBody?.data) {
        if (Array.isArray(responseBody.data)) {
          shipmentsData = responseBody.data;
        } else if (responseBody.data.data && Array.isArray(responseBody.data.data)) {
          shipmentsData = responseBody.data.data;
        }
      }
      
      setShipments(shipmentsData);
    } catch (error: unknown) {
      devError('Shipments fetch error:', error);
      showToast.error('Gagal memuat pengiriman');
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    fetchShipments();
  }, [mounted, user, accessToken, router, fetchShipments]);

  const handleShip = async (data: ShipShipmentInput) => {
    if (!selectedShipment) return;
    
    try {
      setActionLoading(true);
      await inventoryApi.shipShipment(selectedShipment.id, data);
      
      // Check if there was overstock
      const hasOverstock = data.items?.some(item => item.overstockReason);
      if (hasOverstock) {
        showToast.success('Pengiriman berhasil dikirim dengan overstock');
      } else {
        showToast.success('Pengiriman berhasil dikirim');
      }
      
      closeModal();
      fetchShipments();
    } catch (error: unknown) {
      showToast.error(getApiErrorMessage(error, 'Gagal mengirim pengiriman'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceive = async (input: ReceiveShipmentInput) => {
    if (!selectedShipment) return;
    
    try {
      setActionLoading(true);
      await inventoryApi.receiveShipment(selectedShipment.id, input);
      const hasDiscrepancy = input.discrepancies && input.discrepancies.length > 0;
      showToast.success(hasDiscrepancy ? 'Pengiriman diterima dengan catatan ketidaksesuaian' : 'Pengiriman berhasil diterima');
      closeModal();
      fetchShipments();
    } catch (error: unknown) {
      showToast.error(getApiErrorMessage(error, 'Gagal menerima pengiriman'));
    } finally {
      setActionLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedShipment(null);
    setModalAction(null);
    setIssueReviewDecision(null);
    setDetailLoading(false);
  };

  const handleUpdateShipment = async (data: UpdateShipmentInput) => {
    if (!selectedShipment) return;

    try {
      setActionLoading(true);
      await inventoryApi.updateShipment(selectedShipment.id, data);
      showToast.success('Pengiriman berhasil diperbarui');
      closeModal();
      fetchShipments();
    } catch (error: unknown) {
      showToast.error(getApiErrorMessage(error, 'Gagal memperbarui pengiriman'));
    } finally {
      setActionLoading(false);
    }
  };

  const closeIssueReviewModal = () => {
    setIssueReviewDecision(null);
  };

  const openShipModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setModalAction('ship');
  };

  const openReceiveModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setModalAction('receive');
  };

  const openEditShipmentModal = async (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setModalAction('edit');
    setDetailLoading(true);

    try {
      const response = await inventoryApi.getShipmentById(shipment.id);
      const detail = response.data?.data?.data || response.data?.data;

      if (detail) {
        setSelectedShipment(detail as Shipment);
      }
    } catch (error: unknown) {
      showToast.error(getApiErrorMessage(error, 'Gagal memuat detail pengiriman'));
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetailModal = async (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setModalAction('detail');
    setDetailLoading(true);

    try {
      const response = await inventoryApi.getShipmentById(shipment.id);
      const detail = response.data?.data?.data || response.data?.data;

      if (detail) {
        setSelectedShipment(detail as Shipment);
      }
    } catch (error: unknown) {
      showToast.error(getApiErrorMessage(error, 'Gagal memuat detail pengiriman'));
    } finally {
      setDetailLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'PREPARING':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'SHIPPED':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'RECEIVED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'RECEIVED_WITH_ISSUE':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default:
        return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PREPARING':
        return <Package className="h-3.5 w-3.5" />;
      case 'SHIPPED':
        return <Truck className="h-3.5 w-3.5" />;
      case 'RECEIVED':
        return <Inbox className="h-3.5 w-3.5" />;
      case 'RECEIVED_WITH_ISSUE':
        return <AlertTriangle className="h-3.5 w-3.5" />;
      default:
        return <FileText className="h-3.5 w-3.5" />;
    }
  };

  const canShip = (shipment: Shipment) => 
    ['SUPER_ADMIN', 'ADMIN_MANAGER'].includes(user?.role || '') && 
    shipment.status === 'PREPARING';

  const canEditShipment = (shipment: Shipment) =>
    ['SUPER_ADMIN', 'ADMIN_MANAGER'].includes(user?.role || '') &&
    shipment.status === 'PREPARING';
    
  const canReceive = (shipment: Shipment) =>
    user?.role === 'ADMIN_CABANG' &&
    shipment.status === 'SHIPPED';

  const canReviewIssue = (shipment: Shipment) =>
    ['SUPER_ADMIN', 'ADMIN_MANAGER'].includes(user?.role || '') &&
    shipment.status === 'RECEIVED_WITH_ISSUE' &&
    !shipment.approvedAt;

  const openIssueReviewModal = async (decision: ShipmentIssueDecision) => {
    setIssueReviewDecision(decision);
  };

  const submitIssueReview = async (notes: string, shortageItems?: Array<{ masterProductId: string; quantity: number; unit?: string }>) => {
    if (!selectedShipment || !issueReviewDecision) return;

    try {
      setActionLoading(true);
      const response = await inventoryApi.reviewShipmentIssue(selectedShipment.id, {
        decision: issueReviewDecision,
        notes,
        shortageItems,
      });
      const message = response.data?.data?.message || 'Tindak lanjut pengiriman bermasalah berhasil disimpan';
      showToast.success(message);
      closeModal();
      fetchShipments();
    } catch (error: unknown) {
      showToast.error(getApiErrorMessage(error, 'Gagal memproses tindak lanjut pengiriman'));
    } finally {
      setActionLoading(false);
    }
  };

  const filterOptions: { value: ShipmentStatus; label: string; icon: React.ReactNode }[] = [
    { value: 'ALL', label: 'Semua', icon: <FileText className="h-4 w-4" /> },
    { value: 'PREPARING', label: 'Disiapkan', icon: <Package className="h-4 w-4" /> },
    { value: 'SHIPPED', label: 'Dikirim', icon: <Truck className="h-4 w-4" /> },
    { value: 'RECEIVED', label: 'Diterima', icon: <Inbox className="h-4 w-4" /> },
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatQuantity = (value: number) => {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  };

  const getTotalSentQty = (shipment: Shipment) => {
    return shipment.items.reduce((sum, item) => sum + Number(item.sentQty || 0), 0);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/30">
            <Truck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Pengiriman Stok
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Kelola pengiriman stok antar cabang
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-700 dark:text-red-300">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold">Penerima wajib merekam video saat membuka paket.</p>
            <p className="mt-1 text-sm leading-relaxed text-red-700/90 dark:text-red-200/90">
              Komplain tidak dapat diproses tanpa video unboxing. Jika ditemukan selisih, rusak, atau barang salah, segera hubungi Admin Manager dan Super Admin.
            </p>
          </div>
        </div>
      </div>

      {/* Warning Banner - Stock Changes */}
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

      {/* Filter Tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                filter === f.value
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-amber-400 dark:hover:border-amber-500'
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <PageLoading text="Memuat data pengiriman" />
      ) : shipments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-20 h-20 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center mb-6">
            <Truck className="h-10 w-10 text-neutral-400" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            Belum Ada Pengiriman
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-center mb-6 max-w-md">
            Belum ada pengiriman stok. Pengiriman akan muncul setelah request stok disetujui.
          </p>
          <button
            onClick={() => router.push('/inventory/stock-requests')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg shadow-amber-500/30"
          >
            <FileText className="h-5 w-5" />
            Lihat Request Stok
          </button>
        </div>
      ) : (
        <>
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] table-fixed">
              <colgroup>
                <col className="w-[190px]" />
                <col className="w-[230px]" />
                <col className="w-[170px]" />
                <col className="w-[260px]" />
                <col className="w-[110px]" />
                <col className="w-[190px]" />
                <col className="w-[210px]" />
                <col className="w-[190px]" />
              </colgroup>
              <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/70">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Kode</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Rute</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Status</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Item</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Total Qty</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Timeline</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Catatan</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {shipments.map((shipment) => {
                  const hasOverstock = shipment.items.some(item => item.overstockQty && item.overstockQty > 0);
                  const hasDiscrepancy = Boolean(
                    shipment.discrepancies?.length || shipment.hasDiscrepancies || shipment.discrepancyCount
                  );
                  const totalQty = getTotalSentQty(shipment);

                  return (
                    <tr
                      key={shipment.id}
                      onClick={() => openDetailModal(shipment)}
                      className="cursor-pointer transition-colors hover:bg-amber-50/60 dark:hover:bg-neutral-800/70"
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
                            <Truck className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-neutral-900 dark:text-white">
                              {shipment.shipmentCode}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              Dibuat {formatDate(shipment.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex min-w-0 items-center gap-2 text-sm">
                          <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">
                            {shipment.fromBranchName}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400" />
                          <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">
                            {shipment.toBranchName}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusBadgeClass(shipment.status)}`}>
                          {getStatusIcon(shipment.status)}
                          {STATUS_LABELS[shipment.status] || shipment.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="space-y-1.5">
                          {shipment.items.slice(0, 2).map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-800/70">
                              <span className="truncate text-neutral-800 dark:text-neutral-200">
                                {item.productName}
                              </span>
                              <span className="flex-shrink-0 font-semibold text-blue-500">
                                {formatQuantity(Number(item.sentQty))} {item.unit}
                              </span>
                            </div>
                          ))}
                          {shipment.items.length > 2 && (
                            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                              +{shipment.items.length - 2} item lainnya
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {hasOverstock && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-1 text-xs font-semibold text-purple-500">
                                <Package className="h-3 w-3" />
                                Overstock
                              </span>
                            )}
                            {hasDiscrepancy && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-500">
                                <AlertTriangle className="h-3 w-3" />
                                Masalah
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right align-top">
                        <div className="text-lg font-bold text-amber-500">
                          {formatQuantity(totalQty)}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {shipment.items.length} item
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Dibuat: {formatDate(shipment.createdAt)}</span>
                          </div>
                          {shipment.shippedAt && (
                            <div className="flex items-center gap-2 text-blue-500">
                              <Truck className="h-3.5 w-3.5" />
                              <span>Dikirim: {formatDate(shipment.shippedAt)}</span>
                            </div>
                          )}
                          {shipment.receivedAt && (
                            <div className="flex items-center gap-2 text-emerald-500">
                              <Inbox className="h-3.5 w-3.5" />
                              <span>Diterima: {formatDate(shipment.receivedAt)}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        {shipment.notes ? (
                          <p className="line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">
                            {shipment.notes}
                          </p>
                        ) : (
                          <span className="text-sm text-neutral-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap justify-end gap-2">
                          {canEditShipment(shipment) && (
                            <button
                              onClick={() => openEditShipmentModal(shipment)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          )}
                          {canShip(shipment) && (
                            <button
                              onClick={() => openShipModal(shipment)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-blue-600"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Kirim
                            </button>
                          )}
                          {canReceive(shipment) && (
                            <button
                              onClick={() => openReceiveModal(shipment)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-emerald-600"
                            >
                              <Inbox className="h-3.5 w-3.5" />
                              Terima
                            </button>
                          )}
                          <button
                            onClick={() => openDetailModal(shipment)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-all hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                          >
                            Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-neutral-200 px-5 py-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            Geser tabel ke samping untuk melihat seluruh kolom pada layar kecil.
          </div>
        </div>

        <div className="hidden">
          {shipments.map((shipment) => (
            <div
              key={shipment.id}
              onClick={() => openDetailModal(shipment)}
              className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-xl hover:border-amber-400 dark:hover:border-amber-500 transition-all cursor-pointer overflow-hidden group"
            >
              {/* Card Header */}
              <div className="p-5 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-neutral-900 dark:text-white truncate group-hover:text-amber-500 transition-colors">
                      {shipment.shipmentCode}
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-1">
                      {shipment.fromBranchName}
                      <ChevronRight className="h-3 w-3" />
                      {shipment.toBranchName}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(shipment.status)}`}>
                    {getStatusIcon(shipment.status)}
                    {STATUS_LABELS[shipment.status] || shipment.status}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-4">
                {/* Timeline */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                      <Calendar className="h-4 w-4" />
                      Dibuat:
                    </span>
                    <span className="font-medium text-neutral-700 dark:text-neutral-200">
                      {formatDate(shipment.createdAt)}
                    </span>
                  </div>
                  {shipment.shippedAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-blue-500">
                        <Truck className="h-4 w-4" />
                        Dikirim:
                      </span>
                      <span className="font-medium text-blue-500">
                        {formatDate(shipment.shippedAt)}
                      </span>
                    </div>
                  )}
                  {shipment.receivedAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-emerald-500">
                        <Inbox className="h-4 w-4" />
                        Diterima:
                      </span>
                      <span className="font-medium text-emerald-500">
                        {formatDate(shipment.receivedAt)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Items Count */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">Items:</span>
                  <span className="text-lg font-bold text-amber-500">{shipment.items.length}</span>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  {shipment.items.slice(0, 3).map((item) => {
                    const hasOverstock = item.overstockQty && item.overstockQty > 0;
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col py-2 px-3 rounded-lg ${
                          hasOverstock 
                            ? 'bg-purple-500/10 border border-purple-500/20' 
                            : 'bg-blue-500/10 border border-blue-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200 truncate">
                            {item.productName}
                          </span>
                          <span className={`flex-shrink-0 text-sm font-semibold ${hasOverstock ? 'text-purple-500' : 'text-blue-500'}`}>
                            {item.sentQty} {item.unit}
                            {item.receivedQty !== undefined && item.receivedQty !== item.sentQty && (
                              <span className="text-red-500 ml-1">
                                (diterima: {item.receivedQty})
                              </span>
                            )}
                          </span>
                        </div>
                        {hasOverstock && (
                          <div className="mt-1 text-xs text-purple-400">
                            <span className="font-semibold">+{item.overstockQty} lebih</span>
                            {item.overstockReason && (
                              <span className="ml-1 text-purple-300">• {item.overstockReason}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {shipment.items.length > 3 && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center py-1">
                      +{shipment.items.length - 3} item lainnya
                    </p>
                  )}
                </div>

                {/* Overstock Summary */}
                {shipment.items.some(item => item.overstockQty && item.overstockQty > 0) && (
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm mb-1">
                      <Package className="h-4 w-4" />
                      Overstock ({shipment.items.filter(i => i.overstockQty && i.overstockQty > 0).length} item)
                    </div>
                    <p className="text-xs text-purple-300">
                      Pengiriman ini memiliki item yang dikirim lebih dari permintaan
                    </p>
                  </div>
                )}

                {/* Discrepancies */}
                {shipment.discrepancies && shipment.discrepancies.length > 0 && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <div className="flex items-center gap-2 text-red-400 font-semibold text-sm mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      Ketidaksesuaian ({shipment.discrepancies.length})
                    </div>
                    {shipment.discrepancies.slice(0, 2).map((d, i) => (
                      <p key={i} className="text-xs text-red-400">
                        {d.productName}: {d.discrepancyType}
                      </p>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {shipment.notes && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <p className="text-xs font-semibold text-amber-400 mb-1">📝 Catatan:</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 line-clamp-2">
                      {shipment.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              {(canShip(shipment) || canReceive(shipment)) && (
                <div className="px-5 pb-5">
                  <div className="flex gap-2">
                    {canShip(shipment) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openShipModal(shipment);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30 text-sm"
                      >
                        <Send className="h-4 w-4" />
                        Kirim
                      </button>
                    )}
                    {canReceive(shipment) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openReceiveModal(shipment);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/30 text-sm"
                      >
                        <Inbox className="h-4 w-4" />
                        Terima
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        </>
      )}

      {/* Ship Modal */}
      {selectedShipment && modalAction === 'edit' && (
        <EditShipmentModal
          shipment={selectedShipment}
          onClose={closeModal}
          onSubmit={handleUpdateShipment}
          loading={actionLoading || detailLoading}
        />
      )}

      {selectedShipment && modalAction === 'ship' && (
        <ShipModal
          shipment={selectedShipment}
          onClose={closeModal}
          onShip={handleShip}
          loading={actionLoading}
        />
      )}

      {/* Receive Modal */}
      {selectedShipment && modalAction === 'receive' && (
        <ReceiveModal
          shipment={selectedShipment}
          onClose={closeModal}
          onReceive={handleReceive}
          loading={actionLoading}
        />
      )}

      {/* Detail Modal */}
      {selectedShipment && modalAction === 'detail' && (
        <DetailModal
          shipment={selectedShipment}
          onClose={closeModal}
          onShip={canShip(selectedShipment) ? () => {
            closeModal();
            setTimeout(() => openShipModal(selectedShipment), 100);
          } : undefined}
          onReceive={canReceive(selectedShipment) ? () => {
            closeModal();
            setTimeout(() => openReceiveModal(selectedShipment), 100);
          } : undefined}
          onReviewIssue={canReviewIssue(selectedShipment) ? openIssueReviewModal : undefined}
          detailLoading={detailLoading}
          loading={actionLoading}
        />
      )}

      {selectedShipment && issueReviewDecision === 'SEND_SHORTAGE' && (
        <SendShortageModal
          shipment={selectedShipment}
          onClose={closeIssueReviewModal}
          onSubmit={async ({ items, notes }) => {
            await submitIssueReview(
              notes,
              items.map((item) => ({
                masterProductId: item.productId,
                quantity: item.sendQty,
                unit: item.unit,
              }))
            );
          }}
          loading={actionLoading}
        />
      )}

      {selectedShipment && issueReviewDecision && issueReviewDecision !== 'SEND_SHORTAGE' && (
        <NotesModal
          decision={issueReviewDecision}
          onClose={closeIssueReviewModal}
          onSubmit={(notes) => submitIssueReview(notes)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
