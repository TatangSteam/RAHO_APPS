'use client';

import { useState, useEffect } from 'react';
import { Truck, Package, Send, MessageSquare, RefreshCw, ChevronRight, AlertTriangle, Plus, Minus, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Shipment, ShipShipmentInput } from '@/lib/api/inventoryApi';
import { ShipmentModal } from './ShipmentModal';

interface ShipmentItemWithOverstock {
  masterProductId: string;
  productName: string;
  originalRequestedQty: number; // Original request amount
  overstockDeducted: number; // Amount already deducted from overstock
  sentQty: number; // Amount to send (default = originalRequestedQty - overstockDeducted)
  unit: string;
  overstockReason: string;
}

interface ShipModalProps {
  shipment: Shipment;
  onClose: () => void;
  onShip: (data: ShipShipmentInput) => Promise<void>;
  loading: boolean;
}

export default function ShipModal({ shipment, onClose, onShip, loading }: ShipModalProps) {
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ShipmentItemWithOverstock[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize items from shipment
  useEffect(() => {
    setItems(shipment.items.map(item => {
      // Get original requested qty and overstock info
      const originalRequestedQty = (item as any).originalRequestedQty || (item as any).requestedQty || item.sentQty;
      const overstockDeducted = (item as any).overstockDeducted || 0;
      
      return {
        masterProductId: item.masterProductId,
        productName: item.productName,
        // Original requested amount (before overstock deduction)
        originalRequestedQty,
        // Amount already deducted from overstock
        overstockDeducted,
        // Default sentQty is the finalQty (after overstock deduction)
        // This can be 0 if overstock covers everything
        sentQty: item.sentQty,
        unit: item.unit,
        overstockReason: '',
      };
    }));
  }, [shipment]);

  const updateItemQty = (masterProductId: string, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.masterProductId === masterProductId) {
        // Allow 0 if overstock covers everything
        const newQty = Math.max(0, item.sentQty + delta);
        return { ...item, sentQty: newQty };
      }
      return item;
    }));
    // Clear error when qty changes
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[masterProductId];
      return newErrors;
    });
  };

  const updateItemSentQty = (masterProductId: string, value: number) => {
    setItems(prev => prev.map(item => {
      if (item.masterProductId === masterProductId) {
        // Allow 0 if overstock covers everything
        return { ...item, sentQty: Math.max(0, value) };
      }
      return item;
    }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[masterProductId];
      return newErrors;
    });
  };

  const updateOverstockReason = (masterProductId: string, reason: string) => {
    setItems(prev => prev.map(item => {
      if (item.masterProductId === masterProductId) {
        return { ...item, overstockReason: reason };
      }
      return item;
    }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[masterProductId];
      return newErrors;
    });
  };

  const hasOverstock = items.some(item => item.sentQty > (item.originalRequestedQty - item.overstockDeducted));

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    for (const item of items) {
      // Calculate the expected amount to send (after overstock deduction)
      const expectedSentQty = item.originalRequestedQty - item.overstockDeducted;
      // If sending more than expected, require overstock reason
      if (item.sentQty > expectedSentQty && !item.overstockReason.trim()) {
        newErrors[item.masterProductId] = 'Alasan overstock wajib diisi';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const data: ShipShipmentInput = {
      notes: notes || undefined,
      items: items.map(item => {
        const expectedSentQty = item.originalRequestedQty - item.overstockDeducted;
        return {
          masterProductId: item.masterProductId,
          sentQty: item.sentQty,
          overstockReason: item.sentQty > expectedSentQty ? item.overstockReason : undefined,
        };
      }),
    };

    await onShip(data);
  };

  return (
    <ShipmentModal
      closeDisabled={loading}
      icon={<Truck className="h-6 w-6 text-white" />}
      iconClassName="from-blue-400 to-blue-600 shadow-blue-500/30"
      open
      subtitle={shipment.shipmentCode}
      title="Kirim Pengiriman"
      wrapBody={false}
      onClose={onClose}
    >
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

            {/* Overstock Info Banner */}
            {items.some(item => item.overstockDeducted > 0) && (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-purple-400">Overstock Sudah Dikurangi</p>
                    <p className="text-xs text-purple-400/80 mt-1">
                      Beberapa item sudah dikurangi dari overstock yang tersedia. Jumlah yang perlu dikirim sudah disesuaikan.
                    </p>
                    <div className="mt-2 space-y-1">
                      {items.filter(item => item.overstockDeducted > 0).map(item => (
                        <div key={item.masterProductId} className="flex justify-between text-xs">
                          <span className="text-purple-300">{item.productName}</span>
                          <span className="text-purple-400 font-medium">
                            Diminta: {item.originalRequestedQty} → Overstock: -{item.overstockDeducted} → Kirim: {item.originalRequestedQty - item.overstockDeducted} {item.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Overstock Info Banner */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">Fitur Overstock</p>
                  <p className="text-xs text-amber-400/80 mt-1">
                    Anda dapat mengirim lebih banyak dari jumlah yang diminta. Kelebihan akan dicatat sebagai overstock 
                    dan otomatis dikurangi dari request berikutnya. Alasan overstock wajib diisi jika mengirim lebih.
                  </p>
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <h3 className="text-sm font-semibold text-blue-400 mb-4 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Items yang akan dikirim ({items.length} item)
              </h3>
              
              <div className="space-y-4">
                {items.map((item) => {
                  const expectedSentQty = item.originalRequestedQty - item.overstockDeducted;
                  const isOverstock = item.sentQty > expectedSentQty;
                  const overstockQty = isOverstock ? item.sentQty - expectedSentQty : 0;
                  const hasError = !!errors[item.masterProductId];

                  return (
                    <div
                      key={item.masterProductId}
                      className={`p-4 rounded-xl border transition-all ${
                        isOverstock 
                          ? 'bg-amber-500/10 border-amber-500/30' 
                          : item.overstockDeducted > 0
                            ? 'bg-purple-500/10 border-purple-500/30'
                            : 'bg-blue-500/10 border-blue-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-neutral-700 dark:text-neutral-200">
                          {item.productName}
                        </span>
                        <div className="text-right">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 block">
                            Diminta asli: {item.originalRequestedQty} {item.unit}
                          </span>
                          {item.overstockDeducted > 0 && (
                            <span className="text-xs text-purple-400 block">
                              Overstock: -{item.overstockDeducted} {item.unit}
                            </span>
                          )}
                          <span className="text-xs text-emerald-400 font-medium block">
                            Perlu dikirim: {expectedSentQty} {item.unit}
                          </span>
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm text-neutral-500 dark:text-neutral-400 w-20">Kirim:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateItemQty(item.masterProductId, -1)}
                            className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                          >
                            <Minus className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.sentQty}
                            onChange={(e) => updateItemSentQty(item.masterProductId, parseInt(e.target.value) || 0)}
                            className="w-20 px-3 py-2 text-center text-sm font-bold rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => updateItemQty(item.masterProductId, 1)}
                            className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                          >
                            <Plus className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                          </button>
                          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                            {item.unit}
                          </span>
                        </div>
                      </div>

                      {/* Overstock Badge & Reason */}
                      {isOverstock && (
                        <div className="mt-3 pt-3 border-t border-amber-500/30">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                            <span className="text-sm font-semibold text-amber-400">
                              Overstock Baru: +{overstockQty} {item.unit}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={item.overstockReason}
                            onChange={(e) => updateOverstockReason(item.masterProductId, e.target.value)}
                            placeholder="Alasan overstock (wajib diisi)..."
                            className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                              hasError 
                                ? 'border-red-500 dark:border-red-500' 
                                : 'border-amber-500/30'
                            }`}
                          />
                          {hasError && (
                            <p className="text-xs text-red-500 mt-1">{errors[item.masterProductId]}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            {hasOverstock && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Ringkasan Overstock Baru
                </h3>
                <div className="space-y-1">
                  {items.filter(i => i.sentQty > (i.originalRequestedQty - i.overstockDeducted)).map(item => {
                    const expectedSentQty = item.originalRequestedQty - item.overstockDeducted;
                    return (
                      <div key={item.masterProductId} className="flex justify-between text-sm">
                        <span className="text-neutral-400">{item.productName}</span>
                        <span className="text-emerald-400 font-medium">
                          +{item.sentQty - expectedSentQty} {item.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-emerald-400/70 mt-3">
                  Overstock baru akan dicatat dan otomatis dikurangi dari request stok berikutnya.
                </p>
              </div>
            )}

            {/* Notes Section */}
            <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Catatan Pengiriman (Opsional)
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Masukkan catatan pengiriman..."
                rows={3}
                className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex-shrink-0">
            <Button
              unstyled
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
            >
              Batal
            </Button>
            <Button
              unstyled
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
            </Button>
          </div>
    </ShipmentModal>
  );
}
