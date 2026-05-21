'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Truck, Package, Send, MessageSquare, RefreshCw, ChevronRight } from 'lucide-react';
import { Shipment } from '@/lib/api/inventoryApi';

interface ShipModalProps {
  shipment: Shipment;
  onClose: () => void;
  onShip: (notes?: string) => Promise<void>;
  loading: boolean;
}

export default function ShipModal({ shipment, onClose, onShip, loading }: ShipModalProps) {
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState('');

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

  const handleSubmit = async () => {
    await onShip(notes || undefined);
  };

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
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/30">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Kirim Pengiriman
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
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  PREPARING
                </span>
              </div>
            </div>

            {/* Items Section */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <h3 className="text-sm font-semibold text-blue-400 mb-4 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Items yang akan dikirim ({shipment.items.length} item)
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
                    <span className="font-bold text-blue-500">
                      {item.sentQty} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes Section */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Catatan Pengiriman (Opsional)
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Masukkan catatan pengiriman..."
                rows={3}
                className="w-full px-4 py-3 text-sm rounded-xl border border-amber-500/30 bg-neutral-800/50 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex-shrink-0">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Kirim Pengiriman
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
