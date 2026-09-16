import {
  canManageHomecareSetup,
  canRequestHomecareBagStock,
  canReviewHomecareBagStockRequests,
  canShipHomecareBagStock,
} from './inventoryRoleAccess';

describe('inventory role access', () => {
  it('allows Finance & Logistics Controller to manage and move homecare stock', () => {
    const role = 'FINANCE_LOGISTICS_CONTROLLER';

    expect(canManageHomecareSetup(role)).toBe(true);
    expect(canRequestHomecareBagStock(role)).toBe(true);
    expect(canShipHomecareBagStock(role)).toBe(true);
  });

  it('keeps homecare bag request approval as a manager checker action', () => {
    expect(canReviewHomecareBagStockRequests('FINANCE_LOGISTICS_CONTROLLER')).toBe(false);
    expect(canReviewHomecareBagStockRequests('ADMIN_MANAGER')).toBe(true);
  });
});
