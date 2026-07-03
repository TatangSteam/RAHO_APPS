import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Truck } from 'lucide-react';
import { ShipmentModal } from './ShipmentModal';

afterEach(cleanup);

describe('ShipmentModal', () => {
  it('renders a shipment shell and forwards close actions', () => {
    const onClose = jest.fn();

    render(
      <ShipmentModal
        icon={<Truck data-testid="shipment-icon" />}
        iconClassName="from-blue-400 to-blue-600"
        open
        subtitle="SHP-001"
        title="Kirim Pengiriman"
        footer={<button type="button">Kirim</button>}
        onClose={onClose}
      >
        Detail shipment
      </ShipmentModal>,
    );

    expect(screen.getByRole('dialog', { name: 'Kirim Pengiriman' })).toBeVisible();
    expect(screen.getByText('SHP-001')).toBeVisible();
    expect(screen.getByTestId('shipment-icon')).toBeVisible();
    expect(screen.getByText('Detail shipment')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Tutup modal' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
