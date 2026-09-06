import { fireEvent, render, screen } from '@testing-library/react';
import type { MemberDetail } from '@/types/member';
import MemberStatusCards from './MemberStatusCards';

describe('MemberStatusCards', () => {
  it('offers the same balance-edit action for BASIC and BOOSTER vouchers', () => {
    const onEditBasicVoucher = jest.fn();
    const onEditBoosterVoucher = jest.fn();
    const member = {
      isActive: true,
      isDeceased: false,
      isConsentToPhoto: false,
      memberRank: 'A',
      lastPurchaseDiscountPercent: 0,
    } as MemberDetail;

    render(
      <MemberStatusCards
        member={member}
        packages={[]}
        canEditVoucher
        onEditBasicVoucher={onEditBasicVoucher}
        onEditBoosterVoucher={onEditBoosterVoucher}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit voucher BASIC' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit voucher BOOSTER' }));

    expect(onEditBasicVoucher).toHaveBeenCalledTimes(1);
    expect(onEditBoosterVoucher).toHaveBeenCalledTimes(1);
  });
});
