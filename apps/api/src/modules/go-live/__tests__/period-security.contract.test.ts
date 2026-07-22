import fs from 'fs';
import path from 'path';

describe('Sprint 11 period and security hardening contract', () => {
  const root = path.resolve(__dirname, '..', '..');
  const accounting = fs.readFileSync(path.join(root, 'accounting', 'accounting.service.ts'), 'utf8');
  const evidence = fs.readFileSync(path.join(root, 'invoices', 'services', 'invoice-retrieval.service.ts'), 'utf8');

  it('menolak posting pada period non-OPEN dan mengambil row lock', () => {
    expect(accounting).toContain('FOR SHARE');
    expect(accounting).toContain("lockedPeriod.status !== AccountingPeriodStatus.OPEN");
    expect(accounting).toContain("'ACCOUNTING_PERIOD_CLOSED'");
  });

  it('period LOCKED tidak dapat dibuka melalui API umum dan perubahan diaudit', () => {
    expect(accounting).toContain('ACCOUNTING_PERIOD_LOCKED');
    expect(accounting).toContain("resource: 'AccountingPeriod'");
    expect(accounting).toContain('reason: input.reason');
  });

  it('evidence invoice menerapkan branch scope dan permission server-side', () => {
    expect(evidence).toContain('assertBranchAccess');
    expect(evidence).toContain('INVOICE_PROOF_READ');
    expect(evidence).toContain('GetObjectCommand');
  });
});
