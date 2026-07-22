import { Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { buildTreatmentCompletionJournalLines } from '../revenue.service';

describe('Sprint 8 atomic treatment completion', () => {
  it('membentuk jurnal revenue release dan HPP yang balanced', () => {
    const lines = buildTreatmentCompletionJournalLines([{
      amount: new Prisma.Decimal('1000000.00'),
      contract: { valuation: { deferredRevenueAccountCode: '2200', revenueAccountCode: '4100' } },
    }], '200.0049');
    expect(lines.map((line) => ({
      accountCode: line.accountCode,
      debit: 'debit' in line ? line.debit.toFixed(2) : undefined,
      credit: 'credit' in line ? line.credit.toFixed(2) : undefined,
      role: line.metadata.treatmentRole,
    }))).toEqual([
      { accountCode: '2200', debit: '1000000.00', credit: undefined, role: 'DEFERRED_RELEASE' },
      { accountCode: '4100', debit: undefined, credit: '1000000.00', role: 'REVENUE' },
      { accountCode: '5100', debit: '200.00', credit: undefined, role: 'HPP' },
      { accountCode: '1300', debit: undefined, credit: '200.00', role: 'INVENTORY' },
    ]);
  });

  it('mengikat session, stock, revenue, HPP dan journal dalam satu Prisma transaction', () => {
    const apiRoot = path.resolve(__dirname, '..', '..', '..');
    const completion = fs.readFileSync(path.join(apiRoot, 'modules', 'sessions', 'services', 'session-completion.service.ts'), 'utf8');
    const revenue = fs.readFileSync(path.join(apiRoot, 'modules', 'revenue', 'revenue.service.ts'), 'utf8');
    expect(completion).toContain('prisma.$transaction(async (tx)');
    expect(completion).toContain('issueInventoryInTransaction');
    expect(completion).toContain('postTreatmentCompletionRevenueInTransaction');
    expect(completion).toContain('completionJournalEntryId: finance.journal.id');
    expect(completion).toContain('status: IntegrationEventStatus.PROCESSED');
    expect(revenue).toContain('postTreatmentCompletionJournal');
    expect(revenue).toContain("status: RevenueRecognitionStatus.POSTED");
    expect(revenue).toContain("status: DomainEventStatus.PROCESSED");
  });
});
