import { api } from './api';

export interface Expense {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID';
  rejectionReason?: string;
  branch: { id: string; branchCode: string; name: string };
  expenseAccount: { code: string; name: string };
  cashBankAccount: { id: string; code: string; name: string };
  journalEntry?: { journalNumber: string };
  evidenceFileUrl?: string;
}

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;

export const expenseApi = {
  list: async () => unwrap<Expense[]>(await api.get('/expenses')),
  create: async (form: FormData) => unwrap<{ expense: Expense }>(await api.post('/expenses', form)),
  update: async (id: string, data: {
    expenseDate: string;
    category: string;
    description: string;
    amount: string;
    expenseAccountCode: string;
    cashBankAccountId: string;
  }) => unwrap<Expense>(await api.patch(`/expenses/${id}`, data)),
  submit: async (id: string) => unwrap<Expense>(await api.post(`/expenses/${id}/submit`)),
  approve: async (id: string, note?: string) => unwrap<Expense>(await api.post(`/expenses/${id}/approve`, { note })),
  reject: async (id: string, reason: string) => unwrap<Expense>(await api.post(`/expenses/${id}/reject`, { reason })),
  pay: async (id: string) => unwrap<{ expense: Expense }>(await api.post(`/expenses/${id}/pay`)),
  evidence: async (id: string) => unwrap<{ url: string }>(await api.get(`/expenses/${id}/evidence`)),
};
