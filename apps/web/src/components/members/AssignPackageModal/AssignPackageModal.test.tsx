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

function AssignPackageHarness({ onSubmit }: { onSubmit: () => void }) {
  const [assignData, setAssignData] = useState(initialAssignData);

  return (
    <AssignPackageModal
      show
      pricings={[]}
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
});
