import { render, screen } from '@testing-library/react';
import PackageRefundModal from './PackageRefundModal';

const noop = () => undefined;

describe('PackageRefundModal', () => {
  it('allows a free add-on to be cancelled with mandatory stock return', () => {
    render(
      <PackageRefundModal
        show
        packageCode="ADDON-FREE-001"
        finalPrice={0}
        reason="Transaksi salah input"
        refundAmount={0}
        returnAddOnsToStock
        submitting={false}
        onClose={noop}
        onReasonChange={noop}
        onRefundAmountChange={noop}
        onReturnAddOnsToStockChange={noop}
        onSubmit={noop}
        itemLabel="Add-On"
        forceReturnStock
        allowZeroRefund
      />,
    );

    expect(screen.getByRole('button', { name: 'Refund Add-On' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: /Kembalikan add-on fisik ke stok/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Kembalikan add-on fisik ke stok/i })).toBeDisabled();
  });

  it('still requires a positive refund for a package', () => {
    render(
      <PackageRefundModal
        show
        packageCode="PACKAGE-001"
        finalPrice={100_000}
        reason="Permintaan refund member"
        refundAmount={0}
        returnAddOnsToStock={false}
        submitting={false}
        onClose={noop}
        onReasonChange={noop}
        onRefundAmountChange={noop}
        onReturnAddOnsToStockChange={noop}
        onSubmit={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'Refund Paket' })).toBeDisabled();
  });
});
