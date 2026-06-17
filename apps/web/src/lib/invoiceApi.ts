import { api } from './api';
import type { Invoice } from '@/types/invoice';

export const invoiceApi = {
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
};
