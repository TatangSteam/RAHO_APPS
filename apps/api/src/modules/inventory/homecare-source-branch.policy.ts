import { BranchType } from '@prisma/client';

type BranchScope = { id: string; type: BranchType };

/**
 * A homecare bag normally consumes stock from its own branch. Partnership
 * teams are the exception because their stock is supplied by Central Stock.
 */
export function canSupplyHomecareBagRequest(
  requestBranch: BranchScope,
  sourceBranch: BranchScope,
) {
  if (requestBranch.id === sourceBranch.id) return true;
  return requestBranch.type === BranchType.PARTNERSHIP
    && sourceBranch.type === BranchType.PUSAT;
}
