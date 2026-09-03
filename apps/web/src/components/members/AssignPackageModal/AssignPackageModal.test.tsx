import { useState, type ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AssignPackageModal from './index';

type AssignData = ComponentProps<typeof AssignPackageModal>['assignData'];

const initialAssignData: AssignData = {
  selectedPackages: [],
  selectedAddOns: [],
  discountPercent: 0,
  discountAmount: 0,
  discountNote: '',
  notes: '',
  paymentPlan: {
    type: 'FULL_PAYMENT' as const,
    installmentCount: 2,
  },
};

function AssignPackageHarness({
  onSubmit,
  pricings = [],
  pricingScopeName,
}: {
  onSubmit: () => void;
  pricings?: ComponentProps<typeof AssignPackageModal>['pricings'];
  pricingScopeName?: string;
}) {
  const [assignData, setAssignData] = useState(initialAssignData);

  return (
    <AssignPackageModal
      show
      pricings={pricings}
      pricingScopeName={pricingScopeName}
      assignData={assignData}
      submitting={false}
      onClose={() => undefined}
      onAssignDataChange={setAssignData}
      onSubmit={onSubmit}
    />
  );
}

describe('AssignPackageModal package assignment', () => {
  it('removes add-on choices and only enables submission after selecting a package', () => {
    const onSubmit = jest.fn();
    render(
      <AssignPackageHarness
        onSubmit={onSubmit}
        pricings={[{
          id: 'basic-pricing',
          branchId: 'branch-jakarta',
          packageType: 'BASIC',
          totalSessions: 1,
          price: 2_000_000,
          boosterType: null,
          serviceType: 'PM',
          productCode: 'SRV-TNB-TRP-HC-001',
          name: 'Terapi Nano Bubble 1X',
          isActive: true,
          createdAt: '2026-09-02T00:00:00.000Z',
          updatedAt: '2026-09-02T00:00:00.000Z',
        }]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Assign Paket' })).toBeInTheDocument();
    expect(screen.queryByText(/ADD-ON PRODUK/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Air Nano Kuning 600ml/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pilih Paket' })).toBeDisabled();

    fireEvent.click(
      screen.getByRole('checkbox', { name: /Terapi Nano Bubble 1X/i }),
    );

    expect(screen.getByRole('button', { name: 'Assign 1 Paket' })).toBeEnabled();
    expect(screen.getAllByText('Rp 2.000.000').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Assign 1 Paket' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows only active package pricing from the refreshed member scope', () => {
    const basePricing = {
      branchId: 'branch-jakarta',
      packageType: 'BASIC' as const,
      totalSessions: 7,
      price: 5_000_000,
      boosterType: null,
      serviceType: 'PM',
      productCode: 'TNB-P7-PM',
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    };

    render(
      <AssignPackageHarness
        onSubmit={jest.fn()}
        pricingScopeName="Raho Premier Jakarta"
        pricings={[
          { ...basePricing, id: 'active-pricing', name: 'Paket Aktif', isActive: true },
          { ...basePricing, id: 'inactive-pricing', name: 'Paket Nonaktif', productCode: 'TNB-P7-OLD', isActive: false },
        ]}
      />,
    );

    expect(screen.getByText('Katalog harga aktif: Raho Premier Jakarta')).toBeInTheDocument();
    expect(screen.getByText('Paket Aktif')).toBeInTheDocument();
    expect(screen.queryByText('Paket Nonaktif')).not.toBeInTheDocument();
  });

  it('allows Program Sosial to be assigned directly using its branch price', () => {
    render(
      <AssignPackageHarness
        onSubmit={jest.fn()}
        pricings={[{
          id: 'social-pricing',
          branchId: 'branch-jakarta',
          packageType: 'BASIC',
          totalSessions: 1,
          price: 500_000,
          boosterType: null,
          serviceType: 'PS',
          productCode: 'SRV-TNB-TRP-PS-001',
          name: 'Terapi Nano Bubble 1X (Program Sosial)',
          isActive: true,
          createdAt: '2026-09-02T00:00:00.000Z',
          updatedAt: '2026-09-02T00:00:00.000Z',
        }]}
      />,
    );

    expect(screen.getByText('Rp 500.000')).toBeInTheDocument();
    const socialProgramCheckbox = screen.getByRole('checkbox', {
      name: /Terapi Nano Bubble 1X \(Program Sosial\)/i,
    });
    expect(socialProgramCheckbox).toBeEnabled();

    fireEvent.click(socialProgramCheckbox);

    expect(screen.getByRole('button', { name: 'Assign 1 Paket' })).toBeEnabled();
  });
});
