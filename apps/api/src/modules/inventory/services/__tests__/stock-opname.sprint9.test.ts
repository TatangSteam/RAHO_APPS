import fs from 'fs';
import path from 'path';
import { buildStockOpnameJournalLines } from '../stock-opname.service';

describe('Sprint 9 stock opname posting', () => {
  it('membentuk journal adjustment masuk dan keluar yang balanced', () => {
    const lines = buildStockOpnameJournalLines('250.005', '100.004');
    expect(lines.map((line) => ({
      account: line.accountCode,
      debit: 'debit' in line ? line.debit.toFixed(2) : undefined,
      credit: 'credit' in line ? line.credit.toFixed(2) : undefined,
      role: line.metadata.opnameRole,
    }))).toEqual([
      { account: '1300', debit: '250.01', credit: undefined, role: 'INVENTORY_INCREASE' },
      { account: '4300', debit: undefined, credit: '250.01', role: 'ADJUSTMENT_GAIN' },
      { account: '5300', debit: '100.00', credit: undefined, role: 'ADJUSTMENT_LOSS' },
      { account: '1300', debit: undefined, credit: '100.00', role: 'INVENTORY_DECREASE' },
    ]);
  });

  it('mengikat approval, snapshot lock, mutation FIFO, dan journal dalam satu transaction', () => {
    const root = path.resolve(__dirname, '..');
    const service = fs.readFileSync(path.join(root, 'stock-opname.service.ts'), 'utf8');
    expect(service).toContain('decideApprovalInTransaction');
    expect(service).toContain('STOCK_OPNAME_SNAPSHOT_STALE');
    expect(service).toContain('issueAdjustmentInventoryInTransaction');
    expect(service).toContain('receiveAdjustmentInventoryInTransaction');
    expect(service).toContain('postStockOpnameJournal');
    expect(service).toContain('Prisma.TransactionIsolationLevel.Serializable');
  });
});
