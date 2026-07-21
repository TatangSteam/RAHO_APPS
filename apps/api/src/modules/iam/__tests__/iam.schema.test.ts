import {
  replaceUserBranchScopeSchema,
  replaceUserOverridesSchema,
} from '../iam.schema';

describe('IAM schemas', () => {
  it('requires at least one branch and a primary branch within scope', () => {
    expect(replaceUserBranchScopeSchema.safeParse({ branchIds: [] }).success).toBe(false);
    expect(replaceUserBranchScopeSchema.safeParse({
      branchIds: ['branch-a'],
      primaryBranchId: 'branch-b',
    }).success).toBe(false);
    expect(replaceUserBranchScopeSchema.safeParse({
      branchIds: ['branch-a', 'branch-b'],
      primaryBranchId: 'branch-b',
    }).success).toBe(true);
  });

  it('rejects duplicate permission overrides in the same scope', () => {
    const result = replaceUserOverridesSchema.safeParse({
      overrides: [
        { permissionCode: 'INVOICE.READ', effect: 'ALLOW', reason: 'Kebutuhan operasional' },
        { permissionCode: 'INVOICE.READ', effect: 'DENY', reason: 'Konflik konfigurasi' },
      ],
    });
    expect(result.success).toBe(false);
  });
});
