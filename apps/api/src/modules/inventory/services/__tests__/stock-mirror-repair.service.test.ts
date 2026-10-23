import { Prisma } from '@prisma/client';
import { repairStockMirrorInTransaction } from '../inventory-ledger.service';

const decimal = (value: number) => new Prisma.Decimal(value);
function fixture(stock: number, onHand: number, layerQty: number) {
  const item = { id: 'item', branchId: 'branch', masterProductId: 'product', stockLocationId: 'location', stock: decimal(stock) };
  const tx = {
    inventoryBalance: { findMany: jest.fn().mockResolvedValue([
      { onHandQty: decimal(onHand), costLayers: [{ remainingQty: decimal(layerQty) }] },
    ]) },
    inventoryItem: { update: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return { item, tx };
}

describe('verified stock mirror repair', () => {
  it.each([[2, 10], [20, 10], [2, 0]])('repairs mirror %s to ledger %s and audits the change', async (stock, quantity) => {
    const { item, tx } = fixture(stock, quantity, quantity);
    expect(await repairStockMirrorInTransaction(tx as any, 'actor', item)).toEqual({ repaired: true, blocked: false });
    expect(item.stock.toNumber()).toBe(quantity);
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      beforeData: { stock: String(stock) }, afterData: { stock: String(quantity), reason: 'STOCK_MIRROR_REPAIR' },
    }) }));
  });
  it('does not manufacture quantity when ledger and layers disagree', async () => {
    const { item, tx } = fixture(2, 10, 3);
    expect(await repairStockMirrorInTransaction(tx as any, 'actor', item)).toEqual({ repaired: false, blocked: true });
    expect(tx.inventoryItem.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
  it('is a no-op on repeated repair', async () => {
    const { item, tx } = fixture(2, 10, 10);
    await repairStockMirrorInTransaction(tx as any, 'actor', item);
    await repairStockMirrorInTransaction(tx as any, 'actor', item);
    expect(tx.inventoryItem.update).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
  it('blocks a missing ledger rather than clearing existing stock', async () => {
    const { item, tx } = fixture(2, 0, 0);
    tx.inventoryBalance.findMany.mockResolvedValue([]);
    expect(await repairStockMirrorInTransaction(tx as any, 'actor', item)).toEqual({ repaired: false, blocked: true });
    expect(tx.inventoryItem.update).not.toHaveBeenCalled();
  });
});
