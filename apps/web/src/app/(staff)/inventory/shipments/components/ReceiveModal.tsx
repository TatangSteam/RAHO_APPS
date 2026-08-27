'use client';

import { useState, useEffect, type ChangeEvent } from 'react';
import { Package, PackageCheck, AlertTriangle, MessageSquare, RefreshCw, ChevronRight, CheckCircle2, Info, TrendingUp, Upload, FileCheck2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Shipment, ReceiveShipmentInput } from '@/lib/api/inventoryApi';
import { ShipmentModal } from './ShipmentModal';

type DiscrepancyType = 'SHORTAGE' | 'DAMAGE' | 'WRONG_ITEM' | 'OTHER';
const RECEIPT_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg'];
const RECEIPT_MAX_SIZE = 10 * 1024 * 1024;

interface ReceiveModalProps {
  shipment: Shipment;
  onClose: () => void;
  onReceive: (input: ReceiveShipmentInput) => Promise<void>;
  loading: boolean;
}

export default function ReceiveModal({ shipment, onClose, onReceive, loading }: ReceiveModalProps) {
  const isPartnership = shipment.toBranchType === 'PARTNERSHIP';
  const [idempotencyKey] = useState(() => `RECEIPT-${shipment.id}-${crypto.randomUUID()}`);
  const [notes, setNotes] = useState('');
  const [isFinal, setIsFinal] = useState(true);
  const [receivedItems, setReceivedItems] = useState<Array<{
    masterProductId: string;
    receivedQty: number;
    quarantineQty: number;
    unit?: string;
  }>>([]);
  const [discrepancies, setDiscrepancies] = useState<Array<{
    masterProductId: string;
    expectedQty: number;
    receivedQty: number;
    discrepancyType: DiscrepancyType;
    unit?: string;
    notes: string;
  }>>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const [formError, setFormError] = useState('');
  const hasDiscrepancy = discrepancies.length > 0 || receivedItems.some(item => item.quarantineQty > 0);

  // Initialize received items
  useEffect(() => {
    setReceivedItems(
      shipment.items.map(item => ({
        masterProductId: item.masterProductId,
        receivedQty: Math.max(0, Number(item.sentQty) - Number(item.receivedQty || 0)),
        quarantineQty: 0,
        unit: item.unit,
      }))
    );
    setDiscrepancies([]);
    setIsFinal(true);
    setReceiptFile(null);
    setReceiptError('');
    setFormError('');
  }, [shipment]);

  const updateReceivedQty = (masterProductId: string, qty: number) => {
    const originalItem = shipment.items.find(i => i.masterProductId === masterProductId);
    if (!originalItem) return;
    const remainingQty = Math.max(0, Number(originalItem.sentQty) - Number(originalItem.receivedQty || 0));
    const safeQty = Math.min(remainingQty, Math.max(0, qty));
    setReceivedItems(prev => 
      prev.map(item => 
        item.masterProductId === masterProductId 
          ? { ...item, receivedQty: safeQty, quarantineQty: Math.min(item.quarantineQty, safeQty) }
          : item
      )
    );

    if (isFinal && safeQty < remainingQty) {
      setDiscrepancies(prev => {
        const existing = prev.find(d => d.masterProductId === masterProductId);
        if (existing) {
          return prev.map(d => 
            d.masterProductId === masterProductId 
              ? { ...d, receivedQty: Number(originalItem.receivedQty || 0) + safeQty }
              : d
          );
        } else {
          return [...prev, {
            masterProductId,
            expectedQty: originalItem.sentQty,
            receivedQty: Number(originalItem.receivedQty || 0) + safeQty,
            discrepancyType: 'SHORTAGE' as DiscrepancyType,
            unit: originalItem.unit,
            notes: 'Jumlah diterima kurang dari sisa quantity in-transit.',
          }];
        }
      });
    } else {
      setDiscrepancies(prev => prev.filter(
        d => d.masterProductId !== masterProductId || d.discrepancyType !== 'SHORTAGE'
      ));
    }
  };

  const updateQuarantineQty = (masterProductId: string, qty: number) => {
    const receiptItem = receivedItems.find(item => item.masterProductId === masterProductId);
    const safeQty = Math.min(receiptItem?.receivedQty || 0, Math.max(0, qty));
    setReceivedItems(prev => prev.map(item => item.masterProductId === masterProductId
      ? { ...item, quarantineQty: safeQty }
      : item));
    setDiscrepancies(prev => {
      const shipmentItem = shipment.items.find(item => item.masterProductId === masterProductId)!;
      const withoutProduct = prev.filter(item => item.masterProductId !== masterProductId);
      const receivedQty = Number(shipmentItem.receivedQty || 0) + (receiptItem?.receivedQty || 0);
      if (safeQty === 0 && (!isFinal || receivedQty >= Number(shipmentItem.sentQty))) return withoutProduct;
      return [...withoutProduct, {
        masterProductId,
        expectedQty: shipmentItem.sentQty,
        receivedQty,
        discrepancyType: (safeQty > 0 ? 'DAMAGE' : 'SHORTAGE') as DiscrepancyType,
        unit: shipmentItem.unit,
        notes: safeQty > 0
          ? 'Barang rusak ditempatkan pada quarantine.'
          : 'Jumlah diterima kurang dari sisa quantity in-transit.',
      }];
    });
  };

  const changeReceiptMode = (finalReceipt: boolean) => {
    setIsFinal(finalReceipt);
    setDiscrepancies(prev => {
      const retained = prev.filter(item => item.discrepancyType !== 'SHORTAGE');
      if (!finalReceipt) return retained;
      const shortages = shipment.items.flatMap(item => {
        const eventQty = receivedItems.find(row => row.masterProductId === item.masterProductId)?.receivedQty || 0;
        const cumulativeQty = Number(item.receivedQty || 0) + eventQty;
        return cumulativeQty < Number(item.sentQty) ? [{
          masterProductId: item.masterProductId,
          expectedQty: item.sentQty,
          receivedQty: cumulativeQty,
          discrepancyType: 'SHORTAGE' as DiscrepancyType,
          unit: item.unit,
          notes: 'Jumlah diterima kurang dari sisa quantity in-transit.',
        }] : [];
      });
      return [...retained, ...shortages];
    });
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleReceiptChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setReceiptError('');

    if (!file) {
      setReceiptFile(null);
      return;
    }

    if (!RECEIPT_ALLOWED_TYPES.includes(file.type)) {
      setReceiptFile(null);
      setReceiptError('Format tanda terima harus PDF atau JPG.');
      event.target.value = '';
      return;
    }

    if (file.size > RECEIPT_MAX_SIZE) {
      setReceiptFile(null);
      setReceiptError('Ukuran tanda terima maksimal 10MB.');
      event.target.value = '';
      return;
    }

    setReceiptFile(file);
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!receiptFile) {
      setReceiptError('File tanda terima wajib diupload.');
      return;
    }
    if (!isFinal && !receivedItems.some(item => item.receivedQty > 0)) {
      setFormError('Penerimaan parsial harus memiliki minimal satu quantity diterima.');
      return;
    }
    if (discrepancies.some(item => item.notes.trim().length < 3)) {
      setFormError('Lengkapi catatan ketidaksesuaian sebelum menyimpan.');
      return;
    }

    const input: ReceiveShipmentInput = {
      idempotencyKey,
      isFinal,
      receivedItems,
      notes: notes || undefined,
      receiptFile,
    };

    if (hasDiscrepancy && discrepancies.length > 0) {
      input.discrepancies = discrepancies.filter(d => d.discrepancyType);
    }

    await onReceive(input);
  };

  return (
    <ShipmentModal
      closeDisabled={loading}
      icon={<PackageCheck className="h-6 w-6 text-white" />}
      iconClassName="from-emerald-400 to-emerald-600 shadow-emerald-500/30"
      open
      size="2xl"
      subtitle={shipment.shipmentCode}
      title={isPartnership ? 'Konfirmasi Delivery Partnership' : 'Terima Pengiriman'}
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
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  SHIPPED
                </span>
              </div>
            </div>

            {!isPartnership && <div className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-700 dark:bg-neutral-800">
              <button
                type="button"
                onClick={() => changeReceiptMode(false)}
                className={`min-h-10 px-3 text-sm font-semibold transition-colors ${!isFinal ? 'bg-white text-sky-700 shadow-sm dark:bg-neutral-700 dark:text-sky-300' : 'text-neutral-500 dark:text-neutral-400'}`}
              >
                Penerimaan parsial
              </button>
              <button
                type="button"
                onClick={() => changeReceiptMode(true)}
                className={`min-h-10 px-3 text-sm font-semibold transition-colors ${isFinal ? 'bg-white text-emerald-700 shadow-sm dark:bg-neutral-700 dark:text-emerald-300' : 'text-neutral-500 dark:text-neutral-400'}`}
              >
                Penerimaan final
              </button>
            </div>}

            {isPartnership && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-700 dark:text-blue-200">
                <p className="font-bold">Konfirmasi delivery eksternal</p>
                <p className="mt-1">Tindakan ini menyelesaikan pengiriman dan request Partnership. Barang tidak akan ditambahkan ke inventory utama atau stok milik perusahaan.</p>
              </div>
            )}

            {/* Overstock Info Banner - Show if any item has overstock */}
            {!isPartnership && shipment.items.some(item => (item.overstockQty && item.overstockQty > 0) || (item.originalRequestedQty && item.sentQty > (item.originalRequestedQty - (item.overstockDeducted || 0)))) && (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-purple-400">Kelebihan Pengiriman (Overstock)</p>
                    <p className="text-xs text-purple-400/80 mt-1">
                      Pengiriman ini mengandung kelebihan stok yang akan dicatat sebagai overstock cabang Anda. 
                      Overstock akan otomatis dikurangi dari permintaan stok berikutnya.
                    </p>
                    <div className="mt-3 space-y-2">
                      {shipment.items.filter(item => {
                        const overstockQty = item.overstockQty || 0;
                        const originalRequestedQty = item.originalRequestedQty || item.requestedQty || item.sentQty;
                        const overstockDeducted = item.overstockDeducted || 0;
                        const expectedSentQty = originalRequestedQty - overstockDeducted;
                        const newOverstock = item.sentQty - expectedSentQty;
                        return overstockQty > 0 || newOverstock > 0;
                      }).map(item => {
                        const overstockQty = item.overstockQty || 0;
                        const originalRequestedQty = item.originalRequestedQty || item.requestedQty || item.sentQty;
                        const overstockDeducted = item.overstockDeducted || 0;
                        const expectedSentQty = originalRequestedQty - overstockDeducted;
                        const newOverstock = overstockQty > 0 ? overstockQty : (item.sentQty - expectedSentQty);
                        
                        return (
                          <div key={item.masterProductId} className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-purple-300">{item.productName}</span>
                              <span className="text-sm font-bold text-purple-400">+{newOverstock} {item.unit}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-purple-400/70">
                              <span>Diminta: {originalRequestedQty}</span>
                              {overstockDeducted > 0 && (
                                <>
                                  <span>•</span>
                                  <span>Overstock lama: -{overstockDeducted}</span>
                                </>
                              )}
                              <span>•</span>
                              <span>Dikirim: {item.sentQty}</span>
                            </div>
                            <div className="mt-2 p-2 rounded bg-amber-500/15 border border-amber-500/30">
                              <p className="text-xs text-amber-400">
                                <span className="font-semibold">Catatan:</span> {item.overstockReason || `Kelebihan pengiriman +${newOverstock} ${item.unit}`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Items Section */}
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <h3 className="text-sm font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Konfirmasi Jumlah Diterima ({shipment.items.length} item)
              </h3>
              
              <div className="space-y-3">
                {shipment.items.map((item) => {
                  const receivedItem = receivedItems.find(r => r.masterProductId === item.masterProductId);
                  const alreadyReceivedQty = Number(item.receivedQty || 0);
                  const remainingQty = Math.max(0, Number(item.sentQty) - alreadyReceivedQty);
                  const hasIssue = Boolean(receivedItem && (
                    receivedItem.quarantineQty > 0 || (isFinal && receivedItem.receivedQty < remainingQty)
                  ));
                  
                  // Calculate overstock info
                  const overstockQty = item.overstockQty || 0;
                  const originalRequestedQty = item.originalRequestedQty || item.requestedQty || item.sentQty;
                  const overstockDeducted = item.overstockDeducted || 0;
                  const expectedSentQty = originalRequestedQty - overstockDeducted;
                  const hasOverstock = !isPartnership && (overstockQty > 0 || item.sentQty > expectedSentQty);
                  const newOverstockQty = overstockQty > 0 ? overstockQty : (item.sentQty - expectedSentQty);
                  
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all ${
                        hasIssue 
                          ? 'bg-red-500/15 border-red-500/40' 
                          : hasOverstock
                            ? 'bg-purple-500/10 border-purple-500/30'
                            : 'bg-emerald-500/10 border-emerald-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                            {item.productName}
                          </span>
                          {hasOverstock && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                              +{newOverstockQty} overstock
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-neutral-500 dark:text-neutral-400 block">
                            Sisa: {remainingQty} {item.unit}
                          </span>
                          {alreadyReceivedQty > 0 && (
                            <span className="text-xs text-sky-400 block">Sudah diterima: {alreadyReceivedQty}</span>
                          )}
                          {hasOverstock && (
                            <span className="text-xs text-purple-400 block">
                              (Diminta: {originalRequestedQty}{overstockDeducted > 0 ? `, Overstock lama: -${overstockDeducted}` : ''})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-neutral-500 dark:text-neutral-400 min-w-[70px]">
                          Diterima:
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={remainingQty}
                          step="0.0001"
                          value={receivedItem?.receivedQty ?? 0}
                          onChange={(e) => updateReceivedQty(item.masterProductId, Number(e.target.value))}
                          className={`w-24 px-3 py-2 text-sm rounded-lg border bg-neutral-800/50 text-white focus:outline-none focus:ring-2 transition-all ${
                            hasIssue 
                              ? 'border-red-500/50 focus:ring-red-500' 
                              : hasOverstock
                                ? 'border-purple-500/30 focus:ring-purple-500'
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
                      {!isPartnership && <div className="mt-3 flex items-center gap-3 border-t border-neutral-700/60 pt-3">
                        <label className="min-w-[70px] text-sm text-neutral-500 dark:text-neutral-400">
                          Quarantine:
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={receivedItem?.receivedQty || 0}
                          step="0.0001"
                          value={receivedItem?.quarantineQty ?? 0}
                          onChange={(e) => updateQuarantineQty(item.masterProductId, Number(e.target.value))}
                          className="w-24 rounded-lg border border-amber-500/40 bg-neutral-800/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">{item.unit}</span>
                      </div>}
                      {/* Show overstock reason if available */}
                      {hasOverstock && (
                        <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                          <div className="flex items-start gap-2">
                            <Info className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-amber-400">Catatan dari Pengirim:</p>
                              <p className="text-sm text-amber-300 mt-1">
                                {item.overstockReason || `Kelebihan pengiriman +${newOverstockQty} ${item.unit}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
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

            {formError && (
              <p className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400">
                <AlertTriangle className="h-4 w-4" />
                {formError}
              </p>
            )}

            {/* Receipt Upload */}
            <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30">
              <h3 className="text-sm font-semibold text-sky-400 mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Tanda Terima <span className="text-red-400">*</span>
              </h3>
              <p className="text-xs text-sky-200/80 mb-3">
                Wajib upload tanda terima penerimaan barang dalam format PDF atau JPG. Maksimal 10MB.
              </p>

              {receiptFile ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
                      <FileCheck2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-700 dark:text-neutral-100">
                        {receiptFile.name}
                      </p>
                      <p className="text-xs text-sky-300">
                        {receiptFile.type === 'application/pdf' ? 'PDF' : 'JPG'} - {formatFileSize(receiptFile.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptFile(null);
                      setReceiptError('');
                    }}
                    disabled={loading}
                    className="rounded-lg p-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                    aria-label="Hapus tanda terima"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all ${
                  receiptError
                    ? 'border-red-500/60 bg-red-500/10'
                    : 'border-sky-500/40 bg-sky-500/5 hover:bg-sky-500/10'
                }`}>
                  <Upload className={`mb-2 h-6 w-6 ${receiptError ? 'text-red-400' : 'text-sky-300'}`} />
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-100">
                    Pilih file tanda terima
                  </span>
                  <span className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    PDF atau JPG/JPEG
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
                    onChange={handleReceiptChange}
                    disabled={loading}
                    className="hidden"
                  />
                </label>
              )}

              {receiptError && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {receiptError}
                </p>
              )}
            </div>

            {/* Notes Section */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {isPartnership ? 'Catatan Delivery (Opsional)' : 'Catatan Penerimaan (Opsional)'}
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isPartnership ? 'Masukkan catatan delivery...' : 'Masukkan catatan penerimaan...'}
                rows={3}
                className="w-full px-4 py-3 text-sm rounded-xl border border-amber-500/30 bg-neutral-800/50 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
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
              disabled={loading || !receiptFile}
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
                  {isFinal ? 'Terima Final dengan Catatan' : 'Simpan Parsial dengan Catatan'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {isPartnership ? 'Konfirmasi Delivery' : isFinal ? 'Terima Pengiriman' : 'Simpan Penerimaan Parsial'}
                </>
              )}
            </Button>
          </div>
    </ShipmentModal>
  );
}
