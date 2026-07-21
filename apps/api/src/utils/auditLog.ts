import { AuditAction } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { logger } from '@lib/logger';

type AuditActionValue = AuditAction | string;
type JsonRecord = Record<string, unknown>;
type AuditLogCreateData = Record<string, unknown>;

export interface AuditChangedField {
  field: string;
  before: unknown;
  after: unknown;
}

export interface AuditLogPayload {
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  action: AuditActionValue;
  module?: string | null;
  resource?: string;
  resourceId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  entityCode?: string | null;
  description?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  changedFields?: AuditChangedField[] | JsonRecord[] | null;
  metadata?: JsonRecord | null;
  meta?: JsonRecord;
  ipAddress?: string;
  userAgent?: string | string[];
  impersonating?: {
    email: string;
    role: string;
    note?: string;
  };
}

type ActorSnapshot = {
  userId: string | null;
  email: string | null;
  fullName: string | null;
  role: string | null;
  staffCode: string | null;
  branchId: string | null;
  branchCode: string | null;
};

type BranchSnapshot = {
  branchId: string | null;
  branchName: string | null;
  branchCode: string | null;
};

const UNKNOWN_USER_IDS = new Set(['', 'unknown', 'system', 'anonymous']);
const MAX_SANITIZE_DEPTH = 6;
const SENSITIVE_KEYWORDS = [
  'password',
  'token',
  'refreshToken',
  'accessToken',
  'authorization',
  'cookie',
  'secret',
  'otp',
  'pin',
  'file',
  'buffer',
  'base64',
  'raw',
  'signature',
];

const RESOURCE_MODULE_MAP: Record<string, string> = {
  Auth: 'AUTH',
  User: 'USER_MANAGEMENT',
  UserProfile: 'USER_MANAGEMENT',
  ManagerBranch: 'USER_MANAGEMENT',
  StaffBranch: 'USER_MANAGEMENT',
  Branch: 'CABANG',
  Member: 'MEMBER',
  MemberDocument: 'UPLOAD_DOCUMENT',
  MemberPackage: 'PAKET_TERAPI',
  Package: 'PAKET_TERAPI',
  PackagePricing: 'HARGA_PAKET',
  Invoice: 'PAKET_TERAPI',
  Payment: 'PAKET_TERAPI',
  Account: 'ACCOUNTING',
  AccountingPeriod: 'ACCOUNTING',
  JournalEntry: 'ACCOUNTING',
  InvoicePayment: 'FINANCE',
  CashBankAccount: 'CASH_BANK',
  CashBankTransaction: 'CASH_BANK',
  OpeningBalance: 'ACCOUNTING',
  Expense: 'EXPENSE',
  TreatmentSession: 'SESI_TERAPI',
  Session: 'SESI_TERAPI',
  Diagnosis: 'DIAGNOSIS',
  DoctorEvaluation: 'DIAGNOSIS',
  TherapyPlan: 'THERAPY_PLAN',
  MasterProduct: 'MASTER_PRODUCT',
  StockRequest: 'INVENTORY',
  Shipment: 'INVENTORY',
  ShipmentReceipt: 'INVENTORY',
  ShipmentDiscrepancy: 'INVENTORY',
  Inventory: 'INVENTORY',
  InventoryItem: 'INVENTORY',
  StockMutation: 'INVENTORY',
  Warehouse: 'INVENTORY',
  StockLocation: 'INVENTORY',
  UnitOfMeasure: 'INVENTORY',
  UnitConversion: 'INVENTORY',
  InventoryBatch: 'INVENTORY',
  InventoryPosting: 'INVENTORY',
  InventoryCostLayer: 'INVENTORY',
  InternalTransferLedger: 'INVENTORY',
  Supplier: 'PURCHASING',
  PurchaseRequest: 'PURCHASING',
  PurchaseOrder: 'PURCHASING',
  GoodsReceipt: 'PURCHASING',
  SupplierInvoice: 'ACCOUNTS_PAYABLE',
  SupplierPayment: 'ACCOUNTS_PAYABLE',
  StockReservation: 'INVENTORY',
  Overstock: 'INVENTORY',
  Referral: 'REFERRAL',
  ReferralCode: 'REFERRAL',
  File: 'UPLOAD_DOCUMENT',
  Upload: 'UPLOAD_DOCUMENT',
};

