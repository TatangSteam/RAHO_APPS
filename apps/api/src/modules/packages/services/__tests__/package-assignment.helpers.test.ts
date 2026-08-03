import {
  allocatePackageDiscount,
  calculatePurchaseDiscount,
  InvalidAddOnError,
  normalizeAddOnAssignments,
} from '../package-assignment.helpers';

describe('package assignment helpers', () => {
  describe('normalizeAddOnAssignments', () => {
    it('uses the server catalog instead of client-supplied price and name', () => {
      expect(
        normalizeAddOnAssignments([
          {
            type: 'AIR_NANO',
            code: 'ARN-CK-V06-BT',
            name: 'Manipulated name',
            price: 1,
            quantity: 2,
          },
        ]),
      ).toEqual([
        {
          type: 'AIR_NANO',
          code: 'PRD-ANN-KNG-001',
          name: 'Air Nano Kuning 600ml 1 Botol',
          price: 15_000,
          quantity: 2,
          inventorySku: 'PRD-ANN-KNG-001',
          inventoryQuantityPerUnit: 1,
        },
      ]);
    });

    it('combines duplicate product lines into one assignment', () => {
      const input = {
        type: 'ROKOK_KENKOU' as const,
        code: 'RKK-KK-BK',
        name: 'Rokok Kenkou 1 Bungkus',
        price: 20_000,
      };

      expect(
        normalizeAddOnAssignments([
          { ...input, quantity: 1 },
          { ...input, quantity: 2 },
        ]),
      ).toEqual([{
        ...input,
        code: 'PRD-CON-RKK-001',
        quantity: 3,
        inventorySku: 'PRD-CON-RKK-001',
        inventoryQuantityPerUnit: 1,
      }]);
    });

    it('maps a dus sale to the bottle-based inventory quantity', () => {
      expect(normalizeAddOnAssignments([{
        type: 'AIR_NANO',
        code: 'PRD-ANN-BRU-003',
        name: 'client display',
        price: 1,
        quantity: 2,
      }])).toEqual([{
        type: 'AIR_NANO',
        code: 'PRD-ANN-BRU-003',
        name: 'Air Nano Biru 600ml 1 Dus',
        price: 360_000,
        quantity: 2,
        inventorySku: 'PRD-ANN-BRU-001',
        inventoryQuantityPerUnit: 24,
      }]);
    });

    it('rejects an unknown code or mismatched type', () => {
      expect(() =>
        normalizeAddOnAssignments([
          {
            type: 'AIR_NANO',
            code: 'RKK-KK-BK',
            name: 'Invalid',
            price: 0,
            quantity: 1,
          },
        ]),
      ).toThrow(InvalidAddOnError);
    });
  });

  describe('calculatePurchaseDiscount', () => {
    it('combines percent and fixed discounts', () => {
      expect(calculatePurchaseDiscount(200_000, 10, 5_000)).toEqual({
        percentAmount: 20_000,
        fixedAmount: 5_000,
        totalDiscountAmount: 25_000,
      });
    });

    it('caps discounts at the purchase subtotal', () => {
      expect(calculatePurchaseDiscount(15_000, 100, 10_000)).toEqual({
        percentAmount: 15_000,
        fixedAmount: 10_000,
        totalDiscountAmount: 15_000,
      });
    });
  });

  describe('allocatePackageDiscount', () => {
    it('allocates a mixed purchase discount proportionally to packages', () => {
      expect(allocatePackageDiscount({
        packageSubtotal: 100_000,
        purchaseSubtotal: 200_000,
        purchaseDiscount: 50_000,
        remainingDiscount: 50_000,
        isLastPackage: true,
        hasAddOns: true,
      })).toBe(25_000);
    });

    it('uses the remainder for the final package when there are no add-ons', () => {
      expect(allocatePackageDiscount({
        packageSubtotal: 100_000,
        purchaseSubtotal: 300_000,
        purchaseDiscount: 30_000,
        remainingDiscount: 10_001,
        isLastPackage: true,
        hasAddOns: false,
      })).toBe(10_001);
    });

    it('never produces a negative package price', () => {
      expect(allocatePackageDiscount({
        packageSubtotal: 10_000,
        purchaseSubtotal: 10_000,
        purchaseDiscount: 50_000,
        remainingDiscount: 50_000,
        isLastPackage: true,
        hasAddOns: false,
      })).toBe(10_000);
    });
  });
});
