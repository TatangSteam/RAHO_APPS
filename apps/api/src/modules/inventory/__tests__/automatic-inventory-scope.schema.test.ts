import {
  createAdjustmentSchema,
  startStockOpnameSchema,
} from '../inventory-control.schema';
import { postGoodsReceiptSchema } from '../goods-receipt.schema';
import { approveStockRequestReservationSchema } from '../stock-reservation.schema';
import { openingBalanceLineSchema } from '../../opening-balance/opening-balance.schema';
import { createGoodsReceiptSchema } from '../../purchasing/purchasing.schema';

const cuid = 'cm12345678901234567890123';

describe('automatic inventory scope contracts', () => {
  it('accepts adjustment and opname without a manually selected location', () => {
    expect(createAdjustmentSchema.parse({
      idempotencyKey: 'adjustment-auto-scope',
      branchId: cuid,
      reasonCode: 'OTHER',
      description: 'Koreksi stok terverifikasi',
      lines: [{
        inventoryItemId: cuid,
        direction: 'IN',
        quantity: '1',
        unitCost: '1000',
      }],
    }).stockLocationId).toBeUndefined();

    expect(startStockOpnameSchema.parse({
      branchId: cuid,
      notes: 'Opname bulanan',
    }).stockLocationId).toBeUndefined();
  });

  it('accepts goods receipt and reservation without a location reference', () => {
    const receipt = postGoodsReceiptSchema.parse({
      idempotencyKey: 'goods-receipt-auto-scope',
      receivedAt: '2026-07-31',
      lines: [{
        purchaseOrderItemId: cuid,
        quantity: '2',
        condition: 'GOOD',
      }],
    });
    expect(receipt.lines[0].stockLocationId).toBeUndefined();

    const reservation = approveStockRequestReservationSchema.parse({
      idempotencyKey: 'reservation-auto-scope',
      sourceBranchId: cuid,
      lines: [{ stockRequestItemId: cuid, approvedQty: '1' }],
    });
    expect(reservation.lines[0].stockLocationId).toBeUndefined();
  });

  it('keeps legacy location fields optional for opening and purchasing APIs', () => {
    expect(openingBalanceLineSchema.parse({
      type: 'INVENTORY',
      accountCode: '1300',
      description: 'Saldo awal persediaan',
      debit: '1000',
      credit: '0',
      inventoryItemId: cuid,
      quantity: '1',
      unitCost: '1000',
    }).stockLocationId).toBeUndefined();

    const legacyReceipt = createGoodsReceiptSchema.parse({
      idempotencyKey: 'legacy-receipt-auto-scope',
      receiptDate: '2026-07-31',
      lines: [{
        purchaseOrderItemId: cuid,
        inventoryItemId: cuid,
        quantity: '1',
      }],
    });
    expect(legacyReceipt.lines[0].stockLocationId).toBeUndefined();
  });
});
