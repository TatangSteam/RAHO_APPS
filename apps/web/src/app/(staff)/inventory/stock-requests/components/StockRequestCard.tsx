'use client';

import { 
  Clock, 
  CreditCard, 
  Upload, 
  CheckCircle, 
  Truck, 
  CheckCheck, 
  XCircle,
  Package,
  FileText,
  Eye,
  ClipboardCheck,
  Receipt,
  Calendar,
  Building2
} from 'lucide-react';
import { StockRequest, StockRequestStatus } from '../types';

interface StockRequestCardProps {
  request: StockRequest;
  userRole?: string;
  onReview: (request: StockRequest) => void;
  onUploadPayment?: (request: StockRequest) => void;
  onReceive?: (request: StockRequest) => void;
}

const STATUS_CONFIG: Record<StockRequestStatus, { 
  label: string; 
  icon: React.ReactNode; 
  bgColor: string; 
  textColor: string;
  borderColor: string;
}> = {
  PENDING: { 
    label: 'Menunggu Review', 
    icon: <Clock className="w-3.5 h-3.5" />, 
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    textColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-500/30'
  },
  APPROVED: { 
    label: 'Disetujui', 
    icon: <CheckCircle className="w-3.5 h-3.5" />, 
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-500/30'
  },
  WAITING_PAYMENT: { 
    label: 'Menunggu Pembayaran', 
    icon: <CreditCard className="w-3.5 h-3.5" />, 
    bgColor: 'bg-purple-50 dark:bg-purple-500/10',
    textColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-500/30'
  },
  PAYMENT_UPLOADED: { 
    label: 'Bukti Diupload', 
    icon: <Upload className="w-3.5 h-3.5" />, 
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-500/30'
  },
  PAYMENT_CONFIRMED: { 
    label: 'Pembayaran Dikonfirmasi', 
    icon: <CheckCircle className="w-3.5 h-3.5" />, 
    bgColor: 'bg-cyan-50 dark:bg-cyan-500/10',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    borderColor: 'border-cyan-200 dark:border-cyan-500/30'
  },
  REJECTED: { 
    label: 'Ditolak', 
    icon: <XCircle className="w-3.5 h-3.5" />, 
    bgColor: 'bg-red-50 dark:bg-red-500/10',
    textColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-500/30'
  },
  SHIPPED: { 
    label: 'Dikirim', 
    icon: <Truck className="w-3.5 h-3.5" />, 
    bgColor: 'bg-indigo-50 dark:bg-indigo-500/10',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    borderColor: 'border-indigo-200 dark:border-indigo-500/30'
  },
  COMPLETED: { 
    label: 'Selesai', 
    icon: <CheckCheck className="w-3.5 h-3.5" />, 
    bgColor: 'bg-green-50 dark:bg-green-500/10',
    textColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-500/30'
  },
  COMPLETED_WITH_ISSUE: { 
    label: 'Selesai (Ada Masalah)', 
    icon: <CheckCheck className="w-3.5 h-3.5" />, 
    bgColor: 'bg-orange-50 dark:bg-orange-500/10',
    textColor: 'text-orange-600 dark:text-orange-400',
    borderColor: 'border-orange-200 dark:border-orange-500/30'
  },
};

export default function StockRequestCard({ 
  request, 
  userRole, 
  onReview,
  onUploadPayment,
  onReceive,
}: StockRequestCardProps) {
  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.PENDING;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isManager = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_MANAGER';
  const isAdminCabang = userRole === 'ADMIN_CABANG';
  
  const canReview = isManager && ['PENDING', 'PAYMENT_UPLOADED'].includes(request.status);
  const canUploadPayment = isManager && request.status === 'WAITING_PAYMENT';
  const canReceive = isAdminCabang && request.status === 'SHIPPED';

  return (
    <div className="group bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-lg hover:border-amber-300 dark:hover:border-amber-500/50 transition-all duration-300 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white truncate">
              {request.requestCode}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                {request.branchName}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                request.branchType === 'PREMIERE' 
                  ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' 
                  : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
              }`}>
                {request.branchType}
              </span>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}>
            {statusConfig.icon}
            <span className="hidden sm:inline">{statusConfig.label}</span>
          </div>
        </div>

        {/* Bundle Indicator */}
        {request.itemCount > 1 && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 mb-3">
            <Package className="w-3.5 h-3.5" />
            Bundle: {request.itemCount} item
          </div>
        )}

        {/* Items Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Items
            </span>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md">
              {request.itemCount}
            </span>
          </div>
          
          <div className="space-y-1.5">
            {request.items.slice(0, 2).map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-700/50"
              >
                <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate flex-1 mr-2">
                  {item.productName}
                </span>
                <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                  {item.requestedQty} {item.unit}
                </span>
              </div>
            ))}
            {request.items.length > 2 && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center py-1">
                +{request.items.length - 2} item lainnya
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="px-5 space-y-2">
        {/* Invoice Info */}
        {request.invoice && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {request.invoice.invoiceNumber}
              </span>
            </div>
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(request.invoice.totalAmount)}
            </span>
          </div>
        )}

        {/* Shipment Info */}
        {request.shipment && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
                {request.shipment.shipmentCode}
              </span>
            </div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/20 px-2 py-0.5 rounded-md">
              {request.shipment.status}
            </span>
          </div>
        )}

        {/* Payment Proof Indicator */}
        {request.paymentProofUrl && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Bukti pembayaran sudah diupload
            </span>
          </div>
        )}

        {/* Notes */}
        {request.notes && (
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-700/50 border border-neutral-200 dark:border-neutral-600">
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Catatan:</p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-2">{request.notes}</p>
          </div>
        )}

        {/* Review Notes */}
        {request.reviewNotes && (
          <div className={`p-3 rounded-xl border-l-4 ${
            request.status === 'REJECTED' 
              ? 'bg-red-50 dark:bg-red-500/10 border-red-500' 
              : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500'
          }`}>
            <p className={`text-xs font-semibold mb-1 ${
              request.status === 'REJECTED' 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {request.status === 'REJECTED' ? 'Alasan Penolakan:' : 'Catatan Review:'}
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-2">
              {request.reviewNotes}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto p-5 pt-4 border-t border-neutral-100 dark:border-neutral-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(request.createdAt)}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {canReview && (
              <button
                onClick={() => onReview(request)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 shadow-sm hover:shadow transition-all"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                {request.status === 'PENDING' ? 'Review' : 'Konfirmasi'}
              </button>
            )}

            {canUploadPayment && onUploadPayment && (
              <button
                onClick={() => onUploadPayment(request)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-500 text-white hover:bg-purple-600 shadow-sm hover:shadow transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Bukti
              </button>
            )}

            {canReceive && onReceive && (
              <button
                onClick={() => onReceive(request)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm hover:shadow transition-all"
              >
                <Package className="w-3.5 h-3.5" />
                Terima
              </button>
            )}

            {!canReview && !canUploadPayment && !canReceive && (
              <button
                onClick={() => onReview(request)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-500 dark:bg-neutral-600 text-white hover:bg-neutral-600 dark:hover:bg-neutral-500 shadow-sm hover:shadow transition-all"
              >
                <Eye className="w-3.5 h-3.5" />
                Lihat Detail
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
