import { canHandlePackagePayment } from './paymentAccess';

describe('canHandlePackagePayment', () => {
  it.each(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'SUPER_ADMIN', 'NURSE'])(
    'allows %s to upload or confirm package payments',
    (role) => {
      expect(canHandlePackagePayment(role)).toBe(true);
    },
  );

  it.each(['DOCTOR', 'MEMBER', 'ADMIN_LOGISTIK', undefined])(
    'does not grant package payment access to %s',
    (role) => {
      expect(canHandlePackagePayment(role)).toBe(false);
    },
  );
});
