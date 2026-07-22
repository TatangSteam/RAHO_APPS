import { AccountType, NormalBalance } from '@prisma/client';
import { buildProfitLoss, buildTrialBalance, reconciliationResult } from '../finance-report.helpers';
import { financeReportQuerySchema } from '../finance-report.schema';

const line = (overrides: Partial<any>) => ({ accountId: 'account-1', code: '1000', name: 'Account', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, debit: '0', credit: '0', ...overrides });

describe('Sprint 10 finance report helpers', () => {
  it('menghitung P&L dari debit/kredit ledger tanpa sumber transaksi operasional', () => {
    const result = buildProfitLoss([
      line({ accountId: 'rev', code: '4100', type: AccountType.REVENUE, normalBalance: NormalBalance.CREDIT, credit: '1000.00' }),
      line({ accountId: 'rev', code: '4100', type: AccountType.REVENUE, normalBalance: NormalBalance.CREDIT, debit: '100.00' }),
      line({ accountId: 'hpp', code: '5100', type: AccountType.EXPENSE, debit: '250.00' }),
    ]);
    expect(result).toMatchObject({ totalRevenue: '900.00', totalExpense: '250.00', netProfit: '650.00' });
  });

  it('membawa opening dan menghasilkan trial balance balanced', () => {
    const result = buildTrialBalance(
      [line({ accountId: 'cash', code: '1100', debit: '500.00' }), line({ accountId: 'equity', code: '3100', type: AccountType.EQUITY, normalBalance: NormalBalance.CREDIT, credit: '500.00' })],
      [line({ accountId: 'cash', code: '1100', debit: '100.00' }), line({ accountId: 'rev', code: '4100', type: AccountType.REVENUE, normalBalance: NormalBalance.CREDIT, credit: '100.00' })],
    );
    expect(result.balanced).toBe(true);
    expect(result.totalDebit).toBe('100.00');
    expect(result.totalCredit).toBe('100.00');
    expect(result.accounts.find((row) => row.code === '1100')?.endingBalance).toBe('600.00');
  });

  it('menandai selisih subledger secara eksplisit', () => {
    expect(reconciliationResult('100.00', '99.00')).toEqual({ ledgerBalance: '100.00', subledgerBalance: '99.00', difference: '1.00', reconciled: false });
  });

  it('memakai batas hari bisnis Asia/Jakarta secara inklusif', () => {
    const query = financeReportQuerySchema.parse({ startDate: '2026-07-22', endDate: '2026-07-22' });
    expect(query.startDate?.toISOString()).toBe('2026-07-21T17:00:00.000Z');
    expect(query.endDate?.toISOString()).toBe('2026-07-22T16:59:59.999Z');
  });
});
