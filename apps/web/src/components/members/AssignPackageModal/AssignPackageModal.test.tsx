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

describe('AssignPackageModal add-on purchase', () => {
  it('allows an add-on-only selection and enables submission', () => {
    const onSubmit = jest.fn();
    render(<AssignPackageHarness onSubmit={onSubmit} />);

    fireEvent.click(
      screen.getByRole('checkbox', { name: /Air Nano Kuning 600ml 1 Botol/i }),
    );

    expect(screen.getByRole('button', { name: 'Assign 1 Item' })).toBeEnabled();
    expect(screen.getAllByText('Rp 15.000').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Assign 1 Item' }));
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
});
