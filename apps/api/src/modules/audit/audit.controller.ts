import { Request, Response, NextFunction } from 'express';
import { prisma } from '@lib/prisma';
import { sendSuccess, buildPaginationMeta } from '@utils/response';
import { errors } from '@middleware/errorHandler';
import {
  assertBranchAccess,
  assertPermission,
  getAccessibleBranchIds,
  hasPermission,
} from '@modules/iam/authorization.service';
import { PERMISSIONS, PermissionCode } from '@modules/iam/permission-catalog';
import { Prisma } from '@prisma/client';

type AuditWhere = Record<string, unknown>;

const auditInclude = {
  user: {
    select: {
      id: true,
      email: true,
      staffCode: true,
      role: true,
      profile: { select: { fullName: true } },
    },
  },
  branch: {
    select: { id: true, name: true, branchCode: true },
  },
} satisfies Prisma.AuditLogInclude;

type AuditLogRecord = Prisma.AuditLogGetPayload<{ include: typeof auditInclude }>;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const EXPORT_LIMIT = 5000;

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
  Inventory: 'INVENTORY',
  InternalTransferLedger: 'INVENTORY',
  InventoryItem: 'INVENTORY',
  StockMutation: 'INVENTORY',
  Overstock: 'INVENTORY',
  Referral: 'REFERRAL',
  ReferralCode: 'REFERRAL',
  File: 'UPLOAD_DOCUMENT',
  Upload: 'UPLOAD_DOCUMENT',
};

