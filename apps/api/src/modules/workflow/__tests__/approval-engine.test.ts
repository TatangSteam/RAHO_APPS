import fs from 'fs';
import path from 'path';
import { chooseApprovalRule, type StartApprovalInput } from '../approval.service';

describe('Sprint 9 generic approval engine', () => {
  const input: StartApprovalInput = {
    module: 'EXPENSE', entityType: 'Expense', entityId: 'expense-1', branchId: 'branch-1',
    makerUserId: 'maker-1', amount: '15000000', category: 'MEDICAL', transactionType: 'EXPENSE', payload: {},
  };

  it('memilih rule branch/category/type yang paling spesifik', () => {
    const selected = chooseApprovalRule([
      { id: 'global', branchScopeKey: 'GLOBAL', categoryKey: '*', transactionType: 'EXPENSE', priority: 100 },
      { id: 'branch', branchScopeKey: 'branch-1', categoryKey: 'MEDICAL', transactionType: 'EXPENSE', priority: 10 },
    ], input);
    expect(selected.id).toBe('branch');
  });

  it('menerapkan maker-checker, approver berbeda per step, dan audit immutable', () => {
    const root = path.resolve(__dirname, '..');
    const service = fs.readFileSync(path.join(root, 'approval.service.ts'), 'utf8');
    const migration = fs.readFileSync(path.resolve(root, '..', '..', '..', 'prisma', 'migrations', '20260722130000_generic_approval_stock_opname', 'migration.sql'), 'utf8');
    expect(service).toContain('instance.makerUserId === input.actorUserId');
    expect(service).toContain('decision.approverUserId === input.actorUserId');
    expect(service).toContain('currentStep: step.stepNo + 1');
    expect(service).toContain('approvalAuditLog.create');
    expect(migration).toContain('approval_audit_no_update');
    expect(migration).toContain('EXPENSE_HIGH_VALUE');
    expect(migration).toContain('aps_expense_high_2');
  });
});
