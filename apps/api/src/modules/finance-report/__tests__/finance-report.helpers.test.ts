import { AccountType, NormalBalance } from '@prisma/client';
import { agingClassification, buildChangesInEquity, buildFinancialPosition, buildProfitLoss, buildTrialBalance, reconciliationResult, summarizeAging } from '../finance-report.helpers';
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

  it('jurnal asli dan jurnal reversal menghasilkan dampak bersih nol', () => {
    const result = buildProfitLoss([
      line({ accountId: 'rev', code: '4100', type: AccountType.REVENUE, normalBalance: NormalBalance.CREDIT, credit: '1000.00' }),
      line({ accountId: 'rev', code: '4100', type: AccountType.REVENUE, normalBalance: NormalBalance.CREDIT, debit: '1000.00' }),
    ]);

    expect(result).toMatchObject({ totalRevenue: '0.00', netProfit: '0.00' });
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

  it('membangun posisi keuangan yang seimbang dengan laba belum ditutup', () => {
    const result = buildFinancialPosition([
      line({ accountId: 'cash', code: '1100', debit: '1000.00' }),
      line({ accountId: 'ap', code: '2100', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, credit: '200.00' }),
      line({ accountId: 'equity', code: '3100', type: AccountType.EQUITY, normalBalance: NormalBalance.CREDIT, credit: '500.00' }),
      line({ accountId: 'revenue', code: '4100', type: AccountType.REVENUE, normalBalance: NormalBalance.CREDIT, credit: '400.00' }),
      line({ accountId: 'expense', code: '5100', type: AccountType.EXPENSE, debit: '100.00' }),
    ]);
    expect(result).toMatchObject({ totalAssets: '1000.00', totalLiabilities: '200.00', postedEquity: '500.00', unclosedEarnings: '300.00', totalEquity: '800.00', balanced: true, difference: '0.00' });
  });

  it('menjelaskan perubahan ekuitas dari saldo awal, transaksi modal, dan laba periode', () => {
    const result = buildChangesInEquity(
      [
        line({ accountId: 'equity', code: '3100', type: AccountType.EQUITY, normalBalance: NormalBalance.CREDIT, credit: '500.00' }),
        line({ accountId: 'old-revenue', code: '4100', type: AccountType.REVENUE, normalBalance: NormalBalance.CREDIT, credit: '100.00' }),
      ],
      [
        line({ accountId: 'equity', code: '3100', type: AccountType.EQUITY, normalBalance: NormalBalance.CREDIT, credit: '50.00' }),
        line({ accountId: 'revenue', code: '4100', type: AccountType.REVENUE, normalBalance: NormalBalance.CREDIT, credit: '200.00' }),
        line({ accountId: 'expense', code: '5100', type: AccountType.EXPENSE, debit: '25.00' }),
      ],
    );
    expect(result).toMatchObject({ openingTotalEquity: '600.00', directEquityMovement: '50.00', periodProfit: '175.00', endingTotalEquity: '825.00' });
  });

  it('mengelompokkan aging berdasarkan hari kalender Jakarta', () => {
    const asOf = new Date('2026-08-12T12:00:00.000Z');
    expect(agingClassification(new Date('2026-08-12T00:00:00.000+07:00'), asOf)).toEqual({ daysPastDue: 0, bucket: 'CURRENT' });
    expect(agingClassification(new Date('2026-07-13T00:00:00.000+07:00'), asOf)).toEqual({ daysPastDue: 30, bucket: 'DAYS_1_30' });
    expect(agingClassification(new Date('2026-05-01T00:00:00.000+07:00'), asOf)).toEqual({ daysPastDue: 103, bucket: 'OVER_90' });
    expect(summarizeAging([
      { balance: '100.00', bucket: 'CURRENT' },
      { balance: '25.00', bucket: 'OVER_90' },
    ])).toMatchObject({ totalOutstanding: '125.00', buckets: { CURRENT: '100.00', OVER_90: '25.00' } });
  });
});
