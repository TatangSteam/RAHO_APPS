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

  // Record invoice payment
  recordPayment: async (invoiceId: string, data: RecordPaymentInput) => {
    const response = await api.post<{ data: Invoice }>(
      `/invoices/${invoiceId}/payment`,
      data
    );
    return response.data.data;
  },
};
