import { api } from '@/lib/api';

export interface FinanceFilters { branchId?: string; startDate?: string; endDate?: string }
export interface FinanceDashboard {
  source: string;
  period: { startDate: string; endDate: string };
  summary: { revenue: string; expense: string; netProfit: string; cashBank: string; deferredRevenue: string };
  reconciliation: { journalBalanced: boolean; cashBank: boolean; deferredRevenue: boolean; reconciled: boolean; checkedAt: string };
}
export interface ReportAccount { accountId: string; code: string; name: string; type: string; amount?: string; openingBalance?: string; debit?: string; credit?: string; endingBalance?: string }
export interface LedgerEntry { id: string; date: string; journalNumber: string; description: string; account: { code: string; name: string }; branch: { branchCode: string; name: string }; debit: string; credit: string; runningBalance: string; sources: Array<{ sourceType: string; sourceNumber?: string }> }
export interface ProfitLossReport { accounts: ReportAccount[]; totalRevenue: string; totalExpense: string; netProfit: string }
export interface TrialBalanceReport { accounts: ReportAccount[]; totalDebit: string; totalCredit: string; difference: string; balanced: boolean }
export interface GeneralLedgerReport { data: LedgerEntry[] }
export interface CashBankReportRow { code: string; name: string; coaAccountCode: string; ledgerBalance: string; subledgerBalance: string; difference: string; reconciled: boolean }
export interface CashBankReport { accounts: CashBankReportRow[] }
export interface DeferredRevenueReportRow { accountCode: string; movementCount: number; ledgerBalance: string; subledgerBalance: string; difference: string; reconciled: boolean }
export interface DeferredRevenueReport { accounts: DeferredRevenueReportRow[] }
export interface FinancialPositionReport {
  assets: ReportAccount[]; liabilities: ReportAccount[]; equityAccounts: ReportAccount[];
  unclosedEarnings: string; totalAssets: string; totalLiabilities: string; postedEquity: string;
  totalEquity: string; totalLiabilitiesAndEquity: string; difference: string; balanced: boolean;
  dataQuality: { complete: boolean; postedOpeningBalances: number; pendingInventoryValuations: number; limitations: string[] };
}
export interface ChangesInEquityReport {
  openingAccounts: ReportAccount[]; movementAccounts: ReportAccount[];
  openingPostedEquity: string; openingUnclosedEarnings: string; openingTotalEquity: string;
  directEquityMovement: string; periodProfit: string; endingTotalEquity: string;
}
export type AgingBucket = 'CURRENT' | 'DAYS_1_30' | 'DAYS_31_60' | 'DAYS_61_90' | 'OVER_90';
export interface AgingReportRow {
  id: string; documentNumber: string; externalDocumentNumber?: string; counterpartyCode: string;
  counterpartyName: string; branch: { branchCode: string; name: string }; dueDate: string | null;
  balance: string; daysPastDue: number; bucket: AgingBucket;
}
export interface AgingReport { rows: AgingReportRow[]; buckets: Record<AgingBucket, string>; totalOutstanding: string; source: string; balanceSnapshotAt: string }
export type FinanceReport = ProfitLossReport | TrialBalanceReport | GeneralLedgerReport | CashBankReport | DeferredRevenueReport | FinancialPositionReport | ChangesInEquityReport | AgingReport;

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;
export const financeReportApi = {
  dashboard: async (params: FinanceFilters) => unwrap<FinanceDashboard>(await api.get('/finance-reports/dashboard', { params })),
  profitLoss: async (params: FinanceFilters) => unwrap<ProfitLossReport>(await api.get('/finance-reports/profit-loss', { params })),
  trialBalance: async (params: FinanceFilters) => unwrap<TrialBalanceReport>(await api.get('/finance-reports/trial-balance', { params })),
  financialPosition: async (params: FinanceFilters) => unwrap<FinancialPositionReport>(await api.get('/finance-reports/financial-position', { params })),
  changesInEquity: async (params: FinanceFilters) => unwrap<ChangesInEquityReport>(await api.get('/finance-reports/changes-in-equity', { params })),
  receivableAging: async (params: FinanceFilters) => unwrap<AgingReport>(await api.get('/finance-reports/receivable-aging', { params })),
  payableAging: async (params: FinanceFilters) => unwrap<AgingReport>(await api.get('/finance-reports/payable-aging', { params })),
  generalLedger: async (params: FinanceFilters & { accountCode?: string }) => unwrap<GeneralLedgerReport>(await api.get('/finance-reports/general-ledger', { params })),
  cashBank: async (params: FinanceFilters) => unwrap<CashBankReport>(await api.get('/finance-reports/cash-bank', { params })),
  deferredRevenue: async (params: FinanceFilters) => unwrap<DeferredRevenueReport>(await api.get('/finance-reports/deferred-revenue', { params })),
};
