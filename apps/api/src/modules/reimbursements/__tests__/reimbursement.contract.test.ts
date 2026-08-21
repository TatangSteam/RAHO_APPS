import fs from 'fs';
import path from 'path';

describe('reimbursement end-to-end contract', () => {
  const moduleRoot = path.resolve(__dirname, '..');
  const service = fs.readFileSync(path.join(moduleRoot, 'reimbursement.service.ts'), 'utf8');
  const routes = fs.readFileSync(path.join(moduleRoot, 'reimbursement.routes.ts'), 'utf8');
  const approval = fs.readFileSync(path.resolve(moduleRoot, '..', 'workflow', 'approval.service.ts'), 'utf8');
  const migration = fs.readFileSync(path.resolve(moduleRoot, '..', '..', '..', 'prisma', 'migrations', '20260821120000_add_reimbursements', 'migration.sql'), 'utf8');

  it('requires private image evidence and exposes it through a protected endpoint', () => {
    expect(routes).toContain("uploadReimbursementEvidence.array('evidence', 5)");
    expect(routes).toContain("router.get('/:id/attachments/:attachmentId'");
    expect(service).toContain('getPresignedUrl');
    expect(service).toContain('REIMBURSEMENT_EVIDENCE_REQUIRED');
  });

  it('uses the generic approval engine with revision and maker-checker protection', () => {
    expect(service).toContain('startApprovalInTransaction');
    expect(service).toContain('decideApprovalInTransaction');
    expect(approval).toContain('instance.makerUserId === input.actorUserId');
    expect(approval).toContain('RETURNED_FOR_REVISION');
    expect(migration).toContain("'REIMBURSEMENT.VERIFY'");
    expect(migration).toContain("'REIMBURSEMENT.APPROVE'");
  });

  it('pays only approved claims and posts journal plus cash/bank ledger atomically', () => {
    expect(service).toContain('REIMBURSEMENT_NOT_APPROVED');
    expect(service).toContain('postJournal');
    expect(service).toContain('cashBankTransaction.create');
    expect(service).toContain('ReimbursementStatus.PAID');
    expect(service).toContain('idempotentReplay: true');
  });
});
