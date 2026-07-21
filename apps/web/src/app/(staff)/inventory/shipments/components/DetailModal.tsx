'use client';

import { useState } from 'react';
import { Package, Truck, PackageCheck, AlertTriangle, Calendar, FileText, ChevronRight, MessageSquare, Info, CheckCircle2 } from 'lucide-react';
import { Shipment, ShipmentIssueDecision } from '@/lib/api/inventoryApi';
import { createAuthenticatedObjectUrl } from '@/lib/fileApi';
import { ShipmentModal } from './ShipmentModal';

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

const DISCREPANCY_LABELS: Record<string, string> = {
  SHORTAGE: 'Kurang',
  DAMAGE: 'Rusak',
  WRONG_ITEM: 'Salah Item',
  OTHER: 'Lainnya',
};

const formatQuantity = (value: number) => {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
};

const formatDateTime = (dateString?: string) => {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface DetailModalProps {
  shipment: Shipment;
  onClose: () => void;
  onShip?: () => void;
  onReceive?: () => void;
  onReviewIssue?: (decision: ShipmentIssueDecision) => Promise<void>;
  loading?: boolean;
  detailLoading?: boolean;
}

export default function DetailModal({ shipment, onClose, onShip, onReceive, onReviewIssue, loading, detailLoading }: DetailModalProps) {
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const statusConfig = STATUS_CONFIG[shipment.status] || STATUS_CONFIG.PREPARING;
  const discrepancies = shipment.discrepancies || [];
  const issueCount = discrepancies.length || shipment.discrepancyCount || 0;
  const hasIssueHistory = Boolean(
    issueCount || shipment.hasDiscrepancies || shipment.status === 'RECEIVED_WITH_ISSUE' || shipment.approvedAt
  );
  const hasOpenIssue = shipment.status === 'RECEIVED_WITH_ISSUE' && !shipment.approvedAt && !shipment.isLedgerManaged;
  const reviewHistory = (shipment.notes || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('[Review Admin Manager]'));

  const handleViewReceipt = async () => {
    if (!shipment.receiptFileUrl) return;

    try {
      setLoadingReceipt(true);
      const blobUrl = await createAuthenticatedObjectUrl(shipment.receiptFileUrl);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setLoadingReceipt(false);
    }
  };

  return (
    <ShipmentModal
      icon={<Package className="h-6 w-6 text-white" />}
      iconClassName="from-slate-400 to-slate-600 shadow-slate-500/30"
      open
      subtitle={shipment.shipmentCode}
      title="Detail Pengiriman"
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
                <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${statusConfig.bgColor} ${statusConfig.textColor} border ${statusConfig.borderColor} flex items-center gap-1.5`}>
                  {statusConfig.icon}
                  {statusConfig.label}
                </span>
              </div>
            </div>

            {detailLoading && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-sm text-blue-300 flex items-center gap-2">
                <Info className="h-4 w-4 flex-shrink-0" />
                Memuat histori masalah pengiriman...
              </div>
            )}

            <div className={`p-4 rounded-xl border ${
              hasIssueHistory
                ? hasOpenIssue
                  ? 'bg-orange-500/10 border-orange-500/40'
                  : 'bg-red-500/10 border-red-500/30'
                : 'bg-emerald-500/10 border-emerald-500/30'
            }`}>
              <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${
                hasIssueHistory
                  ? hasOpenIssue ? 'text-orange-400' : 'text-red-400'
                  : 'text-emerald-400'
              }`}>
                {hasIssueHistory ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Riwayat Masalah Pengiriman
              </h3>
              <p className={`text-sm ${
                hasIssueHistory
                  ? hasOpenIssue ? 'text-orange-200/80' : 'text-red-200/80'
                  : 'text-emerald-200/80'
              }`}>
                {hasIssueHistory
                  ? hasOpenIssue
                    ? `Pernah bermasalah dan masih menunggu review Admin Manager (${issueCount || 1} catatan).`
                    : `Pernah bermasalah${shipment.approvedAt ? ' dan sudah direview Admin Manager' : ''} (${issueCount || 1} catatan).`
                  : 'Tidak ada histori masalah pada pengiriman ini.'}
              </p>
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

            {shipment.receiptFileUrl && (
              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30">
                <h3 className="text-sm font-semibold text-sky-400 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Tanda Terima
                </h3>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-700 dark:text-neutral-100">
                      {shipment.receiptFileName || 'Tanda terima penerimaan'}
                    </p>
                    <p className="text-xs text-sky-300">
                      {shipment.receiptMimeType === 'application/pdf' ? 'PDF' : 'JPG'}
                      {shipment.receiptFileSize ? ` - ${(shipment.receiptFileSize / (1024 * 1024)).toFixed(1)} MB` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleViewReceipt}
                    disabled={loadingReceipt}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-sky-600 disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" />
                    {loadingReceipt ? 'Memuat...' : 'Lihat File'}
                  </button>
                </div>
              </div>
            )}

            {/* Items Section */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <h3 className="text-sm font-semibold text-blue-400 mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Daftar Item ({shipment.items.length})
              </h3>
              
              <div className="space-y-2">
                {shipment.items.map((item) => {
                  const hasOverstock = item.overstockQty && item.overstockQty > 0;
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border ${
                        hasOverstock 
                          ? 'bg-purple-500/10 border-purple-500/30' 
                          : 'bg-blue-500/10 border-blue-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-neutral-700 dark:text-neutral-200">
                          {item.productName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold px-3 py-1 rounded-full text-sm ${
                            hasOverstock 
                              ? 'text-purple-400 bg-purple-500/15' 
                              : 'text-blue-400 bg-blue-500/15'
                          }`}>
                            {item.sentQty} {item.unit}
                          </span>
                          {item.receivedQty !== undefined && item.receivedQty !== item.sentQty && (
                            <span className="text-xs text-red-400 px-2 py-1 bg-red-500/15 rounded-full">
                              Diterima: {item.receivedQty}
                            </span>
                          )}
                        </div>
                      </div>
                      {hasOverstock && (
                        <div className="mt-2 pt-2 border-t border-purple-500/20">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-semibold">
                              +{item.overstockQty} lebih dari permintaan
                            </span>
                            {item.requestedQty && (
                              <span className="text-neutral-500">
                                (diminta: {item.requestedQty} {item.unit})
                              </span>
                            )}
                          </div>
                          {/* Overstock Reason - Amber Box */}
                          <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                            <div className="flex items-start gap-2">
                              <Info className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-semibold text-amber-400">Alasan Kelebihan:</p>
                                <p className="text-sm text-amber-300 mt-1">
                                  {item.overstockReason || `Kelebihan pengiriman +${item.overstockQty} ${item.unit}`}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overstock Summary */}
            {shipment.items.some(item => item.overstockQty && item.overstockQty > 0) && (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <h3 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Ringkasan Overstock
                </h3>
                <div className="space-y-3">
                  {shipment.items
                    .filter(item => item.overstockQty && item.overstockQty > 0)
                    .map((item) => (
                      <div key={item.id} className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600 dark:text-neutral-300 font-medium">{item.productName}</span>
                          <span className="font-semibold text-purple-400">+{item.overstockQty} {item.unit}</span>
                        </div>
                        {/* Overstock Reason */}
                        <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
                          <div className="flex items-start gap-2">
                            <Info className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-300">
                              <span className="font-semibold">Alasan:</span> {item.overstockReason || `Kelebihan pengiriman +${item.overstockQty} ${item.unit}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
                <p className="mt-3 text-xs text-purple-300 border-t border-purple-500/20 pt-3">
                  Item overstock akan ditambahkan ke stok cabang tujuan dan dapat digunakan untuk mengurangi permintaan stok berikutnya.
                </p>
              </div>
            )}

            {/* Issue History */}
            {hasIssueHistory && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40">
                <h3 className="text-sm font-semibold text-red-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Histori Pengiriman Bermasalah ({issueCount || 1})
                </h3>

                {discrepancies.length > 0 ? (
                  <div className="space-y-3">
                    {discrepancies.map((d, index) => {
                      const difference = d.expectedQty - d.receivedQty;

                      return (
                        <div
                          key={d.id || index}
                          className="p-3 rounded-lg bg-red-500/10 border border-red-500/30"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-neutral-700 dark:text-neutral-200">
                                {d.productName}
                              </div>
                              <div className="mt-1 text-xs text-red-300">
                                Dilaporkan: {formatDateTime(d.createdAt)}
                              </div>
                            </div>
                            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
                              {DISCREPANCY_LABELS[d.discrepancyType] || d.discrepancyType}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="rounded-lg bg-neutral-950/5 p-2 dark:bg-neutral-950/30">
                              <div className="text-neutral-500 dark:text-neutral-400">Seharusnya</div>
                              <div className="mt-1 font-bold text-neutral-800 dark:text-neutral-100">
                                {formatQuantity(d.expectedQty)}
                              </div>
                            </div>
                            <div className="rounded-lg bg-neutral-950/5 p-2 dark:bg-neutral-950/30">
                              <div className="text-neutral-500 dark:text-neutral-400">Diterima</div>
                              <div className="mt-1 font-bold text-neutral-800 dark:text-neutral-100">
                                {formatQuantity(d.receivedQty)}
                              </div>
                            </div>
                            <div className="rounded-lg bg-red-500/10 p-2">
                              <div className="text-red-300">Selisih</div>
                              <div className="mt-1 font-bold text-red-300">
                                {formatQuantity(Math.abs(difference))}
                              </div>
                            </div>
                          </div>

                          {d.notes && (
                            <p className="mt-3 rounded-lg bg-neutral-950/5 p-3 text-sm text-neutral-600 dark:bg-neutral-950/30 dark:text-neutral-300">
                              {d.notes}
                            </p>
                          )}

                          {d.photoUrl && (
                            <a
                              href={d.photoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-red-300 hover:text-red-200"
                            >
                              <FileText className="h-4 w-4" />
                              Lihat bukti foto{d.photoFileName ? ` (${d.photoFileName})` : ''}
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-200/80">
                    Pengiriman ini ditandai pernah bermasalah, namun detail item masalah belum tersedia.
                  </p>
                )}

                {reviewHistory.length > 0 && (
                  <div className="mt-4 rounded-lg bg-orange-500/10 border border-orange-500/30 p-3">
                    <div className="text-xs font-semibold uppercase text-orange-300 mb-2">
                      Histori Review Admin Manager
                    </div>
                    <div className="space-y-2">
                      {reviewHistory.map((line, index) => (
                        <p key={`${line}-${index}`} className="text-sm text-orange-100/85">
                          {line.replace('[Review Admin Manager]', '').trim()}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {shipment.status === 'RECEIVED_WITH_ISSUE' && !shipment.approvedAt && (
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/40">
                <h3 className="text-sm font-semibold text-orange-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Menunggu Review Admin Manager
                </h3>
                <p className="text-sm text-orange-200/80 leading-relaxed">
                  Pengiriman ini sudah diterima cabang dengan ketidaksesuaian. Admin Manager harus menentukan apakah kekurangan barang dikirim ulang, kasus ditutup dengan catatan, atau kasus diselesaikan.
                </p>
              </div>
            )}

            {shipment.approvedAt && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Sudah Direview Admin Manager
                </h3>
                <p className="text-sm text-emerald-200/80">
                  Direview pada {new Date(shipment.approvedAt).toLocaleString('id-ID')}.
                </p>
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
            {shipment.stockRequest && (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <h3 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Request Stok Terkait
                </h3>
                <p className="font-semibold text-neutral-700 dark:text-neutral-200">
                  {shipment.stockRequest.requestCode}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex-shrink-0">
            {onReviewIssue && (
              <>
                <button
                  onClick={() => onReviewIssue('SEND_SHORTAGE')}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2 disabled:opacity-50"
                >
                  <Truck className="h-4 w-4" />
                  Kirim Kekurangan
                </button>
                <button
                  onClick={() => onReviewIssue('CLOSE_CASE')}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30 flex items-center gap-2 disabled:opacity-50"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Tutup Kasus
                </button>
                <button
                  onClick={() => onReviewIssue('COMPLETE_CASE')}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2 disabled:opacity-50"
                >
                  <PackageCheck className="h-4 w-4" />
                  Selesaikan
                </button>
              </>
            )}
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
    </ShipmentModal>
  );
}
