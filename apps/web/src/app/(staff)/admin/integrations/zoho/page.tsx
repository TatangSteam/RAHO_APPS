'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Ban,
  Boxes,
  Building2,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Database,
  ExternalLink,
  Eye,
  FileText,
  List,
  Landmark,
  Loader2,
  MapPinned,
  PlugZap,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Unplug,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

type Tab = 'connection' | 'queue' | 'discovery' | 'contacts' | 'masters' | 'invoices' | 'payments' | 'retainers' | 'expenses';
type EventStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'DRY_RUN' | 'DEAD_LETTER' | 'IGNORED';

type Connection = {
  id: string;
  organizationId: string;
  organizationName: string;
  dataCenter: string;
  isActive: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  missingScopes: string[];
  reconnectRequired: boolean;
  organizationCurrencyCode: string | null;
  discoveryLastRunAt: string | null;
  contactSyncReady: boolean;
  itemSyncReady: boolean;
  locationSyncReady: boolean;
  invoiceSyncReady: boolean;
  paymentSyncReady: boolean;
  expenseSyncReady: boolean;
  locationsSupported: boolean | null;
  locationsCapabilityError: string | null;
};
type Status = {
  configured: boolean;
  redirectUri: string | null;
  connected: boolean;
  dryRun: boolean;
  workerEnabled: boolean;
  connections: Connection[];
};
type SyncAttempt = {
  id: string;
  attemptNo: number;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
};
type SyncEvent = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  branchId: string | null;
  status: EventStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  availableAt: string;
  occurredAt: string;
  payload: unknown;
  syncAttempts: SyncAttempt[];
};
type QueueData = {
  items: SyncEvent[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type DiscoveryItem = {
  id: string;
  resourceType: string;
  zohoId: string;
  name: string;
  code: string | null;
  isActive: boolean;
};
type DiscoveryData = {
  organizationId: string;
  lastRunAt: string | null;
  counts: Record<string, number>;
  items: DiscoveryItem[];
  contactExternalIdField: {
    fieldId: string | null;
    apiName: string | null;
    isUnique: boolean | null;
    ready: boolean;
  };
  locationCapability: {
    supported: boolean | null;
    error: string | null;
  };
};
type ContactCandidate = {
  contact_id: string;
  contact_name: string;
  contact_type: string;
  email?: string;
  phone?: string;
};
type ContactReview = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  candidates: ContactCandidate[];
};
type ContactMappingRow = {
  entityType: 'MEMBER' | 'SUPPLIER';
  id: string;
  code: string;
  name: string;
  email: string | null;
  isActive: boolean;
  mapping: { zohoEntityId: string; status: string; lastSyncedAt: string | null } | null;
  review: ContactReview | null;
};
type ContactData = {
  items: ContactMappingRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type MasterEntityType = 'MASTER_PRODUCT' | 'PACKAGE_PRICING' | 'BRANCH_LOCATION' | 'STOCK_LOCATION';
type MasterCandidate = {
  item_id?: string;
  name?: string;
  sku?: string;
  product_type?: string;
  location_id?: string;
  location_name?: string;
};
type MasterReview = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  candidates: MasterCandidate[];
};
type MasterMappingRow = {
  entityType: MasterEntityType;
  id: string;
  code: string;
  name: string;
  subtype?: string;
  isActive: boolean;
  eligible?: boolean;
  mapping: { zohoEntityId: string; status: string; lastSyncedAt: string | null } | null;
  review: MasterReview | null;
};
type MasterData = {
  items: MasterMappingRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type MasterConfig = {
  accountRoles: Array<{
    role: 'ITEM_SALES' | 'ITEM_PURCHASE' | 'ITEM_INVENTORY';
    mapping: { zohoEntityId: string } | null;
  }>;
  accounts: DiscoveryItem[];
  uoms: Array<{
    id: string;
    code: string;
    name: string;
    mapping: { zohoEntityId: string } | null;
  }>;
  locationCapability: { supported: boolean | null; error: string | null };
};
type MasterPreview = {
  snapshot: { name: string; externalKey: string; sku?: string | null; code?: string; eligible?: boolean };
  payload: unknown;
  issues: string[];
  excludedFields: string[];
  liveReady: boolean;
  locationCapability: { supported: boolean | null; error: string | null };
};
type InvoiceMappingRow = {
  id: string;
  invoiceNumber: string;
  memberNo: string;
  memberName: string;
  branchCode: string;
  branchType: string;
  classification: 'NORMAL_SALE' | 'THERAPY_ADVANCE';
  eligible: boolean;
  status: string;
  totalAmount: string;
  finalizedAt: string | null;
  mapping: { zohoEntityId: string; status: string; lastSyncedAt: string | null } | null;
  events: Array<{ id: string; eventType: string; status: EventStatus; lastError: string | null }>;
};
type InvoiceData = {
  items: InvoiceMappingRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type InvoiceConfig = {
  taxes: DiscoveryItem[];
  mappings: Array<{ localEntityId: string; zohoEntityId: string; status: string }>;
};
type InvoicePreview = {
  snapshot: {
    invoiceNumber: string;
    externalKey: string;
    classification: string;
    eligible: boolean;
    excludedReason: string | null;
    totalAmount: string;
  };
  issues: string[];
  payload: unknown;
  liveReady: boolean;
  excludedFields: string[];
};
type PaymentMappingRow = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  branchCode: string;
  branchType: string;
  classification: 'NORMAL_SALE' | 'THERAPY_ADVANCE';
  eligible: boolean;
  amount: string;
  paymentMethod: string;
  accountName: string | null;
  verifiedAt: string | null;
  mapping: { zohoEntityId: string; status: string; lastSyncedAt: string | null } | null;
  event: { id: string; status: EventStatus; lastError: string | null } | null;
  refunds: Array<{
    id: string;
    refundNumber: string;
    amount: string;
    status: string;
    refundDate: string;
    mapping: { zohoEntityId: string; status: string } | null;
    event: { id: string; status: EventStatus; lastError: string | null } | null;
  }>;
};
type PaymentData = {
  items: PaymentMappingRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type PaymentConfig = {
  cashBankAccounts: Array<{
    id: string;
    code: string;
    name: string;
    branch: { branchCode: string; name: string };
    mapping: { zohoEntityId: string } | null;
  }>;
  paymentMethods: Array<{
    method: string;
    mapping: { zohoEntityId: string } | null;
  }>;
  zohoAccounts: DiscoveryItem[];
  modes: DiscoveryItem[];
};
type PaymentPreview = {
  snapshot: {
    invoiceNumber: string;
    externalKey: string;
    classification: string;
    eligible: boolean;
    excludedReason: string | null;
    amount: string;
  };
  issues: string[];
  payload: unknown;
  liveReady: boolean;
};
type ReconciliationData = {
  checked: number;
  matched: number;
  mismatched: number;
  missing: number;
  rows: Array<{
    invoiceId: string;
    invoiceNumber: string;
    localBalance?: string;
    zohoBalance?: number | null;
    result: { status: 'MATCHED' | 'MISMATCH' | 'MISSING'; reasons: string[] };
  }>;
};
type RetainerData = {
  mode: 'DOCUMENT' | 'JOURNAL';
  items: Array<{
    id: string;
    packageCode: string;
    productCode: string | null;
    packageType: 'BASIC' | 'BOOSTER';
    memberNo: string;
    memberName: string;
    branchCode: string;
    totalConsideration: string;
    fundedDeferredAmount: string;
    recognizedAmount: string;
    remainingDeferredAmount: string;
    status: string;
    retainerMapping: { zohoEntityId: string; status: string } | null;
    recognitions: Array<{
      id: string;
      sessionCode: string;
      amount: string;
      status: string;
      recognizedAt: string | null;
      zohoMapping: { zohoEntityId: string; status: string } | null;
    }>;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type RetainerConfig = {
  mode: 'DOCUMENT' | 'JOURNAL';
  accounts: Array<{ code: string; mapping: { zohoEntityId: string } | null }>;
  zohoAccounts: DiscoveryItem[];
};
type RetainerReconciliation = {
  checked: number;
  matched: number;
  mismatched: number;
  missing: number;
  rows: Array<{
    contractId: string;
    packageCode: string;
    status: 'MATCHED' | 'MISMATCH' | 'MISSING';
    reasons: string[];
  }>;
};

type ExpenseMappingRow = {
  id: string;
  expenseNumber: string;
  branch: { branchCode: string; name: string };
  expenseDate: string;
  paidAt: string | null;
  status: string;
  category: string;
  description: string;
  amount: string;
  expenseAccount: { code: string; name: string };
  cashBankAccount: { id: string; code: string; name: string };
  hasEvidence: boolean;
  mapping: { zohoEntityId: string; status: string; metadata?: Record<string, unknown> } | null;
  event: { id: string; status: EventStatus; lastError: string | null } | null;
};
type ExpenseData = {
  items: ExpenseMappingRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type ExpenseConfig = {
  expenseAccounts: Array<{
    id: string;
    code: string;
    name: string;
    mapping: { zohoEntityId: string } | null;
  }>;
  cashBankAccounts: Array<{
    id: string;
    code: string;
    name: string;
    branch: { branchCode: string; name: string };
    mapping: { zohoEntityId: string } | null;
  }>;
  zohoAccounts: DiscoveryItem[];
  zohoBankAccounts: DiscoveryItem[];
};
type ExpensePreview = {
  snapshot: { expenseNumber: string; externalKey: string; amount: string };
  payload: unknown;
  issues: string[];
  liveReady: boolean;
  excludedFields: string[];
  reversalPolicy: string;
};
type ExpenseReconciliation = {
  checked: number;
  matched: number;
  mismatched: number;
  missing: number;
  rows: Array<{
    expenseId: string;
    expenseNumber: string;
    result: { status: 'MATCHED' | 'MISMATCH' | 'MISSING'; reasons: string[] };
  }>;
};

const eventStatuses: Array<EventStatus | ''> = [
  '',
  'PENDING',
  'PROCESSING',
  'DRY_RUN',
  'PROCESSED',
  'FAILED',
  'DEAD_LETTER',
  'IGNORED',
];

const badge: Record<EventStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  PROCESSED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
  DRY_RUN: 'bg-violet-100 text-violet-800',
  DEAD_LETTER: 'bg-rose-200 text-rose-900',
  IGNORED: 'bg-neutral-200 text-neutral-700',
};

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  const message = error.response?.data?.error?.message;
  return typeof message === 'string' ? message : fallback;
}

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString('id-ID') : '-';
}

export default function ZohoIntegrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const canManageConnection = user?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<Tab>('connection');
  const [status, setStatus] = useState<Status | null>(null);
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [discovery, setDiscovery] = useState<DiscoveryData | null>(null);
  const [contacts, setContacts] = useState<ContactData | null>(null);
  const [contactEntityType, setContactEntityType] = useState<'MEMBER' | 'SUPPLIER'>('MEMBER');
  const [contactSearch, setContactSearch] = useState('');
  const [contactPreview, setContactPreview] = useState<{
    snapshot: { displayName: string; externalKey: string };
    payload: unknown;
    excludedFields: string[];
    liveCreateReady: boolean;
  } | null>(null);
  const [masters, setMasters] = useState<MasterData | null>(null);
  const [masterConfig, setMasterConfig] = useState<MasterConfig | null>(null);
  const [masterEntityType, setMasterEntityType] = useState<MasterEntityType>('MASTER_PRODUCT');
  const [masterSearch, setMasterSearch] = useState('');
  const [masterPreview, setMasterPreview] = useState<MasterPreview | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData | null>(null);
  const [invoiceConfig, setInvoiceConfig] = useState<InvoiceConfig | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceTaxPercent, setInvoiceTaxPercent] = useState('11');
  const [invoiceTaxId, setInvoiceTaxId] = useState('');
  const [invoicePreview, setInvoicePreview] = useState<InvoicePreview | null>(null);
  const [payments, setPayments] = useState<PaymentData | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentPreview, setPaymentPreview] = useState<PaymentPreview | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null);
  const [retainers, setRetainers] = useState<RetainerData | null>(null);
  const [retainerConfig, setRetainerConfig] = useState<RetainerConfig | null>(null);
  const [retainerSearch, setRetainerSearch] = useState('');
  const [retainerReconciliation, setRetainerReconciliation] = useState<RetainerReconciliation | null>(null);
  const [expenses, setExpenses] = useState<ExpenseData | null>(null);
  const [expenseConfig, setExpenseConfig] = useState<ExpenseConfig | null>(null);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expensePreview, setExpensePreview] = useState<ExpensePreview | null>(null);
  const [expenseReconciliation, setExpenseReconciliation] = useState<ExpenseReconciliation | null>(null);
  const [statusFilter, setStatusFilter] = useState<EventStatus | ''>('');
  const [selectedEvent, setSelectedEvent] = useState<SyncEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const response = await api.get<{ data: Status }>('/integrations/zoho/status');
    setStatus(response.data.data);
  }, []);

  const loadQueue = useCallback(async () => {
    const response = await api.get<{ data: QueueData }>('/integrations/zoho/events', {
      params: { limit: 50, ...(statusFilter ? { status: statusFilter } : {}) },
    });
    setQueue(response.data.data);
  }, [statusFilter]);

  const loadDiscovery = useCallback(async () => {
    const response = await api.get<{ data: DiscoveryData }>('/integrations/zoho/discovery');
    setDiscovery(response.data.data);
  }, []);

  const loadContacts = useCallback(async () => {
    const response = await api.get<{ data: ContactData }>('/integrations/zoho/contacts', {
      params: {
        entityType: contactEntityType,
        limit: 50,
        ...(contactSearch.trim() ? { search: contactSearch.trim() } : {}),
      },
    });
    setContacts(response.data.data);
  }, [contactEntityType, contactSearch]);

  const loadMasters = useCallback(async () => {
    const [rows, config] = await Promise.all([
      api.get<{ data: MasterData }>('/integrations/zoho/masters', {
        params: {
          entityType: masterEntityType,
          limit: 50,
          ...(masterSearch.trim() ? { search: masterSearch.trim() } : {}),
        },
      }),
      api.get<{ data: MasterConfig }>('/integrations/zoho/masters/config'),
    ]);
    setMasters(rows.data.data);
    setMasterConfig(config.data.data);
  }, [masterEntityType, masterSearch]);

  const loadInvoices = useCallback(async () => {
    const [rows, config] = await Promise.all([
      api.get<{ data: InvoiceData }>('/integrations/zoho/invoices', {
        params: { limit: 50, ...(invoiceSearch.trim() ? { search: invoiceSearch.trim() } : {}) },
      }),
      api.get<{ data: InvoiceConfig }>('/integrations/zoho/invoices/config'),
    ]);
    setInvoices(rows.data.data);
    setInvoiceConfig(config.data.data);
  }, [invoiceSearch]);

  const loadPayments = useCallback(async () => {
    const [rows, config] = await Promise.all([
      api.get<{ data: PaymentData }>('/integrations/zoho/payments', {
        params: { limit: 50, ...(paymentSearch.trim() ? { search: paymentSearch.trim() } : {}) },
      }),
      api.get<{ data: PaymentConfig }>('/integrations/zoho/payments/config'),
    ]);
    setPayments(rows.data.data);
    setPaymentConfig(config.data.data);
  }, [paymentSearch]);

  const loadRetainers = useCallback(async () => {
    const [rows, config] = await Promise.all([
      api.get<{ data: RetainerData }>('/integrations/zoho/retainers', {
        params: { limit: 50, ...(retainerSearch.trim() ? { search: retainerSearch.trim() } : {}) },
      }),
      api.get<{ data: RetainerConfig }>('/integrations/zoho/retainers/config'),
    ]);
    setRetainers(rows.data.data);
    setRetainerConfig(config.data.data);
  }, [retainerSearch]);

  const loadExpenses = useCallback(async () => {
    const [rows, config] = await Promise.all([
      api.get<{ data: ExpenseData }>('/integrations/zoho/expenses', {
        params: { limit: 50, ...(expenseSearch.trim() ? { search: expenseSearch.trim() } : {}) },
      }),
      api.get<{ data: ExpenseConfig }>('/integrations/zoho/expenses/config'),
    ]);
    setExpenses(rows.data.data);
    setExpenseConfig(config.data.data);
  }, [expenseSearch]);

  useEffect(() => {
    if (user && !['SUPER_ADMIN', 'FINANCE_LOGISTICS_CONTROLLER'].includes(user.role)) router.replace('/dashboard');
  }, [router, user]);

  useEffect(() => {
    void loadStatus()
      .catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat status integrasi Zoho.')))
      .finally(() => setLoading(false));
  }, [loadStatus]);

  useEffect(() => {
    if (tab === 'queue') void loadQueue().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat antrean Zoho.')));
    if (tab === 'discovery') void loadDiscovery().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat master Zoho.')));
    if (tab === 'contacts') void loadContacts().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat mapping contact.')));
    if (tab === 'masters') void loadMasters().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat mapping Item/Location.')));
    if (tab === 'invoices') void loadInvoices().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat invoice Zoho.')));
    if (tab === 'payments') void loadPayments().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat pembayaran Zoho.')));
    if (tab === 'retainers') void loadRetainers().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat Retainer & omzet terapi.')));
    if (tab === 'expenses') void loadExpenses().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat Expense Zoho.')));
  }, [loadContacts, loadDiscovery, loadExpenses, loadInvoices, loadMasters, loadPayments, loadQueue, loadRetainers, tab]);

  useEffect(() => {
    const result = searchParams.get('zoho');
    if (!result) return;
    if (result === 'success') toast.success('Zoho Books berhasil dihubungkan.');
    else toast.error(searchParams.get('message') || 'Koneksi Zoho gagal.');
    router.replace('/admin/integrations/zoho');
    void loadStatus();
  }, [loadStatus, router, searchParams]);

  async function connect() {
    setAction('connect');
    try {
      const response = await api.get<{ data: { authorizationUrl: string } }>('/integrations/zoho/connect');
      window.location.assign(response.data.data.authorizationUrl);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Tidak dapat memulai otorisasi Zoho.'));
      setAction(null);
    }
  }

  async function testConnection() {
    setAction('test');
    try {
      await api.post('/integrations/zoho/test');
      toast.success('Koneksi Zoho aktif.');
      await loadStatus();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Pemeriksaan koneksi Zoho gagal.'));
    } finally { setAction(null); }
  }

  async function activate(id: string) {
    setAction(id);
    try {
      await api.post(`/integrations/zoho/organizations/${id}/activate`);
      toast.success('Organisasi aktif diperbarui.');
      await loadStatus();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Gagal memilih organisasi.'));
    } finally { setAction(null); }
  }

  async function disconnect() {
    if (!window.confirm('Putuskan koneksi Zoho Books? Sinkronisasi akan berhenti.')) return;
    setAction('disconnect');
    try {
      await api.delete('/integrations/zoho/connection');
      toast.success('Koneksi Zoho diputus.');
      await loadStatus();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Gagal memutus koneksi Zoho.'));
    } finally { setAction(null); }
  }

  async function retryEvent(event: SyncEvent) {
    setAction(event.id);
    try {
      await api.post(`/integrations/zoho/events/${event.id}/retry`);
      toast.success('Event dimasukkan kembali ke antrean.');
      setSelectedEvent(null);
      await loadQueue();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Event tidak dapat diulang.'));
    } finally { setAction(null); }
  }

  async function ignoreEvent(event: SyncEvent) {
    const reason = window.prompt('Alasan mengabaikan event (minimal 5 karakter):');
    if (!reason) return;
    setAction(event.id);
    try {
      await api.post(`/integrations/zoho/events/${event.id}/ignore`, { reason });
      toast.success('Event ditandai diabaikan.');
      setSelectedEvent(null);
      await loadQueue();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Event tidak dapat diabaikan.'));
    } finally { setAction(null); }
  }

  async function runDiscovery() {
    setAction('discovery');
    try {
      const response = await api.post<{ data: DiscoveryData }>('/integrations/zoho/discovery/run');
      setDiscovery(response.data.data);
      await loadStatus();
      toast.success('Master Zoho berhasil diperbarui.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Discovery Zoho gagal.'));
    } finally { setAction(null); }
  }

  async function previewContact(row: ContactMappingRow) {
    setAction(`preview:${row.id}`);
    try {
      const response = await api.get<{ data: typeof contactPreview }>(
        `/integrations/zoho/contacts/${row.entityType}/${row.id}/preview`,
      );
      setContactPreview(response.data.data);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Preview contact gagal.'));
    } finally { setAction(null); }
  }

  async function findContactMatch(row: ContactMappingRow) {
    setAction(`match:${row.id}`);
    try {
      const response = await api.post<{ data: { decision: { kind: string } } }>(
        `/integrations/zoho/contacts/${row.entityType}/${row.id}/match`,
      );
      toast.success(response.data.data.decision.kind === 'REVIEW'
        ? 'Kandidat ditemukan dan menunggu review.'
        : response.data.data.decision.kind === 'AUTO_MATCH'
          ? 'External RAHO ID cocok.'
          : 'Tidak ada kandidat; contact baru dapat dibuat.');
      await loadContacts();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Pencarian contact Zoho gagal.'));
    } finally { setAction(null); }
  }

  async function enqueueContact(row: ContactMappingRow) {
    setAction(`sync:${row.id}`);
    try {
      await api.post(`/integrations/zoho/contacts/${row.entityType}/${row.id}/enqueue`);
      toast.success(status?.dryRun ? 'Contact masuk antrean dry-run.' : 'Contact masuk antrean sinkronisasi.');
      await loadContacts();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Contact gagal dimasukkan ke antrean.'));
    } finally { setAction(null); }
  }

  async function approveReview(row: ContactMappingRow, zohoContactId: string) {
    if (!row.review) return;
    setAction(`review:${row.id}`);
    try {
      await api.post(`/integrations/zoho/contacts/reviews/${row.review.id}/approve`, { zohoContactId });
      toast.success('Mapping disetujui dan update contact masuk antrean.');
      await loadContacts();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Mapping tidak dapat disetujui.'));
    } finally { setAction(null); }
  }

  async function rejectReview(row: ContactMappingRow) {
    if (!row.review) return;
    setAction(`review:${row.id}`);
    try {
      await api.post(`/integrations/zoho/contacts/reviews/${row.review.id}/reject`);
      toast.success('Kandidat ditolak. Contact dapat dibuat baru melalui antrean.');
      await loadContacts();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Review tidak dapat ditolak.'));
    } finally { setAction(null); }
  }

  async function previewMasterRow(row: MasterMappingRow) {
    setAction(`master-preview:${row.id}`);
    try {
      const response = await api.get<{ data: MasterPreview }>(
        `/integrations/zoho/masters/${row.entityType}/${row.id}/preview`,
      );
      setMasterPreview(response.data.data);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Preview master gagal.'));
    } finally { setAction(null); }
  }

  async function findMasterMatch(row: MasterMappingRow) {
    setAction(`master-match:${row.id}`);
    try {
      const response = await api.post<{ data: { decision: { kind: string } } }>(
        `/integrations/zoho/masters/${row.entityType}/${row.id}/match`,
      );
      toast.success(response.data.data.decision.kind === 'REVIEW'
        ? 'Kandidat ditemukan dan menunggu review.'
        : response.data.data.decision.kind === 'AUTO_MATCH'
          ? 'Kode master cocok tepat.'
          : 'Tidak ada kandidat; master baru dapat dibuat.');
      await loadMasters();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Pencarian master Zoho gagal.'));
    } finally { setAction(null); }
  }

  async function enqueueMasterRow(row: MasterMappingRow) {
    setAction(`master-sync:${row.id}`);
    try {
      await api.post(`/integrations/zoho/masters/${row.entityType}/${row.id}/enqueue`);
      toast.success(status?.dryRun ? 'Master masuk antrean dry-run.' : 'Master masuk antrean sinkronisasi.');
      await loadMasters();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Master gagal dimasukkan ke antrean.'));
    } finally { setAction(null); }
  }

  async function approveMasterMapping(row: MasterMappingRow, candidate: MasterCandidate) {
    if (!row.review) return;
    const zohoEntityId = String(candidate.item_id || candidate.location_id || '');
    if (!zohoEntityId) return;
    setAction(`master-review:${row.id}`);
    try {
      await api.post(`/integrations/zoho/masters/reviews/${row.review.id}/approve`, { zohoEntityId });
      toast.success('Mapping master disetujui dan dimasukkan ke antrean update.');
      await loadMasters();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Mapping master tidak dapat disetujui.'));
    } finally { setAction(null); }
  }

  async function rejectMasterMapping(row: MasterMappingRow) {
    if (!row.review) return;
    setAction(`master-review:${row.id}`);
    try {
      await api.post(`/integrations/zoho/masters/reviews/${row.review.id}/reject`);
      toast.success('Semua kandidat ditolak.');
      await loadMasters();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Review master tidak dapat ditolak.'));
    } finally { setAction(null); }
  }

  async function saveAccountMapping(role: string, zohoAccountId: string) {
    if (!zohoAccountId) return;
    setAction(`account:${role}`);
    try {
      await api.put('/integrations/zoho/masters/config/account', { role, zohoAccountId });
      toast.success('Mapping account Item disimpan.');
      await Promise.all([loadMasters(), loadStatus()]);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Mapping account tidak dapat disimpan.'));
    } finally { setAction(null); }
  }

  async function saveUomMapping(uom: MasterConfig['uoms'][number]) {
    const zohoUnit = window.prompt(`Unit Zoho untuk ${uom.code} - ${uom.name}:`, uom.mapping?.zohoEntityId || uom.code);
    if (!zohoUnit?.trim()) return;
    setAction(`uom:${uom.id}`);
    try {
      await api.put('/integrations/zoho/masters/config/uom', { uomId: uom.id, zohoUnit: zohoUnit.trim() });
      toast.success('Mapping UOM disimpan.');
      await loadMasters();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Mapping UOM tidak dapat disimpan.'));
    } finally { setAction(null); }
  }

  async function previewInvoiceRow(row: InvoiceMappingRow) {
    setAction(`invoice-preview:${row.id}`);
    try {
      const response = await api.get<{ data: InvoicePreview }>(`/integrations/zoho/invoices/${row.id}/preview`);
      setInvoicePreview(response.data.data);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Preview invoice gagal.'));
    } finally { setAction(null); }
  }

  async function enqueueInvoiceRow(row: InvoiceMappingRow) {
    setAction(`invoice-sync:${row.id}`);
    try {
      await api.post(`/integrations/zoho/invoices/${row.id}/enqueue`);
      toast.success(status?.dryRun ? 'Invoice masuk antrean dry-run.' : 'Invoice masuk antrean sinkronisasi.');
      await loadInvoices();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Invoice gagal dimasukkan ke antrean.'));
    } finally { setAction(null); }
  }

  async function saveInvoiceTaxMapping() {
    const percent = Number(invoiceTaxPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100 || !invoiceTaxId) {
      toast.error('Isi persentase dan pilih pajak Zoho.');
      return;
    }
    setAction('invoice-tax');
    try {
      await api.put('/integrations/zoho/invoices/config/tax', { percent, zohoTaxId: invoiceTaxId });
      toast.success(`Pajak ERP ${percent}% berhasil dipetakan.`);
      await loadInvoices();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Mapping pajak gagal disimpan.'));
    } finally { setAction(null); }
  }

  async function savePaymentAccountMapping(cashBankAccountId: string, zohoAccountId: string) {
    if (!zohoAccountId) return;
    setAction(`payment-account:${cashBankAccountId}`);
    try {
      await api.put('/integrations/zoho/payments/config/account', { cashBankAccountId, zohoAccountId });
      toast.success('Mapping rekening pembayaran disimpan.');
      await loadPayments();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Mapping rekening pembayaran gagal.'));
    } finally { setAction(null); }
  }

  async function savePaymentMethodMapping(paymentMethod: string, zohoMode: string) {
    if (!zohoMode) return;
    setAction(`payment-method:${paymentMethod}`);
    try {
      await api.put('/integrations/zoho/payments/config/method', { paymentMethod, zohoMode });
      toast.success('Mapping metode pembayaran disimpan.');
      await loadPayments();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Mapping metode pembayaran gagal.'));
    } finally { setAction(null); }
  }

  async function previewPaymentRow(row: PaymentMappingRow) {
    setAction(`payment-preview:${row.id}`);
    try {
      const response = await api.get<{ data: PaymentPreview }>(`/integrations/zoho/payments/${row.id}/preview`);
      setPaymentPreview(response.data.data);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Preview pembayaran gagal.'));
    } finally { setAction(null); }
  }

  async function enqueuePaymentRow(row: PaymentMappingRow) {
    setAction(`payment-sync:${row.id}`);
    try {
      await api.post(`/integrations/zoho/payments/${row.id}/enqueue`);
      toast.success(status?.dryRun ? 'Pembayaran masuk antrean dry-run.' : 'Pembayaran masuk antrean sinkronisasi.');
      await loadPayments();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Pembayaran gagal dimasukkan ke antrean.'));
    } finally { setAction(null); }
  }

  async function runPaymentReconciliation() {
    setAction('payment-reconcile');
    try {
      const response = await api.post<{ data: ReconciliationData }>('/integrations/zoho/payments/reconcile/run');
      setReconciliation(response.data.data);
      toast.success('Rekonsiliasi piutang selesai.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Rekonsiliasi piutang gagal.'));
    } finally { setAction(null); }
  }

  async function saveRetainerAccountMapping(accountCode: string, zohoAccountId: string) {
    if (!zohoAccountId) return;
    setAction(`retainer-account-${accountCode}`);
    try {
      await api.put('/integrations/zoho/retainers/config/account', { accountCode, zohoAccountId });
      toast.success(`Akun ${accountCode} berhasil dipetakan.`);
      await loadRetainers();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Mapping akun Retainer gagal.'));
    } finally { setAction(null); }
  }

  async function runRetainerReconciliation() {
    setAction('retainer-reconcile');
    try {
      const response = await api.post<{ data: RetainerReconciliation }>('/integrations/zoho/retainers/reconcile/run');
      setRetainerReconciliation(response.data.data);
      toast.success('Rekonsiliasi Retainer selesai.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Rekonsiliasi Retainer gagal.'));
    } finally { setAction(null); }
  }

  async function saveExpenseAccountMapping(accountCode: string, zohoAccountId: string) {
    if (!zohoAccountId) return;
    setAction(`expense-account-${accountCode}`);
    try {
      await api.put('/integrations/zoho/expenses/config/account', { accountCode, zohoAccountId });
      toast.success(`Akun beban ${accountCode} berhasil dipetakan.`);
      await loadExpenses();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Mapping akun beban gagal.'));
    } finally { setAction(null); }
  }

  async function saveExpensePaidThroughMapping(cashBankAccountId: string, zohoAccountId: string) {
    if (!zohoAccountId) return;
    setAction(`expense-paid-through-${cashBankAccountId}`);
    try {
      await api.put('/integrations/zoho/expenses/config/paid-through', { cashBankAccountId, zohoAccountId });
      toast.success('Akun paid-through berhasil dipetakan.');
      await loadExpenses();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Mapping paid-through gagal.'));
    } finally { setAction(null); }
  }

  async function previewExpenseRow(row: ExpenseMappingRow) {
    setAction(`expense-preview-${row.id}`);
    try {
      const response = await api.get<{ data: ExpensePreview }>(`/integrations/zoho/expenses/${row.id}/preview`);
      setExpensePreview(response.data.data);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Preview expense gagal.'));
    } finally { setAction(null); }
  }

  async function enqueueExpenseRow(row: ExpenseMappingRow) {
    setAction(`expense-sync-${row.id}`);
    try {
      await api.post(`/integrations/zoho/expenses/${row.id}/enqueue`);
      toast.success(status?.dryRun ? 'Expense masuk antrean dry-run.' : 'Expense masuk antrean sinkronisasi.');
      await loadExpenses();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Expense gagal dimasukkan ke antrean.'));
    } finally { setAction(null); }
  }

  async function runExpenseReconciliation() {
    setAction('expense-reconcile');
    try {
      const response = await api.post<{ data: ExpenseReconciliation }>('/integrations/zoho/expenses/reconcile/run');
      setExpenseReconciliation(response.data.data);
      toast.success('Rekonsiliasi expense selesai.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Rekonsiliasi expense gagal.'));
    } finally { setAction(null); }
  }

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-neutral-900 dark:text-white">
          <PlugZap className="text-blue-600" /> Integrasi Zoho Books
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Koneksi, antrean sinkronisasi, dan master finance/logistik Zoho.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-neutral-200 dark:border-neutral-700">
        {([
          ['connection', 'Koneksi', PlugZap],
          ['queue', 'Antrean Sinkronisasi', List],
          ['discovery', 'Master Zoho', Database],
          ['contacts', 'Customer & Vendor', Users],
          ['masters', 'Item & Location', Boxes],
          ['invoices', 'Sales Invoice', FileText],
          ['payments', 'Pembayaran & Piutang', CreditCard],
          ['retainers', 'Retainer & Omzet Terapi', Landmark],
          ['expenses', 'Expense', ReceiptText],
        ] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${
              tab === value ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500'
            }`}
          >
            <Icon size={17} /> {label}
          </button>
        ))}
      </div>

      {tab === 'connection' && (
        <>
          {!status?.configured && (
            <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
              <CircleAlert className="shrink-0" />
              <div>
                <p className="font-semibold">Konfigurasi server belum lengkap</p>
                <p className="mt-1 text-sm">Isi credential dan kunci enkripsi Zoho, lalu restart API.</p>
              </div>
            </div>
          )}

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 md:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                {status?.connected ? <CheckCircle2 className="text-emerald-600" size={30} /> : <PlugZap className="text-neutral-400" size={30} />}
                <div>
                  <p className="font-semibold text-neutral-900 dark:text-white">{status?.connected ? 'Zoho Books terhubung' : 'Belum terhubung'}</p>
                  <p className="text-sm text-neutral-500">
                    {status?.dryRun ? 'Mode aman dry-run aktif: belum ada penulisan ke Zoho.' : 'Mode live aktif.'}
                    {' '}Worker {status?.workerEnabled ? 'aktif' : 'nonaktif'}.
                  </p>
                </div>
              </div>
              {canManageConnection && (
                <div className="flex flex-wrap gap-2">
                  {status?.connected && (
                    <button onClick={testConnection} disabled={!!action} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-neutral-700">
                      <RefreshCw size={16} className={action === 'test' ? 'animate-spin' : ''} /> Tes
                    </button>
                  )}
                  <button onClick={connect} disabled={!status?.configured || !!action} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {action === 'connect' ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                    {status?.connected ? 'Hubungkan ulang' : 'Hubungkan Zoho'}
                  </button>
                  {status?.connected && (
                    <button onClick={disconnect} disabled={!!action} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
                      <Unplug size={16} /> Putuskan
                    </button>
                  )}
                </div>
              )}
            </div>
            {status?.redirectUri && (
              <div className="mt-5 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Authorized Redirect URI</p>
                <code className="mt-1 block break-all text-sm">{status.redirectUri}</code>
              </div>
            )}
          </section>

          {!!status?.connections.length && (
            <section className="space-y-3">
              {status.connections.map((connection) => (
                <div key={connection.id} className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="flex gap-3">
                      <Building2 className={connection.isActive ? 'text-blue-600' : 'text-neutral-400'} />
                      <div>
                        <p className="font-semibold">{connection.organizationName}</p>
                        <p className="text-xs text-neutral-500">
                          ID {connection.organizationId} · {connection.organizationCurrencyCode || '-'} · discovery {when(connection.discoveryLastRunAt)}
                        </p>
                        {connection.reconnectRequired && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Hubungkan ulang untuk scope baru: {connection.missingScopes.join(', ') || 'versi izin terbaru'}
                          </p>
                        )}
                        {!connection.contactSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Contact live belum siap: buat custom field contact unik “RAHO External ID”, lalu jalankan discovery.
                          </p>
                        )}
                        {!connection.itemSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Item live belum siap: petakan sales, purchase, dan inventory account.
                          </p>
                        )}
                        {!connection.locationSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Location belum siap: jalankan discovery untuk memeriksa dukungan edition Zoho.
                          </p>
                        )}
                        {!connection.invoiceSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Invoice live belum siap: hubungkan ulang untuk scope CREATE dan UPDATE.
                          </p>
                        )}
                        {!connection.paymentSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Customer Payment/refund belum siap: hubungkan ulang untuk scope pembayaran Sprint 6.
                          </p>
                        )}
                        {!connection.expenseSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Expense belum siap: hubungkan ulang untuk scope expense Sprint 8.
                          </p>
                        )}
                        {connection.lastError && <p className="mt-1 text-xs text-red-600">{connection.lastError}</p>}
                      </div>
                    </div>
                    {connection.isActive ? (
                      <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Aktif</span>
                    ) : canManageConnection ? (
                      <button onClick={() => activate(connection.id)} disabled={!!action} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-neutral-700">
                        Gunakan organisasi ini
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {tab === 'queue' && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Antrean sinkronisasi</h2>
              <p className="text-sm text-neutral-500">{queue?.pagination.total || 0} event ditemukan.</p>
            </div>
            <div className="flex gap-2">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EventStatus | '')} className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700">
                {eventStatuses.map((value) => <option key={value} value={value}>{value || 'Semua status'}</option>)}
              </select>
              <button onClick={() => void loadQueue()} className="rounded-lg border p-2 dark:border-neutral-700" title="Muat ulang"><RefreshCw size={18} /></button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-neutral-500">
                <tr><th className="p-3">Event</th><th className="p-3">Aggregate</th><th className="p-3">Status</th><th className="p-3">Percobaan</th><th className="p-3">Waktu</th><th className="p-3">Aksi</th></tr>
              </thead>
              <tbody>
                {queue?.items.map((event) => (
                  <tr key={event.id} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="p-3 font-medium">{event.eventType}</td>
                    <td className="p-3"><span className="block">{event.aggregateType}</span><span className="text-xs text-neutral-500">{event.aggregateId}</span></td>
                    <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge[event.status]}`}>{event.status}</span></td>
                    <td className="p-3">{event.attempts}/{event.maxAttempts}</td>
                    <td className="p-3 text-xs">{when(event.occurredAt)}</td>
                    <td className="p-3"><button onClick={() => setSelectedEvent(event)} className="inline-flex items-center gap-1 text-blue-600"><Eye size={16} /> Detail</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!queue?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Belum ada event pada filter ini.</p>}
          </div>
        </section>
      )}

      {tab === 'discovery' && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Master read-only dari Zoho</h2>
              <p className="text-sm text-neutral-500">Terakhir diperbarui: {when(discovery?.lastRunAt || null)}</p>
            </div>
            <button onClick={runDiscovery} disabled={!status?.connected || action === 'discovery'} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <RefreshCw size={16} className={action === 'discovery' ? 'animate-spin' : ''} /> Ambil ulang dari Zoho
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(discovery?.counts || {}).map(([resource, count]) => (
              <div key={resource} className="rounded-xl border p-4 dark:border-neutral-700">
                <p className="text-xs font-semibold text-neutral-500">{resource.replaceAll('_', ' ')}</p>
                <p className="mt-1 text-2xl font-bold">{count}</p>
              </div>
            ))}
          </div>
          {discovery && !discovery.contactExternalIdField.ready && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Custom field contact unik “RAHO External ID” belum ditemukan. Field ini wajib agar retry tidak membuat customer/vendor ganda.
            </div>
          )}
          {discovery?.locationCapability.supported === false && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              Zoho Location diblokir oleh capability check: {discovery.locationCapability.error || 'edition tidak mendukung Location'}.
            </div>
          )}
          {!!discovery?.items.length && (
            <div className="mt-5 max-h-96 overflow-auto rounded-xl border dark:border-neutral-700">
              {discovery.items.map((item) => (
                <div key={item.id} className="flex justify-between border-b p-3 text-sm last:border-b-0 dark:border-neutral-700">
                  <div><span className="font-medium">{item.name}</span><span className="ml-2 text-xs text-neutral-500">{item.code}</span></div>
                  <span className={item.isActive ? 'text-emerald-600' : 'text-red-600'}>{item.resourceType} · {item.isActive ? 'aktif' : 'nonaktif'}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'contacts' && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">Mapping Customer dan Vendor</h2>
              <p className="text-sm text-neutral-500">
                Member menjadi customer; supplier menjadi vendor. Data klinis tidak dikirim.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={contactEntityType}
                onChange={(event) => setContactEntityType(event.target.value as 'MEMBER' | 'SUPPLIER')}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              >
                <option value="MEMBER">Member / Customer</option>
                <option value="SUPPLIER">Supplier / Vendor</option>
              </select>
              <input
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void loadContacts(); }}
                placeholder="Cari nama, kode, email"
                className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              />
              <button onClick={() => void loadContacts()} className="rounded-lg border p-2 dark:border-neutral-700"><RefreshCw size={18} /></button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-neutral-500">
                <tr><th className="p-3">ERP</th><th className="p-3">Mapping Zoho</th><th className="p-3">Review</th><th className="p-3">Aksi</th></tr>
              </thead>
              <tbody>
                {contacts?.items.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                    <td className="p-3">
                      <span className="block font-semibold">{row.name}</span>
                      <span className="block text-xs text-neutral-500">{row.code} · {row.email || '-'}</span>
                    </td>
                    <td className="p-3">
                      {row.mapping ? (
                        <>
                          <span className="block font-mono text-xs">{row.mapping.zohoEntityId}</span>
                          <span className="text-xs text-emerald-600">{row.mapping.status}</span>
                        </>
                      ) : <span className="text-xs text-neutral-500">Belum dipetakan</span>}
                    </td>
                    <td className="min-w-64 p-3">
                      {row.review?.status === 'PENDING' ? (
                        <div className="space-y-2">
                          <p className="text-xs text-amber-700">{row.review.reason}</p>
                          {row.review.candidates.map((candidate) => (
                            <div key={candidate.contact_id} className="flex items-center justify-between gap-2 rounded border p-2 dark:border-neutral-700">
                              <span className="text-xs">{candidate.contact_name}<br />{candidate.email || candidate.phone || candidate.contact_id}</span>
                              <button onClick={() => void approveReview(row, String(candidate.contact_id))} disabled={!!action} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">Pilih</button>
                            </div>
                          ))}
                          <button onClick={() => void rejectReview(row)} disabled={!!action} className="text-xs font-semibold text-red-600">Tolak semua kandidat</button>
                        </div>
                      ) : <span className="text-xs text-neutral-500">{row.review?.status || '-'}</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex min-w-52 flex-wrap gap-2">
                        <button onClick={() => void previewContact(row)} disabled={!!action} className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700">Preview</button>
                        {!row.mapping && row.review?.status !== 'PENDING' && (
                          <button onClick={() => void findContactMatch(row)} disabled={!!action} className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700">Cari Zoho</button>
                        )}
                        {row.review?.status !== 'PENDING' && (
                          <button onClick={() => void enqueueContact(row)} disabled={!!action} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
                            {status?.dryRun ? 'Dry-run' : 'Sinkronkan'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!contacts?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Tidak ada data contact.</p>}
          </div>
        </section>
      )}

      {tab === 'masters' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex items-center gap-2">
              <Database className="text-blue-600" size={20} />
              <div>
                <h2 className="font-semibold">Prasyarat Item Zoho</h2>
                <p className="text-sm text-neutral-500">Pilih account dari hasil discovery dan petakan unit ERP.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {masterConfig?.accountRoles.map((entry) => (
                <label key={entry.role} className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  {entry.role.replace('ITEM_', '')} ACCOUNT
                  <select
                    value={entry.mapping?.zohoEntityId || ''}
                    onChange={(event) => void saveAccountMapping(entry.role, event.target.value)}
                    disabled={!!action}
                    className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm font-normal dark:border-neutral-700"
                  >
                    <option value="">Belum dipetakan</option>
                    {masterConfig.accounts.map((account) => (
                      <option key={account.zohoId} value={account.zohoId}>
                        {account.code ? `${account.code} · ` : ''}{account.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Mapping UOM</p>
              <div className="mt-2 flex max-h-44 flex-wrap gap-2 overflow-auto">
                {masterConfig?.uoms.map((uom) => (
                  <button
                    key={uom.id}
                    onClick={() => void saveUomMapping(uom)}
                    disabled={!!action}
                    className={`rounded-lg border px-3 py-2 text-left text-xs disabled:opacity-50 dark:border-neutral-700 ${
                      uom.mapping ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : ''
                    }`}
                  >
                    <span className="block font-semibold">{uom.code} · {uom.name}</span>
                    <span>{uom.mapping?.zohoEntityId || 'Klik untuk petakan'}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className={`mt-4 flex gap-2 rounded-lg p-3 text-sm ${
              masterConfig?.locationCapability.supported === true
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800'
            }`}>
              <MapPinned size={18} className="shrink-0" />
              <span>
                Location: {masterConfig?.locationCapability.supported === true
                  ? 'didukung dan siap dipetakan.'
                  : masterConfig?.locationCapability.error || 'belum diverifikasi; jalankan discovery.'}
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Mapping Item dan Location</h2>
                <p className="text-sm text-neutral-500">
                  Partnership tidak dibuat sebagai Location. BOM, batch, expiry, dan opening stock tetap di ERP.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={masterEntityType}
                  onChange={(event) => setMasterEntityType(event.target.value as MasterEntityType)}
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                >
                  <option value="MASTER_PRODUCT">Barang / Inventory Item</option>
                  <option value="PACKAGE_PRICING">Paket / Service Item</option>
                  <option value="BRANCH_LOCATION">Cabang / Location</option>
                  <option value="STOCK_LOCATION">Stock Location</option>
                </select>
                <input
                  value={masterSearch}
                  onChange={(event) => setMasterSearch(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void loadMasters(); }}
                  placeholder="Cari nama atau kode"
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                />
                <button onClick={() => void loadMasters()} className="rounded-lg border p-2 dark:border-neutral-700"><RefreshCw size={18} /></button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-neutral-500">
                  <tr><th className="p-3">Master ERP</th><th className="p-3">Mapping Zoho</th><th className="p-3">Review</th><th className="p-3">Aksi</th></tr>
                </thead>
                <tbody>
                  {masters?.items.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                      <td className="p-3">
                        <span className="block font-semibold">{row.name}</span>
                        <span className="block text-xs text-neutral-500">{row.code || 'KODE KOSONG'}{row.subtype ? ` · ${row.subtype}` : ''}</span>
                        {row.eligible === false && <span className="mt-1 block text-xs font-semibold text-amber-700">Tidak dikirim sesuai kebijakan Partnership</span>}
                      </td>
                      <td className="p-3">
                        {row.mapping ? (
                          <>
                            <span className="block font-mono text-xs">{row.mapping.zohoEntityId}</span>
                            <span className="text-xs text-emerald-600">{row.mapping.status}</span>
                          </>
                        ) : <span className="text-xs text-neutral-500">Belum dipetakan</span>}
                      </td>
                      <td className="min-w-64 p-3">
                        {row.review?.status === 'PENDING' ? (
                          <div className="space-y-2">
                            <p className="text-xs text-amber-700">{row.review.reason}</p>
                            {row.review.candidates.map((candidate) => {
                              const id = String(candidate.item_id || candidate.location_id || '');
                              return (
                                <div key={id} className="flex items-center justify-between gap-2 rounded border p-2 dark:border-neutral-700">
                                  <span className="text-xs">
                                    {candidate.name || candidate.location_name || id}
                                    <br />{candidate.sku || candidate.product_type || id}
                                  </span>
                                  <button onClick={() => void approveMasterMapping(row, candidate)} disabled={!!action} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">Pilih</button>
                                </div>
                              );
                            })}
                            <button onClick={() => void rejectMasterMapping(row)} disabled={!!action} className="text-xs font-semibold text-red-600">Tolak semua kandidat</button>
                          </div>
                        ) : <span className="text-xs text-neutral-500">{row.review?.status || '-'}</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex min-w-52 flex-wrap gap-2">
                          <button onClick={() => void previewMasterRow(row)} disabled={!!action} className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700">Preview</button>
                          {row.eligible !== false && !row.mapping && row.review?.status !== 'PENDING' && (
                            <button onClick={() => void findMasterMatch(row)} disabled={!!action} className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700">Cari Zoho</button>
                          )}
                          {row.eligible !== false && row.review?.status !== 'PENDING' && (
                            <button onClick={() => void enqueueMasterRow(row)} disabled={!!action} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
                              {status?.dryRun ? 'Dry-run' : 'Sinkronkan'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!masters?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Tidak ada master pada filter ini.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === 'invoices' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex items-center gap-2">
              <Database className="text-blue-600" size={20} />
              <div>
                <h2 className="font-semibold">Mapping Pajak Invoice</h2>
                <p className="text-sm text-neutral-500">
                  Persentase pajak ERP harus menunjuk ke tax rate hasil discovery Zoho.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                Pajak ERP (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={invoiceTaxPercent}
                  onChange={(event) => setInvoiceTaxPercent(event.target.value)}
                  className="mt-1 block w-32 rounded-lg border bg-transparent px-3 py-2 text-sm font-normal dark:border-neutral-700"
                />
              </label>
              <label className="min-w-64 flex-1 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                Tax rate Zoho
                <select
                  value={invoiceTaxId}
                  onChange={(event) => setInvoiceTaxId(event.target.value)}
                  className="mt-1 block w-full rounded-lg border bg-transparent px-3 py-2 text-sm font-normal dark:border-neutral-700"
                >
                  <option value="">Pilih pajak Zoho</option>
                  {invoiceConfig?.taxes.map((tax) => (
                    <option key={tax.zohoId} value={tax.zohoId}>{tax.name}</option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => void saveInvoiceTaxMapping()}
                disabled={!!action}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Simpan mapping
              </button>
            </div>
            {!!invoiceConfig?.mappings.length && (
              <div className="mt-3 flex flex-wrap gap-2">
                {invoiceConfig.mappings.map((mapping) => {
                  const tax = invoiceConfig.taxes.find((entry) => entry.zohoId === mapping.zohoEntityId);
                  return (
                    <span key={mapping.localEntityId} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      ERP {mapping.localEntityId}% → {tax?.name || mapping.zohoEntityId}
                    </span>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Sales Invoice RAHO → Zoho Books</h2>
                <p className="text-sm text-neutral-500">
                  Paket terapi tetap uang muka. Invoice member Partnership tidak menjadi omzet per infus.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  value={invoiceSearch}
                  onChange={(event) => setInvoiceSearch(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void loadInvoices(); }}
                  placeholder="Cari nomor atau member"
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                />
                <button onClick={() => void loadInvoices()} className="rounded-lg border p-2 dark:border-neutral-700">
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="p-3">Invoice ERP</th>
                    <th className="p-3">Kebijakan</th>
                    <th className="p-3">Mapping Zoho</th>
                    <th className="p-3">Event</th>
                    <th className="p-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices?.items.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                      <td className="p-3">
                        <span className="block font-semibold">{row.invoiceNumber}</span>
                        <span className="block text-xs text-neutral-500">{row.memberNo} · {row.memberName}</span>
                        <span className="block text-xs text-neutral-500">{row.branchCode} · IDR {Number(row.totalAmount).toLocaleString('id-ID')}</span>
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.eligible ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {row.classification === 'THERAPY_ADVANCE' ? 'Uang muka terapi' : 'Penjualan biasa'}
                        </span>
                        {row.branchType === 'PARTNERSHIP' && (
                          <span className="mt-2 block text-xs font-semibold text-amber-700">Revenue menunggu shipment barang</span>
                        )}
                      </td>
                      <td className="p-3">
                        {row.mapping ? (
                          <>
                            <span className="block font-mono text-xs">{row.mapping.zohoEntityId}</span>
                            <span className={row.mapping.status === 'ACTIVE' ? 'text-xs text-emerald-600' : 'text-xs text-neutral-500'}>
                              {row.mapping.status}
                            </span>
                          </>
                        ) : <span className="text-xs text-neutral-500">Belum dipetakan</span>}
                      </td>
                      <td className="p-3">
                        {row.events.map((event) => (
                          <span key={event.id} className="mb-1 block text-xs">
                            {event.eventType.replace('INVOICE_', '')} · {event.status}
                          </span>
                        ))}
                        {!row.events.length && <span className="text-xs text-neutral-500">Event lama belum dibuat</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex min-w-44 flex-wrap gap-2">
                          <button onClick={() => void previewInvoiceRow(row)} disabled={!!action} className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700">
                            Preview
                          </button>
                          {row.eligible && (
                            <button onClick={() => void enqueueInvoiceRow(row)} disabled={!!action} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
                              {row.status === 'CANCELLED' ? 'Antrekan void' : status?.dryRun ? 'Dry-run' : 'Sinkronkan'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!invoices?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Tidak ada invoice finalized.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex items-center gap-2">
              <Database className="text-blue-600" size={20} />
              <div>
                <h2 className="font-semibold">Mapping Pembayaran</h2>
                <p className="text-sm text-neutral-500">
                  Setiap rekening dan metode ERP harus menunjuk ke rekening serta payment mode Zoho.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">Rekening kas/bank</p>
                <div className="space-y-2">
                  {paymentConfig?.cashBankAccounts.map((account) => (
                    <label key={account.id} className="grid gap-2 rounded-lg border p-3 text-sm dark:border-neutral-700 sm:grid-cols-[1fr_1.2fr] sm:items-center">
                      <span>
                        <span className="block font-semibold">{account.code} · {account.name}</span>
                        <span className="text-xs text-neutral-500">{account.branch.branchCode}</span>
                      </span>
                      <select
                        value={account.mapping?.zohoEntityId || ''}
                        disabled={!!action}
                        onChange={(event) => void savePaymentAccountMapping(account.id, event.target.value)}
                        className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                      >
                        <option value="">Pilih rekening Zoho</option>
                        {paymentConfig.zohoAccounts.map((entry) => (
                          <option key={entry.zohoId} value={entry.zohoId}>{entry.code ? `${entry.code} · ` : ''}{entry.name}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">Metode pembayaran</p>
                <div className="space-y-2">
                  {paymentConfig?.paymentMethods.map((method) => (
                    <label key={method.method} className="grid gap-2 rounded-lg border p-3 text-sm dark:border-neutral-700 sm:grid-cols-[1fr_1.2fr] sm:items-center">
                      <span className="font-semibold">{method.method}</span>
                      <select
                        value={method.mapping?.zohoEntityId || ''}
                        disabled={!!action}
                        onChange={(event) => void savePaymentMethodMapping(method.method, event.target.value)}
                        className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                      >
                        <option value="">Pilih payment mode Zoho</option>
                        {paymentConfig.modes.map((entry) => (
                          <option key={entry.zohoId} value={entry.zohoId}>{entry.name}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Customer Payment RAHO → Zoho Books</h2>
                <p className="text-sm text-neutral-500">
                  Hanya pembayaran verified untuk penjualan biasa. Uang muka paket menunggu Retainer Sprint 7.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={paymentSearch}
                  onChange={(event) => setPaymentSearch(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void loadPayments(); }}
                  placeholder="Cari invoice atau referensi"
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                />
                <button onClick={() => void loadPayments()} className="rounded-lg border p-2 dark:border-neutral-700">
                  <RefreshCw size={18} />
                </button>
                <button
                  onClick={() => void runPaymentReconciliation()}
                  disabled={!!action || status?.dryRun}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  title={status?.dryRun ? 'Matikan dry-run untuk membandingkan data live Zoho.' : undefined}
                >
                  Rekonsiliasi AR
                </button>
              </div>
            </div>

            {reconciliation && (
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                <div className="flex flex-wrap gap-4 font-semibold">
                  <span>Diperiksa: {reconciliation.checked}</span>
                  <span className="text-emerald-700">Cocok: {reconciliation.matched}</span>
                  <span className="text-red-700">Beda: {reconciliation.mismatched}</span>
                  <span className="text-amber-700">Hilang: {reconciliation.missing}</span>
                </div>
                {!!reconciliation.rows.filter((row) => row.result.status !== 'MATCHED').length && (
                  <div className="mt-3 space-y-1 text-xs">
                    {reconciliation.rows.filter((row) => row.result.status !== 'MATCHED').map((row) => (
                      <p key={row.invoiceId}>
                        <strong>{row.invoiceNumber}</strong>: {row.result.reasons.join(' ')}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="p-3">Pembayaran ERP</th>
                    <th className="p-3">Kebijakan</th>
                    <th className="p-3">Zoho</th>
                    <th className="p-3">Refund</th>
                    <th className="p-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {payments?.items.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                      <td className="p-3">
                        <span className="block font-semibold">{row.invoiceNumber}</span>
                        <span className="block text-xs text-neutral-500">
                          {row.branchCode} · {row.paymentMethod} · {row.accountName || '-'}
                        </span>
                        <span className="block text-xs font-semibold">IDR {Number(row.amount).toLocaleString('id-ID')}</span>
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.eligible ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {row.classification === 'THERAPY_ADVANCE' ? 'Uang muka/retainer' : row.branchType === 'PARTNERSHIP' ? 'Partnership' : 'Customer payment'}
                        </span>
                      </td>
                      <td className="p-3 text-xs">
                        {row.mapping ? (
                          <>
                            <span className="block font-mono">{row.mapping.zohoEntityId}</span>
                            <span className="text-emerald-600">{row.mapping.status}</span>
                          </>
                        ) : (
                          <span className={row.event?.lastError ? 'text-red-600' : 'text-neutral-500'}>
                            {row.event ? row.event.status : 'Belum diantrikan'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs">
                        {row.refunds.map((refund) => (
                          <span key={refund.id} className="mb-1 block">
                            {refund.refundNumber} · IDR {Number(refund.amount).toLocaleString('id-ID')} · {refund.mapping ? 'Zoho OK' : refund.event?.status || refund.status}
                          </span>
                        ))}
                        {!row.refunds.length && <span className="text-neutral-500">Tidak ada</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex min-w-40 flex-wrap gap-2">
                          <button
                            onClick={() => void previewPaymentRow(row)}
                            disabled={!!action}
                            className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700"
                          >
                            Preview
                          </button>
                          {row.eligible && (
                            <button
                              onClick={() => void enqueuePaymentRow(row)}
                              disabled={!!action}
                              className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {status?.dryRun ? 'Dry-run' : 'Sinkronkan'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!payments?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Belum ada pembayaran verified.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div>
              <h2 className="font-semibold">Mapping Expense</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Expense hanya dikirim setelah PAID. Akun beban dan rekening paid-through wajib dipetakan sebelum worker menulis ke Zoho.
              </p>
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold">Akun beban ERP → Zoho</p>
                <div className="max-h-72 space-y-2 overflow-auto">
                  {expenseConfig?.expenseAccounts.map((account) => (
                    <label key={account.id} className="grid gap-1 rounded-lg border p-3 text-xs dark:border-neutral-700">
                      <span className="font-semibold">{account.code} · {account.name}</span>
                      <select
                        value={account.mapping?.zohoEntityId || ''}
                        disabled={!!action}
                        onChange={(event) => void saveExpenseAccountMapping(account.code, event.target.value)}
                        className="rounded border bg-transparent px-2 py-2 dark:border-neutral-700"
                      >
                        <option value="">Belum dipetakan</option>
                        {expenseConfig.zohoAccounts.map((entry) => (
                          <option key={entry.zohoId} value={entry.zohoId}>
                            {entry.code ? `${entry.code} · ` : ''}{entry.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Kas/bank ERP → Paid-through Zoho</p>
                <div className="max-h-72 space-y-2 overflow-auto">
                  {expenseConfig?.cashBankAccounts.map((account) => (
                    <label key={account.id} className="grid gap-1 rounded-lg border p-3 text-xs dark:border-neutral-700">
                      <span className="font-semibold">{account.branch.branchCode} · {account.code} · {account.name}</span>
                      <select
                        value={account.mapping?.zohoEntityId || ''}
                        disabled={!!action}
                        onChange={(event) => void saveExpensePaidThroughMapping(account.id, event.target.value)}
                        className="rounded border bg-transparent px-2 py-2 dark:border-neutral-700"
                      >
                        <option value="">Belum dipetakan</option>
                        {expenseConfig.zohoBankAccounts.map((entry) => (
                          <option key={entry.zohoId} value={entry.zohoId}>
                            {entry.code ? `${entry.code} · ` : ''}{entry.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Kontrol Expense RAHO → Zoho</h2>
                <p className="text-sm text-neutral-500">{expenses?.pagination.total || 0} expense · receipt diunggah terpisah agar retry tidak menggandakan expense.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={expenseSearch}
                  onChange={(event) => setExpenseSearch(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void loadExpenses(); }}
                  placeholder="Cari nomor/kategori"
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                />
                <button onClick={() => void loadExpenses()} className="rounded-lg border p-2 dark:border-neutral-700">
                  <RefreshCw size={18} />
                </button>
                <button
                  onClick={() => void runExpenseReconciliation()}
                  disabled={!!action || status?.dryRun}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  title={status?.dryRun ? 'Matikan dry-run untuk rekonsiliasi live.' : undefined}
                >
                  Rekonsiliasi
                </button>
              </div>
            </div>

            {expenseReconciliation && (
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                <div className="flex flex-wrap gap-4 font-semibold">
                  <span>Diperiksa: {expenseReconciliation.checked}</span>
                  <span className="text-emerald-700">Cocok: {expenseReconciliation.matched}</span>
                  <span className="text-red-700">Beda: {expenseReconciliation.mismatched}</span>
                  <span className="text-amber-700">Hilang: {expenseReconciliation.missing}</span>
                </div>
                {expenseReconciliation.rows.filter((row) => row.result.status !== 'MATCHED').map((row) => (
                  <p key={row.expenseId} className="mt-1 text-xs"><strong>{row.expenseNumber}</strong>: {row.result.reasons.join(' ')}</p>
                ))}
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="p-3">Expense</th>
                    <th className="p-3">Akun</th>
                    <th className="p-3">Nominal</th>
                    <th className="p-3">Zoho / Receipt</th>
                    <th className="p-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses?.items.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                      <td className="p-3">
                        <span className="block font-semibold">{row.expenseNumber}</span>
                        <span className="block text-xs text-neutral-500">{row.branch.branchCode} · {new Date(row.expenseDate).toLocaleDateString('id-ID')}</span>
                        <span className="block text-xs">{row.category} · {row.status}</span>
                      </td>
                      <td className="p-3 text-xs">
                        <span className="block">{row.expenseAccount.code} · {row.expenseAccount.name}</span>
                        <span className="block text-neutral-500">{row.cashBankAccount.code} · {row.cashBankAccount.name}</span>
                      </td>
                      <td className="p-3 font-mono">IDR {Number(row.amount).toLocaleString('id-ID')}</td>
                      <td className="p-3 text-xs">
                        {row.mapping ? (
                          <>
                            <span className="block font-mono">{row.mapping.zohoEntityId}</span>
                            <span className="text-emerald-600">{row.mapping.status}</span>
                            <span className="block">Receipt: {String(row.mapping.metadata?.receiptStatus || (row.hasEvidence ? 'PENDING' : 'NOT_PROVIDED'))}</span>
                          </>
                        ) : <span className="text-amber-700">Belum tersinkron</span>}
                        {row.event && <span className={`mt-1 block w-fit rounded px-2 py-0.5 ${badge[row.event.status]}`}>{row.event.status}</span>}
                        {row.event?.lastError && <span className="mt-1 block text-red-600">{row.event.lastError}</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {row.status === 'PAID' && (
                            <>
                              <button onClick={() => void previewExpenseRow(row)} disabled={!!action} className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700">Preview</button>
                              <button onClick={() => void enqueueExpenseRow(row)} disabled={!!action} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
                                {status?.dryRun ? 'Dry-run' : 'Sinkronkan'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!expenses?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Belum ada expense.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === 'retainers' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Retainer dan pengakuan omzet terapi</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Mode {retainerConfig?.mode || retainers?.mode || 'DOCUMENT'}: uang paket tetap menjadi kewajiban sampai satu sesi Basic atau Booster selesai.
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                Satu sesi = satu sumber omzet
              </span>
            </div>

            {retainerConfig?.mode === 'JOURNAL' && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Mapping akun untuk mode Journal</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {retainerConfig.accounts.map((account) => (
                    <label key={account.code} className="grid gap-2 text-sm">
                      <span className="font-semibold">Akun ERP {account.code}</span>
                      <select
                        value={account.mapping?.zohoEntityId || ''}
                        disabled={!!action}
                        onChange={(event) => void saveRetainerAccountMapping(account.code, event.target.value)}
                        className="rounded-lg border bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
                      >
                        <option value="">Pilih akun Zoho</option>
                        {retainerConfig.zohoAccounts.map((entry) => (
                          <option key={entry.zohoId} value={entry.zohoId}>
                            {entry.code ? `${entry.code} · ` : ''}{entry.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Kontrak deferred revenue</h2>
                <p className="text-sm text-neutral-500">{retainers?.pagination.total || 0} paket berkontrak.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={retainerSearch}
                  onChange={(event) => setRetainerSearch(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void loadRetainers(); }}
                  placeholder="Cari paket atau member"
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                />
                <button onClick={() => void loadRetainers()} className="rounded-lg border p-2 dark:border-neutral-700">
                  <RefreshCw size={18} />
                </button>
                <button
                  onClick={() => void runRetainerReconciliation()}
                  disabled={!!action || status?.dryRun}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  title={status?.dryRun ? 'Matikan dry-run untuk rekonsiliasi live.' : undefined}
                >
                  Rekonsiliasi Retainer
                </button>
              </div>
            </div>

            {retainerReconciliation && (
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                <div className="flex flex-wrap gap-4 font-semibold">
                  <span>Diperiksa: {retainerReconciliation.checked}</span>
                  <span className="text-emerald-700">Cocok: {retainerReconciliation.matched}</span>
                  <span className="text-red-700">Beda: {retainerReconciliation.mismatched}</span>
                  <span className="text-amber-700">Hilang: {retainerReconciliation.missing}</span>
                </div>
                <div className="mt-2 space-y-1 text-xs">
                  {retainerReconciliation.rows.filter((row) => row.status !== 'MATCHED').map((row) => (
                    <p key={row.contractId}><strong>{row.packageCode}</strong>: {row.reasons.join(' ')}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="p-3">Paket</th>
                    <th className="p-3">Deferred ERP</th>
                    <th className="p-3">Retainer Zoho</th>
                    <th className="p-3">Recognition terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {retainers?.items.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                      <td className="p-3">
                        <span className="block font-semibold">{row.packageCode}</span>
                        <span className="block text-xs text-neutral-500">
                          {row.packageType} · {row.productCode || '-'} · {row.branchCode}
                        </span>
                        <span className="block text-xs">{row.memberNo} · {row.memberName}</span>
                      </td>
                      <td className="p-3 text-xs">
                        <span className="block">Nilai: IDR {Number(row.totalConsideration).toLocaleString('id-ID')}</span>
                        <span className="block">Terbayar: IDR {Number(row.fundedDeferredAmount).toLocaleString('id-ID')}</span>
                        <span className="block text-emerald-700">Jadi omzet: IDR {Number(row.recognizedAmount).toLocaleString('id-ID')}</span>
                        <span className="block font-semibold">Sisa: IDR {Number(row.remainingDeferredAmount).toLocaleString('id-ID')}</span>
                      </td>
                      <td className="p-3 text-xs">
                        {row.retainerMapping ? (
                          <>
                            <span className="block font-mono">{row.retainerMapping.zohoEntityId}</span>
                            <span className="text-emerald-600">{row.retainerMapping.status}</span>
                          </>
                        ) : <span className="text-amber-700">Belum tersinkron</span>}
                      </td>
                      <td className="p-3 text-xs">
                        {row.recognitions.map((recognition) => (
                          <span key={recognition.id} className="mb-1 block">
                            {recognition.sessionCode} · IDR {Number(recognition.amount).toLocaleString('id-ID')}
                            {' · '}{recognition.zohoMapping ? 'Zoho OK' : recognition.status}
                          </span>
                        ))}
                        {!row.recognitions.length && <span className="text-neutral-500">Belum ada terapi selesai</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!retainers?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Belum ada kontrak deferred revenue.</p>}
            </div>
          </section>
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setSelectedEvent(null)}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-between gap-3">
              <div><h3 className="text-lg font-bold">{selectedEvent.eventType}</h3><p className="text-xs text-neutral-500">{selectedEvent.id}</p></div>
              <span className={`h-fit rounded-full px-2 py-1 text-xs font-semibold ${badge[selectedEvent.status]}`}>{selectedEvent.status}</span>
            </div>
            {selectedEvent.lastError && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{selectedEvent.lastError}</div>}
            <p className="mt-4 text-sm font-semibold">Payload ERP</p>
            <pre className="mt-2 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-800">{JSON.stringify(selectedEvent.payload, null, 2)}</pre>
            <p className="mt-4 text-sm font-semibold">Riwayat percobaan</p>
            <div className="mt-2 space-y-2">
              {selectedEvent.syncAttempts.map((attempt) => (
                <div key={attempt.id} className="rounded-lg border p-3 text-xs dark:border-neutral-700">
                  #{attempt.attemptNo} · {attempt.status} · {when(attempt.startedAt)}
                  {attempt.errorMessage && <p className="mt-1 text-red-600">{attempt.errorCode}: {attempt.errorMessage}</p>}
                </div>
              ))}
              {!selectedEvent.syncAttempts.length && <p className="text-xs text-neutral-500">Belum pernah diproses worker.</p>}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {['FAILED', 'DEAD_LETTER', 'DRY_RUN', 'IGNORED'].includes(selectedEvent.status) && (
                <button onClick={() => void retryEvent(selectedEvent)} disabled={!!action} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  <RotateCcw size={16} /> Ulang
                </button>
              )}
              {!['PROCESSED', 'PROCESSING', 'IGNORED'].includes(selectedEvent.status) && (
                <button onClick={() => void ignoreEvent(selectedEvent)} disabled={!!action} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
                  <Ban size={16} /> Abaikan
                </button>
              )}
              <button onClick={() => setSelectedEvent(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold dark:border-neutral-700">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {contactPreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setContactPreview(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold">Preview contact: {contactPreview.snapshot.displayName}</h3>
            <p className="mt-1 font-mono text-xs text-neutral-500">{contactPreview.snapshot.externalKey}</p>
            {!contactPreview.liveCreateReady && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Live create diblok sampai ZOHO_CONTACT_RAHO_ID_CUSTOM_FIELD_ID diisi.
              </div>
            )}
            <p className="mt-4 text-sm font-semibold">Payload yang boleh dikirim</p>
            <pre className="mt-2 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-800">{JSON.stringify(contactPreview.payload, null, 2)}</pre>
            <p className="mt-4 text-sm font-semibold">Field yang sengaja dilarang</p>
            <p className="mt-1 text-xs text-red-600">{contactPreview.excludedFields.join(', ')}</p>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setContactPreview(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold dark:border-neutral-700">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {masterPreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setMasterPreview(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold">Preview master: {masterPreview.snapshot.name}</h3>
            <p className="mt-1 font-mono text-xs text-neutral-500">{masterPreview.snapshot.externalKey}</p>
            {!!masterPreview.issues.length && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Belum siap live:</p>
                <ul className="mt-1 list-disc pl-5">
                  {masterPreview.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </div>
            )}
            {!masterPreview.liveReady && !masterPreview.issues.length && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Capability Location belum diverifikasi melalui discovery.
              </div>
            )}
            <p className="mt-4 text-sm font-semibold">Payload yang boleh dikirim</p>
            <pre className="mt-2 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-800">{JSON.stringify(masterPreview.payload, null, 2)}</pre>
            {!!masterPreview.excludedFields.length && (
              <>
                <p className="mt-4 text-sm font-semibold">Field yang sengaja tidak dikirim</p>
                <p className="mt-1 text-xs text-red-600">{masterPreview.excludedFields.join(', ')}</p>
              </>
            )}
            <div className="mt-5 flex justify-end">
              <button onClick={() => setMasterPreview(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold dark:border-neutral-700">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {invoicePreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setInvoicePreview(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold">Preview invoice: {invoicePreview.snapshot.invoiceNumber}</h3>
            <p className="mt-1 font-mono text-xs text-neutral-500">{invoicePreview.snapshot.externalKey}</p>
            {!invoicePreview.snapshot.eligible && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Tidak dibuat sebagai Sales Invoice biasa</p>
                <p className="mt-1">{invoicePreview.snapshot.excludedReason}</p>
              </div>
            )}
            {!!invoicePreview.issues.length && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Belum siap live:</p>
                <ul className="mt-1 list-disc pl-5">
                  {invoicePreview.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-4 text-sm font-semibold">Payload yang boleh dikirim</p>
            <pre className="mt-2 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
              {invoicePreview.payload ? JSON.stringify(invoicePreview.payload, null, 2) : 'Tidak ada payload Sales Invoice.'}
            </pre>
            <p className="mt-4 text-sm font-semibold">Field yang sengaja tidak dikirim</p>
            <p className="mt-1 text-xs text-red-600">{invoicePreview.excludedFields.join(', ')}</p>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setInvoicePreview(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold dark:border-neutral-700">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {paymentPreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setPaymentPreview(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold">Preview pembayaran: {paymentPreview.snapshot.invoiceNumber}</h3>
            <p className="mt-1 font-mono text-xs text-neutral-500">{paymentPreview.snapshot.externalKey}</p>
            {!paymentPreview.snapshot.eligible && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Tidak dibuat sebagai Customer Payment biasa</p>
                <p className="mt-1">{paymentPreview.snapshot.excludedReason}</p>
              </div>
            )}
            {!!paymentPreview.issues.length && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Belum siap live:</p>
                <ul className="mt-1 list-disc pl-5">
                  {paymentPreview.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-4 text-sm font-semibold">Payload Customer Payment</p>
            <pre className="mt-2 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
              {paymentPreview.payload ? JSON.stringify(paymentPreview.payload, null, 2) : 'Tidak ada payload Customer Payment.'}
            </pre>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setPaymentPreview(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold dark:border-neutral-700">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {expensePreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setExpensePreview(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold">Preview expense: {expensePreview.snapshot.expenseNumber}</h3>
            <p className="mt-1 font-mono text-xs text-neutral-500">{expensePreview.snapshot.externalKey}</p>
            {!!expensePreview.issues.length && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Belum siap live:</p>
                <ul className="mt-1 list-disc pl-5">
                  {expensePreview.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-4 text-sm font-semibold">Payload Expense Zoho</p>
            <pre className="mt-2 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
              {expensePreview.payload ? JSON.stringify(expensePreview.payload, null, 2) : 'Payload diblok sampai mapping lengkap.'}
            </pre>
            <p className="mt-4 text-sm font-semibold">Receipt</p>
            <p className="mt-1 text-xs text-neutral-600">File dikirim sebagai multipart terpisah; URL internal tidak pernah masuk description/payload.</p>
            <p className="mt-4 text-sm font-semibold">Kebijakan reversal</p>
            <p className="mt-1 text-xs text-neutral-600">{expensePreview.reversalPolicy}</p>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setExpensePreview(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold dark:border-neutral-700">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
