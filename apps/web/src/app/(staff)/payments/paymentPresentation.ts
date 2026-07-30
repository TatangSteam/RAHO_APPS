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
  isDraft?: boolean;
  pendingPayments?: Array<{
    id: string;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    proofUrl?: string;
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    proofUrl?: string;
    status: 'PENDING' | 'VERIFIED' | 'REJECTED';
    rejectionReason?: string;
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
  return items.reduce((sum, item) => {
    const quantity = Number(item?.quantity);
    const unitPrice = Number(item?.unitPrice);
    const discount = Number(item?.discount);

    if (![quantity, unitPrice, discount].every(Number.isFinite)) return sum;
    return sum + quantity * unitPrice - discount;
  }, 0);
}

export function remainingAmount(invoice: Invoice) {
  const pendingAmount = (Array.isArray(invoice.pendingPayments) ? invoice.pendingPayments : []).reduce(
    (sum, payment) => sum + (Number.isFinite(Number(payment?.amount)) ? Number(payment.amount) : 0),
    0,
  );
  const total = Number.isFinite(Number(invoice.total)) ? Number(invoice.total) : 0;
  const paidAmount = Number.isFinite(Number(invoice.paidAmount)) ? Number(invoice.paidAmount) : 0;
  const refundAmount = Number.isFinite(Number(invoice.refundAmount)) ? Number(invoice.refundAmount) : 0;
  return Math.max(total - paidAmount - pendingAmount - refundAmount, 0);
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
    const memberName = typeof invoice?.memberName === 'string' ? invoice.memberName : '';
    const invoiceId = typeof invoice?.id === 'string' ? invoice.id : '';
    const invoiceNumber = typeof invoice?.invoiceNumber === 'string' ? invoice.invoiceNumber : '';
    const status = typeof invoice?.status === 'string' ? invoice.status : '';
    const paymentMethods = Array.isArray(invoice?.paymentMethods) ? invoice.paymentMethods : [];
    const createdAt = typeof invoice?.createdAt === 'string' ? invoice.createdAt : '';
    const matchesSearch =
      !query ||
      memberName.toLowerCase().includes(query) ||
      invoiceId.toLowerCase().includes(query) ||
      invoiceNumber.toLowerCase().includes(query);
    const matchesStatus =
      filters.statusFilter === 'Semua Status' ||
      status.toLowerCase().includes(filters.statusFilter.toLowerCase());
    const matchesMethod =
      filters.methodFilter === 'Semua Metode' ||
      paymentMethods.some(
        (method) => typeof method === 'string'
          && method.toLowerCase() === filters.methodFilter.toLowerCase(),
      );
    const matchesStart = !filters.startDate || (createdAt !== '' && createdAt >= filters.startDate);
    const matchesEnd = !filters.endDate || (createdAt !== '' && createdAt <= filters.endDate);

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
  return items.some((item) => {
    const lineSubtotal = item.quantity * item.unitPrice;
    return (
      !item.productName ||
      ![item.quantity, item.unitPrice, item.discount, lineSubtotal].every(Number.isFinite) ||
      item.quantity <= 0 ||
      item.unitPrice < 0 ||
      item.discount < 0 ||
      item.discount > lineSubtotal
    );
  });
}

export function getPaymentStatus(total: number, paidAmount: number) {
  return paidAmount >= total ? 'Lunas' : 'Partial';
}
