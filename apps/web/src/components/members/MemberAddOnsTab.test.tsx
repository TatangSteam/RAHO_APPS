import { render, screen } from '@testing-library/react';
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
});
