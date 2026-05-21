'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, PackageCheck, AlertTriangle, MessageSquare, RefreshCw, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Shipment, ReceiveShipmentInput } from '@/lib/api/inventoryApi';

type DiscrepancyType = 'SHORTAGE' | 'DAMAGE' | 'WRONG_ITEM' | 'OTHER';

interface ReceiveModalProps {
  shipment: Shipment;
  onClose: () => void;
  onReceive: (input: ReceiveShipmentInput) => Promise<void>;
  loading: boolean;
}

export default function ReceiveModal({ shipment, onClose, onReceive, loading }: ReceiveModalProps) {
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState('');
  const [receivedItems, setReceivedItems] = useState<Array<{ masterProductId: string; receivedQty: number }>>([]);
  const [discrepancies, setDiscrepancies] = useState<Array<{
    masterProductId: string;
    expectedQty: number;
    receivedQty: number;
    discrepancyType: DiscrepancyType;
    notes: string;
  }>>([]);
  const [hasDiscrepancy, setHasDiscrepancy] = useState(false);

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

  // Initialize received items
  useEffect(() => {
    setReceivedItems(
      shipment.items.map(item => ({
        masterProductId: item.masterProductId,
        receivedQty: item.sentQty,
      }))
    );
    setDiscrepancies([]);
    setHasDiscrepancy(false);
  }, [shipment]);

  const updateReceivedQty = (masterProductId: string, qty: number) => {
    setReceivedItems(prev => 
      prev.map(item => 
        item.masterProductId === masterProductId 
          ? { ...item, receivedQty: qty }
          : item
      )
    );

    const originalItem = shipment.items.find(i => i.masterProductId === masterProductId);
    if (originalItem && qty !== originalItem.sentQty) {
      // Add or update discrepancy
      setDiscrepancies(prev => {
        const existing = prev.find(d => d.masterProductId === masterProductId);
        if (existing) {
          return prev.map(d => 
            d.masterProductId === masterProductId 
              ? { ...d, receivedQty: qty }
              : d
          );
        } else {
          return [...prev, {
            masterProductId,
            expectedQty: originalItem.sentQty,
            receivedQty: qty,
            discrepancyType: 'SHORTAGE' as DiscrepancyType,
            notes: '',
          }];
        }
      });
      setHasDiscrepancy(true);
    } else {
      // Remove discrepancy if qty matches
      const newDiscrepancies = discrepancies.filter(d => d.masterProductId !== masterProductId);
      setDiscrepancies(newDiscrepancies);
      setHasDiscrepancy(newDiscrepancies.length > 0);
    }
  };

  const updateDiscrepancy = (masterProductId: string, field: string, value: string) => {
    setDiscrepancies(prev => 
      prev.map(d => 
        d.masterProductId === masterProductId 
          ? { ...d, [field]: value }
          : d
      )
    );
  };

  const handleSubmit = async () => {
    const input: ReceiveShipmentInput = {
      receivedItems,
      notes: notes || undefined,
    };

    if (hasDiscrepancy && discrepancies.length > 0) {
      input.discrepancies = discrepancies.filter(d => d.discrepancyType);
    }

    await onReceive(input);
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
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
                <PackageCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Terima Pengiriman
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
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  SHIPPED
                </span>
              </div>
            </div>

            {/* Items Section */}
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <h3 className="text-sm font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Konfirmasi Jumlah Diterima ({shipment.items.length} item)
              </h3>
              
              <div className="space-y-3">
                {shipment.items.map((item) => {
                  const receivedItem = receivedItems.find(r => r.masterProductId === item.masterProductId);
                  const hasIssue = receivedItem && receivedItem.receivedQty !== item.sentQty;
                  
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all ${
                        hasIssue 
                          ? 'bg-red-500/15 border-red-500/40' 
                          : 'bg-emerald-500/10 border-emerald-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                          {item.productName}
                        </span>
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">
                          Dikirim: {item.sentQty} {item.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-neutral-500 dark:text-neutral-400 min-w-[70px]">
                          Diterima:
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={receivedItem?.receivedQty || 0}
                          onChange={(e) => updateReceivedQty(item.masterProductId, Number(e.target.value))}
                          className={`w-24 px-3 py-2 text-sm rounded-lg border bg-neutral-800/50 text-white focus:outline-none focus:ring-2 transition-all ${
                            hasIssue 
                              ? 'border-red-500/50 focus:ring-red-500' 
                              : 'border-emerald-500/30 focus:ring-emerald-500'
                          }`}
                        />
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">
                          {item.unit}
                        </span>
                        {hasIssue && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-red-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Tidak sesuai
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Discrepancy Details */}
            {hasDiscrepancy && discrepancies.length > 0 && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40">
                <h3 className="text-sm font-semibold text-red-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Detail Ketidaksesuaian
                </h3>
                
                <div className="space-y-3">
                  {discrepancies.map((d) => {
                    const item = shipment.items.find(i => i.masterProductId === d.masterProductId);
                    return (
                      <div 
                        key={d.masterProductId} 
                        className="p-4 rounded-xl bg-red-500/10 border border-red-500/30"
                      >
                        <div className="font-semibold text-neutral-700 dark:text-neutral-200 mb-3">
                          {item?.productName}
                          <span className="font-normal text-neutral-500 dark:text-neutral-400 ml-2 text-sm">
                            (Dikirim: {d.expectedQty}, Diterima: {d.receivedQty})
                          </span>
                        </div>
                        <div className="flex gap-3 mb-3">
                          <select
                            value={d.discrepancyType}
                            onChange={(e) => updateDiscrepancy(d.masterProductId, 'discrepancyType', e.target.value)}
                            className="flex-1 px-3 py-2 text-sm rounded-lg border border-red-500/40 bg-neutral-800/50 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            <option value="SHORTAGE">Kurang</option>
                            <option value="DAMAGE">Rusak</option>
                            <option value="WRONG_ITEM">Salah Item</option>
                            <option value="OTHER">Lainnya</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          value={d.notes}
                          onChange={(e) => updateDiscrepancy(d.masterProductId, 'notes', e.target.value)}
                          placeholder="Catatan ketidaksesuaian..."
                          className="w-full px-3 py-2 text-sm rounded-lg border border-red-500/40 bg-neutral-800/50 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes Section */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Catatan Penerimaan (Opsional)
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Masukkan catatan penerimaan..."
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
              className={`px-6 py-2.5 rounded-xl text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                hasDiscrepancy 
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30' 
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : hasDiscrepancy ? (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Terima dengan Catatan
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Terima Pengiriman
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