function isUsableUserId(userId?: string | null): userId is string {
  return Boolean(userId && !UNKNOWN_USER_IDS.has(userId.toLowerCase()));
}

function emptyActorSnapshot(userId?: string | null): ActorSnapshot {
  return {
    userId: isUsableUserId(userId) ? userId : null,
    email: null,
    fullName: null,
    role: null,
    staffCode: null,
    branchId: null,
    branchCode: null,
  };
}

function emptyBranchSnapshot(branchId?: string | null): BranchSnapshot {
  return {
    branchId: branchId || null,
    branchName: null,
    branchCode: null,
  };
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

export function sanitizeAuditData(value: unknown, depth = 0): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (depth > MAX_SANITIZE_DEPTH) return '[Max depth reached]';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[Function]';
  if (typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return '[Binary data]';
  if ('toJSON' in value && typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return sanitizeAuditData((value as { toJSON: () => unknown }).toJSON(), depth + 1);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditData(item, depth + 1));
  }

  const sanitized: JsonRecord = {};
  for (const [key, item] of Object.entries(value as JsonRecord)) {
    if (item === undefined) continue;
    sanitized[key] = isSensitiveKey(key) ? '[REDACTED]' : sanitizeAuditData(item, depth + 1);
  }
  return sanitized;
}

export function buildChangedFields(
  beforeData?: unknown,
  afterData?: unknown,
  allowedFields?: string[],
): AuditChangedField[] {
  if (!beforeData || !afterData || typeof beforeData !== 'object' || typeof afterData !== 'object') {
    return [];
  }

  const beforeRecord = beforeData as JsonRecord;
  const afterRecord = afterData as JsonRecord;
  const fields = allowedFields ?? Array.from(new Set([
    ...Object.keys(beforeRecord),
    ...Object.keys(afterRecord),
  ]));

  return fields.reduce<AuditChangedField[]>((acc, field) => {
    if (isSensitiveKey(field)) return acc;

    const beforeValue = sanitizeAuditData(beforeRecord[field]);
    const afterValue = sanitizeAuditData(afterRecord[field]);
    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) return acc;

    acc.push({
      field,
      before: beforeValue,
      after: afterValue,
    });
    return acc;
  }, []);
}

function inferModule(resource?: string | null, module?: string | null): string {
  if (module) return module;
  if (!resource) return 'SYSTEM';
  return RESOURCE_MODULE_MAP[resource] ?? RESOURCE_MODULE_MAP[resource.replace(/\s/g, '')] ?? resource.toUpperCase();
}

function inferDescription(payload: AuditLogPayload, entityType: string, entityCode: string | null): string {
  if (payload.description) return payload.description;
  const target = entityCode || payload.entityId || payload.resourceId || entityType;
  return `${payload.action} ${entityType}${target ? ` (${target})` : ''}`;
}

function normalizeUserAgent(userAgent?: string | string[]): string | undefined {
  if (Array.isArray(userAgent)) return userAgent.join(', ');
  return userAgent;
}

function isUnknownAuditLogFieldError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Unknown argument `(userName|userRole|branchName|module|entityType|entityId|entityCode|description|beforeData|afterData|changedFields|metadata)`/.test(message);
}

function toLegacyAuditLogData(data: AuditLogCreateData): AuditLogCreateData {
  return {
    userId: data.userId,
    branchId: data.branchId,
    action: data.action,
    resource: data.resource,
    resourceId: data.resourceId,
    meta: data.meta,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  };
}

async function createAuditLog(data: AuditLogCreateData): Promise<void> {
  try {
    await (prisma.auditLog as any).create({ data });
  } catch (error) {
    if (!isUnknownAuditLogFieldError(error)) throw error;
    await (prisma.auditLog as any).create({ data: toLegacyAuditLogData(data) });
  }
}

async function getActorSnapshot(userId?: string | null): Promise<ActorSnapshot> {
  if (!isUsableUserId(userId)) return emptyActorSnapshot(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      staffCode: true,
      branchId: true,
      profile: { select: { fullName: true } },
      branch: { select: { branchCode: true } },
    },
  });

  if (!user) return emptyActorSnapshot(null);

  return {
    userId: user.id,
    email: user.email,
    fullName: user.profile?.fullName || user.email,
    role: user.role,
    staffCode: user.staffCode,
    branchId: user.branchId,
    branchCode: user.branch?.branchCode || null,
  };
}

