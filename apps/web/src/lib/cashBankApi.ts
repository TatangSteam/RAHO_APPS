import { api } from './api';

export interface CashBankAccount {
  id: string;
  code: string;
  name: string;
  type: 'CASH' | 'BANK';
  branchId: string;
  currency: string;
  requiresReference: boolean;
  isActive: boolean;
  coaAccount: { code: string; name: string };
}

export const cashBankApi = {
  listAccounts: async (params?: { branchId?: string; type?: 'CASH' | 'BANK'; isActive?: 'true' | 'false' }) => {
    const response = await api.get<{ data: CashBankAccount[] }>('/cash-bank/accounts', { params });
    return response.data.data;
  },
  createAccount: async (data: {
    code: string;
    name: string;
    type: 'CASH' | 'BANK';
    branchId: string;
    coaAccountCode: string;
    currency: string;
    bankName?: string;
    accountNumber?: string;
    accountHolderName?: string;
    requiresReference: boolean;
  }) => {
    const response = await api.post<{ data: CashBankAccount }>('/cash-bank/accounts', data);
    return response.data.data;
  },
  listTransactions: async (params?: { branchId?: string; page?: number; limit?: number }) => {
    const response = await api.get('/cash-bank/transactions', { params });
    return response.data.data;
  },
};
