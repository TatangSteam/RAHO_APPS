import { PackageStatus } from '@prisma/client';

interface PurchasePaymentState {
  status: PackageStatus;
  paymentPlanType?: string | null;
  paymentPlanStatus?: string | null;
}

interface PendingInvoiceState {
  paymentPlanType?: string | null;
}

/**
 * The pending invoice is the authoritative source for an installment that is
 * currently collectible. This also repairs compatibility with older purchase
 * rows whose denormalized paymentPlanStatus was not updated.
 */
export function canVerifyPurchasePayment(
  purchase: PurchasePaymentState,
  pendingInvoice: PendingInvoiceState | null | undefined,
  hasPaymentProof: boolean,
  isComplimentary: boolean,
): boolean {
  if (purchase.status === PackageStatus.WAITING_VERIFICATION) {
    return true;
  }

  if (purchase.status === PackageStatus.PENDING_PAYMENT) {
    return hasPaymentProof || isComplimentary;
  }

  if (purchase.status !== PackageStatus.ACTIVE) {
    return false;
  }

  const purchaseHasActiveInstallment = purchase.paymentPlanType === 'INSTALLMENT'
    && purchase.paymentPlanStatus === 'ACTIVE_INSTALLMENT';
  const invoiceHasActiveInstallment = pendingInvoice?.paymentPlanType === 'INSTALLMENT';

  return purchaseHasActiveInstallment || invoiceHasActiveInstallment;
}
