export type PaymentMethod = 'Cash' | 'Transfer' | 'QRIS' | 'Debit' | 'Credit' | 'Other';

export interface InvoiceItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  memberName: string;
  items: InvoiceItem[];
  notes?: string;
  status: string;
  total: number;
  paidAmount: number;
  paymentMethods: PaymentMethod[];
  references: string[];
  refundAmount: number;
  createdAt: string;
  pendingPayments?: Array<{
    id: string;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    proofUrl?: string;
  }>;
}

export interface InvoiceItemForm {
  productName: string;
  quantity: string;
  unitPrice: string;
  discount: string;
}

export const STORAGE_KEY = 'raho-e2e-payment-invoices';
export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Transfer', 'QRIS', 'Debit', 'Credit', 'Other'];
export const STATUS_FILTERS = ['Semua Status', 'Draft', 'Menunggu Pembayaran', 'Partial', 'Lunas', 'Utang', 'Jatuh Tempo', 'Dibatalkan'];
export const METHOD_FILTERS = ['Semua Metode', ...PAYMENT_METHODS];
export const PRODUCTS = [
  { name: 'IFA 250', price: 10000 },
  { name: 'Vitamin C', price: 5000 },
  { name: 'Konsultasi Dokter', price: 100000 },
  { name: 'Paket Terapi O3', price: 900000 },
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'INV-E2E-001',
    memberName: 'Test Demo Member',
    items: [{ productName: 'IFA 250', quantity: 30, unitPrice: 10000, discount: 0 }],
    status: 'Menunggu Pembayaran',
    total: 300000,
    paidAmount: 0,
    paymentMethods: [],
    references: [],
    refundAmount: 0,
    createdAt: '2026-06-30',
    pendingPayments: [],
  },
];

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateTotal(items: InvoiceItem[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0);
}

export function remainingAmount(invoice: Invoice) {
  return Math.max(invoice.total - invoice.paidAmount - invoice.refundAmount, 0);
}

export function matchingProducts(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return PRODUCTS;
  return PRODUCTS.filter((product) => product.name.toLowerCase().includes(normalized));
}

export function filterInvoices(
  invoices: Invoice[],
  filters: {
    search: string;
    statusFilter: string;
    methodFilter: string;
    startDate: string;
    endDate: string;
  }
) {
  return invoices.filter((invoice) => {
    const query = filters.search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      invoice.memberName.toLowerCase().includes(query) ||
      invoice.id.toLowerCase().includes(query) ||
      (invoice.invoiceNumber || '').toLowerCase().includes(query);
    const matchesStatus =
      filters.statusFilter === 'Semua Status' ||
      invoice.status.toLowerCase().includes(filters.statusFilter.toLowerCase());
    const matchesMethod =
      filters.methodFilter === 'Semua Metode' ||
      invoice.paymentMethods.some((method) => method.toLowerCase() === filters.methodFilter.toLowerCase());
    const matchesStart = !filters.startDate || invoice.createdAt >= filters.startDate;
    const matchesEnd = !filters.endDate || invoice.createdAt <= filters.endDate;

    return matchesSearch && matchesStatus && matchesMethod && matchesStart && matchesEnd;
  });
}

export function parseInvoiceItemForms(items: InvoiceItemForm[]) {
  return items.map((item) => ({
    productName: item.productName.trim(),
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    discount: Number(item.discount || 0),
  }));
}

export function hasInvalidInvoiceItem(items: InvoiceItem[]) {
  return items.some((item) => !item.productName || item.quantity <= 0 || item.unitPrice < 0 || item.discount < 0);
}

export function getPaymentStatus(total: number, paidAmount: number) {
  return paidAmount >= total ? 'Lunas' : 'Partial';
}
