import { render, screen } from '@testing-library/react';
import PackageCancelModal from './PackageCancelModal';

const noop = () => undefined;

describe('PackageCancelModal', () => {
  it('prevents submission until the cancellation reason has five characters', () => {
    render(
      <PackageCancelModal
        show
        packageCode="ADDON-001"
        reason="satu"
        submitting={false}
        onClose={noop}
        onReasonChange={noop}
        onSubmit={noop}
        itemLabel="Add-On"
        returnsStock
      />,
    );

    expect(screen.getByRole('button', { name: 'Batalkan Pembelian' })).toBeDisabled();
    expect(screen.getByText(/Reservasi stok akan dilepas/i)).toBeInTheDocument();
  });
});
