import fs from 'fs';
import path from 'path';
import {
  createHomecareTeamSchema,
  createHomecareTeamLoanSchema,
  reviewHomecareTeamLoanSchema,
  updateHomecareBagSchema,
  updateHomecareTeamSchema,
} from '../logistics.schema';

describe('homecare logistics operational contract', () => {
  const moduleRoot = path.resolve(__dirname, '..');
  const service = fs.readFileSync(path.join(moduleRoot, 'logistics.service.ts'), 'utf8');
  const routes = fs.readFileSync(path.join(moduleRoot, 'inventory.routes.ts'), 'utf8');

  it('requires two distinct staff accounts when a team is created', () => {
    expect(createHomecareTeamSchema.safeParse({
      name: 'Tim Homecare A',
      branchId: 'branch-1',
    }).success).toBe(false);

    expect(createHomecareTeamSchema.safeParse({
      name: 'Tim Homecare A',
      branchId: 'branch-1',
      adminLayananUserId: 'admin-1',
      nakesUserId: 'nakes-1',
    }).success).toBe(true);

    expect(createHomecareTeamSchema.safeParse({
      name: 'Tim Homecare A',
      branchId: 'branch-1',
      adminLayananUserId: 'same-user',
      nakesUserId: 'same-user',
    }).success).toBe(false);
  });

  it('routes review to Admin Manager and preserves branch-stock location semantics', () => {
    expect(routes).toContain("authorize(canReviewBagStockRequest)");
    expect(service).toContain("role: Role.ADMIN_MANAGER");
    expect(service).toContain("code: 'HOMECARE_APPROVER_NOT_FOUND'");
    expect(service).toContain("code: 'HOMECARE_SERVICE_BRANCH_REQUIRED'");
    expect(service).toContain("code: 'HOMECARE_SOURCE_BRANCH_MISMATCH'");
    expect(service).toContain('locationType: params.locationType');
    expect(service).toContain('? LogisticLocationType.CENTRAL_STOCK');
    expect(service).toContain(': LogisticLocationType.BRANCH_STOCK');
  });

  it('exposes guarded edit and usage-history endpoints', () => {
    expect(routes).toContain("'/logistics/homecare-teams/:teamId'");
    expect(routes).toContain("'/logistics/homecare-bags/:bagId'");
    expect(routes).toContain("'/logistics/homecare-usage-history'");
    expect(routes).toContain("'/logistics/homecare-usage-history/export'");
    expect(routes).toContain('authorize(canManageCentralStock)');
    expect(routes).toContain('authorize(logisticStaffRoles)');
  });

  it('supports a simple guarded inter-team loan lifecycle', () => {
    expect(createHomecareTeamLoanSchema.safeParse({
      fromBagId: 'bag-lender',
      toBagId: 'bag-borrower',
      reason: 'Kebutuhan sesi hari ini',
      items: [{ masterProductId: 'product-1', quantity: 2 }],
    }).success).toBe(true);
    expect(createHomecareTeamLoanSchema.safeParse({
      fromBagId: 'same-bag',
      toBagId: 'same-bag',
      reason: 'Kebutuhan sesi hari ini',
      items: [{ masterProductId: 'product-1', quantity: 2 }],
    }).success).toBe(false);
    expect(reviewHomecareTeamLoanSchema.safeParse({ decision: 'APPROVE' }).success).toBe(true);
    expect(reviewHomecareTeamLoanSchema.safeParse({ decision: 'INVALID' }).success).toBe(false);
    expect(routes).toContain("'/logistics/homecare-team-loans'");
    expect(routes).toContain("'/logistics/homecare-team-loans/:loanId/review'");
    expect(routes).toContain("'/logistics/homecare-team-loans/:loanId/return'");
    expect(service).toContain('LogisticTransactionType.TEAM_LOAN');
    expect(service).toContain('LogisticTransactionType.TEAM_LOAN_RETURN');
    expect(service).toContain("code: 'CROSS_BRANCH_TEAM_LOAN'");
  });

  it('rejects a team id that does not own the selected bag', () => {
    expect(service).toContain("code: 'BAG_TEAM_MISMATCH'");
    expect(service).toContain('const teamId = bag.teamId;');
  });

  it('rejects empty or invalid team and bag edits', () => {
    expect(updateHomecareTeamSchema.safeParse({}).success).toBe(false);
    expect(updateHomecareTeamSchema.safeParse({ name: 'Tim Batavia', isActive: true }).success).toBe(true);
    expect(updateHomecareBagSchema.safeParse({}).success).toBe(false);
    expect(updateHomecareBagSchema.safeParse({ status: 'UNKNOWN' }).success).toBe(false);
    expect(updateHomecareBagSchema.safeParse({ status: 'IN_CHECKING' }).success).toBe(true);
  });

  it('keeps manager branch scope and product filtering in usage history', () => {
    expect(service).toContain('actor.role === Role.ADMIN_MANAGER');
    expect(service).toContain('where: { userId: actor.userId }');
    expect(service).toContain('!query.masterProductId || item.masterProductId === query.masterProductId');
    expect(service).toContain("workbook.addWorksheet('Penggunaan Inventori Tim'");
    expect(service).toContain('workbook.xlsx.writeBuffer()');
  });
});
