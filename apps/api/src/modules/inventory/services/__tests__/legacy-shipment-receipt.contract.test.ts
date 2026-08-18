import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('legacy shipment receipt inventory compatibility', () => {
  const service = readFileSync(
    resolve(__dirname, '../shipment-processing.service.ts'),
    'utf8',
  );

  it('synchronizes compatibility stock into the authoritative location ledger', () => {
    expect(service).toContain("sourceType: 'LEGACY_SHIPMENT_RECEIPT'");
    expect(service).toContain('postCompatibilityStockReceiptInTransaction(tx, {');
    expect(service).toContain('quantity: actualReceivedQty');
  });
});
