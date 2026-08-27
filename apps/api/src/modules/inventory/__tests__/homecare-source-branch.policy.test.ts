import { BranchType } from '@prisma/client';
import { canSupplyHomecareBagRequest } from '../homecare-source-branch.policy';

describe('homecare source branch policy', () => {
  it('allows a bag to use stock from its own branch', () => {
    expect(canSupplyHomecareBagRequest(
      { id: 'branch-a', type: BranchType.PREMIER },
      { id: 'branch-a', type: BranchType.PREMIER },
    )).toBe(true);
  });

  it('allows Central Stock to supply a Partnership team bag', () => {
    expect(canSupplyHomecareBagRequest(
      { id: 'partnership', type: BranchType.PARTNERSHIP },
      { id: 'central', type: BranchType.PUSAT },
    )).toBe(true);
  });

  it('rejects arbitrary cross-branch sources', () => {
    expect(canSupplyHomecareBagRequest(
      { id: 'branch-a', type: BranchType.PREMIER },
      { id: 'branch-b', type: BranchType.PREMIER },
    )).toBe(false);
  });
});
