'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
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
import { api, getApiErrorMessage } from '@/lib/api';
import { invoiceApi } from '@/lib/invoiceApi';
import { cashBankApi, type CashBankAccount } from '@/lib/cashBankApi';
import type {
  Invoice as ApiInvoice,
  InvoiceStatus as ApiInvoiceStatus,
  PaymentMethod as ApiPaymentMethod,
} from '@/types/invoice';
import {
  METHOD_FILTERS,
  PAYMENT_METHODS,
  STATUS_FILTERS,
  calculateTotal,
  filterInvoices,
  formatCurrency,
  hasInvalidInvoiceItem,
  matchingProducts,
  parseInvoiceItemForms,
  remainingAmount,
  type Invoice,
  type InvoiceItemForm,
  type PaymentMethod,
} from './paymentPresentation';

type ModalType = 'invoice' | 'detail' | 'finalize' | 'payment' | 'verify' | 'approve' | 'reject' | 'refund' | null;

const PAYMENT_METHOD_LABEL: Record<ApiPaymentMethod, PaymentMethod> = {
  CASH: 'Cash',
  TRANSFER: 'Transfer',
  QRIS: 'QRIS',
  DEBIT: 'Debit',
  CREDIT: 'Credit',
  OTHER: 'Other',
};

const PAYMENT_METHOD_VALUE: Record<PaymentMethod, ApiPaymentMethod> = {
  Cash: 'CASH',
  Transfer: 'TRANSFER',
  QRIS: 'QRIS',
  Debit: 'DEBIT',
  Credit: 'CREDIT',
  Other: 'OTHER',
};

const INVOICE_STATUS_LABEL: Record<ApiInvoiceStatus, string> = {
  DRAFT: 'Draft',
  PENDING_PAYMENT: 'Menunggu Pembayaran',
  PAID: 'Lunas',
  DEBT: 'Utang',
  CANCELLED: 'Dibatalkan',
  OVERDUE: 'Jatuh Tempo',
};

function toPaymentStatus(invoice: ApiInvoice, paidAmount: number, total: number) {
  if (invoice.status === 'PENDING_PAYMENT' && paidAmount > 0 && paidAmount < total) {
    return 'Partial';
  }

  if (invoice.status === 'DEBT' && paidAmount > 0 && paidAmount < total) {
    return 'Partial';
  }

  return INVOICE_STATUS_LABEL[invoice.status] || invoice.status;
}

