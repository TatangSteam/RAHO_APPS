import fs from 'fs';
import path from 'path';

describe('approval engine cross-module contract', () => {
  it.each([
    ['expenses/expense.service.ts', 'EXPENSE'],
    ['purchasing/purchasing.service.ts', 'PURCHASE_REQUEST'],
    ['inventory/services/stock-reservation.service.ts', 'STOCK_REQUEST'],
    ['inventory/services/stock-opname.service.ts', 'STOCK_OPNAME'],
  ])('%s memakai approval engine untuk %s', (relative, moduleName) => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', '..', relative), 'utf8');
    expect(source).toContain('startApprovalInTransaction');
    expect(source).toContain('decideApprovalInTransaction');
    expect(source).toContain(`module: '${moduleName}'`);
  });
});
