import { api } from './api';

export interface OpeningLine {
  type: 'GENERAL' | 'CASH_BANK' | 'INVENTORY' | 'AR' | 'AP' | 'DEPOSIT' | 'DEFERRED_REVENUE';
  accountCode: string;
  description: string;
  debit: string;
  credit: string;
  counterpartyRef?: string;
  cashBankAccountId?: string;
  inventoryItemId?: string;
  stockLocationId?: string;
  quantity?: string;
  unitCost?: string;
  batchNumber?: string;
  manufactureDate?: string;
  expiryDate?: string;
}

export interface OpeningBalance {
  id: string;
  documentNumber: string;
  balanceDate: string;
  description: string;
  status: 'DRAFT' | 'SUBMITTED' | 'POSTED' | 'REJECTED';
  totalDebit: string;
  totalCredit: string;
  createdBy: string;
  reviewedBy?: string;
  submittedAt?: string;
  reviewedAt?: string;
  postedAt?: string;
  rejectionReason?: string;
  history: Array<{
    id: string;
    action: string;
    description: string;
    createdAt: string;
    afterData?: { status?: string; rejectionReason?: string };
    user: { id: string; email: string; profile?: { fullName?: string } };
  }>;
  branch: { id: string; branchCode: string; name: string };
  creator: { id: string; email: string; profile?: { fullName?: string } };
  reviewer?: { id: string; email: string; profile?: { fullName?: string } };
  journalEntry?: { id: string; journalNumber: string };
  lines: Array<OpeningLine & {
    id: string;
    inventoryPosting?: { id: string; postingNumber: string };
    cashBankTransaction?: { id: string; transactionNumber: string };
  }>;
}

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;

export const openingBalanceApi = {
  list: async () => unwrap<OpeningBalance[]>(await api.get('/opening-balances')),
  create: async (data: Record<string, unknown>) => unwrap<{ openingBalance: OpeningBalance }>(await api.post('/opening-balances', data)),
  update: async (id: string, data: Record<string, unknown>) => unwrap<OpeningBalance>(await api.patch(`/opening-balances/${id}`, data)),
  submit: async (id: string) => unwrap<OpeningBalance>(await api.post(`/opening-balances/${id}/submit`)),
  post: async (id: string) => unwrap<{ openingBalance: OpeningBalance }>(await api.post(`/opening-balances/${id}/post`)),
  reject: async (id: string, reason: string) => unwrap<OpeningBalance>(await api.post(`/opening-balances/${id}/reject`, { reason })),
};
