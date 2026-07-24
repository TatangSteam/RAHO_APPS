import { api } from '@/lib/api';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  normalBalance: 'DEBIT' | 'CREDIT';
  parentId: string | null;
  level: number;
  allowPosting: boolean;
  isControl: boolean;
  isActive: boolean;
  parent?: { id: string; code: string; name: string } | null;
}

export interface AccountingPeriod {
  id: string;
  name: string;
  fiscalYear: number;
  periodNo: number;
  startDate: string;
  endDate: string;
  branchId: string | null;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  branch?: { id: string; branchCode: string; name: string } | null;
}

export interface Journal {
  id: string;
  journalNumber: string;
  postingKey: string;
  transactionDate: string;
  description: string;
  status: 'POSTED' | 'REVERSED';
  totalDebit: string;
  totalCredit: string;
  branch: { id: string; branchCode: string; name: string };
  accountingPeriod: { id: string; name: string; status: string };
  lines: Array<{
    id: string;
    lineNo: number;
    debit: string;
    credit: string;
    description?: string;
    account: { code: string; name: string };
  }>;
  sourceLinks: Array<{ id: string; sourceType: string; sourceId: string; sourceNumber?: string }>;
}

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;

export const accountingApi = {
  async accounts() { return unwrap<Account[]>(await api.get('/accounting/accounts')); },
  async createAccount(data: Record<string, unknown>) { return unwrap<Account>(await api.post('/accounting/accounts', data)); },
  async updateAccount(id: string, data: Record<string, unknown>) { return unwrap<Account>(await api.patch(`/accounting/accounts/${id}`, data)); },
  async deleteAccount(id: string) { return unwrap<{ id: string; deleted: boolean }>(await api.delete(`/accounting/accounts/${id}`)); },
  async periods() { return unwrap<AccountingPeriod[]>(await api.get('/accounting/periods')); },
  async createPeriod(data: Record<string, unknown>) { return unwrap<AccountingPeriod>(await api.post('/accounting/periods', data)); },
  async updatePeriod(id: string, data: Record<string, unknown>) { return unwrap<AccountingPeriod>(await api.patch(`/accounting/periods/${id}`, data)); },
  async deletePeriod(id: string) { return unwrap<{ id: string; deleted: boolean }>(await api.delete(`/accounting/periods/${id}`)); },
  async setPeriodStatus(id: string, status: AccountingPeriod['status'], reason: string) {
    return unwrap<AccountingPeriod>(await api.patch(`/accounting/periods/${id}/status`, { status, reason }));
  },
  async journals() {
    const result = unwrap<{ data: Journal[] }>(await api.get('/accounting/journals', { params: { limit: 50 } }));
    return result.data;
  },
  async postJournal(data: Record<string, unknown>) {
    return unwrap<{ journal: Journal; idempotentReplay: boolean }>(await api.post('/accounting/journals', data, {
      headers: { 'Idempotency-Key': `MANUAL_JOURNAL:${String(data.requestId || '')}` },
    }));
  },
  async reverseJournal(id: string, reason: string) {
    const requestId = crypto.randomUUID();
    return unwrap<{ journal: Journal; idempotentReplay: boolean }>(await api.post(`/accounting/journals/${id}/reverse`, {
      transactionDate: new Date().toISOString().slice(0, 10),
      reason,
      requestId,
    }, { headers: { 'Idempotency-Key': `MANUAL_JOURNAL_REVERSAL:${requestId}` } }));
  },
};
