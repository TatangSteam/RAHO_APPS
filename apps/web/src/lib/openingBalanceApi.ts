import { api } from './api';

export interface OpeningLine {
  type: 'GENERAL' | 'CASH_BANK' | 'INVENTORY' | 'AR' | 'AP' | 'DEPOSIT' | 'DEFERRED_REVENUE';
  accountCode: string;
  description: string;
  debit: string;
  credit: string;
  cashBankAccountId?: string;
  inventoryItemId?: string;
  stockLocationId?: string;
  quantity?: string;
  unitCost?: string;
  batchNumber?: string;
}

export interface OpeningBalance {
  id: string;
  documentNumber: string;
  balanceDate: string;
  description: string;
  status: 'DRAFT' | 'SUBMITTED' | 'POSTED' | 'REJECTED';
  totalDebit: string;
  totalCredit: string;
  branch: { branchCode: string; name: string };
  journalEntry?: { journalNumber: string };
  lines: Array<OpeningLine & { id: string; inventoryPosting?: { postingNumber: string } }>;
}

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;

export const openingBalanceApi = {
  list: async () => unwrap<OpeningBalance[]>(await api.get('/opening-balances')),
  create: async (data: Record<string, unknown>) => unwrap<{ openingBalance: OpeningBalance }>(await api.post('/opening-balances', data)),
  submit: async (id: string) => unwrap<OpeningBalance>(await api.post(`/opening-balances/${id}/submit`)),
  post: async (id: string) => unwrap<{ openingBalance: OpeningBalance }>(await api.post(`/opening-balances/${id}/post`)),
  reject: async (id: string, reason: string) => unwrap<OpeningBalance>(await api.post(`/opening-balances/${id}/reject`, { reason })),
};
