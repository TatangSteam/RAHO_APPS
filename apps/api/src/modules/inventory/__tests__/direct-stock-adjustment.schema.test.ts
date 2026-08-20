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
    const outgoingWithoutUnitCost = directStockAdjustmentSchema.parse({
      idempotencyKey: 'DIRECT-STOCK-002',
      adjustment: -3,
      notes: 'Koreksi stok tanpa input harga',
    });

    expect(incoming.adjustment).toBe('5');
    expect(incoming.unitCost).toBe('25000');
    expect(incoming.reasonCode).toBe('OTHER');
    expect(outgoing.adjustment).toBe('-2.5');
    expect(outgoingWithoutUnitCost.unitCost).toBeUndefined();
    const incomingWithoutUnitCost = directStockAdjustmentSchema.parse({
      idempotencyKey: 'DIRECT-STOCK-003',
      adjustment: 3,
      notes: 'Penambahan stok tanpa harga',
    });
    expect(incomingWithoutUnitCost.unitCost).toBeUndefined();
  });

  it('menerima adjustment nol hanya untuk valuasi stok lama', () => {
    const valuationInput = {
      ...validInput,
      adjustment: 0,
      valuationDocumentReference: 'INV-OPENING-2026-001',
      reasonCode: 'LEGACY_OPENING_VALUATION',
    };
    expect(directStockAdjustmentSchema.safeParse(valuationInput).success).toBe(true);
    expect(directStockAdjustmentSchema.safeParse({ ...valuationInput, unitCost: undefined }).success).toBe(false);
    expect(directStockAdjustmentSchema.safeParse({ ...validInput, adjustment: 0 }).success).toBe(false);
    expect(directStockAdjustmentSchema.safeParse({
      ...valuationInput,
      reasonCode: 'OTHER',
    }).success).toBe(false);
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

  it('memisahkan valuasi legacy dari adjustment stok operasional', () => {
    const service = readFileSync(
      resolve(process.cwd(), 'src/modules/inventory/services/inventory-control.service.ts'),
      'utf8',
    );

    expect(service).toContain('adjustment.isZero() ? await valuePendingStockInTransaction');
    expect(service).toContain("'VALUATION_EVIDENCE_REQUIRED'");
    expect(service).toContain('sourceDocumentReference: input.valuationDocumentReference!');
  });

  it('memisahkan perubahan quantity dari valuasi harga', () => {
    const service = readFileSync(
      resolve(process.cwd(), 'src/modules/inventory/services/inventory-control.service.ts'),
      'utf8',
    );
    const ledger = readFileSync(
      resolve(process.cwd(), 'src/modules/inventory/services/inventory-ledger.service.ts'),
      'utf8',
    );

    expect(service).not.toContain('Harga pokok belum tersedia dari riwayat');
    expect(service).toContain('{ allowUnvaluedQuantity: true }');
    expect(service).toContain("adjustment.sourceType !== 'SUPER_ADMIN_DIRECT'");
    expect(service).toContain("adjustment.greaterThan(0) ? 'PENDING_VALUATION' : 'FIFO'");
    expect(ledger).toContain('InventoryValuationStatus.PENDING_VALUATION');
    expect(ledger).toContain('actualCost: unitCost ? totalCost : null');
  });
});
