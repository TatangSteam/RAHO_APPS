import fs from 'fs';
import path from 'path';

describe('Sprint 8 AC-001/AC-002 integration contract', () => {
  const apiRoot = path.resolve(__dirname, '..', '..', '..');
  const payment = fs.readFileSync(
    path.join(apiRoot, 'modules', 'invoices', 'services', 'invoice-payment.service.ts'),
    'utf8',
  );
  const completion = fs.readFileSync(
    path.join(apiRoot, 'modules', 'sessions', 'services', 'session-completion.service.ts'),
    'utf8',
  );
  const revenue = fs.readFileSync(path.join(apiRoot, 'modules', 'revenue', 'revenue.service.ts'), 'utf8');
  const accounting = fs.readFileSync(path.join(apiRoot, 'modules', 'accounting', 'accounting.service.ts'), 'utf8');
  const deletion = fs.readFileSync(
    path.join(apiRoot, 'modules', 'sessions', 'services', 'session-deletion.service.ts'),
    'utf8',
  );
  const migration = fs.readFileSync(
    path.resolve(apiRoot, '..', 'prisma', 'migrations', '20260722130000_atomic_treatment_completion', 'migration.sql'),
    'utf8',
  );

  it('AC-001 keeps payment cash posting and deferred funding in the same transaction', () => {
    const transactionStart = payment.indexOf('return prisma.$transaction(async (tx) =>');
    const journalPosting = payment.indexOf('const posted = await postJournal({', transactionStart);
    const deferredFunding = payment.indexOf('fundPackageDeferredRevenueInTransaction({', journalPosting);
    expect(transactionStart).toBeGreaterThan(-1);
    expect(journalPosting).toBeGreaterThan(transactionStart);
    expect(deferredFunding).toBeGreaterThan(journalPosting);
    expect(payment).toContain('payment.invoice.settlementAccountCode, credit: payment.amount');
  });

  it('AC-002 posts FIFO, revenue, HPP, journal and session state through one transaction client', () => {
    expect(completion).toContain('issueInventoryInTransaction(userId');
    expect(completion).toContain('postTreatmentCompletionFinancialsInTransaction({');
    expect(completion).toContain('completionJournalEntryId: finance.journalEntryId');
    expect(completion).toContain('Prisma.TransactionIsolationLevel.Serializable');
    expect(revenue).toContain("{ accountCode: '5100', debit: materialCost");
    expect(revenue).toContain("{ accountCode: '1300', credit: materialCost");
    expect(accounting).toContain('postTreatmentCompletionDerivedJournal');
  });

  it('guards duplicate completion and provides an auditable cancellation reversal', () => {
    expect(completion).toContain('WHERE "id" = ${sessionId} FOR UPDATE');
    expect(completion).toContain('TREATMENT-CANCEL:${session.id}:${input.idempotencyKey}');
    expect(completion).toContain('reverseInventoryPostingInTransaction');
    expect(completion).toContain('reverseTreatmentCompletionFinancialsInTransaction');
    expect(deletion).toContain('POSTED_SESSION_IMMUTABLE');
    expect(migration).toContain('treatment_sessions_cancellationIdempotencyKey_key');
    expect(migration).toContain('TREATMENT.COMPLETION.REVERSE');
  });
});
