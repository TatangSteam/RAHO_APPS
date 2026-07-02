import {
  allocateInvoiceItems,
  cloneInvoiceItemsForAllocation,
  type InvoiceItemForAllocation,
} from '../invoice-generation.helpers';

const items: InvoiceItemForAllocation[] = [
  {
    itemType: 'PACKAGE',
    itemId: 'pkg-1',
    code: 'PKG-1',
    description: 'Paket 1',
    quantity: 1,
    pricePerUnit: 100000,
    subtotal: 100000,
    discountAmount: 0,
    totalAmount: 100000,
  },
  {
    itemType: 'ADDON',
    itemId: 'addon-1',
    code: 'ADD-1',
    description: 'Add on 1',
    quantity: 1,
    pricePerUnit: 50000,
    subtotal: 50000,
    discountAmount: 0,
    totalAmount: 50000,
  },
];

describe('invoice generation helpers', () => {
  describe('allocateInvoiceItems', () => {
    it('allocates installment amount proportionally across items', () => {
      const allocated = allocateInvoiceItems(items, 75000, 150000);

      expect(allocated.map((item) => item.totalAmount)).toEqual([50000, 25000]);
      expect(allocated.map((item) => item.subtotal)).toEqual([50000, 25000]);
      expect(allocated.map((item) => item.discountAmount)).toEqual([0, 0]);
    });

    it('puts rounding remainder on the last item', () => {
      const allocated = allocateInvoiceItems(
        [
          { ...items[0], totalAmount: 1, subtotal: 1 },
          { ...items[1], totalAmount: 1, subtotal: 1 },
          { ...items[1], itemId: 'addon-2', totalAmount: 1, subtotal: 1 },
        ],
        100,
        3
      );

      expect(allocated.map((item) => item.totalAmount)).toEqual([33, 33, 34]);
    });

    it('allocates entire amount to first item when source total is unavailable', () => {
      const allocated = allocateInvoiceItems(items, 120000, 0);

      expect(allocated[0]).toEqual(
        expect.objectContaining({
          description: 'Paket 1 - Termin',
          pricePerUnit: 120000,
          subtotal: 120000,
          totalAmount: 120000,
          discountAmount: 0,
        })
      );
      expect(allocated[1]).toEqual(
        expect.objectContaining({
          description: 'Add on 1',
          pricePerUnit: 0,
          subtotal: 0,
          totalAmount: 0,
          discountAmount: 0,
        })
      );
    });

    it('returns an empty list for empty source items', () => {
      expect(allocateInvoiceItems([], 100000, 100000)).toEqual([]);
    });
  });

  describe('cloneInvoiceItemsForAllocation', () => {
    it('clones invoice items into numeric allocation input', () => {
      expect(
        cloneInvoiceItemsForAllocation([
          {
            itemType: 'PACKAGE',
            itemId: 'pkg-1',
            code: 'PKG-1',
            description: 'Paket 1',
            quantity: 1,
            pricePerUnit: '100000' as unknown as number,
            subtotal: '100000' as unknown as number,
            discountAmount: 5000,
            totalAmount: '95000' as unknown as number,
          },
        ])
      ).toEqual([
        {
          itemType: 'PACKAGE',
          itemId: 'pkg-1',
          code: 'PKG-1',
          description: 'Paket 1',
          quantity: 1,
          pricePerUnit: 100000,
          subtotal: 100000,
          discountAmount: 0,
          totalAmount: 95000,
        },
      ]);
    });
  });
});
