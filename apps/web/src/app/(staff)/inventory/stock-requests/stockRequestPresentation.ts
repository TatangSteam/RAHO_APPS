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

export function getStockRequestRowActions(request: StockRequest, role?: Role) {
  const isManager = isStockRequestManager(role);
  const isDebtInvoice = request.invoice?.status === 'DEBT';
  const remainingAmount =
    request.invoice?.remainingAmount ??
    Math.max(0, (request.invoice?.totalAmount ?? 0) - (request.invoice?.paidAmount ?? 0));
  const isFreeInvoice = Boolean(request.invoice) && (request.invoice?.totalAmount ?? 0) <= 0;

  return {
    isDebtInvoice,
    canReview:
      (request.status === 'PENDING' && isManager) ||
      (request.status === 'PAYMENT_UPLOADED' && isManager),
    canEditRequest: isManager && request.status === 'PENDING',
    canUploadPayment:
      isManager &&
      !isFreeInvoice &&
      (request.status === 'WAITING_PAYMENT' || (isDebtInvoice && remainingAmount > 0)),
  };
}
