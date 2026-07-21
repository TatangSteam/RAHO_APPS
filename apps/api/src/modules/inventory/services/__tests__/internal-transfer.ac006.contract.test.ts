import fs from 'fs';
import path from 'path';

describe('AC-006 internal transfer double-processing contract', () => {
  it('mengunci shipment dan memakai unique source posting untuk kedua jalur API', () => {
    const moduleRoot = path.resolve(__dirname, '..', '..');
    const logistics = fs.readFileSync(path.join(moduleRoot, 'logistics.service.ts'), 'utf8');
    const legacy = fs.readFileSync(path.join(moduleRoot, 'services', 'shipment-processing.service.ts'), 'utf8');
    const posting = fs.readFileSync(path.join(moduleRoot, 'services', 'internal-transfer-posting.service.ts'), 'utf8');
    const accounting = fs.readFileSync(path.join(moduleRoot, '..', 'accounting', 'accounting.service.ts'), 'utf8');
    const migration = fs.readFileSync(path.resolve(moduleRoot, '..', '..', '..', 'prisma', 'migrations', '20260721170000_add_internal_transfer_posting', 'migration.sql'), 'utf8');

    for (const service of [logistics, legacy]) {
      expect(service).toContain('FROM "shipments" WHERE "id" = ${shipmentId} FOR UPDATE');
    }
    expect(posting).toContain('TRANSFER_DISPATCH:${shipmentId}');
    expect(posting).toContain('TRANSFER_RECEIPT:${shipmentId}');
    expect(posting).toContain('internalTransferLedger.findUnique({ where: { shipmentId } })');
    expect(migration).toContain('internal_transfer_ledgers_shipmentId_key');
    expect(migration).toContain('internal_transfer_ledgers_dispatchJournalEntryId_key');
    expect(accounting).toContain('TRANSFER_JOURNAL_ACCOUNT_INVALID');
    expect(accounting).toContain("lineByAccount.get('1300')");
    expect(accounting).toContain("lineByAccount.get('1310')");
  });
});
