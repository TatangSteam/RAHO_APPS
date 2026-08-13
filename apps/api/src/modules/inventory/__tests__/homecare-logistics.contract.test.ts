import fs from 'fs';
import path from 'path';
import { createHomecareTeamSchema } from '../logistics.schema';

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
});
