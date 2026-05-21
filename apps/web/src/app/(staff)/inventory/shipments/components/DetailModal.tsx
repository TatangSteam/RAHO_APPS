'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, Truck, PackageCheck, AlertTriangle, Calendar, FileText, ChevronRight, MessageSquare } from 'lucide-react';
import { Shipment } from '@/lib/api/inventoryApi';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; bgColor: string; textColor: string; borderColor: string }> = {
  PREPARING: {
    label: 'Sedang Disiapkan',
    icon: <Package className="h-3.5 w-3.5" />,
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
  },
  SHIPPED: {
    label: 'Dikirim',
    icon: <Truck className="h-3.5 w-3.5" />,
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
  },
  RECEIVED: {
    label: 'Diterima',
    icon: <PackageCheck className="h-3.5 w-3.5" />,
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
  },
  RECEIVED_WITH_ISSUE: {
    label: 'Diterima (Ada Masalah)',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    bgColor: 'bg-orange-500/20',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/30',
  },
};

interface DetailModalProps {
  shipment: Shipment;
  onClose: () => void;
  onShip?: () => void;
  onReceive?: () => void;
}

export default function DetailModal({ shipment, onClose, onShip, onReceive }: DetailModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const statusConfig = STATUS_CONFIG[shipment.status] || STATUS_CONFIG.PREPARING;

  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl transform transition-all max-h-[90vh] flex flex-col"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-400 to-slate-600 shadow-lg shadow-slate-500/30">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Detail Pengiriman
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {shipment.shipmentCode}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Shipment Info Card */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-lg text-neutral-900 dark:text-white">
                    {shipment.shipmentCode}
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                    {shipment.fromBranchName}
                    <ChevronRight className="h-3 w-3" />
                    {shipment.toBranchName}
                  </p>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${statusConfig.bgColor} ${statusConfig.textColor} border ${statusConfig.borderColor} flex items-center gap-1.5`}>
                  {statusConfig.icon}
                  {statusConfig.label}
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Timeline
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-center">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase mb-1">Dibuat</div>
                  <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                    {new Date(shipment.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div className={`p-3 rounded-xl text-center ${
                  shipment.shippedAt 
                    ? 'bg-blue-500/15 border border-blue-500/30' 
                    : 'bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                }`}>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase mb-1">Dikirim</div>
                  <div className={`text-sm font-semibold ${shipment.shippedAt ? 'text-blue-400' : 'text-neutral-400'}`}>
                    {shipment.shippedAt 
                      ? new Date(shipment.shippedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                      : '-'
                    }
                  </div>
                </div>
                <div className={`p-3 rounded-xl text-center ${
                  shipment.receivedAt 
                    ? 'bg-emerald-500/15 border border-emerald-500/30' 
                    : 'bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                }`}>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase mb-1">Diterima</div>
                  <div className={`text-sm font-semibold ${shipment.receivedAt ? 'text-emerald-400' : 'text-neutral-400'}`}>
                    {shipment.receivedAt 
                      ? new Date(shipment.receivedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                      : '-'
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <h3 className="text-sm font-semibold text-blue-400 mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Daftar Item ({shipment.items.length})
              </h3>
              
              <div className="space-y-2">
                {shipment.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20"
                  >
                    <span className="font-medium text-neutral-700 dark:text-neutral-200">
                      {item.productName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-400 px-3 py-1 bg-blue-500/15 rounded-full text-sm">
                        {item.sentQty} {item.unit}
                      </span>
                      {item.receivedQty !== undefined && item.receivedQty !== item.sentQty && (
                        <span className="text-xs text-red-400 px-2 py-1 bg-red-500/15 rounded-full">
                          Diterima: {item.receivedQty}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Discrepancies */}
            {shipment.discrepancies && shipment.discrepancies.length > 0 && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40">
                <h3 className="text-sm font-semibold text-red-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Ketidaksesuaian ({shipment.discrepancies.length})
                </h3>
                
                <div className="space-y-2">
                  {shipment.discrepancies.map((d, index) => (
                    <div 
                      key={index} 
                      className="p-3 rounded-lg bg-red-500/10 border border-red-500/30"
                    >
                      <div className="font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
                        {d.productName}
                      </div>
                      <div className="text-sm text-red-400">
                        {d.discrepancyType === 'SHORTAGE' ? 'Kurang' : 
                         d.discrepancyType === 'DAMAGE' ? 'Rusak' : 
                         d.discrepancyType === 'WRONG_ITEM' ? 'Salah Item' : 'Lainnya'}
                        {d.notes && ` - ${d.notes}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {shipment.notes && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Catatan
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300 italic text-sm">
                  {shipment.notes}
                </p>
              </div>
            )}

            {/* Stock Request Info */}
            {(shipment as any).stockRequest && (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <h3 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Request Stok Terkait
                </h3>
                <p className="font-semibold text-neutral-700 dark:text-neutral-200">
                  {(shipment as any).stockRequest.requestCode}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex-shrink-0">
            {onShip && (
              <button
                onClick={onShip}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2"
              >
                <Truck className="h-4 w-4" />
                Kirim
              </button>
            )}
            {onReceive && (
              <button
                onClick={onReceive}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2"
              >
                <PackageCheck className="h-4 w-4" />
                Terima
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
