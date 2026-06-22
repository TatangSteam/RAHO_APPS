'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, Send, AlertTriangle, ChevronRight, Calendar, FileText, Info } from 'lucide-react';
import { Shipment } from '@/lib/api/inventoryApi';

interface SendShortageItem {
  productId: string;
  productName: string;
  unit: string;
  shortageQty: number;
  sendQty: number;
  overstockReason?: string;
}

interface SendShortageModalProps {
  shipment: Shipment;
  onClose: () => void;
  onSubmit: (data: { items: SendShortageItem[]; notes: string }) => Promise<void>;
  loading?: boolean;
}

export function SendShortageModal({
  shipment,
  onClose,
  onSubmit,
  loading = false,
}: SendShortageModalProps) {
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

  const shortageItems = useMemo<SendShortageItem[]>(() => {
    const currentShortageItems = shipment.items
      .filter(item => item.receivedQty !== undefined && Number(item.receivedQty) < Number(item.sentQty))
      .map(item => {
        const shortageQty = Number(item.sentQty) - Number(item.receivedQty || 0);
        return {
          productId: item.masterProductId,
          productName: item.productName,
          unit: item.unit,
          shortageQty,
          sendQty: shortageQty,
          overstockReason: '',
        };
      });

    if (currentShortageItems.length > 0) {
      return currentShortageItems;
    }

    const latestShortageByProduct = new Map<string, NonNullable<Shipment['discrepancies']>[number]>();
    (shipment.discrepancies || [])
      .filter(d => d.discrepancyType === 'SHORTAGE')
      .forEach(d => {
        const existing = latestShortageByProduct.get(d.masterProductId);
        const existingTime = existing?.createdAt ? new Date(existing.createdAt).getTime() : 0;
        const currentTime = d.createdAt ? new Date(d.createdAt).getTime() : 0;

        if (!existing || currentTime >= existingTime) {
          latestShortageByProduct.set(d.masterProductId, d);
        }
      });

    return Array.from(latestShortageByProduct.values())
      .map(d => {
        const originalItem = shipment.items.find(i => i.masterProductId === d.masterProductId);
        const shortageQty = Number(d.expectedQty) - Number(d.receivedQty);
        return {
          productId: d.masterProductId,
          productName: d.productName,
          unit: originalItem?.unit || 'unit',
          shortageQty,
          sendQty: shortageQty,
          overstockReason: '',
        };
      })
      .filter(item => item.shortageQty > 0);
  }, [shipment.items, shipment.discrepancies]);

  const [items, setItems] = useState<SendShortageItem[]>(shortageItems);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setItems(shortageItems);
    setErrors({});
  }, [shipment.id, shortageItems]);

  const handleQtyChange = (productId: string, value: string) => {
    const qty = parseInt(value) || 0;
    setItems(prev =>
      prev.map(item =>
        item.productId === productId
          ? { ...item, sendQty: qty }
          : item
      )
    );
    // Clear error when user types
    if (errors[productId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[productId];
        return newErrors;
      });
    }
  };

  const handleOverstockReasonChange = (productId: string, value: string) => {
    setItems(prev =>
      prev.map(item =>
        item.productId === productId
          ? { ...item, overstockReason: value }
          : item
      )
    );
  };

  const handleSubmit = async () => {
    // Validation
    const newErrors: Record<string, string> = {};
    
    items.forEach(item => {
      if (item.sendQty <= 0) {
        newErrors[item.productId] = 'Jumlah harus lebih dari 0';
      }
      // If sending more than shortage, need overstock reason
      if (item.sendQty > item.shortageQty && !item.overstockReason?.trim()) {
        newErrors[`${item.productId}_reason`] = 'Alasan overstock wajib diisi';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await onSubmit({ items, notes });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl transform transition-all max-h-[90vh] flex flex-col"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/30">
                <Send className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Kirim Kekurangan Barang
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {shipment.shipmentCode}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
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
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Ada Kekurangan
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
                <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-center">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase mb-1">Dikirim</div>
                  <div className="text-sm font-semibold text-blue-400">
                    {shipment.shippedAt 
                      ? new Date(shipment.shippedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                      : '-'
                    }
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-center">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase mb-1">Diterima</div>
                  <div className="text-sm font-semibold text-emerald-400">
                    {shipment.receivedAt 
                      ? new Date(shipment.receivedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                      : '-'
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-400 mb-2">
                    Informasi Pengiriman Kekurangan
                  </p>
                  <ul className="text-xs text-blue-400/80 dark:text-blue-300/80 space-y-1.5">
                    <li>• Input jumlah barang yang akan dikirim untuk setiap item yang kurang</li>
                    <li>• Jika jumlah <strong>kurang</strong> dari kekurangan: akan tetap dicatat kurang</li>
                    <li>• Jika jumlah <strong>lebih</strong> dari kekurangan: akan masuk sebagai overstock (wajib isi alasan)</li>
                    <li>• Admin cabang akan crosscheck lagi saat menerima</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Items List */}
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <h3 className="text-sm font-semibold text-red-400 mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Barang yang Kurang ({items.length} item)
              </h3>
              
              {items.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-neutral-500 dark:text-neutral-400">
                    Tidak ada item dengan kekurangan
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => {
                    const isOverstock = item.sendQty > item.shortageQty;
                    const qtyError = errors[item.productId];
                    const reasonError = errors[`${item.productId}_reason`];

                    return (
                      <div
                        key={item.productId}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          isOverstock
                            ? 'bg-purple-500/5 border-purple-500/30'
                            : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        {/* Product Info */}
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-neutral-900 dark:text-white mb-1">
                              {item.productName}
                            </h4>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                              Kekurangan: <span className="font-semibold text-red-400">{item.shortageQty} {item.unit}</span>
                            </p>
                          </div>
                        </div>

                        {/* Quantity Input */}
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                            Jumlah yang Akan Dikirim <span className="text-red-500">*</span>
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min="1"
                              value={item.sendQty}
                              onChange={(e) => handleQtyChange(item.productId, e.target.value)}
                              disabled={loading}
                              className={`flex-1 px-4 py-2.5 rounded-xl border-2 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white transition-all focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
                                qtyError
                                  ? 'border-red-500'
                                  : isOverstock
                                  ? 'border-purple-500'
                                  : 'border-neutral-200 dark:border-neutral-700'
                              }`}
                            />
                            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 min-w-[60px]">
                              {item.unit}
                            </span>
                          </div>
                          {qtyError && (
                            <p className="mt-1.5 text-xs text-red-500">{qtyError}</p>
                          )}
                        </div>

                        {/* Overstock Warning & Reason */}
                        {isOverstock && (
                          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                            <div className="flex items-start gap-2 mb-3">
                              <AlertTriangle className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-purple-400 mb-1">
                                  Overstock +{item.sendQty - item.shortageQty} {item.unit}
                                </p>
                                <p className="text-xs text-purple-400/80">
                                  Anda mengirim lebih dari kekurangan. Wajib isi alasan.
                                </p>
                              </div>
                            </div>
                            <textarea
                              value={item.overstockReason}
                              onChange={(e) => handleOverstockReasonChange(item.productId, e.target.value)}
                              placeholder="Alasan overstock (contoh: buffer stock, anticipate next request)"
                              disabled={loading}
                              rows={2}
                              className={`w-full px-3 py-2.5 rounded-lg border-2 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-sm transition-all focus:ring-2 focus:ring-purple-500 disabled:opacity-50 ${
                                reasonError
                                  ? 'border-red-500'
                                  : 'border-purple-500/30'
                              }`}
                            />
                            {reasonError && (
                              <p className="mt-1.5 text-xs text-red-500">{reasonError}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <label className="block text-sm font-medium text-amber-400 mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan untuk admin cabang mengenai pengiriman kekurangan ini..."
                disabled={loading}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border-2 border-amber-500/30 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white transition-all focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 flex-shrink-0">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || items.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Kirim Kekurangan
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
