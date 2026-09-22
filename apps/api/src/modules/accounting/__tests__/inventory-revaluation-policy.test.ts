import { AccountType } from '@prisma/client';
import { expectedAdjustmentAccountType } from '../accounting.service';

describe('inventory adjustment account policy', () => {
  it('posts legacy opening valuation against equity instead of revenue', () => {
    expect(expectedAdjustmentAccountType('INVENTORY_REVALUATION', 'INVENTORY_IN'))
      .toBe(AccountType.ASSET);
    expect(expectedAdjustmentAccountType('INVENTORY_REVALUATION', 'GAIN'))
      .toBe(AccountType.EQUITY);
  });

  it('keeps operational adjustment gains and losses on profit and loss accounts', () => {
    expect(expectedAdjustmentAccountType('INVENTORY_ADJUSTMENT', 'GAIN'))
      .toBe(AccountType.REVENUE);
    expect(expectedAdjustmentAccountType('INVENTORY_ADJUSTMENT', 'LOSS'))
      .toBe(AccountType.EXPENSE);
  });
});
