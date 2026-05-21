'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { inventoryApi, Shipment, ReceiveShipmentInput } from '@/lib/api/inventoryApi';
import { Truck, Package, RefreshCw, Calendar, Send, Inbox, AlertTriangle, FileText, ChevronRight } from 'lucide-react';
import { ShipModal, ReceiveModal, DetailModal } from './components';

type ShipmentStatus = 'ALL' | 'PREPARING' | 'SHIPPED' | 'RECEIVED' | 'RECEIVED_WITH_ISSUE';

const STATUS_LABELS: Record<string, string> = {
  PREPARING: 'Sedang Disiapkan',
  SHIPPED: 'Dikirim',
  RECEIVED: 'Diterima',
  RECEIVED_WITH_ISSUE: 'Diterima (Ada Masalah)',
};

export default function ShipmentsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ShipmentStatus>('ALL');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [modalAction, setModalAction] = useState<'ship' | 'receive' | 'detail' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fetchShipments = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      setLoading(true);
      const params: any = {};
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
    } catch (error: any) {
      console.error('Shipments fetch error:', error);
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

  const handleShip = async (notes?: string) => {
    if (!selectedShipment) return;
    
    try {
      setActionLoading(true);
      await inventoryApi.shipShipment(selectedShipment.id, { notes });
      showToast.success('Pengiriman berhasil dikirim');
      closeModal();
      fetchShipments();
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Gagal mengirim pengiriman');
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
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Gagal menerima pengiriman');
    } finally {
      setActionLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedShipment(null);
    setModalAction(null);
  };

  const openShipModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setModalAction('ship');
  };

  const openReceiveModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setModalAction('receive');
  };

  const openDetailModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setModalAction('detail');
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
    
  const canReceive = (shipment: Shipment) =>
    user?.role === 'ADMIN_CABANG' &&
    shipment.status === 'SHIPPED';

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
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCw className="h-12 w-12 text-amber-500 animate-spin mb-4" />
          <p className="text-neutral-500 dark:text-neutral-400">Memuat data...</p>
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
                  {shipment.items.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20"
                    >
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200 truncate">
                        {item.productName}
                      </span>
                      <span className="flex-shrink-0 text-sm font-semibold text-blue-500">
                        {item.sentQty} {item.unit}
                        {item.receivedQty !== undefined && item.receivedQty !== item.sentQty && (
                          <span className="text-red-500 ml-1">
                            (diterima: {item.receivedQty})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                  {shipment.items.length > 3 && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center py-1">
                      +{shipment.items.length - 3} item lainnya
                    </p>
                  )}
                </div>

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
      )}

      {/* Ship Modal */}
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
        />
      )}
    </div>
  );
}
