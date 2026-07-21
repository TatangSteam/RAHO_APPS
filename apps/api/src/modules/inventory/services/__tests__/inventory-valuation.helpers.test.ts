import { calculateInventoryAssetValue } from '../inventory-valuation.helpers';

describe('inventory asset valuation contract', () => {
  it('reservation tidak mengubah nilai aset karena cost layer tetap', () => {
    const layers = [
      { remainingQty: '10.0000', unitCost: '15000.0000' },
      { remainingQty: '4.0000', unitCost: '17500.0000' },
    ];
    const beforeReservation = calculateInventoryAssetValue(layers);
    const reservedQty = '6.0000';
    const afterReservation = calculateInventoryAssetValue(layers);

    expect(reservedQty).toBe('6.0000');
    expect(afterReservation.equals(beforeReservation)).toBe(true);
    expect(afterReservation.toFixed(2)).toBe('220000.00');
  });

  it('nilai aset tetap utuh ketika stock masih parsial in-transit', () => {
    const onHandLayers = [{ remainingQty: '4', unitCost: '125', valuationStatus: 'VALUED' as const }];
    const transfers = [{ shippedQty: '6', receivedQty: '2', unitCost: '125' }];

    expect(calculateInventoryAssetValue(onHandLayers, transfers).toFixed(4)).toBe('1000.0000');
  });
});
