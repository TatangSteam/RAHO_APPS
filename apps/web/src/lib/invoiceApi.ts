import { api } from './api';
import type { Invoice, RecordPaymentInput } from '@/types/invoice';

interface InvoicesResponse {
  data: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const invoiceApi = {
  // Get invoices for staff payment dashboard
  getInvoices: async (params?: {
    search?: string;
    status?: string;
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get<{ data: InvoicesResponse }>(
      '/invoices',
      { params }
    );
    return response.data.data;
  },

  // Get member's invoices
  getMemberInvoices: async (memberId: string) => {
    const response = await api.get<{ data: Invoice[] }>(
      `/invoices/member/${memberId}`
    );
    return response.data.data;
  },

  // Get invoice by ID
  getInvoiceById: async (invoiceId: string) => {
    const response = await api.get<{ data: Invoice }>(
      `/invoices/${invoiceId}`
    );
    return response.data.data;
  },

  // Get invoice/receipt by package or add-on ID
  getInvoiceByPackageId: async (packageId: string) => {
    const response = await api.get<{ data: Invoice }>(
      `/invoices/package/${packageId}`
    );
    return response.data.data;
  },

  finalizeInvoice: async (invoiceId: string, dueDate?: string) => {
    const response = await api.post<{ data: Invoice }>(
      `/invoices/${invoiceId}/finalize`,
      dueDate ? { dueDate: new Date(`${dueDate}T00:00:00.000Z`).toISOString() } : {},
    );
    return response.data.data;
  },

  // Record invoice payment
  recordPayment: async (invoiceId: string, data: RecordPaymentInput) => {
    const form = new FormData();
    form.append('amount', data.amount);
    form.append('paymentMethod', data.paymentMethod);
    form.append('cashBankAccountId', data.cashBankAccountId);
    form.append('postingKey', data.postingKey);
    if (data.paymentReference) form.append('paymentReference', data.paymentReference);
    if (data.notes) form.append('notes', data.notes);
    if (data.proof) form.append('proof', data.proof);
    const response = await api.post<{ data: { payment: unknown; idempotentReplay: boolean } }>(
      `/invoices/${invoiceId}/payment`,
      form,
      { headers: { 'Idempotency-Key': data.postingKey } },
    );
    return response.data.data;
  },

  verifyPayment: async (paymentId: string, reason?: string) => {
    const response = await api.post<{
      data: {
        payment: { id: string; verificationStatus: string };
        cashBankTransaction: { id: string; transactionNumber: string } | null;
        journal?: { id: string; journalNumber: string };
        idempotentReplay: boolean;
      };
    }>(`/invoices/payments/${paymentId}/verify`, { reason });
    return response.data.data;
  },

  rejectPayment: async (paymentId: string, reason: string) => {
    const response = await api.post(`/invoices/payments/${paymentId}/reject`, { reason });
    return response.data.data;
  },
};
