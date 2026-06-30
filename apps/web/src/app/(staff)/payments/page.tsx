'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Receipt,
  RotateCcw,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

type PaymentMethod = 'Cash' | 'Transfer' | 'QRIS';
type ModalType = 'invoice' | 'detail' | 'payment' | 'verify' | 'approve' | 'reject' | 'refund' | null;

interface InvoiceItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface Invoice {
  id: string;
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
}

interface InvoiceItemForm {
  productName: string;
  quantity: string;
  unitPrice: string;
  discount: string;
}

const STORAGE_KEY = 'raho-e2e-payment-invoices';
const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Transfer', 'QRIS'];
const STATUS_FILTERS = ['Semua Status', 'Menunggu Pembayaran', 'Partial', 'Lunas', 'Verified', 'Rejected', 'Refund'];
const METHOD_FILTERS = ['Semua Metode', ...PAYMENT_METHODS];
const PRODUCTS = [
  { name: 'IFA 250', price: 10000 },
  { name: 'Vitamin C', price: 5000 },
  { name: 'Konsultasi Dokter', price: 100000 },
  { name: 'Paket Terapi O3', price: 900000 },
];

const INITIAL_INVOICES: Invoice[] = [
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
  },
];

function downloadFile(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function calculateTotal(items: InvoiceItem[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0);
}

function remainingAmount(invoice: Invoice) {
  return Math.max(invoice.total - invoice.paidAmount - invoice.refundAmount, 0);
}

function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </label>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between rounded-lg border border-neutral-300 bg-white px-3 text-left text-sm text-neutral-900 hover:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      >
        <span>{value}</span>
        <span className="text-neutral-400">v</span>
      </button>
      {open && (
        <div role="listbox" className="absolute z-30 mt-2 w-full rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const role = user?.role;
  const canAccess = role === 'SUPER_ADMIN' || role === 'ADMIN_MANAGER' || role === 'ADMIN_CABANG' || role === 'ADMIN_LAYANAN';
  const canVerify = role === 'SUPER_ADMIN' || role === 'ADMIN_MANAGER';

  const [hydrated, setHydrated] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Semua Status');
  const [methodFilter, setMethodFilter] = useState('Semua Metode');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [formError, setFormError] = useState('');
  const [invoiceForm, setInvoiceForm] = useState({
    memberName: '',
    notes: '',
    items: [] as InvoiceItemForm[],
  });
  const [paymentForm, setPaymentForm] = useState({
    method: 'Cash' as PaymentMethod,
    amount: '',
    reference: '',
    notes: '',
  });
  const [reasonForm, setReasonForm] = useState({
    notes: '',
    reason: '',
    amount: '',
  });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Invoice[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setInvoices(parsed);
        }
      }
    } catch {
      setInvoices(INITIAL_INVOICES);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
    }
  }, [hydrated, invoices]);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId],
  );

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        invoice.memberName.toLowerCase().includes(query) ||
        invoice.id.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === 'Semua Status' ||
        invoice.status.toLowerCase().includes(statusFilter.toLowerCase());
      const matchesMethod =
        methodFilter === 'Semua Metode' ||
        invoice.paymentMethods.some((method) => method.toLowerCase() === methodFilter.toLowerCase());
      const matchesStart = !startDate || invoice.createdAt >= startDate;
      const matchesEnd = !endDate || invoice.createdAt <= endDate;

      return matchesSearch && matchesStatus && matchesMethod && matchesStart && matchesEnd;
    });
  }, [endDate, invoices, methodFilter, search, startDate, statusFilter]);

  const openCreateInvoice = () => {
    setInvoiceForm({ memberName: '', notes: '', items: [] });
    setFormError('');
    setSelectedInvoiceId(null);
    setModal('invoice');
  };

  const openInvoiceModal = (invoice: Invoice, nextModal: ModalType) => {
    setSelectedInvoiceId(invoice.id);
    setFormError('');
    setPaymentForm({ method: 'Cash', amount: '', reference: '', notes: '' });
    setReasonForm({ notes: '', reason: '', amount: '' });
    setModal(nextModal);
  };

  const addInvoiceItem = () => {
    setInvoiceForm((current) => ({
      ...current,
      items: [...current.items, { productName: '', quantity: '1', unitPrice: '0', discount: '0' }],
    }));
  };

  const updateInvoiceItem = (index: number, patch: Partial<InvoiceItemForm>) => {
    setInvoiceForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  };

  const matchingProducts = (query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return PRODUCTS;
    return PRODUCTS.filter((product) => product.name.toLowerCase().includes(normalized));
  };

  const submitInvoice = () => {
    const items = invoiceForm.items.map((item) => ({
      productName: item.productName.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount || 0),
    }));
    const hasInvalidItem = items.some((item) => !item.productName || item.quantity <= 0 || item.unitPrice < 0 || item.discount < 0);

    if (!invoiceForm.memberName.trim() || items.length === 0 || hasInvalidItem) {
      setFormError('Member wajib diisi dan minimal satu item harus diisi.');
      return;
    }

    const total = calculateTotal(items);
    const invoice: Invoice = {
      id: `INV-E2E-${Date.now()}`,
      memberName: invoiceForm.memberName.trim(),
      items,
      notes: invoiceForm.notes,
      status: 'Menunggu Pembayaran',
      total,
      paidAmount: 0,
      paymentMethods: [],
      references: [],
      refundAmount: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setInvoices((current) => [invoice, ...current]);
    setToast('Berhasil menyimpan invoice');
    setModal(null);
  };

  const submitPayment = () => {
    if (!selectedInvoice) return;

    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Jumlah tidak valid, harus lebih besar dari 0.');
      return;
    }

    setInvoices((current) =>
      current.map((invoice) => {
        if (invoice.id !== selectedInvoice.id) return invoice;

        const paidAmount = invoice.paidAmount + amount;
        const status = paidAmount >= invoice.total ? 'Lunas Paid' : 'Partial';

        return {
          ...invoice,
          paidAmount,
          status,
          paymentMethods: Array.from(new Set([...invoice.paymentMethods, paymentForm.method])),
          references: paymentForm.reference ? [...invoice.references, paymentForm.reference] : invoice.references,
        };
      }),
    );
    setToast('Pembayaran berhasil diproses');
    setModal(null);
  };

  const updateInvoiceStatus = (status: string, message: string) => {
    if (!selectedInvoice) return;

    setInvoices((current) =>
      current.map((invoice) => (invoice.id === selectedInvoice.id ? { ...invoice, status } : invoice)),
    );
    setToast(message);
    setModal(null);
  };

  const submitRefund = () => {
    if (!selectedInvoice) return;

    const amount = Number(reasonForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Jumlah refund harus lebih besar dari 0.');
      return;
    }

    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === selectedInvoice.id
          ? { ...invoice, refundAmount: amount, status: 'Refund Dikembalikan' }
          : invoice,
      ),
    );
    setToast('Refund berhasil diproses');
    setModal(null);
  };

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-neutral-50 p-6 text-neutral-900 dark:bg-neutral-950 dark:text-white">
        <section className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-8 dark:border-red-500/30 dark:bg-neutral-900">
          <h1 className="text-2xl font-bold">Akses pembayaran dibatasi</h1>
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
            Tidak memiliki izin untuk membuka pembayaran. Permission forbidden untuk role ini.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-6 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      {toast && (
        <div
          role="status"
          className="fixed right-6 top-6 z-50 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-lg dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          {toast}
        </div>
      )}

      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase text-amber-600 dark:text-amber-400">
              ERP Klinik
            </p>
            <h1 className="mt-1 text-3xl font-bold">Pembayaran</h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
              Invoice, pembayaran, verifikasi, refund, dan bukti transaksi.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateInvoice}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 text-sm font-bold text-black hover:bg-amber-400"
          >
            <FileText size={16} />
            Buat Invoice
          </button>
        </header>

        <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari invoice atau member"
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((current) => !current)}
              className="h-11 rounded-lg border border-neutral-300 px-4 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
            >
              Filter
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Dropdown label="Status" value={statusFilter} options={STATUS_FILTERS} onChange={setStatusFilter} />
              <Dropdown label="Metode Pembayaran" value={methodFilter} options={METHOD_FILTERS} onChange={setMethodFilter} />
              <div>
                <label htmlFor="payment-start-date" className="mb-2 block text-sm font-medium">
                  Tanggal Mulai
                </label>
                <input
                  id="payment-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label htmlFor="payment-end-date" className="mb-2 block text-sm font-medium">
                  Tanggal Akhir
                </label>
                <input
                  id="payment-end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setToast('Filter pembayaran diterapkan')}
                  className="h-11 w-full rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  Terapkan Filter
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                <tr>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Metode</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Sisa</th>
                  <th className="px-5 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-neutral-500">
                      Tidak ada data invoice.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="px-5 py-4 font-semibold">{invoice.id}</td>
                      <td className="px-5 py-4">{invoice.memberName}</td>
                      <td className="px-5 py-4">{invoice.status}</td>
                      <td className="px-5 py-4">{invoice.paymentMethods.join(', ') || '-'}</td>
                      <td className="px-5 py-4 text-right font-semibold">{formatCurrency(invoice.total)}</td>
                      <td className="px-5 py-4 text-right">{remainingAmount(invoice)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openInvoiceModal(invoice, 'detail')} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:border-amber-500 dark:border-neutral-700">
                            Detail
                          </button>
                          <button type="button" onClick={() => openInvoiceModal(invoice, 'payment')} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:border-amber-500 dark:border-neutral-700">
                            Bayar
                          </button>
                          {canVerify && (
                            <>
                              <button type="button" onClick={() => openInvoiceModal(invoice, 'verify')} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:border-amber-500 dark:border-neutral-700">
                                Verifikasi
                              </button>
                              <button type="button" onClick={() => openInvoiceModal(invoice, 'approve')} className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10">
                                Approve
                              </button>
                              <button type="button" onClick={() => openInvoiceModal(invoice, 'reject')} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10">
                                Reject
                              </button>
                              <button type="button" onClick={() => openInvoiceModal(invoice, 'refund')} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:border-amber-500 dark:border-neutral-700">
                                Refund
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modal === 'invoice' && (
        <Modal title="Buat Invoice" onClose={() => setModal(null)}>
          <div className="grid gap-4">
            <div>
              <label htmlFor="invoice-member" className="mb-2 block text-sm font-medium">
                Sesi / Member / Pasien
              </label>
              <input
                id="invoice-member"
                value={invoiceForm.memberName}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, memberName: event.target.value }))}
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                placeholder="Nama member"
              />
              {invoiceForm.memberName && (
                <button type="button" className="mt-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                  {invoiceForm.memberName}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Item Invoice</h3>
              <button
                type="button"
                onClick={addInvoiceItem}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
              >
                Tambah Item
              </button>
            </div>

            {invoiceForm.items.map((item, index) => (
              <div key={index} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label htmlFor={`invoice-product-${index}`} className="mb-2 block text-sm font-medium">
                      Produk / Layanan
                    </label>
                    <input
                      id={`invoice-product-${index}`}
                      value={item.productName}
                      onChange={(event) => updateInvoiceItem(index, { productName: event.target.value })}
                      className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {matchingProducts(item.productName).map((product) => (
                        <button
                          key={product.name}
                          type="button"
                          onClick={() =>
                            updateInvoiceItem(index, {
                              productName: product.name,
                              unitPrice: String(product.price),
                            })
                          }
                          className="rounded-md bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                        >
                          {product.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor={`invoice-quantity-${index}`} className="mb-2 block text-sm font-medium">
                      Jumlah
                    </label>
                    <input
                      id={`invoice-quantity-${index}`}
                      value={item.quantity}
                      onChange={(event) => updateInvoiceItem(index, { quantity: event.target.value })}
                      className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label htmlFor={`invoice-price-${index}`} className="mb-2 block text-sm font-medium">
                      Harga
                    </label>
                    <input
                      id={`invoice-price-${index}`}
                      value={item.unitPrice}
                      onChange={(event) => updateInvoiceItem(index, { unitPrice: event.target.value })}
                      className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label htmlFor={`invoice-discount-${index}`} className="mb-2 block text-sm font-medium">
                      Diskon
                    </label>
                    <input
                      id={`invoice-discount-${index}`}
                      value={item.discount}
                      onChange={(event) => updateInvoiceItem(index, { discount: event.target.value })}
                      className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div>
              <label htmlFor="invoice-notes" className="mb-2 block text-sm font-medium">
                Catatan
              </label>
              <textarea
                id="invoice-notes"
                value={invoiceForm.notes}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>

            {formError && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{formError}</p>}

            <button
              type="button"
              onClick={submitInvoice}
              className="h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold text-black hover:bg-amber-400"
            >
              Simpan Invoice
            </button>
          </div>
        </Modal>
      )}

      {modal === 'detail' && selectedInvoice && (
        <Modal title="Detail Invoice" onClose={() => setModal(null)}>
          <div className="grid gap-4">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">Invoice</p>
              <p className="font-bold">{selectedInvoice.id}</p>
              <p className="mt-2 font-semibold">{selectedInvoice.memberName}</p>
              <p className="mt-2">Status: {selectedInvoice.status}</p>
              <p>Total {selectedInvoice.total}</p>
              <p>Sisa {remainingAmount(selectedInvoice)}</p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold">Items</h3>
              {selectedInvoice.items.map((item) => (
                <div key={`${item.productName}-${item.quantity}`} className="flex justify-between border-b border-neutral-100 py-2 text-sm dark:border-neutral-800">
                  <span>{item.productName} x {item.quantity}</span>
                  <span>{item.quantity * item.unitPrice - item.discount}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold">Pembayaran</h3>
              <p className="text-sm">Metode: {selectedInvoice.paymentMethods.join(', ') || '-'}</p>
              <p className="text-sm">Referensi: {selectedInvoice.references.join(', ') || '-'}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadFile(`invoice-${selectedInvoice.id}.pdf`, 'application/pdf', `Invoice ${selectedInvoice.id}`)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
              >
                <Download size={16} />
                PDF Invoice
              </button>
              <button
                type="button"
                onClick={() => setToast('Receipt siap dicetak')}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 px-4 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
              >
                <Receipt size={16} />
                Receipt
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'payment' && selectedInvoice && (
        <Modal title="Proses Pembayaran" onClose={() => setModal(null)}>
          <div className="grid gap-4">
            <Dropdown label="Metode Pembayaran" value={paymentForm.method} options={PAYMENT_METHODS} onChange={(method) => setPaymentForm((current) => ({ ...current, method }))} />
            <div>
              <label htmlFor="payment-amount" className="mb-2 block text-sm font-medium">
                Jumlah Pembayaran
              </label>
              <input
                id="payment-amount"
                value={paymentForm.amount}
                onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label htmlFor="payment-reference" className="mb-2 block text-sm font-medium">
                Referensi Transaksi
              </label>
              <input
                id="payment-reference"
                value={paymentForm.reference}
                onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label htmlFor="payment-notes" className="mb-2 block text-sm font-medium">
                Catatan Pembayaran
              </label>
              <textarea
                id="payment-notes"
                value={paymentForm.notes}
                onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            {formError && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{formError}</p>}
            <button
              type="button"
              onClick={submitPayment}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-bold text-black hover:bg-amber-400"
            >
              <CreditCard size={16} />
              Proses Pembayaran
            </button>
          </div>
        </Modal>
      )}

      {modal === 'verify' && selectedInvoice && (
        <Modal title="Verifikasi Pembayaran" onClose={() => setModal(null)}>
          <div className="grid gap-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Invoice {selectedInvoice.id} siap diverifikasi oleh manager.
            </p>
            <button
              type="button"
              onClick={() => updateInvoiceStatus('Verified Approved Terverifikasi', 'Pembayaran berhasil diverifikasi')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-400"
            >
              <CheckCircle2 size={16} />
              Simpan Verifikasi
            </button>
          </div>
        </Modal>
      )}

      {modal === 'approve' && selectedInvoice && (
        <Modal title="Approve Pembayaran" onClose={() => setModal(null)}>
          <div className="grid gap-4">
            <label htmlFor="approve-notes" className="block text-sm font-medium">
              Catatan
            </label>
            <textarea
              id="approve-notes"
              value={reasonForm.notes}
              onChange={(event) => setReasonForm((current) => ({ ...current, notes: event.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <button
              type="button"
              onClick={() => updateInvoiceStatus('Verified Approved Terverifikasi', 'Pembayaran berhasil disetujui')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-400"
            >
              <CheckCircle2 size={16} />
              Ya Setuju
            </button>
          </div>
        </Modal>
      )}

      {modal === 'reject' && selectedInvoice && (
        <Modal title="Reject Pembayaran" onClose={() => setModal(null)}>
          <div className="grid gap-4">
            <label htmlFor="reject-reason" className="block text-sm font-medium">
              Alasan
            </label>
            <textarea
              id="reject-reason"
              value={reasonForm.reason}
              onChange={(event) => setReasonForm((current) => ({ ...current, reason: event.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <button
              type="button"
              onClick={() => updateInvoiceStatus('Rejected Ditolak', 'Pembayaran berhasil ditolak')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 text-sm font-bold text-white hover:bg-red-400"
            >
              <XCircle size={16} />
              Ya Tolak
            </button>
          </div>
        </Modal>
      )}

      {modal === 'refund' && selectedInvoice && (
        <Modal title="Refund Pembayaran" onClose={() => setModal(null)}>
          <div className="grid gap-4">
            <div>
              <label htmlFor="refund-amount" className="mb-2 block text-sm font-medium">
                Jumlah Refund
              </label>
              <input
                id="refund-amount"
                value={reasonForm.amount}
                onChange={(event) => setReasonForm((current) => ({ ...current, amount: event.target.value }))}
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label htmlFor="refund-reason" className="mb-2 block text-sm font-medium">
                Alasan Refund
              </label>
              <textarea
                id="refund-reason"
                value={reasonForm.reason}
                onChange={(event) => setReasonForm((current) => ({ ...current, reason: event.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            {formError && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{formError}</p>}
            <button
              type="button"
              onClick={submitRefund}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-bold text-black hover:bg-amber-400"
            >
              <RotateCcw size={16} />
              Ya Confirm Refund
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" aria-label="Tutup" onClick={onClose} className="rounded-lg p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
