import { fireEvent, render, screen } from '@testing-library/react';
import MemberAddOnsTab from './MemberAddOnsTab';
import type { StandaloneAddOn } from '@/types/package';

describe('MemberAddOnsTab', () => {
  it('shows a dedicated empty state', () => {
    render(<MemberAddOnsTab addOns={[]} loading={false} />);

    expect(screen.getByText('Belum ada transaksi Add-On')).toBeInTheDocument();
  });

  it('shows an existing Air Nano transaction', () => {
    const addOn: StandaloneAddOn = {
      isGroup: false,
      isAddOn: true,
      id: 'addon-1',
      addOnId: 'addon-1',
      addOnCode: 'ADO-PUS-2609-0001',
      addOnType: 'AIR_NANO',
      quantity: 2,
      pricePerUnit: 15_000,
      totalPrice: 30_000,
      status: 'PENDING_PAYMENT',
      notes: 'Air Nano Kuning 600ml 1 Botol (PRD-ANN-KNG-001)',
      transactionDate: '2026-09-03',
      sellerMsoId: 'mso-1',
      sellerMsoName: 'MSO Satu',
      branchName: 'Raho Premier Jakarta',
      assignedBy: 'Admin Cabang',
      createdAt: '2026-09-03T00:00:00.000Z',
    };

    render(<MemberAddOnsTab addOns={[addOn]} loading={false} />);

    expect(screen.getByText('Air Nano Kuning 600ml 1 Botol')).toBeInTheDocument();
    expect(screen.getByText(/Qty: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/MSO: MSO Satu/i)).toBeInTheDocument();
    expect(screen.getByText(/03 Sep 2026/i)).toBeInTheDocument();
  });

  it('offers Super Admin cancellation for unpaid add-ons', () => {
    const onCancelAddOn = jest.fn();
    const addOn: StandaloneAddOn = {
      isGroup: false,
      isAddOn: true,
      id: 'addon-pending',
      addOnId: 'addon-pending',
      addOnCode: 'ADO-PENDING-001',
      addOnType: 'AIR_NANO',
      quantity: 1,
      pricePerUnit: 15_000,
      totalPrice: 15_000,
      status: 'PENDING_PAYMENT',
      branchName: 'Raho Premier Jakarta',
      assignedBy: 'Super Admin',
      createdAt: '2026-09-22T00:00:00.000Z',
    };

    render(
      <MemberAddOnsTab
        addOns={[addOn]}
        loading={false}
        onCancelAddOn={onCancelAddOn}
      />,
    );

    fireEvent.click(screen.getByText('ADO-PENDING-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Hapus & Kembalikan Stok' }));

    expect(onCancelAddOn).toHaveBeenCalledWith('addon-pending', 'ADO-PENDING-001');
  });

  it('offers Super Admin stock return for paid add-ons', () => {
    const onReturnAddOn = jest.fn();
    const addOn: StandaloneAddOn = {
      isGroup: false,
      isAddOn: true,
      id: 'addon-active',
      addOnId: 'addon-active',
      addOnCode: 'ADO-ACTIVE-001',
      addOnType: 'AIR_NANO',
      quantity: 2,
      pricePerUnit: 15_000,
      totalPrice: 30_000,
      status: 'ACTIVE',
      branchName: 'Raho Premier Jakarta',
      assignedBy: 'Super Admin',
      createdAt: '2026-09-22T00:00:00.000Z',
    };

    render(
      <MemberAddOnsTab
        addOns={[addOn]}
        loading={false}
        onReturnAddOn={onReturnAddOn}
      />,
    );

    fireEvent.click(screen.getByText('ADO-ACTIVE-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Batalkan & Kembalikan Stok' }));

    expect(onReturnAddOn).toHaveBeenCalledWith('addon-active', 'ADO-ACTIVE-001', 30_000);
  });
});
