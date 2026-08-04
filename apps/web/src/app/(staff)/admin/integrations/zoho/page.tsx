'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  FileInput,
  FileText,
  List,
  Landmark,
  Loader2,
  MapPinned,
  PlugZap,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Unplug,
  Users,
  Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ZohoExistingDataGuide } from '@/components/zoho/ZohoExistingDataGuide';

type Tab = 'connection' | 'queue' | 'discovery' | 'contacts' | 'masters' | 'invoices' | 'payments' | 'retainers' | 'partnership' | 'purchaseOrders' | 'bills' | 'vendorPayments' | 'inventoryAdjustments' | 'operations' | 'expenses';
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
  authorizationReady: boolean;
  organizationCurrencyCode: string | null;
  discoveryLastRunAt: string | null;
  contactSyncReady: boolean;
  itemSyncReady: boolean;
  itemAccountSyncReady: boolean;
  uomSyncReady: boolean;
  locationSyncReady: boolean;
  invoiceSyncReady: boolean;
  paymentSyncReady: boolean;
  expenseSyncReady: boolean;
  purchaseOrderSyncReady: boolean;
  billSyncReady: boolean;
  vendorPaymentSyncReady: boolean;
  locationsSupported: boolean | null;
  locationsCapabilityError: string | null;
  inventoryAdjustmentsSupported: boolean | null;
  inventoryAdjustmentsCapabilityError: string | null;
  inventoryAdjustmentsLastCheckedAt: string | null;
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
type SetupData = {
  contactExternalIdField: {
    fieldId: string;
    apiName: string;
    isUnique: true;
  };
  itemAccountMappings: Array<{
    role: 'ITEM_SALES' | 'ITEM_PURCHASE' | 'ITEM_INVENTORY';
    zohoAccountId: string | null;
    status: 'PRESERVED' | 'MAPPED' | 'REVIEW_REQUIRED';
  }>;
  uomMappings: Array<{
    uomId: string;
    zohoUnit: string;
    status: 'PRESERVED' | 'MAPPED';
  }>;
  discovery: DiscoveryData;
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
  entityType: 'MEMBER' | 'SUPPLIER' | 'PARTNERSHIP_BRANCH';
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

type PartnershipSaleRow = {
  id: string;
  shipmentCode: string;
  status: string;
  shippedAt: string | null;
  fromBranch: { id: string; branchCode: string; name: string };
  partnershipBranch: { id: string; branchCode: string; name: string; type: string };
  stockRequest: { id: string; requestCode: string };
  invoice: { id: string; invoiceNumber: string; status: string } | null;
  amounts: { revenue?: string; fifoCost?: string; grossProfit?: string } | null;
  customerMapping: { zohoEntityId: string; status: string } | null;
  invoiceMapping: { zohoEntityId: string; status: string } | null;
  paymentMapping: { zohoEntityId: string; status: string } | null;
  event: { id: string; status: EventStatus; lastError: string | null } | null;
};
type PartnershipSaleData = {
  items: PartnershipSaleRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type PartnershipSalePreview = {
  snapshot: {
    shipmentCode: string;
    invoiceNumber: string;
    revenueAmount: string;
    costAmount: string;
    grossProfit: string;
  };
  payload: unknown;
  issues: string[];
  liveReady: boolean;
  accounting: { revenue: string; fifoCost: string; grossProfit: string; policy: string };
  excludedFields: string[];
};
type PartnershipReconciliation = {
  checked: number;
  matched: number;
  mismatched: number;
  missing: number;
  rows: Array<{
    shipmentId: string;
    shipmentCode: string;
    result: { status: 'MATCHED' | 'MISMATCH' | 'MISSING'; differences: string[] };
  }>;
};

type PurchaseOrderRow = {
  id: string;
  poNumber: string;
  orderDate: string;
  expectedDate: string | null;
  status: string;
  currency: string;
  totalAmount: string;
  supplier: { id: string; code: string; name: string };
  branch: { id: string; code: string; name: string; type: string };
  lineCount: number;
  mapping: { zohoEntityId: string; status: string; lastSyncedAt: string | null } | null;
  events: Array<{ id: string; eventType: string; status: EventStatus; lastError: string | null }>;
};
type PurchaseOrderData = {
  items: PurchaseOrderRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type PurchaseOrderPreview = {
  snapshot: {
    poNumber: string;
    externalKey: string;
    eligible: boolean;
    excludedReason: string | null;
    totalAmount: string;
    lines: unknown[];
  };
  payload: unknown;
  issues: string[];
  liveReady: boolean;
  stockPolicy: string;
  excludedFields: string[];
};
type PurchaseOrderReconciliation = {
  checked: number;
  matched: number;
  mismatched: number;
  missing: number;
  rows: Array<{
    purchaseOrderId: string;
    poNumber: string;
    result: { status: 'MATCHED' | 'MISMATCH' | 'MISSING'; differences: string[] };
  }>;
};

type BillRow = {
  id: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  paidAmount: string;
  balanceAmount: string;
  status: string;
  lineCount: number;
  supplier: { id: string; code: string; name: string };
  branch: { id: string; code: string; name: string; type: string };
  purchaseOrder: { id: string; poNumber: string };
  mapping: { zohoEntityId: string; status: string; lastSyncedAt: string | null } | null;
  event: { id: string; status: EventStatus; lastError: string | null } | null;
};
type BillData = {
  items: BillRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type BillPreview = {
  snapshot: {
    invoiceNumber: string;
    supplierInvoiceNumber: string;
    externalKey: string;
    poNumber: string;
    eligible: boolean;
    excludedReason: string | null;
    amount: string;
    lines: unknown[];
  };
  payload: unknown;
  issues: string[];
  liveReady: boolean;
  inventoryPolicy: string;
  excludedFields: string[];
};
type BillReconciliation = {
  checked: number;
  matched: number;
  mismatched: number;
  missing: number;
  rows: Array<{
    supplierInvoiceId: string;
    invoiceNumber: string;
    result: { status: 'MATCHED' | 'MISMATCH' | 'MISSING'; differences: string[] };
  }>;
};
type GrniData = {
  summary: {
    waiting: number;
    overdue: number;
    clear: number;
    unbilledValue: string;
    slaDays: number;
  };
  items: Array<{
    purchaseOrderId: string;
    poNumber: string;
    supplier: { code: string; name: string };
    branch: { code: string; name: string };
    oldestReceiptAt: string;
    ageDays: number;
    status: 'WAITING' | 'OVERDUE' | 'CLEAR';
    receivedValue: string;
    billedValue: string;
    unbilledValue: string;
    receiptCount: number;
    billCount: number;
    hasLegacyAmountOnlyBill: boolean;
    lines: Array<{
      purchaseOrderItemId: string;
      sku: string | null;
      name: string;
      receivedQty: string;
      billedQty: string;
      unbilledQty: string;
    }>;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type VendorPaymentRow = {
  id: string;
  paymentNumber: string;
  paymentReference: string;
  paymentDate: string;
  amount: string;
  paymentMethod: 'CASH' | 'TRANSFER';
  cashBankAccount: { id: string; code: string; name: string };
  supplierInvoice: {
    id: string;
    invoiceNumber: string;
    supplierInvoiceNumber: string;
    balanceAmount: string;
  };
  supplier: { id: string; code: string; name: string };
  branch: { id: string; code: string; name: string; type: string };
  eligible: boolean;
  mapping: { zohoEntityId: string; status: string; lastSyncedAt: string | null } | null;
  event: { id: string; status: EventStatus; lastError: string | null } | null;
};
type VendorPaymentData = {
  items: VendorPaymentRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type VendorPaymentPreview = {
  snapshot: {
    paymentNumber: string;
    invoiceNumber: string;
    externalKey: string;
    eligible: boolean;
    excludedReason: string | null;
    amount: string;
  };
  dependencies: Record<string, string | undefined>;
  payload: unknown;
  issues: string[];
  liveReady: boolean;
  invariant: string;
};
type VendorPaymentReconciliation = {
  checked: number;
  matched: number;
  missing: number;
  mismatched: number;
  rows: Array<{
    supplierPaymentId: string;
    paymentNumber: string;
    result: {
      status: 'MATCHED' | 'MISSING_IN_ZOHO' | 'AMOUNT_MISMATCH';
      differences: string[];
    };
  }>;
};
type InventoryAdjustmentData = {
  items: SyncEvent[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type InventoryAdjustmentCapability = {
  supported: boolean | null;
  error: string | null;
  checkedAt: string | null;
  fallback: 'CONTROLLED_EXPORT_OR_ENABLE_ZOHO_INVENTORY' | null;
};
type InventoryAdjustmentReconciliation = {
  checked: number;
  results: Array<{
    localEntityId: string;
    referenceMatched: boolean;
    quantityMatched: boolean;
    valueMatched: boolean;
  }>;
};
type WebhookInboxData = {
  items: Array<{
    id: string;
    eventType: string;
    zohoEntityType: string | null;
    zohoEntityId: string | null;
    externalReference: string | null;
    status: string;
    correlationStatus: string;
    receivedAt: string;
    errorMessage: string | null;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type ReconciliationResultRow = {
  id: string;
  entityType: string;
  externalReference: string | null;
  status: string;
  severity: string;
  differences: string[];
  actionRequired: string | null;
  resolvedAt: string | null;
};
type ReconciliationRunsData = {
  items: Array<{
    id: string;
    runType: string;
    status: string;
    triggerSource: string;
    totalChecked: number;
    matchedCount: number;
    exceptionCount: number;
    errorCount: number;
    lastError: string | null;
    createdAt: string;
    finishedAt: string | null;
    results: ReconciliationResultRow[];
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type GoLiveData = {
  connected: boolean;
  organizationId?: string;
  organizationName?: string;
  localErpIndependent: boolean;
  runtime: {
    mode: 'OFF' | 'DRY_RUN' | 'CANARY' | 'LIVE';
    source: 'CONTROL' | 'LEGACY_ENV' | 'DISCONNECTED' | 'CONFIGURATION_INVALID';
    canaryBranchIds: string[];
    masterFrozen: boolean;
  };
  control: null | {
    id: string;
    mode: 'OFF' | 'DRY_RUN' | 'CANARY' | 'LIVE';
    masterFrozen: boolean;
    canaryBranchIds: string[];
    mismatchFreeBusinessDays: number;
    financeApprovedAt: string | null;
    logisticsApprovedAt: string | null;
    lastRollbackAt: string | null;
    rollbackReason: string | null;
  };
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
  const [contactEntityType, setContactEntityType] = useState<'MEMBER' | 'SUPPLIER' | 'PARTNERSHIP_BRANCH'>('MEMBER');
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
  const [partnershipSales, setPartnershipSales] = useState<PartnershipSaleData | null>(null);
  const [partnershipSearch, setPartnershipSearch] = useState('');
  const [partnershipPreview, setPartnershipPreview] = useState<PartnershipSalePreview | null>(null);
  const [partnershipReconciliation, setPartnershipReconciliation] = useState<PartnershipReconciliation | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderData | null>(null);
  const [purchaseOrderSearch, setPurchaseOrderSearch] = useState('');
  const [purchaseOrderPreview, setPurchaseOrderPreview] = useState<PurchaseOrderPreview | null>(null);
  const [purchaseOrderReconciliation, setPurchaseOrderReconciliation] = useState<PurchaseOrderReconciliation | null>(null);
  const [bills, setBills] = useState<BillData | null>(null);
  const [grni, setGrni] = useState<GrniData | null>(null);
  const [billSearch, setBillSearch] = useState('');
  const [billPreview, setBillPreview] = useState<BillPreview | null>(null);
  const [billReconciliation, setBillReconciliation] = useState<BillReconciliation | null>(null);
  const [vendorPayments, setVendorPayments] = useState<VendorPaymentData | null>(null);
  const [vendorPaymentConfig, setVendorPaymentConfig] = useState<PaymentConfig | null>(null);
  const [vendorPaymentSearch, setVendorPaymentSearch] = useState('');
  const [vendorPaymentPreview, setVendorPaymentPreview] = useState<VendorPaymentPreview | null>(null);
  const [vendorPaymentReconciliation, setVendorPaymentReconciliation] = useState<VendorPaymentReconciliation | null>(null);
  const [inventoryAdjustments, setInventoryAdjustments] = useState<InventoryAdjustmentData | null>(null);
  const [inventoryAdjustmentCapability, setInventoryAdjustmentCapability] = useState<InventoryAdjustmentCapability | null>(null);
  const [inventoryAdjustmentReconciliation, setInventoryAdjustmentReconciliation] = useState<InventoryAdjustmentReconciliation | null>(null);
  const [webhookInbox, setWebhookInbox] = useState<WebhookInboxData | null>(null);
  const [reconciliationRuns, setReconciliationRuns] = useState<ReconciliationRunsData | null>(null);
  const [goLive, setGoLive] = useState<GoLiveData | null>(null);
  const [canaryBranchIds, setCanaryBranchIds] = useState('');
  const [statusFilter, setStatusFilter] = useState<EventStatus | ''>('');
  const [selectedEvent, setSelectedEvent] = useState<SyncEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const oauthCallbackHandled = useRef(false);

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

  const loadPartnershipSales = useCallback(async () => {
    const response = await api.get<{ data: PartnershipSaleData }>('/integrations/zoho/partnership-sales', {
      params: {
        limit: 50,
        ...(partnershipSearch.trim() ? { search: partnershipSearch.trim() } : {}),
      },
    });
    setPartnershipSales(response.data.data);
  }, [partnershipSearch]);

  const loadPurchaseOrders = useCallback(async () => {
    const response = await api.get<{ data: PurchaseOrderData }>('/integrations/zoho/purchase-orders', {
      params: {
        limit: 50,
        ...(purchaseOrderSearch.trim() ? { search: purchaseOrderSearch.trim() } : {}),
      },
    });
    setPurchaseOrders(response.data.data);
  }, [purchaseOrderSearch]);

  const loadBills = useCallback(async () => {
    const [billResponse, grniResponse] = await Promise.all([
      api.get<{ data: BillData }>('/integrations/zoho/bills', {
        params: {
          limit: 50,
          ...(billSearch.trim() ? { search: billSearch.trim() } : {}),
        },
      }),
      api.get<{ data: GrniData }>('/integrations/zoho/grni', {
        params: {
          limit: 50,
          ...(billSearch.trim() ? { search: billSearch.trim() } : {}),
        },
      }),
    ]);
    setBills(billResponse.data.data);
    setGrni(grniResponse.data.data);
  }, [billSearch]);

  const loadVendorPayments = useCallback(async () => {
    const [rows, config] = await Promise.all([
      api.get<{ data: VendorPaymentData }>('/integrations/zoho/vendor-payments', {
        params: {
          limit: 50,
          ...(vendorPaymentSearch.trim() ? { search: vendorPaymentSearch.trim() } : {}),
        },
      }),
      api.get<{ data: PaymentConfig }>('/integrations/zoho/vendor-payments/config'),
    ]);
    setVendorPayments(rows.data.data);
    setVendorPaymentConfig(config.data.data);
  }, [vendorPaymentSearch]);

  const loadInventoryAdjustments = useCallback(async () => {
    const [events, capability] = await Promise.all([
      api.get<{ data: InventoryAdjustmentData }>('/integrations/zoho/inventory-adjustments', {
        params: { limit: 50 },
      }),
      api.get<{ data: InventoryAdjustmentCapability }>('/integrations/zoho/inventory-adjustments/capability'),
    ]);
    setInventoryAdjustments(events.data.data);
    setInventoryAdjustmentCapability(capability.data.data);
  }, []);

  const loadOperations = useCallback(async () => {
    const [webhooks, runs, control] = await Promise.all([
      api.get<{ data: WebhookInboxData }>('/integrations/zoho/webhooks', { params: { limit: 30 } }),
      api.get<{ data: ReconciliationRunsData }>('/integrations/zoho/reconciliation/runs', { params: { limit: 10 } }),
      api.get<{ data: GoLiveData }>('/integrations/zoho/go-live'),
    ]);
    setWebhookInbox(webhooks.data.data);
    setReconciliationRuns(runs.data.data);
    setGoLive(control.data.data);
    const ids = control.data.data.control?.canaryBranchIds;
    setCanaryBranchIds(Array.isArray(ids) ? ids.join(', ') : '');
  }, []);

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
    if (tab === 'partnership') void loadPartnershipSales().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat penjualan Partnership.')));
    if (tab === 'purchaseOrders') void loadPurchaseOrders().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat Purchase Order.')));
    if (tab === 'bills') void loadBills().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat Bill dan GRNI.')));
    if (tab === 'vendorPayments') void loadVendorPayments().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat Vendor Payment.')));
    if (tab === 'inventoryAdjustments') void loadInventoryAdjustments().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat adjustment inventory.')));
    if (tab === 'operations') void loadOperations().catch((error) => toast.error(apiErrorMessage(error, 'Gagal memuat kontrol go-live.')));
  }, [loadBills, loadContacts, loadDiscovery, loadExpenses, loadInventoryAdjustments, loadInvoices, loadMasters, loadOperations, loadPartnershipSales, loadPayments, loadPurchaseOrders, loadQueue, loadRetainers, loadVendorPayments, tab]);

  useEffect(() => {
    const result = searchParams.get('zoho');
    if (!result || oauthCallbackHandled.current) return;
    oauthCallbackHandled.current = true;
    const finishOAuth = async () => {
      if (result === 'success') {
        toast.success('Zoho Books berhasil dihubungkan. Menyiapkan integrasi...');
        try {
          const response = await api.post<{ data: SetupData }>('/integrations/zoho/setup');
          setDiscovery(response.data.data.discovery);
          toast.success('Prasyarat Contact dan Item Zoho berhasil disiapkan.');
        } catch (error) {
          toast.error(apiErrorMessage(error, 'Zoho terhubung, tetapi konfigurasi otomatis belum selesai. Klik “Siapkan otomatis”.'));
        }
      } else {
        toast.error(searchParams.get('message') || 'Koneksi Zoho gagal.');
      }
      await loadStatus().catch(() => undefined);
      router.replace('/admin/integrations/zoho');
    };
    void finishOAuth();
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
      await loadStatus().catch(() => undefined);
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

  async function setupZoho() {
    setAction('setup');
    try {
      const response = await api.post<{ data: SetupData }>('/integrations/zoho/setup');
      setDiscovery(response.data.data.discovery);
      await loadStatus();
      toast.success('Custom field Contact dan account Item berhasil disiapkan.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Prasyarat Zoho tidak dapat disiapkan otomatis.'));
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

  async function previewPartnershipSale(row: PartnershipSaleRow) {
    setAction(`partnership-preview-${row.id}`);
    try {
      const response = await api.get<{ data: PartnershipSalePreview }>(
        `/integrations/zoho/partnership-sales/${row.id}/preview`,
      );
      setPartnershipPreview(response.data.data);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Preview shipment Partnership gagal.'));
    } finally { setAction(null); }
  }

  async function enqueuePartnershipSale(row: PartnershipSaleRow) {
    setAction(`partnership-sync-${row.id}`);
    try {
      await api.post(`/integrations/zoho/partnership-sales/${row.id}/enqueue`);
      toast.success(status?.dryRun
        ? 'Shipment Partnership masuk antrean dry-run.'
        : 'Shipment Partnership masuk antrean Zoho.');
      await loadPartnershipSales();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Shipment Partnership gagal dimasukkan ke antrean.'));
    } finally { setAction(null); }
  }

  async function enqueuePartnershipCustomer(row: PartnershipSaleRow) {
    setAction(`partnership-customer-${row.partnershipBranch.id}`);
    try {
      await api.post(
        `/integrations/zoho/partnership-sales/customers/${row.partnershipBranch.id}/enqueue`,
      );
      toast.success('Customer Partnership masuk antrean mapping Zoho.');
      await loadPartnershipSales();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Customer Partnership gagal dimasukkan ke antrean.'));
    } finally { setAction(null); }
  }

  async function runPartnershipReconciliation() {
    setAction('partnership-reconcile');
    try {
      const response = await api.post<{ data: PartnershipReconciliation }>(
        '/integrations/zoho/partnership-sales/reconcile/run',
      );
      setPartnershipReconciliation(response.data.data);
      toast.success('Rekonsiliasi penjualan Partnership selesai.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Rekonsiliasi Partnership gagal.'));
    } finally { setAction(null); }
  }

  async function previewPurchaseOrder(row: PurchaseOrderRow) {
    setAction(`po-preview-${row.id}`);
    try {
      const response = await api.get<{ data: PurchaseOrderPreview }>(
        `/integrations/zoho/purchase-orders/${row.id}/preview`,
      );
      setPurchaseOrderPreview(response.data.data);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Preview Purchase Order gagal.'));
    } finally { setAction(null); }
  }

  async function enqueuePurchaseOrder(row: PurchaseOrderRow) {
    setAction(`po-sync-${row.id}`);
    try {
      await api.post(`/integrations/zoho/purchase-orders/${row.id}/enqueue`);
      toast.success(row.status === 'CANCELLED'
        ? 'Pembatalan Purchase Order masuk antrean Zoho.'
        : status?.dryRun
          ? 'Purchase Order masuk antrean dry-run.'
          : 'Purchase Order masuk antrean Zoho.');
      await loadPurchaseOrders();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Purchase Order gagal dimasukkan ke antrean.'));
    } finally { setAction(null); }
  }

  async function enqueuePurchaseOrderDependencies(row: PurchaseOrderRow) {
    setAction(`po-dependencies-${row.id}`);
    try {
      await api.post(`/integrations/zoho/purchase-orders/${row.id}/dependencies/enqueue`);
      toast.success('Vendor, Item, dan Location masuk antrean mapping.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Dependency Purchase Order gagal dimasukkan ke antrean.'));
    } finally { setAction(null); }
  }

  async function runPurchaseOrderReconciliation() {
    setAction('po-reconcile');
    try {
      const response = await api.post<{ data: PurchaseOrderReconciliation }>(
        '/integrations/zoho/purchase-orders/reconcile/run',
      );
      setPurchaseOrderReconciliation(response.data.data);
      toast.success('Rekonsiliasi Purchase Order selesai.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Rekonsiliasi Purchase Order gagal.'));
    } finally { setAction(null); }
  }

  async function previewBill(row: BillRow) {
    setAction(`bill-preview-${row.id}`);
    try {
      const response = await api.get<{ data: BillPreview }>(
        `/integrations/zoho/bills/${row.id}/preview`,
      );
      setBillPreview(response.data.data);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Preview Zoho Bill gagal.'));
    } finally { setAction(null); }
  }

  async function enqueueBill(row: BillRow) {
    setAction(`bill-sync-${row.id}`);
    try {
      await api.post(`/integrations/zoho/bills/${row.id}/enqueue`);
      toast.success(status?.dryRun ? 'Bill masuk antrean dry-run.' : 'Bill masuk antrean Zoho.');
      await loadBills();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Bill gagal dimasukkan ke antrean.'));
    } finally { setAction(null); }
  }

  async function enqueueBillDependencies(row: BillRow) {
    setAction(`bill-dependencies-${row.id}`);
    try {
      await api.post(`/integrations/zoho/bills/${row.id}/dependencies/enqueue`);
      toast.success('Vendor, PO, Item, dan Location masuk antrean mapping.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Dependency Bill gagal dimasukkan ke antrean.'));
    } finally { setAction(null); }
  }

  async function runBillReconciliation() {
    setAction('bill-reconcile');
    try {
      const response = await api.post<{ data: BillReconciliation }>(
        '/integrations/zoho/bills/reconcile/run',
      );
      setBillReconciliation(response.data.data);
      toast.success('Rekonsiliasi Bill dan AP selesai.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Rekonsiliasi Bill gagal.'));
    } finally { setAction(null); }
  }

  async function previewVendorPayment(row: VendorPaymentRow) {
    setAction(`vendor-payment-preview-${row.id}`);
    try {
      const response = await api.get<{ data: VendorPaymentPreview }>(
        `/integrations/zoho/vendor-payments/${row.id}/preview`,
      );
      setVendorPaymentPreview(response.data.data);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Preview Vendor Payment gagal.'));
    } finally { setAction(null); }
  }

  async function enqueueVendorPayment(row: VendorPaymentRow) {
    setAction(`vendor-payment-sync-${row.id}`);
    try {
      await api.post(`/integrations/zoho/vendor-payments/${row.id}/enqueue`);
      toast.success(status?.dryRun
        ? 'Vendor Payment masuk antrean dry-run.'
        : 'Vendor Payment masuk antrean Zoho.');
      await loadVendorPayments();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Vendor Payment gagal dimasukkan ke antrean.'));
    } finally { setAction(null); }
  }

  async function runVendorPaymentReconciliation() {
    setAction('vendor-payment-reconcile');
    try {
      const response = await api.post<{ data: VendorPaymentReconciliation }>(
        '/integrations/zoho/vendor-payments/reconcile/run',
      );
      setVendorPaymentReconciliation(response.data.data);
      toast.success('Rekonsiliasi Vendor Payment dan AP selesai.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Rekonsiliasi Vendor Payment gagal.'));
    } finally { setAction(null); }
  }

  async function probeInventoryCapability() {
    setAction('inventory-capability');
    try {
      const response = await api.post<{ data: InventoryAdjustmentCapability }>(
        '/integrations/zoho/inventory-adjustments/capability/probe',
      );
      setInventoryAdjustmentCapability(response.data.data);
      toast.success(response.data.data.supported
        ? 'API adjustment Zoho Inventory tersedia.'
        : 'API adjustment belum tersedia; gunakan ekspor terkontrol.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Capability probe gagal.'));
    } finally { setAction(null); }
  }

  async function runInventoryAdjustmentReconciliation() {
    setAction('inventory-reconcile');
    try {
      const response = await api.post<{ data: InventoryAdjustmentReconciliation }>(
        '/integrations/zoho/inventory-adjustments/reconcile/run',
      );
      setInventoryAdjustmentReconciliation(response.data.data);
      toast.success('Rekonsiliasi quantity dan value selesai.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Rekonsiliasi adjustment gagal.'));
    } finally { setAction(null); }
  }

  async function downloadInventoryAdjustmentExport() {
    setAction('inventory-export');
    try {
      const response = await api.get('/integrations/zoho/inventory-adjustments/export', {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data as Blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'zoho-inventory-adjustments.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Ekspor adjustment gagal.'));
    } finally { setAction(null); }
  }

  async function runFullReconciliation() {
    setAction('full-reconciliation');
    try {
      await api.post('/integrations/zoho/reconciliation/run');
      toast.success('Reconciliation penuh selesai atau dijadwalkan untuk dilanjutkan.');
      await loadOperations();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Reconciliation penuh gagal.'));
    } finally { setAction(null); }
  }

  async function retryWebhookCorrelation(id: string) {
    setAction(`webhook-${id}`);
    try {
      await api.post(`/integrations/zoho/webhooks/${id}/correlate`);
      await loadOperations();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Korelasi webhook gagal.'));
    } finally { setAction(null); }
  }

  async function resolveReconciliationResult(id: string) {
    const note = window.prompt('Catatan penyelesaian exception:');
    if (!note?.trim()) return;
    setAction(`resolve-${id}`);
    try {
      await api.post(`/integrations/zoho/reconciliation/results/${id}/resolve`, { note });
      toast.success('Exception ditandai selesai.');
      await loadOperations();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Exception gagal diselesaikan.'));
    } finally { setAction(null); }
  }

  async function saveGoLiveConfig() {
    setAction('go-live-config');
    try {
      const ids = canaryBranchIds.split(',').map((entry) => entry.trim()).filter(Boolean);
      await api.put('/integrations/zoho/go-live', {
        masterFrozen: goLive?.runtime.masterFrozen || false,
        canaryBranchIds: ids,
      });
      toast.success('Konfigurasi cutover disimpan dalam mode aman.');
      await loadOperations();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Konfigurasi cutover gagal.'));
    } finally { setAction(null); }
  }

  async function changeGoLiveMode(mode: 'OFF' | 'DRY_RUN' | 'CANARY' | 'LIVE') {
    setAction(`go-live-${mode}`);
    try {
      await api.post('/integrations/zoho/go-live/mode', { mode });
      toast.success(`Mode Zoho berubah menjadi ${mode}.`);
      await loadOperations();
    } catch (error) {
      toast.error(apiErrorMessage(error, `Mode ${mode} belum dapat diaktifkan.`));
    } finally { setAction(null); }
  }

  async function approveGoLive(area: 'FINANCE' | 'LOGISTICS') {
    setAction(`approve-${area}`);
    try {
      await api.post('/integrations/zoho/go-live/approve', { area });
      toast.success(`Approval ${area} tersimpan.`);
      await loadOperations();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Approval gagal.'));
    } finally { setAction(null); }
  }

  async function rollbackGoLive() {
    const reason = window.prompt('Alasan rollback Zoho:');
    if (!reason?.trim()) return;
    setAction('go-live-rollback');
    try {
      await api.post('/integrations/zoho/go-live/rollback', { reason });
      toast.success('Sinkronisasi Zoho dihentikan. ERP lokal tetap berjalan.');
      await loadOperations();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Rollback gagal.'));
    } finally { setAction(null); }
  }

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden p-4 md:p-8">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-neutral-900 dark:text-white">
          <PlugZap className="text-blue-600" /> Integrasi Zoho Books
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Koneksi, antrean sinkronisasi, dan master finance/logistik Zoho.
        </p>
      </div>

      <div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto border-b border-neutral-200 dark:border-neutral-700">
        {([
          ['connection', 'Koneksi', PlugZap],
          ['queue', 'Antrean Sinkronisasi', List],
          ['discovery', 'Master Zoho', Database],
          ['contacts', 'Customer & Vendor', Users],
          ['masters', 'Item & Scope Cabang', Boxes],
          ['invoices', 'Sales Invoice', FileText],
          ['payments', 'Pembayaran & Piutang', CreditCard],
          ['retainers', 'Retainer & Omzet Terapi', Landmark],
          ['partnership', 'Penjualan Partnership', Building2],
          ['purchaseOrders', 'Purchase Order', ShoppingCart],
          ['bills', 'Bill & GRNI', FileInput],
          ['vendorPayments', 'Vendor Payment & AP', CreditCard],
          ['inventoryAdjustments', 'Inventory Usage', Boxes],
          ['operations', 'Go-live & Exception', CircleAlert],
          ['expenses', 'Expense', ReceiptText],
        ] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${
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
                <div className="flex max-w-full flex-wrap gap-2">
                  {status?.connected && (
                    <button onClick={testConnection} disabled={!!action} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-neutral-700">
                      <RefreshCw size={16} className={action === 'test' ? 'animate-spin' : ''} /> Tes
                    </button>
                  )}
                  {status?.connected && status.connections.some((connection) => (
                    connection.authorizationReady && (!connection.contactSyncReady || !connection.itemSyncReady)
                  )) && (
                    <button onClick={setupZoho} disabled={!!action} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      {action === 'setup' ? <Loader2 size={16} className="animate-spin" /> : <Wrench size={16} />}
                      Siapkan otomatis
                    </button>
                  )}
                  <button onClick={connect} disabled={!status?.configured || !!action} className="inline-flex max-w-full items-center gap-2 whitespace-normal rounded-lg bg-blue-600 px-4 py-2 text-left text-sm font-semibold text-white disabled:opacity-50">
                    {action === 'connect' ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                    {status?.connected || status?.connections.some((connection) => connection.reconnectRequired)
                      ? 'Hubungkan ulang'
                      : 'Hubungkan Zoho'}
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

          <ZohoExistingDataGuide />

          {!!status?.connections.length && (
            <section className="space-y-3">
              {status.connections.map((connection) => (
                <div key={connection.id} className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="flex gap-3">
                      <Building2 className={connection.authorizationReady ? 'text-blue-600' : 'text-neutral-400'} />
                      <div>
                        <p className="font-semibold">{connection.organizationName}</p>
                        <p className="text-xs text-neutral-500">
                          ID {connection.organizationId} · {connection.organizationCurrencyCode || '-'} · discovery {when(connection.discoveryLastRunAt)}
                        </p>
                        {connection.reconnectRequired && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            {connection.lastError?.match(/ZOHO_REFRESH_FAILED|invalid_code|invalid_grant/i)
                              ? 'Token Zoho tidak berlaku. Klik “Hubungkan ulang” dan setujui kembali seluruh izin.'
                              : `Hubungkan ulang untuk scope baru: ${connection.missingScopes.join(', ') || 'versi izin terbaru'}`}
                          </p>
                        )}
                        {!connection.reconnectRequired && connection.discoveryLastRunAt && !connection.contactSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Contact live belum siap: jalankan penyiapan otomatis untuk membuat field unik “RAHO External ID”.
                          </p>
                        )}
                        {!connection.reconnectRequired && connection.discoveryLastRunAt && !connection.itemAccountSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Item live belum siap: jalankan penyiapan otomatis untuk memetakan account standar Zoho.
                          </p>
                        )}
                        {!connection.reconnectRequired && connection.discoveryLastRunAt && !connection.uomSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Item live belum siap: petakan seluruh UOM aktif pada tab Master Zoho.
                          </p>
                        )}
                        {!connection.reconnectRequired && connection.discoveryLastRunAt && !connection.locationSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Scope cabang Zoho belum siap: jalankan discovery untuk memeriksa dukungan edition Zoho.
                          </p>
                        )}
                        {!connection.reconnectRequired && !connection.invoiceSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Invoice live belum siap: hubungkan ulang untuk scope CREATE dan UPDATE.
                          </p>
                        )}
                        {!connection.reconnectRequired && !connection.paymentSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Customer Payment/refund belum siap: hubungkan ulang untuk scope pembayaran Sprint 6.
                          </p>
                        )}
                        {!connection.reconnectRequired && !connection.expenseSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Expense belum siap: hubungkan ulang untuk scope expense Sprint 8.
                          </p>
                        )}
                        {!connection.reconnectRequired && !connection.purchaseOrderSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Purchase Order belum siap: hubungkan ulang untuk scope purchase order.
                          </p>
                        )}
                        {!connection.reconnectRequired && !connection.billSyncReady && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Bill belum siap: hubungkan ulang untuk scope Bill Sprint 11.
                          </p>
                        )}
                        {connection.lastError && !connection.reconnectRequired && <p className="mt-1 text-xs text-red-600">{connection.lastError}</p>}
                      </div>
                    </div>
                    {connection.authorizationReady ? (
                      <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Aktif</span>
                    ) : connection.reconnectRequired ? (
                      <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Perlu OAuth</span>
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
            <div className="flex flex-wrap gap-2">
              {discovery && !discovery.contactExternalIdField.ready && canManageConnection && (
                <button onClick={setupZoho} disabled={!!action} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {action === 'setup' ? <Loader2 size={16} className="animate-spin" /> : <Wrench size={16} />}
                  Siapkan otomatis
                </button>
              )}
              <button onClick={runDiscovery} disabled={!status?.connected || action === 'discovery'} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <RefreshCw size={16} className={action === 'discovery' ? 'animate-spin' : ''} /> Ambil ulang dari Zoho
              </button>
            </div>
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
              Scope cabang Zoho diblokir oleh capability check: {discovery.locationCapability.error || 'edition tidak mendukung scope cabang'}.
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
                Member dan cabang Partnership menjadi customer; supplier menjadi vendor. Data klinis tidak dikirim.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={contactEntityType}
                onChange={(event) => setContactEntityType(event.target.value as 'MEMBER' | 'SUPPLIER' | 'PARTNERSHIP_BRANCH')}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              >
                <option value="MEMBER">Member / Customer</option>
                <option value="SUPPLIER">Supplier / Vendor</option>
                <option value="PARTNERSHIP_BRANCH">Cabang Partnership / Customer</option>
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
                <h2 className="font-semibold">Mapping Item dan Scope Cabang</h2>
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

      {tab === 'partnership' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Kontrol Penjualan Barang Partnership</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Omzet muncul saat shipment SHIPPED. Terapi di cabang Partnership tetap tidak membuat omzet per infus di Zoho.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={partnershipSearch}
                  onChange={(event) => setPartnershipSearch(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void loadPartnershipSales(); }}
                  placeholder="Cari shipment/order/invoice"
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                />
                <button onClick={() => void loadPartnershipSales()} className="rounded-lg border p-2 dark:border-neutral-700">
                  <RefreshCw size={18} />
                </button>
                <button
                  onClick={() => void runPartnershipReconciliation()}
                  disabled={!!action || status?.dryRun}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  title={status?.dryRun ? 'Matikan dry-run untuk rekonsiliasi live.' : undefined}
                >
                  Rekonsiliasi
                </button>
              </div>
            </div>

            {partnershipReconciliation && (
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                <div className="flex flex-wrap gap-4 font-semibold">
                  <span>Diperiksa: {partnershipReconciliation.checked}</span>
                  <span className="text-emerald-700">Cocok: {partnershipReconciliation.matched}</span>
                  <span className="text-red-700">Beda: {partnershipReconciliation.mismatched}</span>
                  <span className="text-amber-700">Hilang: {partnershipReconciliation.missing}</span>
                </div>
                {partnershipReconciliation.rows.filter((row) => row.result.status !== 'MATCHED').map((row) => (
                  <p key={row.shipmentId} className="mt-1 text-xs">
                    <strong>{row.shipmentCode}</strong>: {row.result.differences.join(' ')}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="p-3">Shipment / Order</th>
                    <th className="p-3">Omzet / HPP</th>
                    <th className="p-3">Customer / Payment</th>
                    <th className="p-3">Invoice Zoho</th>
                    <th className="p-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {partnershipSales?.items.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                      <td className="p-3">
                        <span className="block font-semibold">{row.shipmentCode}</span>
                        <span className="block text-xs text-neutral-500">
                          {row.stockRequest.requestCode} · {row.invoice?.invoiceNumber || 'Belum ada invoice'}
                        </span>
                        <span className="block text-xs">
                          {row.fromBranch.branchCode} → {row.partnershipBranch.branchCode} · {row.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs">
                        {row.amounts ? (
                          <>
                            <span className="block">Omzet IDR {Number(row.amounts.revenue || 0).toLocaleString('id-ID')}</span>
                            <span className="block">HPP IDR {Number(row.amounts.fifoCost || 0).toLocaleString('id-ID')}</span>
                            <span className="block font-semibold text-emerald-700">
                              Laba kotor IDR {Number(row.amounts.grossProfit || 0).toLocaleString('id-ID')}
                            </span>
                          </>
                        ) : <span className="text-amber-700">Menunggu shipment final</span>}
                      </td>
                      <td className="p-3 text-xs">
                        <span className={row.customerMapping ? 'text-emerald-700' : 'text-amber-700'}>
                          Customer: {row.customerMapping?.zohoEntityId || 'belum dipetakan'}
                        </span>
                        <span className="block">
                          Advance/payment: {row.paymentMapping?.zohoEntityId || 'belum tersinkron'}
                        </span>
                      </td>
                      <td className="p-3 text-xs">
                        {row.invoiceMapping ? (
                          <span className="font-mono text-emerald-700">{row.invoiceMapping.zohoEntityId}</span>
                        ) : <span className="text-amber-700">Belum tersinkron</span>}
                        {row.event && (
                          <span className={`mt-1 block w-fit rounded px-2 py-0.5 ${badge[row.event.status]}`}>
                            {row.event.status}
                          </span>
                        )}
                        {row.event?.lastError && <span className="mt-1 block text-red-600">{row.event.lastError}</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex min-w-48 flex-wrap gap-2">
                          {!row.customerMapping && (
                            <button
                              onClick={() => void enqueuePartnershipCustomer(row)}
                              disabled={!!action}
                              className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700"
                            >
                              Petakan customer
                            </button>
                          )}
                          {row.event && (
                            <>
                              <button onClick={() => void previewPartnershipSale(row)} disabled={!!action} className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700">
                                Preview
                              </button>
                              <button onClick={() => void enqueuePartnershipSale(row)} disabled={!!action} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
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
              {!partnershipSales?.items.length && (
                <p className="p-8 text-center text-sm text-neutral-500">Belum ada shipment Partnership.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'purchaseOrders' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Kontrol Purchase Order</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Hanya PO berstatus issued yang dikirim. Membuat PO tidak mengurangi atau menambah stok ERP.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={purchaseOrderSearch}
                  onChange={(event) => setPurchaseOrderSearch(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void loadPurchaseOrders(); }}
                  placeholder="Cari PO, vendor, cabang"
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                />
                <button onClick={() => void loadPurchaseOrders()} className="rounded-lg border p-2 dark:border-neutral-700">
                  <RefreshCw size={18} />
                </button>
                <button
                  onClick={() => void runPurchaseOrderReconciliation()}
                  disabled={!!action || status?.dryRun}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  title={status?.dryRun ? 'Matikan dry-run untuk rekonsiliasi live.' : undefined}
                >
                  Rekonsiliasi
                </button>
              </div>
            </div>

            {purchaseOrderReconciliation && (
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                <div className="flex flex-wrap gap-4 font-semibold">
                  <span>Diperiksa: {purchaseOrderReconciliation.checked}</span>
                  <span className="text-emerald-700">Cocok: {purchaseOrderReconciliation.matched}</span>
                  <span className="text-red-700">Beda: {purchaseOrderReconciliation.mismatched}</span>
                  <span className="text-amber-700">Hilang: {purchaseOrderReconciliation.missing}</span>
                </div>
                {purchaseOrderReconciliation.rows
                  .filter((row) => row.result.status !== 'MATCHED')
                  .map((row) => (
                    <p key={row.purchaseOrderId} className="mt-1 text-xs">
                      <strong>{row.poNumber}</strong>: {row.result.differences.join(' ')}
                    </p>
                  ))}
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="p-3">PO / Tanggal</th>
                    <th className="p-3">Vendor / Cabang</th>
                    <th className="p-3">Nilai / Baris</th>
                    <th className="p-3">Zoho</th>
                    <th className="p-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders?.items.map((row) => {
                    const latestEvent = row.events.at(-1);
                    const partnership = row.branch.type === 'PARTNERSHIP';
                    return (
                      <tr key={row.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                        <td className="p-3">
                          <span className="block font-semibold">{row.poNumber}</span>
                          <span className="block text-xs text-neutral-500">
                            {new Date(row.orderDate).toLocaleDateString('id-ID')} · {row.status}
                          </span>
                        </td>
                        <td className="p-3 text-xs">
                          <span className="block font-semibold">{row.supplier.code} · {row.supplier.name}</span>
                          <span className="block text-neutral-500">{row.branch.code} · {row.branch.name}</span>
                          {partnership && <span className="block text-amber-700">Tidak memakai Location internal Zoho</span>}
                        </td>
                        <td className="p-3 text-xs">
                          <span className="block font-semibold">
                            {row.currency} {Number(row.totalAmount).toLocaleString('id-ID')}
                          </span>
                          <span>{row.lineCount} baris item</span>
                        </td>
                        <td className="p-3 text-xs">
                          {row.mapping ? (
                            <span className="font-mono text-emerald-700">{row.mapping.zohoEntityId}</span>
                          ) : <span className="text-amber-700">{partnership ? 'Dikecualikan' : 'Belum tersinkron'}</span>}
                          {latestEvent && (
                            <span className={`mt-1 block w-fit rounded px-2 py-0.5 ${badge[latestEvent.status]}`}>
                              {latestEvent.eventType} · {latestEvent.status}
                            </span>
                          )}
                          {latestEvent?.lastError && <span className="mt-1 block max-w-xs text-red-600">{latestEvent.lastError}</span>}
                        </td>
                        <td className="p-3">
                          <div className="flex min-w-52 flex-wrap gap-2">
                            <button
                              onClick={() => void previewPurchaseOrder(row)}
                              disabled={!!action}
                              className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700"
                            >
                              Preview
                            </button>
                            {!partnership && !row.mapping && (
                              <button
                                onClick={() => void enqueuePurchaseOrderDependencies(row)}
                                disabled={!!action}
                                className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700"
                              >
                                Siapkan mapping
                              </button>
                            )}
                            {!partnership && (
                              <button
                                onClick={() => void enqueuePurchaseOrder(row)}
                                disabled={!!action}
                                className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                {row.status === 'CANCELLED' ? 'Sync pembatalan' : status?.dryRun ? 'Dry-run' : 'Sinkronkan'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!purchaseOrders?.items.length && (
                <p className="p-8 text-center text-sm text-neutral-500">Belum ada Purchase Order.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'bills' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Received not billed (GRNI)</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Goods Receipt menaikkan stok ERP. Quantity Zoho baru naik satu kali ketika Bill dibuat.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={billSearch}
                  onChange={(event) => setBillSearch(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void loadBills(); }}
                  placeholder="Cari Bill, PO, vendor"
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                />
                <button onClick={() => void loadBills()} className="rounded-lg border p-2 dark:border-neutral-700">
                  <RefreshCw size={18} />
                </button>
                <button
                  onClick={() => void runBillReconciliation()}
                  disabled={!!action || status?.dryRun}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Rekonsiliasi
                </button>
              </div>
            </div>

            {grni && (
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-amber-50 p-3 text-amber-900"><span className="block text-xs">Menunggu</span><strong>{grni.summary.waiting}</strong></div>
                <div className="rounded-lg bg-red-50 p-3 text-red-900"><span className="block text-xs">Lewat SLA {grni.summary.slaDays} hari</span><strong>{grni.summary.overdue}</strong></div>
                <div className="rounded-lg bg-emerald-50 p-3 text-emerald-900"><span className="block text-xs">Clear</span><strong>{grni.summary.clear}</strong></div>
                <div className="rounded-lg bg-blue-50 p-3 text-blue-900"><span className="block text-xs">Nilai belum ditagih</span><strong>IDR {Number(grni.summary.unbilledValue).toLocaleString('id-ID')}</strong></div>
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="p-3">PO / Vendor</th>
                    <th className="p-3">Umur / Status</th>
                    <th className="p-3">Received</th>
                    <th className="p-3">Billed</th>
                    <th className="p-3">Belum ditagih</th>
                  </tr>
                </thead>
                <tbody>
                  {grni?.items.map((row) => (
                    <tr key={row.purchaseOrderId} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                      <td className="p-3">
                        <span className="block font-semibold">{row.poNumber}</span>
                        <span className="block text-xs">{row.supplier.code} · {row.supplier.name}</span>
                        <span className="block text-xs text-neutral-500">{row.branch.code} · {row.receiptCount} GR / {row.billCount} Bill</span>
                      </td>
                      <td className="p-3 text-xs">
                        <span className={`rounded px-2 py-1 font-semibold ${
                          row.status === 'OVERDUE'
                            ? 'bg-red-100 text-red-800'
                            : row.status === 'CLEAR'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}>{row.status}</span>
                        <span className="mt-2 block">{row.ageDays} hari</span>
                        {row.hasLegacyAmountOnlyBill && <span className="block text-red-600">Ada Bill lama tanpa quantity</span>}
                      </td>
                      <td className="p-3 text-xs">
                        <span className="font-semibold">IDR {Number(row.receivedValue).toLocaleString('id-ID')}</span>
                        {row.lines.map((line) => <span key={line.purchaseOrderItemId} className="block">{line.sku || '-'}: {line.receivedQty}</span>)}
                      </td>
                      <td className="p-3 text-xs">
                        <span className="font-semibold">IDR {Number(row.billedValue).toLocaleString('id-ID')}</span>
                        {row.lines.map((line) => <span key={line.purchaseOrderItemId} className="block">{line.sku || '-'}: {line.billedQty}</span>)}
                      </td>
                      <td className="p-3 text-xs">
                        <span className="font-semibold">IDR {Number(row.unbilledValue).toLocaleString('id-ID')}</span>
                        {row.lines.map((line) => <span key={line.purchaseOrderItemId} className="block">{line.sku || '-'}: {line.unbilledQty}</span>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!grni?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Belum ada Goods Receipt.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <h2 className="font-semibold">Supplier Invoice → Zoho Bill</h2>
            <p className="mt-1 text-sm text-neutral-500">Bill harus terkait PO dan hanya memuat quantity received yang benar-benar ditagihkan.</p>

            {billReconciliation && (
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                <div className="flex flex-wrap gap-4 font-semibold">
                  <span>Diperiksa: {billReconciliation.checked}</span>
                  <span className="text-emerald-700">Cocok: {billReconciliation.matched}</span>
                  <span className="text-red-700">Beda: {billReconciliation.mismatched}</span>
                  <span className="text-amber-700">Hilang: {billReconciliation.missing}</span>
                </div>
                {billReconciliation.rows.filter((row) => row.result.status !== 'MATCHED').map((row) => (
                  <p key={row.supplierInvoiceId} className="mt-1 text-xs">
                    <strong>{row.invoiceNumber}</strong>: {row.result.differences.join(' ')}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="p-3">Invoice / PO</th>
                    <th className="p-3">Vendor / Cabang</th>
                    <th className="p-3">Amount / AP</th>
                    <th className="p-3">Zoho</th>
                    <th className="p-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {bills?.items.map((row) => {
                    const partnership = row.branch.type === 'PARTNERSHIP';
                    return (
                      <tr key={row.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                        <td className="p-3">
                          <span className="block font-semibold">{row.invoiceNumber}</span>
                          <span className="block text-xs">{row.supplierInvoiceNumber} · {row.purchaseOrder.poNumber}</span>
                          <span className="block text-xs text-neutral-500">{new Date(row.invoiceDate).toLocaleDateString('id-ID')} · {row.lineCount} baris</span>
                        </td>
                        <td className="p-3 text-xs">
                          <span className="block font-semibold">{row.supplier.code} · {row.supplier.name}</span>
                          <span>{row.branch.code} · {row.branch.name}</span>
                        </td>
                        <td className="p-3 text-xs">
                          <span className="block font-semibold">IDR {Number(row.amount).toLocaleString('id-ID')}</span>
                          <span className="block">Saldo IDR {Number(row.balanceAmount).toLocaleString('id-ID')}</span>
                          <span>{row.status}</span>
                        </td>
                        <td className="p-3 text-xs">
                          {row.mapping ? <span className="font-mono text-emerald-700">{row.mapping.zohoEntityId}</span> : <span className="text-amber-700">{partnership ? 'Dikecualikan' : 'Belum tersinkron'}</span>}
                          {row.event && <span className={`mt-1 block w-fit rounded px-2 py-0.5 ${badge[row.event.status]}`}>{row.event.status}</span>}
                          {row.event?.lastError && <span className="mt-1 block max-w-xs text-red-600">{row.event.lastError}</span>}
                        </td>
                        <td className="p-3">
                          <div className="flex min-w-52 flex-wrap gap-2">
                            <button onClick={() => void previewBill(row)} disabled={!!action} className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700">Preview</button>
                            {!partnership && !row.mapping && <button onClick={() => void enqueueBillDependencies(row)} disabled={!!action} className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700">Siapkan mapping</button>}
                            {!partnership && <button onClick={() => void enqueueBill(row)} disabled={!!action} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">{status?.dryRun ? 'Dry-run' : 'Sinkronkan'}</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!bills?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Belum ada supplier invoice.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === 'vendorPayments' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Supplier Payment → Zoho Vendor Payment</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Setiap pembayaran diterapkan ke satu Bill yang tepat. Partial payment mengurangi saldo AP tanpa membuat payment ganda.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={vendorPaymentSearch}
                  onChange={(event) => setVendorPaymentSearch(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void loadVendorPayments(); }}
                  placeholder="Cari payment, Bill, vendor"
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                />
                <button onClick={() => void loadVendorPayments()} className="rounded-lg border p-2 dark:border-neutral-700">
                  <RefreshCw size={18} />
                </button>
                <button
                  onClick={() => void runVendorPaymentReconciliation()}
                  disabled={!!action || status?.dryRun}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Rekonsiliasi AP
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-neutral-50 p-3 text-xs dark:bg-neutral-800">
              <span>
                Rekening terpetakan: <strong>{vendorPaymentConfig?.cashBankAccounts.filter((row) => row.mapping).length || 0}/{vendorPaymentConfig?.cashBankAccounts.length || 0}</strong>
              </span>
              <span>
                Metode terpetakan: <strong>{vendorPaymentConfig?.paymentMethods.filter((row) => row.mapping).length || 0}/{vendorPaymentConfig?.paymentMethods.length || 0}</strong>
              </span>
              <button onClick={() => setTab('payments')} className="font-semibold text-blue-600">
                Atur mapping rekening & metode
              </button>
            </div>

            {vendorPaymentReconciliation && (
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                <div className="flex flex-wrap gap-4 font-semibold">
                  <span>Diperiksa: {vendorPaymentReconciliation.checked}</span>
                  <span className="text-emerald-700">Cocok: {vendorPaymentReconciliation.matched}</span>
                  <span className="text-red-700">Beda: {vendorPaymentReconciliation.mismatched}</span>
                  <span className="text-amber-700">Hilang: {vendorPaymentReconciliation.missing}</span>
                </div>
                {vendorPaymentReconciliation.rows.filter((row) => row.result.status !== 'MATCHED').map((row) => (
                  <p key={row.supplierPaymentId} className="mt-1 text-xs">
                    <strong>{row.paymentNumber}</strong>: {row.result.differences.join(' ')}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="p-3">Payment / Tanggal</th>
                    <th className="p-3">Vendor / Bill</th>
                    <th className="p-3">Nominal / Rekening</th>
                    <th className="p-3">Zoho</th>
                    <th className="p-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorPayments?.items.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                      <td className="p-3">
                        <span className="block font-semibold">{row.paymentNumber}</span>
                        <span className="block text-xs">{new Date(row.paymentDate).toLocaleDateString('id-ID')}</span>
                        <span className="block text-xs text-neutral-500">{row.paymentReference}</span>
                      </td>
                      <td className="p-3 text-xs">
                        <span className="block font-semibold">{row.supplier.code} · {row.supplier.name}</span>
                        <span className="block">{row.supplierInvoice.invoiceNumber}</span>
                        <span className="text-neutral-500">{row.branch.code} · {row.branch.type}</span>
                      </td>
                      <td className="p-3 text-xs">
                        <span className="block font-semibold">IDR {Number(row.amount).toLocaleString('id-ID')}</span>
                        <span>{row.cashBankAccount.code} · {row.cashBankAccount.name}</span>
                        <span className="block">{row.paymentMethod}</span>
                      </td>
                      <td className="p-3 text-xs">
                        {row.mapping
                          ? <span className="font-mono text-emerald-700">{row.mapping.zohoEntityId}</span>
                          : <span className="text-amber-700">{row.eligible ? 'Belum tersinkron' : 'Dikecualikan'}</span>}
                        {row.event && <span className={`mt-1 block w-fit rounded px-2 py-0.5 ${badge[row.event.status]}`}>{row.event.status}</span>}
                        {row.event?.lastError && <span className="mt-1 block max-w-xs text-red-600">{row.event.lastError}</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex min-w-40 flex-wrap gap-2">
                          <button onClick={() => void previewVendorPayment(row)} disabled={!!action} className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700">Preview</button>
                          {row.eligible && <button onClick={() => void enqueueVendorPayment(row)} disabled={!!action} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">{status?.dryRun ? 'Dry-run' : 'Sinkronkan'}</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!vendorPayments?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Belum ada pembayaran supplier.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === 'inventoryAdjustments' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Treatment & Inventory Adjustment</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Consumer inventory berdiri sendiri dari finance. Error atau retry stok tidak memposting ulang omzet/HPP.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void probeInventoryCapability()} disabled={!!action} className="rounded-lg border px-3 py-2 text-sm font-semibold dark:border-neutral-700">
                  Tes capability
                </button>
                <button onClick={() => void downloadInventoryAdjustmentExport()} disabled={!!action} className="rounded-lg border px-3 py-2 text-sm font-semibold dark:border-neutral-700">
                  Ekspor CSV
                </button>
                <button
                  onClick={() => void runInventoryAdjustmentReconciliation()}
                  disabled={!!action || inventoryAdjustmentCapability?.supported !== true || status?.dryRun}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Rekonsiliasi
                </button>
              </div>
            </div>

            <div className={`mt-4 rounded-xl border p-4 text-sm ${
              inventoryAdjustmentCapability?.supported === true
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}>
              <p className="font-semibold">
                Capability: {inventoryAdjustmentCapability?.supported === true
                  ? 'Tersedia'
                  : inventoryAdjustmentCapability?.supported === false
                    ? 'Tidak tersedia'
                    : 'Belum dites'}
              </p>
              <p className="mt-1 text-xs">
                {inventoryAdjustmentCapability?.error
                  || 'Bila endpoint tidak tersedia, transaksi lokal tetap jalan dan data dapat diekspor tanpa jurnal palsu.'}
              </p>
              <p className="mt-1 text-xs">Terakhir dicek: {when(inventoryAdjustmentCapability?.checkedAt || null)}</p>
            </div>

            {inventoryAdjustmentReconciliation && (
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                <p className="font-semibold">Diperiksa: {inventoryAdjustmentReconciliation.checked}</p>
                <p className="mt-1 text-xs">
                  Selisih: {inventoryAdjustmentReconciliation.results.filter((row) => (
                    !row.referenceMatched || !row.quantityMatched || !row.valueMatched
                  )).length}
                </p>
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="p-3">Event</th>
                    <th className="p-3">Referensi</th>
                    <th className="p-3">Cabang / Waktu</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryAdjustments?.items.map((row) => {
                    const payload = row.payload as {
                      externalKey?: string;
                      postingReference?: string | null;
                      lines?: unknown[];
                    };
                    return (
                      <tr key={row.id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                        <td className="p-3">
                          <span className="block font-semibold">{row.eventType}</span>
                          <span className="text-xs text-neutral-500">{payload.lines?.length || 0} baris</span>
                        </td>
                        <td className="p-3 text-xs">
                          <span className="block font-mono">{payload.externalKey || row.aggregateId}</span>
                          <span className="text-neutral-500">{payload.postingReference || '-'}</span>
                        </td>
                        <td className="p-3 text-xs">
                          <span className="block">{row.branchId || '-'}</span>
                          <span>{when(row.occurredAt)}</span>
                        </td>
                        <td className="p-3 text-xs">
                          <span className={`block w-fit rounded px-2 py-0.5 ${badge[row.status]}`}>{row.status}</span>
                          {row.lastError && <span className="mt-1 block max-w-sm text-red-600">{row.lastError}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!inventoryAdjustments?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Belum ada event inventory.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === 'operations' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Cutover, Canary, dan Rollback</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Mode ini hanya mengontrol adapter Zoho. Pembelian paket, pembayaran, treatment, stok, dan purchasing lokal tetap berjalan saat mode OFF atau Zoho terputus.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${
                goLive?.runtime.mode === 'LIVE' ? 'bg-emerald-100 text-emerald-800'
                  : goLive?.runtime.mode === 'CANARY' ? 'bg-blue-100 text-blue-800'
                    : goLive?.runtime.mode === 'DRY_RUN' ? 'bg-violet-100 text-violet-800'
                      : 'bg-neutral-200 text-neutral-700'
              }`}>
                {goLive?.runtime.mode || 'OFF'}
              </span>
            </div>

            {!goLive?.connected && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Zoho belum terhubung. Seluruh ERP lokal tetap dapat digunakan; worker dan reconciliation Zoho tidak melakukan write.
              </div>
            )}

            {goLive?.runtime.source === 'CONFIGURATION_INVALID' && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                Runtime Zoho dipaksa OFF karena worker atau kredensial server belum lengkap. ERP lokal tetap berjalan normal.
              </div>
            )}

            {goLive?.connected && (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-800">
                    <p className="text-xs text-neutral-500">Approval Finance</p>
                    <p className="font-semibold">{goLive.control?.financeApprovedAt ? when(goLive.control.financeApprovedAt) : 'Belum'}</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-800">
                    <p className="text-xs text-neutral-500">Approval Logistik</p>
                    <p className="font-semibold">{goLive.control?.logisticsApprovedAt ? when(goLive.control.logisticsApprovedAt) : 'Belum'}</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-800">
                    <p className="text-xs text-neutral-500">Canary bebas mismatch</p>
                    <p className="font-semibold">{goLive.control?.mismatchFreeBusinessDays || 0}/5 hari kerja</p>
                  </div>
                </div>

                {canManageConnection && (
                  <div className="mt-4 space-y-3 rounded-xl border p-4 dark:border-neutral-700">
                    <label className="block text-sm">
                      <span className="font-semibold">ID cabang canary</span>
                      <span className="ml-2 text-xs text-neutral-500">pisahkan dengan koma</span>
                      <input
                        value={canaryBranchIds}
                        onChange={(event) => setCanaryBranchIds(event.target.value)}
                        className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-xs dark:border-neutral-700"
                        placeholder="cuid-cabang-1, cuid-cabang-2"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => void saveGoLiveConfig()} disabled={!!action} className="rounded-lg border px-3 py-2 text-xs font-semibold dark:border-neutral-700">Simpan kontrol</button>
                      <button onClick={() => void approveGoLive('FINANCE')} disabled={!!action || !goLive.control} className="rounded-lg border px-3 py-2 text-xs font-semibold dark:border-neutral-700">Approval Finance</button>
                      <button onClick={() => void approveGoLive('LOGISTICS')} disabled={!!action || !goLive.control} className="rounded-lg border px-3 py-2 text-xs font-semibold dark:border-neutral-700">Approval Logistik</button>
                      <button onClick={() => void changeGoLiveMode('DRY_RUN')} disabled={!!action || !goLive.control} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Dry-run</button>
                      <button onClick={() => void changeGoLiveMode('CANARY')} disabled={!!action || !goLive.control} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Canary</button>
                      <button onClick={() => void changeGoLiveMode('LIVE')} disabled={!!action || !goLive.control} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Live</button>
                      <button onClick={() => void rollbackGoLive()} disabled={!!action || !goLive.control} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Rollback OFF</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Reconciliation & Exception</h2>
                <p className="mt-1 text-sm text-neutral-500">Run dapat dilanjutkan setelah restart atau rate-limit.</p>
              </div>
              <button onClick={() => void runFullReconciliation()} disabled={!!action || !goLive?.connected} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Jalankan reconciliation
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {reconciliationRuns?.items.map((run) => (
                <div key={run.id} className="rounded-xl border p-4 text-sm dark:border-neutral-700">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-semibold">{run.runType} · {run.triggerSource}</span>
                    <span>{run.status} · {when(run.finishedAt || run.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Diperiksa {run.totalChecked} · cocok {run.matchedCount} · exception {run.exceptionCount} · error {run.errorCount}
                  </p>
                  {run.lastError && <p className="mt-2 text-xs text-red-600">{run.lastError}</p>}
                  {run.results.map((result) => (
                    <div key={result.id} className="mt-2 flex flex-wrap items-start justify-between gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-950">
                      <div>
                        <p className="font-semibold">{result.severity} · {result.entityType} · {result.status}</p>
                        <p>{result.externalReference || '-'} · {(result.differences || []).join(', ')}</p>
                        {result.actionRequired && <p className="mt-1">{result.actionRequired}</p>}
                      </div>
                      {!result.resolvedAt && (
                        <button onClick={() => void resolveReconciliationResult(result.id)} disabled={!!action} className="rounded border border-amber-400 px-2 py-1 font-semibold">
                          Selesaikan
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              {!reconciliationRuns?.items.length && <p className="py-6 text-center text-sm text-neutral-500">Belum ada reconciliation run.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <h2 className="font-semibold">Webhook Inbox</h2>
            <p className="mt-1 text-sm text-neutral-500">Webhook duplikat disimpan satu kali; event yang belum punya mapping menunggu korelasi.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="p-3">Event</th>
                    <th className="p-3">Entity</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {webhookInbox?.items.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="p-3 font-semibold">{row.eventType}</td>
                      <td className="p-3 text-xs">{row.zohoEntityType || '-'} · {row.externalReference || row.zohoEntityId || '-'}</td>
                      <td className="p-3 text-xs">{row.status} · {row.correlationStatus}</td>
                      <td className="p-3 text-xs">{when(row.receivedAt)}</td>
                      <td className="p-3">
                        {row.status === 'PENDING_CORRELATION' && (
                          <button onClick={() => void retryWebhookCorrelation(row.id)} disabled={!!action} className="rounded border px-2 py-1 text-xs font-semibold dark:border-neutral-700">Coba korelasi</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!webhookInbox?.items.length && <p className="p-8 text-center text-sm text-neutral-500">Belum ada webhook.</p>}
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
                Capability scope cabang belum diverifikasi melalui discovery.
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

      {partnershipPreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setPartnershipPreview(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold">Preview shipment: {partnershipPreview.snapshot.shipmentCode}</h3>
            <p className="mt-1 font-mono text-xs text-neutral-500">{partnershipPreview.snapshot.invoiceNumber}</p>
            <div className="mt-4 grid gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 sm:grid-cols-3">
              <span>Omzet: IDR {Number(partnershipPreview.accounting.revenue).toLocaleString('id-ID')}</span>
              <span>HPP FIFO: IDR {Number(partnershipPreview.accounting.fifoCost).toLocaleString('id-ID')}</span>
              <span>Laba kotor: IDR {Number(partnershipPreview.accounting.grossProfit).toLocaleString('id-ID')}</span>
            </div>
            {!!partnershipPreview.issues.length && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Belum siap live:</p>
                <ul className="mt-1 list-disc pl-5">
                  {partnershipPreview.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-4 text-sm font-semibold">Payload Sales Invoice barang</p>
            <pre className="mt-2 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
              {partnershipPreview.payload
                ? JSON.stringify(partnershipPreview.payload, null, 2)
                : 'Payload diblok sampai mapping customer, item, dan Location HQ lengkap.'}
            </pre>
            <p className="mt-4 text-sm font-semibold">Kebijakan accounting</p>
            <p className="mt-1 text-xs text-neutral-600">{partnershipPreview.accounting.policy}</p>
            <p className="mt-4 text-sm font-semibold">Field yang tidak pernah dikirim</p>
            <p className="mt-1 text-xs text-red-600">{partnershipPreview.excludedFields.join(', ')}</p>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setPartnershipPreview(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold dark:border-neutral-700">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {billPreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setBillPreview(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold">Preview Bill: {billPreview.snapshot.invoiceNumber}</h3>
            <p className="mt-1 font-mono text-xs text-neutral-500">{billPreview.snapshot.externalKey}</p>
            <p className="mt-1 text-sm">{billPreview.snapshot.supplierInvoiceNumber} · {billPreview.snapshot.poNumber}</p>
            {!billPreview.snapshot.eligible && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Bill tidak dikirim ke Zoho</p>
                <p className="mt-1">{billPreview.snapshot.excludedReason}</p>
              </div>
            )}
            {!!billPreview.issues.length && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Belum siap live:</p>
                <ul className="mt-1 list-disc pl-5">
                  {billPreview.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-4 text-sm font-semibold">Payload Zoho Bill</p>
            <pre className="mt-2 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
              {billPreview.payload
                ? JSON.stringify(billPreview.payload, null, 2)
                : 'Payload diblok sampai Vendor, PO, Item, UOM, Location, dan alokasi quantity lengkap.'}
            </pre>
            <p className="mt-4 text-sm font-semibold">Kebijakan anti-double-stock</p>
            <p className="mt-1 text-xs text-neutral-600">{billPreview.inventoryPolicy}</p>
            <p className="mt-4 text-sm font-semibold">Data yang tidak dikirim</p>
            <p className="mt-1 text-xs text-red-600">{billPreview.excludedFields.join(', ')}</p>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setBillPreview(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold dark:border-neutral-700">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {vendorPaymentPreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setVendorPaymentPreview(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold">Preview Vendor Payment: {vendorPaymentPreview.snapshot.paymentNumber}</h3>
            <p className="mt-1 font-mono text-xs text-neutral-500">{vendorPaymentPreview.snapshot.externalKey}</p>
            <p className="mt-1 text-sm">{vendorPaymentPreview.snapshot.invoiceNumber} · IDR {Number(vendorPaymentPreview.snapshot.amount).toLocaleString('id-ID')}</p>
            {!vendorPaymentPreview.snapshot.eligible && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Vendor Payment tidak dikirim ke Zoho</p>
                <p className="mt-1">{vendorPaymentPreview.snapshot.excludedReason}</p>
              </div>
            )}
            {!!vendorPaymentPreview.issues.length && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Belum siap live:</p>
                <ul className="mt-1 list-disc pl-5">
                  {vendorPaymentPreview.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-4 text-sm font-semibold">Payload Zoho Vendor Payment</p>
            <pre className="mt-2 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
              {vendorPaymentPreview.payload
                ? JSON.stringify(vendorPaymentPreview.payload, null, 2)
                : 'Payload diblok sampai Vendor, Bill, rekening, dan metode terpetakan.'}
            </pre>
            <p className="mt-4 text-xs text-neutral-600">{vendorPaymentPreview.invariant}</p>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setVendorPaymentPreview(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold dark:border-neutral-700">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {purchaseOrderPreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setPurchaseOrderPreview(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold">Preview PO: {purchaseOrderPreview.snapshot.poNumber}</h3>
            <p className="mt-1 font-mono text-xs text-neutral-500">{purchaseOrderPreview.snapshot.externalKey}</p>
            {!purchaseOrderPreview.snapshot.eligible && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">PO tidak dikirim ke Zoho</p>
                <p className="mt-1">{purchaseOrderPreview.snapshot.excludedReason}</p>
              </div>
            )}
            {!!purchaseOrderPreview.issues.length && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Belum siap live:</p>
                <ul className="mt-1 list-disc pl-5">
                  {purchaseOrderPreview.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-4 text-sm font-semibold">Payload Purchase Order Zoho</p>
            <pre className="mt-2 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
              {purchaseOrderPreview.payload
                ? JSON.stringify(purchaseOrderPreview.payload, null, 2)
                : 'Payload diblok sampai mapping vendor, item, UOM, dan Location lengkap.'}
            </pre>
            <p className="mt-4 text-sm font-semibold">Kebijakan stok</p>
            <p className="mt-1 text-xs text-neutral-600">{purchaseOrderPreview.stockPolicy}</p>
            <p className="mt-4 text-sm font-semibold">Data yang tidak dikirim</p>
            <p className="mt-1 text-xs text-red-600">{purchaseOrderPreview.excludedFields.join(', ')}</p>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setPurchaseOrderPreview(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold dark:border-neutral-700">Tutup</button>
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
