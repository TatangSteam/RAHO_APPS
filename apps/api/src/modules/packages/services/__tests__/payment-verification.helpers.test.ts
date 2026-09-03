import { PackageStatus } from '@prisma/client';
import { canVerifyPurchasePayment } from '../payment-verification.helpers';

describe('canVerifyPurchasePayment', () => {
  it('accepts an active installment using the purchase snapshot', () => {
    expect(canVerifyPurchasePayment({
      status: PackageStatus.ACTIVE,
      paymentPlanType: 'INSTALLMENT',
      paymentPlanStatus: 'ACTIVE_INSTALLMENT',
    }, null, true, false)).toBe(true);
  });

  it('uses the pending installment invoice when an older purchase snapshot is stale', () => {
    expect(canVerifyPurchasePayment({
      status: PackageStatus.ACTIVE,
      paymentPlanType: 'FULL_PAYMENT',
      paymentPlanStatus: null,
    }, {
      paymentPlanType: 'INSTALLMENT',
    }, true, false)).toBe(true);
  });

  it('does not reactivate expired purchases even when an invoice is pending', () => {
    expect(canVerifyPurchasePayment({
      status: PackageStatus.EXPIRED,
      paymentPlanType: 'INSTALLMENT',
      paymentPlanStatus: 'ACTIVE_INSTALLMENT',
    }, {
      paymentPlanType: 'INSTALLMENT',
    }, true, false)).toBe(false);
  });

  it('requires proof for a pending paid purchase', () => {
    const purchase = { status: PackageStatus.PENDING_PAYMENT };

    expect(canVerifyPurchasePayment(purchase, null, false, false)).toBe(false);
    expect(canVerifyPurchasePayment(purchase, null, true, false)).toBe(true);
  });
});
