import type { Role } from '@/types/auth';
import type { StockRequest } from './types';

export function isStockRequestManager(role?: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN_MANAGER';
}

export function formatStockRequestDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function canCreateStockRequestInvoice(request: StockRequest, role?: Role): boolean {
  if (!isStockRequestManager(role) || request.invoice) return false;
  if (request.status === 'PENDING') return true;
  return (
    ['APPROVED', 'PARTIALLY_APPROVED'].includes(request.status) &&
    request.shipment?.status === 'PREPARING'
  );
}

export function getStockRequestRowActions(request: StockRequest, role?: Role) {
  const isManager = isStockRequestManager(role);
  const isDebtInvoice = request.invoice?.status === 'DEBT';
  const remainingAmount =
    request.invoice?.remainingAmount ??
    Math.max(0, (request.invoice?.totalAmount ?? 0) - (request.invoice?.paidAmount ?? 0));
  const isFreeInvoice = Boolean(request.invoice) && (request.invoice?.totalAmount ?? 0) <= 0;
  const hasActivePaymentProof = Boolean(request.paymentProofUrl || request.paymentUploadedAt || request.invoice?.paymentProofUrl);
  const hasShipment = Boolean(request.shipment);
  const canEditPendingRequest = isManager && request.status === 'PENDING';
  const canEditWaitingInvoice =
    isManager &&
    request.status === 'WAITING_PAYMENT' &&
    Boolean(request.invoice) &&
    !hasActivePaymentProof &&
    !hasShipment;

  return {
    isDebtInvoice,
    canReview:
      canCreateStockRequestInvoice(request, role) ||
      (request.status === 'PAYMENT_UPLOADED' && isManager),
    canEditRequest: canEditPendingRequest || canEditWaitingInvoice,
    canUploadPayment:
      isManager &&
      !isFreeInvoice &&
      (request.status === 'WAITING_PAYMENT' || (isDebtInvoice && remainingAmount > 0)),
  };
}
