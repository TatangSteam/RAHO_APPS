import { Role } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ALLSTAFF } from '../authorize';

describe('authorization role groups', () => {
  it('treats Finance & Logistics Controller as a staff role', () => {
    expect(ALLSTAFF).toContain(Role.FINANCE_LOGISTICS_CONTROLLER);
  });

  it('guards inventory ledger reads with the shared staff role group', () => {
    const routes = readFileSync(
      resolve(process.cwd(), 'src/modules/inventory/inventory.routes.ts'),
      'utf8',
    );
    const balanceRoute = routes.match(
      /router\.get\('\/ledger\/balances',[\s\S]*?inventoryLedgerController\.balances\.bind\(inventoryLedgerController\)\);/,
    )?.[0];

    expect(routes).toContain("import { ALLSTAFF, authorize } from '../../middleware/authorize';");
    expect(balanceRoute).toContain('authorize(ALLSTAFF)');
  });
});
