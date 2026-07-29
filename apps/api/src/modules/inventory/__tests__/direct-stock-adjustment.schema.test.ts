import { readFileSync } from 'fs';
import { resolve } from 'path';
import { directStockAdjustmentSchema } from '../inventory-control.schema';

const validInput = {
  idempotencyKey: 'DIRECT-STOCK-001',
  adjustment: 5,
  unitCost: 25000,
  notes: 'Koreksi stok fisik oleh Super Admin',
};

describe('directStockAdjustmentSchema', () => {
  it('menerima penambahan dan pengurangan stok serta memakai reason OTHER', () => {
    const incoming = directStockAdjustmentSchema.parse(validInput);
    const outgoing = directStockAdjustmentSchema.parse({ ...validInput, adjustment: '-2.5' });

    expect(incoming.adjustment).toBe('5');
    expect(incoming.unitCost).toBe('25000');
    expect(incoming.reasonCode).toBe('OTHER');
    expect(outgoing.adjustment).toBe('-2.5');
  });

  it('menolak adjustment nol dan harga pokok nol', () => {
    expect(directStockAdjustmentSchema.safeParse({ ...validInput, adjustment: 0 }).success).toBe(false);
    expect(directStockAdjustmentSchema.safeParse({ ...validInput, unitCost: 0 }).success).toBe(false);
  });

  it('menolak adjustment dengan lebih dari empat desimal', () => {
    expect(directStockAdjustmentSchema.safeParse({
      ...validInput,
      adjustment: '1.00001',
    }).success).toBe(false);
  });

  it('membatasi endpoint direct adjustment hanya untuk Super Admin', () => {
    const routes = readFileSync(resolve(process.cwd(), 'src/modules/inventory/inventory.routes.ts'), 'utf8');
    const directRoute = routes.match(
      /router\.patch\(\s*'\/items\/:itemId\/adjust-stock',[\s\S]*?inventoryControlController\.directAdjustStock\.bind\(inventoryControlController\)\s*\)/,
    )?.[0];

    expect(directRoute).toContain('authorize(superAdminOnly)');
  });
});