function parsePositiveNumber(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function parseDateFilter(value: unknown, endOfDay = false): Date | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay && !value.includes('T')) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function getStringQuery(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function appendAndFilter(where: AuditWhere, filter: Record<string, unknown>): void {
  const filters = Array.isArray(where.AND) ? [...where.AND] : [];
  if (where.OR) {
    filters.push({ OR: where.OR });
    delete where.OR;
  }
  filters.push(filter);
  where.AND = filters;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function auditSnapshots(log: AuditLogRecord) {
  const meta = asRecord(log.meta);
  return {
    meta,
    actor: asRecord(meta.actorSnapshot),
    branch: asRecord(meta.branchSnapshot),
  };
}

export async function buildAuditWhere(req: Request, permission: PermissionCode = PERMISSIONS.AUDIT_READ): Promise<AuditWhere> {
  const where: AuditWhere = {};
  const branchId = getStringQuery(req.query.branchId);
  const accessibleBranchIds = await getAccessibleBranchIds(req.user.userId);
  if (branchId) {
    await assertBranchAccess(req.user.userId, branchId);
    await assertPermission(req.user.userId, permission, branchId);
    where.branchId = branchId;
  } else {
    const candidates = accessibleBranchIds === null
      ? (await prisma.branch.findMany({ where: { isActive: true }, select: { id: true } })).map((branch) => branch.id)
      : accessibleBranchIds;
    const permittedBranches = (await Promise.all(candidates.map(async (candidate) =>
      (await hasPermission(req.user.userId, permission, candidate)) ? candidate : null
    ))).filter(Boolean);
    if (accessibleBranchIds === null && await hasPermission(req.user.userId, permission)) {
      if (permittedBranches.length !== candidates.length) where.branchId = { in: permittedBranches };
    } else {
      where.branchId = { in: permittedBranches };
    }
  }

  const action = getStringQuery(req.query.action);
  if (action) where.action = action;

  const module = getStringQuery(req.query.module);
  if (module) where.module = module;

  const resource = getStringQuery(req.query.resource);
  if (resource) where.resource = resource;

  const userId = getStringQuery(req.query.userId);
  if (userId) where.userId = userId;

  const roleFilter = getStringQuery(req.query.role);
  if (roleFilter) {
    appendAndFilter(where, {
      OR: [
        { userRole: roleFilter },
        { user: { role: roleFilter } },
      ],
    });
  }

  const actor = getStringQuery(req.query.actor);
  if (actor) {
    appendAndFilter(where, {
      OR: [
        { userName: { contains: actor, mode: 'insensitive' } },
        { user: { email: { contains: actor, mode: 'insensitive' } } },
        { user: { profile: { fullName: { contains: actor, mode: 'insensitive' } } } },
        { meta: { path: ['actorSnapshot', 'email'], string_contains: actor } },
        { meta: { path: ['actorSnapshot', 'fullName'], string_contains: actor } },
      ],
    });
  }

  const startDate = parseDateFilter(req.query.startDate);
  const endDate = parseDateFilter(req.query.endDate, true);
  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    };
  }

  const search = getStringQuery(req.query.search);
  if (search) {
    const searchFilter = {
      OR: [
        { description: { contains: search, mode: 'insensitive' } },
        { module: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { resourceId: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { entityCode: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { profile: { fullName: { contains: search, mode: 'insensitive' } } } },
        { branchName: { contains: search, mode: 'insensitive' } },
        { branch: { name: { contains: search, mode: 'insensitive' } } },
      ],
    };

    appendAndFilter(where, searchFilter);
  }

  return where;
}

function resolveModule(log: AuditLogRecord): string {
  return log.module || RESOURCE_MODULE_MAP[log.resource] || 'SYSTEM';
}

function resolveUserName(log: AuditLogRecord): string | null {
  const { actor } = auditSnapshots(log);
  return (
    log.userName ||
    log.user?.profile?.fullName ||
    log.user?.email ||
    optionalString(actor.fullName) ||
    optionalString(actor.email) ||
    null
  );
}

function resolveUserRole(log: AuditLogRecord): string | null {
  const { actor } = auditSnapshots(log);
  return log.userRole || log.user?.role || optionalString(actor.role) || null;
}

function resolveBranchName(log: AuditLogRecord): string | null {
  const { branch } = auditSnapshots(log);
  return log.branchName || log.branch?.name || optionalString(branch.branchName) || null;
}

function resolveEntityCode(log: AuditLogRecord): string | null {
  const { meta } = auditSnapshots(log);
  return (
    log.entityCode ||
    optionalString(meta.entityCode) ||
    optionalString(meta.sessionCode) ||
    optionalString(meta.memberNo) ||
    optionalString(meta.invoiceNo) ||
    optionalString(meta.shipmentCode) ||
    optionalString(meta.requestCode) ||
    null
  );
}

function formatAuditLog(log: AuditLogRecord) {
  const { actor, branch: branchSnapshot } = auditSnapshots(log);
  const entityType = log.entityType || log.resource || 'System';
  const entityId = log.entityId || log.resourceId || null;
  const entityCode = resolveEntityCode(log);

  return {
    id: log.id,
    createdAt: log.createdAt,
    userId: log.userId,
    userName: resolveUserName(log),
    userEmail: log.user?.email || optionalString(actor.email) || null,
    userRole: resolveUserRole(log),
    branchId: log.branchId,
    branchName: resolveBranchName(log),
    branchCode: log.branch?.branchCode || optionalString(branchSnapshot.branchCode) || null,
    action: log.action,
    module: resolveModule(log),
    entityType,
    entityId,
    entityCode,
    resource: log.resource,
    resourceId: log.resourceId,
    description: log.description || `${log.action} ${entityType}${entityCode ? ` (${entityCode})` : ''}`,
    beforeData: log.beforeData || null,
    afterData: log.afterData || null,
    changedFields: log.changedFields || [],
    metadata: log.metadata || log.meta || null,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    user: log.user
      ? {
          id: log.user.id,
          email: log.user.email,
          role: log.user.role,
          staffCode: log.user.staffCode,
          fullName: log.user.profile?.fullName || log.user.email,
        }
      : null,
    branch: log.branch
      ? {
          id: log.branch.id,
          name: log.branch.name,
          branchCode: log.branch.branchCode,
        }
      : null,
  };
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const stringValue = value instanceof Date ? value.toISOString() : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function buildCsv(logs: ReturnType<typeof formatAuditLog>[]): string {
  const headers = [
    'Waktu',
    'User',
    'Email',
    'Role',
    'Cabang',
    'Action',
    'Modul',
    'Entity',
    'Kode/ID',
    'Deskripsi',
    'IP Address',
    'User Agent',
  ];

  const rows = logs.map((log) => [
    log.createdAt,
    log.userName,
    log.userEmail,
    log.userRole,
    log.branchName,
    log.action,
    log.module,
    log.entityType,
    log.entityCode || log.entityId,
    log.description,
    log.ipAddress,
    log.userAgent,
  ]);

  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

async function findLogByIdForRole(req: Request, id: string) {
  const baseWhere = await buildAuditWhere(req);
  return prisma.auditLog.findFirst({
    where: {
      AND: [
        { id },
        baseWhere,
      ] as Prisma.AuditLogWhereInput[],
    },
    include: auditInclude,
  });
}

export async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parsePositiveNumber(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveNumber(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const where = await buildAuditWhere(req);

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where: where as Prisma.AuditLogWhereInput }),
      prisma.auditLog.findMany({
        where: where as Prisma.AuditLogWhereInput,
        include: auditInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const pagination = buildPaginationMeta(total, page, limit);
    sendSuccess(res, {
      logs: logs.map(formatAuditLog),
      pagination,
    }, 200, pagination);
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const log = await findLogByIdForRole(req, req.params.id);
    if (!log) throw errors.notFound('Audit log tidak ditemukan.');
    sendSuccess(res, formatAuditLog(log));
  } catch (err) {
    next(err);
  }
}

export async function exportAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const where = await buildAuditWhere(req, PERMISSIONS.AUDIT_EXPORT);
    const logs = await prisma.auditLog.findMany({
      where: where as Prisma.AuditLogWhereInput,
      include: auditInclude,
      orderBy: { createdAt: 'desc' },
      take: EXPORT_LIMIT,
    });

    const csv = buildCsv(logs.map(formatAuditLog));
    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${timestamp}.csv"`);
    res.status(200).send(`\uFEFF${csv}`);
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const where = await buildAuditWhere(req);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const statsWhere = {
      AND: [
        where,
        { createdAt: { gte: thirtyDaysAgo } },
      ],
    };

    const [totalActions, actionsByType, modulesByType, topUsers] = await Promise.all([
      prisma.auditLog.count({ where: statsWhere as Prisma.AuditLogWhereInput }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where: statsWhere as Prisma.AuditLogWhereInput,
        _count: { action: true },
      }),
      prisma.auditLog.groupBy({
        by: ['module'],
        where: statsWhere as Prisma.AuditLogWhereInput,
        _count: { module: true },
      }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: statsWhere as Prisma.AuditLogWhereInput,
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),
    ]);

    const userIds = topUsers.map((item: { userId: string | null }) => item.userId).filter(Boolean) as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        staffCode: true,
        role: true,
        profile: {
          select: { fullName: true },
        },
      },
    });

    sendSuccess(res, {
      totalActions,
      actionsByType: actionsByType.map((item) => ({
        action: item.action,
        count: item._count.action,
      })),
      modulesByType: modulesByType
        .filter((item) => item.module)
        .map((item) => ({
          module: item.module,
          count: item._count.module,
        })),
      topUsers: topUsers.map((item) => {
        const user = users.find((candidate) => candidate.id === item.userId);
        return {
          userId: item.userId,
          staffCode: user?.staffCode || null,
          fullName: user?.profile?.fullName || user?.email || null,
          role: user?.role || null,
          actionCount: item._count.userId,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
}
