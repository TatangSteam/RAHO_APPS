import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AssignAddOnModal, { type AddOnTransactionData } from './AssignAddOnModal';

function Harness({ onSubmit, available = true }: { onSubmit: () => void; available?: boolean }) {
  const [data, setData] = useState<AddOnTransactionData>({
    selectedAddOns: [],
    transactionDate: '2026-09-03',
    sellerMsoId: '',
    notes: '',
  });

  return (
    <AssignAddOnModal
      show
      availability={{ 'PRD-ANN-KNG-001': { code: 'PRD-ANN-KNG-001', availableUnits: available ? 2 : 0, reason: available ? null : 'Harga modal stok belum tersedia pada cabang ini.' } }}
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

  it('prevents unavailable stock from being selected or submitted', () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} available={false} />);
    const product = screen.getByRole('checkbox', { name: /Air Nano Kuning 600ml 1 Botol/i });
    expect(product).toBeDisabled();
    expect(screen.getByText('Harga modal stok belum tersedia pada cabang ini.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buat Transaksi' })).toBeDisabled();
  });
});