function toPaymentInvoice(invoice: ApiInvoice): Invoice {
  const total = Number(invoice.totalAmount || invoice.subtotal || 0);
  const payments = invoice.payments || [];
  const verifiedPayments = payments.filter((payment) => payment.verificationStatus === 'VERIFIED');
  const paymentTotal = verifiedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paidAmount = paymentTotal || Number(invoice.actualPaidAmount || 0);
  const paymentMethods = Array.from(
    new Set(
      verifiedPayments.map((payment) => PAYMENT_METHOD_LABEL[payment.paymentMethod]).filter(Boolean),
    ),
  );

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    memberName: invoice.memberName || invoice.memberNo || '-',
    items: (invoice.items || []).map((item) => ({
      productName: item.description || item.code || item.itemType,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.pricePerUnit || 0),
      discount: Number(item.discountAmount || 0),
    })),
    notes: invoice.notes,
    status: toPaymentStatus(invoice, paidAmount, total),
    total,
    paidAmount,
    paymentMethods,
    references: verifiedPayments
      .map((payment) => payment.paymentReference)
      .filter((reference): reference is string => Boolean(reference)),
    refundAmount: 0,
    createdAt: invoice.createdAt?.slice(0, 10) || '',
    isDraft: invoice.status === 'DRAFT',
    pendingPayments: payments
      .filter((payment) => payment.verificationStatus === 'PENDING')
      .map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        method: PAYMENT_METHOD_LABEL[payment.paymentMethod],
        reference: payment.paymentReference,
        proofUrl: payment.proofFileUrl,
      })),
    payments: payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      method: PAYMENT_METHOD_LABEL[payment.paymentMethod],
      reference: payment.paymentReference,
      proofUrl: payment.proofFileUrl,
      status: payment.verificationStatus,
      rejectionReason: payment.verificationReason,
    })),
  };
}

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

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cashBankAccounts, setCashBankAccounts] = useState<CashBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Semua Status');
  const [methodFilter, setMethodFilter] = useState('Semua Metode');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [protectedProofPreview, setProtectedProofPreview] = useState<string | null>(null);
  const [proofPreviewError, setProofPreviewError] = useState('');
  const [toast, setToast] = useState('');
  const [postingEvidence, setPostingEvidence] = useState<{
    paymentId: string;
    cashTransactionId?: string;
    cashTransactionNumber?: string;
    journalNumber?: string;
    idempotentReplay: boolean;
  } | null>(null);
  const [formError, setFormError] = useState('');
  const [invoiceForm, setInvoiceForm] = useState({
    memberName: '',
    notes: '',
    items: [] as InvoiceItemForm[],
  });
  const [paymentForm, setPaymentForm] = useState({
    method: 'Cash' as PaymentMethod,
    amount: '',
    cashBankAccountId: '',
    reference: '',
    notes: '',
  });
  const [reasonForm, setReasonForm] = useState({
    notes: '',
    reason: '',
    amount: '',
  });
  const [dueDate, setDueDate] = useState('');

  const fetchInvoices = useCallback(async () => {
    if (!canAccess) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const [result, accounts] = await Promise.all([
        invoiceApi.getInvoices({ limit: 100 }),
        cashBankApi.listAccounts({ isActive: 'true' }),
      ]);
      setInvoices(result.data.map(toPaymentInvoice));
      setCashBankAccounts(accounts);
    } catch (error) {
      setInvoices([]);
      setLoadError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [canAccess]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (modal !== 'verify' || !selectedPaymentId) {
      setProofPreviewError('');
      return;
    }
    const payment = invoices
      .flatMap((invoice) => invoice.payments || [])
      .find((item) => item.id === selectedPaymentId);
    if (!payment?.proofUrl) {
      setProtectedProofPreview(null);
      setProofPreviewError('');
      return;
    }
    setProtectedProofPreview(null);
    setProofPreviewError('');
    let objectUrl: string | null = null;
    void api.get(payment.proofUrl, { responseType: 'blob' })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        setProtectedProofPreview(objectUrl);
        setProofPreviewError('');
      })
      .catch((error) => {
        setProtectedProofPreview(null);
        setProofPreviewError(getApiErrorMessage(error));
      });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoices, modal, selectedPaymentId]);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId],
  );

  const filteredInvoices = useMemo(() => {
    return filterInvoices(invoices, {
      search,
      statusFilter,
      methodFilter,
      startDate,
      endDate,
    });
  }, [endDate, invoices, methodFilter, search, startDate, statusFilter]);

  const openCreateInvoice = () => {
    setToast('Invoice dibuat otomatis dari pembelian paket, add-on, atau produk non-terapi.');
  };

  const openInvoiceModal = (invoice: Invoice, nextModal: ModalType) => {
    const balance = remainingAmount(invoice);
    setSelectedInvoiceId(invoice.id);
    setFormError('');
    const defaultAccount = cashBankAccounts.find((account) => account.type === 'CASH');
    setPaymentForm({ method: 'Cash', amount: balance > 0 ? String(balance) : '', cashBankAccountId: defaultAccount?.id || '', reference: '', notes: '' });
    setPaymentProof(null);
    setReasonForm({ notes: '', reason: '', amount: '' });
    setDueDate('');
    setModal(nextModal);
  };

  const submitFinalize = async () => {
    if (!selectedInvoice) return;
    setSubmittingPayment(true);
    setFormError('');
    try {
      await invoiceApi.finalizeInvoice(selectedInvoice.id, dueDate || undefined);
      await fetchInvoices();
      setToast(`Invoice ${selectedInvoice.invoiceNumber || selectedInvoice.id} difinalisasi; snapshot terkunci`);
      setModal(null);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSubmittingPayment(false);
    }
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

  const submitInvoice = () => {
    const items = parseInvoiceItemForms(invoiceForm.items);

    if (!invoiceForm.memberName.trim() || items.length === 0 || hasInvalidInvoiceItem(items)) {
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
      pendingPayments: [],
    };

    setInvoices((current) => [invoice, ...current]);
    setToast('Berhasil menyimpan invoice');
    setModal(null);
  };

  const submitPayment = async () => {
    if (!selectedInvoice) return;

    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Jumlah tidak valid, harus lebih besar dari 0.');
      return;
    }

    const balance = remainingAmount(selectedInvoice);
    if (balance > 0 && amount > balance) {
      setFormError('Jumlah pembayaran tidak boleh melebihi sisa tagihan.');
      return;
    }
    if (!paymentForm.cashBankAccountId) {
      setFormError('Akun kas/bank wajib dipilih.');
      return;
    }
    if (paymentForm.method !== 'Cash' && !paymentProof) {
      setFormError('Bukti pembayaran wajib untuk metode non-cash.');
      return;
    }

    setSubmittingPayment(true);
    setFormError('');

    try {
      await invoiceApi.recordPayment(selectedInvoice.id, {
        amount: amount.toFixed(2),
        paymentMethod: PAYMENT_METHOD_VALUE[paymentForm.method],
        cashBankAccountId: paymentForm.cashBankAccountId,
        postingKey: `INVOICE_PAYMENT_SUBMIT:${selectedInvoice.id}:${crypto.randomUUID()}`,
        paymentReference: paymentForm.reference.trim() || undefined,
        notes: paymentForm.notes.trim() || undefined,
        proof: paymentProof || undefined,
      });

      await fetchInvoices();
      setToast('Pembayaran diajukan dan menunggu verifikasi');
      setModal(null);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSubmittingPayment(false);
    }
  };

  const submitVerification = async (approved: boolean) => {
    if (!selectedPaymentId) return;
    if (!approved && reasonForm.reason.trim().length < 3) {
      setFormError('Alasan penolakan minimal 3 karakter.');
      return;
    }
    setSubmittingPayment(true);
    setFormError('');
    try {
      if (approved) {
        const result = await invoiceApi.verifyPayment(selectedPaymentId, reasonForm.notes.trim() || undefined);
        setPostingEvidence({
          paymentId: result.payment.id,
          cashTransactionId: result.cashBankTransaction?.id,
          cashTransactionNumber: result.cashBankTransaction?.transactionNumber,
          journalNumber: result.journal?.journalNumber,
          idempotentReplay: result.idempotentReplay,
        });
      } else {
        await invoiceApi.rejectPayment(selectedPaymentId, reasonForm.reason.trim());
        setPostingEvidence(null);
      }
      await fetchInvoices();
      setToast(approved ? 'Pembayaran diverifikasi; evidence posting tersedia di layar' : 'Pembayaran ditolak');
      setModal(null);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSubmittingPayment(false);
    }
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
        {postingEvidence && (
          <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">Evidence payment posting</p>
                <p className="mt-1">Payment ID: <code>{postingEvidence.paymentId}</code></p>
                <p>Cash transaction ID: <code>{postingEvidence.cashTransactionId || '-'}</code></p>
                <p>Cash transaction: <code>{postingEvidence.cashTransactionNumber || '-'}</code></p>
                <p>Journal number: <code>{postingEvidence.journalNumber || 'lihat transaksi kas/bank'}</code></p>
                <p>Mode: {postingEvidence.idempotentReplay ? 'IDEMPOTENT REPLAY — tidak membuat posting baru' : 'POSTING BARU'}</p>
              </div>
              <div className="flex gap-2">
                <a href="/cash-bank" className="rounded-md border border-emerald-400 px-3 py-2 font-semibold">Buka Kas/Bank</a>
                <a href="/accounting" className="rounded-md border border-emerald-400 px-3 py-2 font-semibold">Buka Accounting</a>
              </div>
            </div>
          </section>
        )}
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
            Info Invoice Otomatis
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
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-neutral-500">
                      Memuat invoice...
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-red-600 dark:text-red-400">
                      {loadError}
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-neutral-500">
                      Tidak ada data invoice.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="px-5 py-4 font-semibold">{invoice.invoiceNumber || invoice.id}</td>
                      <td className="px-5 py-4">{invoice.memberName}</td>
                      <td className="px-5 py-4">{invoice.status}</td>
                      <td className="px-5 py-4">{invoice.paymentMethods.join(', ') || '-'}</td>
                      <td className="px-5 py-4 text-right font-semibold">{formatCurrency(invoice.total)}</td>
                      <td className="px-5 py-4 text-right">{formatCurrency(remainingAmount(invoice))}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openInvoiceModal(invoice, 'detail')} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:border-amber-500 dark:border-neutral-700">
                            Detail
                          </button>
                          {invoice.isDraft && (
                            <button
                              type="button"
                              onClick={() => openInvoiceModal(invoice, 'finalize')}
                              className="rounded-md border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300"
                            >
                              Finalisasi
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openInvoiceModal(invoice, 'payment')}
                            disabled={invoice.isDraft || remainingAmount(invoice) <= 0 || invoice.status === 'Dibatalkan'}
                            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700"
                          >
                            Bayar
                          </button>
                          {(invoice.pendingPayments || []).map((payment) => (
                            <span key={payment.id} className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedInvoiceId(invoice.id);
                                  setSelectedPaymentId(payment.id);
                                  setReasonForm({ notes: '', reason: '', amount: '' });
                                  setFormError('');
                                  setModal('verify');
                                }}
                                className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                              >
                                Verifikasi {formatCurrency(payment.amount)}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedInvoiceId(invoice.id);
                                  setSelectedPaymentId(payment.id);
                                  setReasonForm({ notes: '', reason: '', amount: '' });
                                  setFormError('');
                                  setModal('reject');
                                }}
                                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
                              >
                                Tolak
                              </button>
                            </span>
                          ))}
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

      {modal === 'finalize' && selectedInvoice && (
        <Modal title="Finalisasi Invoice" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              <p className="font-semibold">{selectedInvoice.invoiceNumber || selectedInvoice.id}</p>
              <p className="mt-1">Total {formatCurrency(selectedInvoice.total)}. Setelah finalisasi, snapshot item dan nominal terkunci.</p>
            </div>
            <label className="block text-sm font-medium">
              Jatuh tempo (opsional)
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-950"
              />
            </label>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <button
              type="button"
              disabled={submittingPayment}
              onClick={submitFinalize}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {submittingPayment ? 'Memproses...' : 'Finalisasi & Kunci Snapshot'}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'detail' && selectedInvoice && (
        <Modal title="Detail Invoice" onClose={() => setModal(null)}>
          <div className="grid gap-4">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">Invoice</p>
              <p className="font-bold">{selectedInvoice.invoiceNumber || selectedInvoice.id}</p>
              <p className="mt-2 font-semibold">{selectedInvoice.memberName}</p>
              <p className="mt-2">Status: {selectedInvoice.status}</p>
              <p>Total {formatCurrency(selectedInvoice.total)}</p>
              <p>Sisa {formatCurrency(remainingAmount(selectedInvoice))}</p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold">Items</h3>
              {selectedInvoice.items.map((item) => (
                <div key={`${item.productName}-${item.quantity}`} className="flex justify-between border-b border-neutral-100 py-2 text-sm dark:border-neutral-800">
                  <span>{item.productName} x {item.quantity}</span>
                  <span>{formatCurrency(item.quantity * item.unitPrice - item.discount)}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold">Pembayaran</h3>
              {(selectedInvoice.payments || []).length === 0 ? (
                <p className="text-sm text-neutral-500">Belum ada pembayaran.</p>
              ) : (selectedInvoice.payments || []).map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 py-2 text-sm dark:border-neutral-800">
                  <div>
                    <code>{payment.id}</code>
                    <p>{payment.method} · {formatCurrency(payment.amount)} · {payment.status}</p>
                    {payment.reference && <p className="text-xs text-neutral-500">{payment.reference}</p>}
                    {payment.status === 'REJECTED' && (
                      <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-300">
                        Alasan: {payment.rejectionReason || 'Tidak tersedia'}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                  {payment.status === 'REJECTED' && (
                    <button
                      type="button"
                      onClick={() => openInvoiceModal(selectedInvoice, 'payment')}
                      className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
                    >
                      Submit ulang bukti
                    </button>
                  )}
                  {payment.status === 'VERIFIED' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPaymentId(payment.id);
                        setReasonForm({ notes: 'Uji retry idempotensi', reason: '', amount: '' });
                        setModal('verify');
                      }}
                      className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                    >
                      Uji retry
                    </button>
                  )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadFile(`invoice-${selectedInvoice.invoiceNumber || selectedInvoice.id}.pdf`, 'application/pdf', `Invoice ${selectedInvoice.invoiceNumber || selectedInvoice.id}`)}
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
            <Dropdown
              label="Metode Pembayaran"
              value={paymentForm.method}
              options={PAYMENT_METHODS}
              onChange={(method) => {
                const type = method === 'Cash' ? 'CASH' : 'BANK';
                const account = cashBankAccounts.find((candidate) => candidate.type === type);
                setPaymentForm((current) => ({ ...current, method, cashBankAccountId: account?.id || '' }));
              }}
            />
            <div>
              <label htmlFor="cash-bank-account" className="mb-2 block text-sm font-medium">
                Akun Kas/Bank
              </label>
              <select
                id="cash-bank-account"
                value={paymentForm.cashBankAccountId}
                onChange={(event) => setPaymentForm((current) => ({ ...current, cashBankAccountId: event.target.value }))}
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              >
                <option value="">Pilih akun</option>
                {cashBankAccounts
                  .filter((account) => account.type === (paymentForm.method === 'Cash' ? 'CASH' : 'BANK'))
                  .map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}
              </select>
            </div>
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
            {paymentForm.method !== 'Cash' && (
              <div>
                <label htmlFor="payment-proof" className="mb-2 block text-sm font-medium">
                  Bukti Pembayaran
                </label>
                <input
                  id="payment-proof"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
                  onChange={(event) => setPaymentProof(event.target.files?.[0] || null)}
                  className="block w-full rounded-lg border border-neutral-300 p-2 text-sm dark:border-neutral-700"
                />
              </div>
            )}
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
              disabled={submittingPayment}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-bold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CreditCard size={16} />
              {submittingPayment ? 'Memproses...' : 'Proses Pembayaran'}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'verify' && selectedInvoice && (
        <Modal title="Verifikasi Pembayaran" onClose={() => setModal(null)}>
          <div className="grid gap-4">
            {(() => {
              const payment = (selectedInvoice.payments || []).find((item) => item.id === selectedPaymentId);
              return <>
                <div className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                  <p>Invoice: <strong>{selectedInvoice.invoiceNumber || selectedInvoice.id}</strong></p>
                  <p>Payment ID: <code>{payment?.id || selectedPaymentId}</code></p>
                  <p>Nominal: <strong>{formatCurrency(payment?.amount || 0)}</strong></p>
                  <p>Status: <strong>{payment?.status || 'PENDING'}</strong></p>
                </div>
                {payment?.proofUrl ? (
                  <div>
                    <p className="mb-2 text-sm font-semibold">Bukti pembayaran terlindungi</p>
                    {protectedProofPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={protectedProofPreview} alt={`Bukti pembayaran ${payment.id}`} className="max-h-72 w-full rounded-lg border object-contain dark:border-neutral-700" />
                    ) : proofPreviewError ? (
                      <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                        Bukti tidak dapat dibuka: {proofPreviewError}
                      </p>
                    ) : (
                      <p className="text-sm text-neutral-500">Memuat bukti pembayaran...</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Pembayaran cash atau tidak memiliki file bukti.</p>
                )}
                {payment?.status === 'VERIFIED' && (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    Ini adalah uji retry. Sistem harus mengembalikan posting lama tanpa membuat cash transaction atau jurnal baru.
                  </p>
                )}
              </>;
            })()}
            <button
              type="button"
              onClick={() => void submitVerification(true)}
              disabled={submittingPayment}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-400"
            >
              <CheckCircle2 size={16} />
              {submittingPayment ? 'Mem-posting...' : 'Verifikasi & Posting'}
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
              onClick={() => void submitVerification(false)}
              disabled={submittingPayment}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 text-sm font-bold text-white hover:bg-red-400"
            >
              <XCircle size={16} />
              {submittingPayment ? 'Memproses...' : 'Ya Tolak'}
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
  const titleId = useId();
  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 id={titleId} className="text-xl font-bold">{title}</h2>
          <button type="button" aria-label="Tutup" onClick={onClose} className="rounded-lg p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
