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

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;
export const financeReportApi = {
  dashboard: async (params: FinanceFilters) => unwrap<FinanceDashboard>(await api.get('/finance-reports/dashboard', { params })),
  profitLoss: async (params: FinanceFilters) => unwrap<any>(await api.get('/finance-reports/profit-loss', { params })),
  trialBalance: async (params: FinanceFilters) => unwrap<any>(await api.get('/finance-reports/trial-balance', { params })),
  generalLedger: async (params: FinanceFilters & { accountCode?: string }) => unwrap<any>(await api.get('/finance-reports/general-ledger', { params })),
  cashBank: async (params: FinanceFilters) => unwrap<any>(await api.get('/finance-reports/cash-bank', { params })),
  deferredRevenue: async (params: FinanceFilters) => unwrap<any>(await api.get('/finance-reports/deferred-revenue', { params })),
};
