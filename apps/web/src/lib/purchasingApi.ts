import { api } from './api';

export type Supplier = { id: string; code: string; name: string; status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED'; paymentTermsDays: number };
export type PurchaseRequest = {
  id: string;
  requestNumber: string;
  branchId: string;
  requestDate: string;
  requiredDate?: string;
  description: string;
  status: string;
  rejectionReason?: string;
  creator?: { email: string };
  reviewer?: { email: string };
  items: Array<{
    id: string;
    masterProductId?: string;
    description: string;
    requestedQty: string;
    estimatedUnitCost?: string;
    approvedQty?: string;
    masterProduct?: { sku: string; name: string; baseUnit?: string; unit?: string };
  }>;
};
export type SupplierInvoiceLine = { id: string; purchaseOrderItemId: string; billedQty: string; unitPrice: string; lineTotal: string };
export type PurchaseOrder = { id: string; poNumber: string; branchId: string; orderDate: string; status: string; totalAmount: string; supplier: Supplier; items: Array<{ id: string; nameSnapshot: string; orderedQty: string; receivedQty: string; unitPrice: string }>; goodsReceipts: Array<{ id: string; receiptNumber: string; totalValue: string }>; invoices: Array<{ id: string; invoiceNumber: string; lines: SupplierInvoiceLine[] }> };
export type SupplierPaymentRefund = { id: string; refundNumber: string; amount: string; refundDate: string; reason: string };
export type SupplierPayment = { id: string; paymentNumber: string; amount: string; paymentDate: string; cashBankAccountId: string; refunds: SupplierPaymentRefund[] };
export type SupplierInvoice = { id: string; invoiceNumber: string; supplierInvoiceNumber: string; branchId: string; dueDate: string; amount: string; paidAmount: string; balanceAmount: string; status: string; supplier: Supplier; purchaseOrder: { poNumber: string }; journalEntry: { journalNumber: string }; lines: SupplierInvoiceLine[]; payments: SupplierPayment[] };
const unwrap = <T>(response: { data: { data: T } }) => response.data.data;

export const purchasingApi = {
  suppliers: async () => unwrap<Supplier[]>(await api.get('/purchasing/suppliers')),
  createSupplier: async (data: Record<string, unknown>) => unwrap<Supplier>(await api.post('/purchasing/suppliers', data)),
  requests: async () => unwrap<PurchaseRequest[]>(await api.get('/purchasing/purchase-requests')),
  createRequest: async (data: Record<string, unknown>) =>
    unwrap<{ purchaseRequest: PurchaseRequest; idempotentReplay: boolean }>(
      await api.post('/purchasing/purchase-requests', data),
    ),
  submitRequest: async (id: string) => unwrap<PurchaseRequest>(await api.post(`/purchasing/purchase-requests/${id}/submit`)),
  approveRequest: async (id: string, items: Array<{ itemId: string; approvedQty: string }>, note?: string) =>
    unwrap<PurchaseRequest>(await api.post(`/purchasing/purchase-requests/${id}/approve`, { items, note })),
  rejectRequest: async (id: string, reason: string) => unwrap<PurchaseRequest>(await api.post(`/purchasing/purchase-requests/${id}/reject`, { reason })),
  orders: async () => unwrap<PurchaseOrder[]>(await api.get('/purchasing/purchase-orders')),
  createOrder: async (purchaseRequestId: string, supplierId: string) => unwrap<{ purchaseOrder: PurchaseOrder }>(await api.post('/purchasing/purchase-orders', { postingKey: crypto.randomUUID(), purchaseRequestId, supplierId, orderDate: new Date().toISOString() })),
  cancelOrder: async (id: string, reason: string) =>
    unwrap<{ purchaseOrder: PurchaseOrder; idempotentReplay: boolean }>(
      await api.post(`/purchasing/purchase-orders/${id}/cancel`, { reason }),
    ),
  accountsPayable: async () => unwrap<SupplierInvoice[]>(await api.get('/purchasing/accounts-payable')),
  postInvoice: async (
    purchaseOrderId: string,
    supplierInvoiceNumber: string,
    amount: string,
    termsDays: number,
    lines?: Array<{ purchaseOrderItemId: string; billedQty: string }>,
  ) => {
    const due = new Date(); due.setDate(due.getDate() + termsDays);
    return unwrap(await api.post('/purchasing/supplier-invoices', {
      postingKey: crypto.randomUUID(),
      purchaseOrderId,
      supplierInvoiceNumber,
      invoiceDate: new Date().toISOString(),
      dueDate: due.toISOString(),
      amount,
      ...(lines?.length ? { lines } : {}),
    }));
  },
  payInvoice: async (id: string, cashBankAccountId: string, amount: string, paymentReference: string) => unwrap(await api.post(`/purchasing/supplier-invoices/${id}/payments`, { postingKey: crypto.randomUUID(), cashBankAccountId, paymentDate: new Date().toISOString(), amount, paymentReference })),
  refundSupplierPayment: async (id: string, data: { cashBankAccountId: string; amount: string; reason: string; referenceNumber?: string }) => unwrap(await api.post(`/purchasing/supplier-payments/${id}/refunds`, {
    postingKey: crypto.randomUUID(),
    cashBankAccountId: data.cashBankAccountId,
    refundDate: new Date().toISOString(),
    amount: data.amount,
    reason: data.reason,
    ...(data.referenceNumber ? { referenceNumber: data.referenceNumber } : {}),
  })),
};
