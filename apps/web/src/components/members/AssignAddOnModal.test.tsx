import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AssignAddOnModal, { type AddOnTransactionData } from './AssignAddOnModal';

function Harness({ onSubmit }: { onSubmit: () => void }) {
  const [data, setData] = useState<AddOnTransactionData>({
    selectedAddOns: [],
    transactionDate: '2026-09-03',
    sellerMsoId: '',
    notes: '',
  });

  return (
    <AssignAddOnModal
      show
      branchName="Raho Premier Jakarta"
      msoStaff={[{
        userId: 'mso-1',
        staffCode: 'MSO-001',
        fullName: 'MSO Satu',
        role: 'ADMIN_LAYANAN',
      }]}
      loadingMsoStaff={false}
      data={data}
      submitting={false}
      onChange={setData}
      onClose={() => undefined}
      onSubmit={onSubmit}
    />
  );
}

describe('AssignAddOnModal', () => {
  it('creates a standalone Air Nano selection from the dedicated modal', () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    expect(screen.getByRole('heading', { name: 'Tambah Air Nano & Add-On' })).toBeInTheDocument();
    expect(screen.getByText('Cabang transaksi: Raho Premier Jakarta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buat Transaksi' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/MSO yang menjual/i), {
      target: { value: 'mso-1' },
    });

    fireEvent.click(screen.getByRole('checkbox', {
      name: /Air Nano Kuning 600ml 1 Botol/i,
    }));

    expect(screen.getByRole('button', { name: 'Buat Transaksi' })).toBeEnabled();
    expect(screen.getAllByText('Rp 15.000').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Buat Transaksi' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