async function getBranchSnapshot(branchId?: string | null): Promise<BranchSnapshot> {
  if (!branchId) return emptyBranchSnapshot(branchId);

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      name: true,
      branchCode: true,
    },
  });

  if (!branch) return emptyBranchSnapshot(branchId);

  return {
    branchId: branch.id,
    branchName: branch.name,
    branchCode: branch.branchCode,
  };
}

/**
 * Record an official audit trail entry.
 * This helper never throws to keep business flows from failing because of logging.
 */
export async function logAudit(payload: AuditLogPayload): Promise<void> {
  try {
    const actorSnapshot = await getActorSnapshot(payload.userId);
    const branchId = payload.branchId ?? actorSnapshot.branchId ?? null;
    const branchSnapshot = await getBranchSnapshot(branchId);
    const entityType = payload.entityType || payload.resource || 'System';
    const entityId = payload.entityId || payload.resourceId || null;
    const entityCode = payload.entityCode || null;
    const module = inferModule(payload.resource || entityType, payload.module);
    const changedFields =
      payload.changedFields ??
      buildChangedFields(payload.beforeData, payload.afterData);

    const metaData: JsonRecord = {
      ...(payload.meta ?? {}),
      ...(payload.metadata ?? {}),
    };
    metaData.actorSnapshot = {
      ...(typeof metaData.actorSnapshot === 'object' && metaData.actorSnapshot !== null
        ? (metaData.actorSnapshot as JsonRecord)
        : {}),
      ...actorSnapshot,
      userName: payload.userName || actorSnapshot.fullName || actorSnapshot.email,
      userRole: payload.userRole || actorSnapshot.role,
    };
    metaData.branchSnapshot = {
      branchId,
      branchName: payload.branchName || branchSnapshot.branchName,
      branchCode: branchSnapshot.branchCode,
    };

    if (payload.impersonating) {
      metaData.impersonating = payload.impersonating.email;
      metaData.impersonatedRole = payload.impersonating.role;
      metaData.note = payload.impersonating.note || `Action performed as ${payload.impersonating.email}`;
    }

    await createAuditLog({
      userId: actorSnapshot.userId,
      userName: payload.userName || actorSnapshot.fullName || actorSnapshot.email,
      userRole: payload.userRole || actorSnapshot.role,
      branchId,
      branchName: payload.branchName || branchSnapshot.branchName,
      action: payload.action,
      module,
      resource: payload.resource || entityType,
      resourceId: payload.resourceId || entityId || 'unknown',
      entityType,
      entityId,
      entityCode,
      description: inferDescription(payload, entityType, entityCode),
      meta: sanitizeAuditData(metaData) as object,
      beforeData: sanitizeAuditData(payload.beforeData) as object,
      afterData: sanitizeAuditData(payload.afterData) as object,
      changedFields: sanitizeAuditData(changedFields) as object,
      metadata: sanitizeAuditData(payload.metadata ?? metaData) as object,
      ipAddress: payload.ipAddress,
      userAgent: normalizeUserAgent(payload.userAgent),
    });
  } catch (err) {
    logger.warn('[AuditLog] Failed to write audit log entry', {
      error: err,
      payload: sanitizeAuditData(payload),
    });
  }
}

/**
 * Helper to create audit log from Express request.
 * Automatically handles impersonation tracking.
 */
export async function logAuditFromRequest(
  req: any,
  action: AuditActionValue,
  resource: string,
  resourceId: string,
  meta?: JsonRecord,
  options?: Partial<AuditLogPayload>,
): Promise<void> {
  const userId = req.originalUser?.userId || req.user?.userId;
  const branchId = options?.branchId ?? req.user?.branchId ?? null;

  const impersonating = req.isImpersonating ? {
    email: req.user.email,
    role: req.user.role,
    note: `Action performed as ${req.user.email}`,
  } : undefined;

  await logAudit({
    userId,
    branchId,
    action,
    resource,
    resourceId,
    meta,
    ipAddress: req.ip,
    userAgent: req.headers?.['user-agent'],
    impersonating,
    ...options,
  });
}
