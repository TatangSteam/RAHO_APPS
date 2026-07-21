import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuditAction, Prisma, Role } from '@prisma/client';
import { buildChangedFields, logAudit, logAuditFromRequest, sanitizeAuditData } from '../auditLog';
import { prisma } from '@lib/prisma';
import { logger } from '@lib/logger';

jest.mock('@lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    branch: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@lib/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

const mockPrisma = prisma as any;

describe('auditLog utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.branch.findUnique.mockResolvedValue(null);
  });

  it('creates an enriched audit log with actor and branch snapshots', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'admin@raho.id',
      role: Role.ADMIN_CABANG,
      staffCode: 'AC-001',
      branchId: 'branch-456',
      profile: { fullName: 'Admin Cabang' },
      branch: { branchCode: 'PST' },
    });
    mockPrisma.branch.findUnique.mockResolvedValue({
      id: 'branch-456',
      name: 'RAHO Pusat',
      branchCode: 'PST',
    });

    await logAudit({
      userId: 'user-123',
      action: AuditAction.CREATE,
      resource: 'Member',
      resourceId: 'member-789',
      entityCode: 'MBR-001',
      meta: { source: 'test' },
      ipAddress: '127.0.0.1',
      userAgent: ['Playwright', 'Chrome'],
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-123',
        userName: 'Admin Cabang',
        userRole: Role.ADMIN_CABANG,
        branchId: 'branch-456',
        branchName: 'RAHO Pusat',
        action: AuditAction.CREATE,
        module: 'MEMBER',
        resource: 'Member',
        resourceId: 'member-789',
        entityType: 'Member',
        entityId: 'member-789',
        entityCode: 'MBR-001',
        ipAddress: '127.0.0.1',
        userAgent: 'Playwright, Chrome',
      }),
    });

    const data = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(data.meta).toMatchObject({
      source: 'test',
      actorSnapshot: {
        userId: 'user-123',
        userName: 'Admin Cabang',
        userRole: Role.ADMIN_CABANG,
        branchCode: 'PST',
      },
      branchSnapshot: {
        branchId: 'branch-456',
        branchName: 'RAHO Pusat',
        branchCode: 'PST',
      },
    });
  });

  it('adds impersonation details from request context', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'super-admin-1',
      email: 'superadmin@raho.id',
      role: Role.SUPER_ADMIN,
      staffCode: null,
      branchId: null,
      profile: { fullName: 'Super Admin' },
      branch: null,
    });

    const request = {
      originalUser: { userId: 'super-admin-1' },
      user: {
        userId: 'manager-1',
        email: 'manager@raho.id',
        role: Role.ADMIN_MANAGER,
        branchId: null,
      },
      isImpersonating: true,
      ip: '10.0.0.1',
      headers: { 'user-agent': 'Chrome/120' },
    } as any;

    await logAuditFromRequest(request, AuditAction.UPDATE, 'Branch', 'branch-1');

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'super-admin-1',
        branchId: null,
        action: AuditAction.UPDATE,
        resource: 'Branch',
        resourceId: 'branch-1',
        ipAddress: '10.0.0.1',
        userAgent: 'Chrome/120',
      }),
    });
    expect(mockPrisma.auditLog.create.mock.calls[0][0].data.meta).toMatchObject({
      impersonating: 'manager@raho.id',
      impersonatedRole: Role.ADMIN_MANAGER,
      note: 'Action performed as manager@raho.id',
    });
  });

  it('retries with legacy audit-log fields when generated Prisma client is stale', async () => {
    const staleClientError = new Error('Unknown argument `userName`. Available options are marked with ?.');
    mockPrisma.auditLog.create
      .mockRejectedValueOnce(staleClientError)
      .mockResolvedValueOnce({});
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'admin@raho.id',
      role: Role.ADMIN_CABANG,
      staffCode: 'AC-001',
      branchId: 'branch-456',
      profile: { fullName: 'Admin Cabang' },
      branch: { branchCode: 'PST' },
    });

    await logAudit({
      userId: 'user-123',
      branchId: 'branch-456',
      action: AuditAction.LOGIN,
      resource: 'Auth',
      resourceId: 'user-123',
      meta: { email: 'admin@raho.id' },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.auditLog.create).toHaveBeenNthCalledWith(2, {
      data: {
        userId: 'user-123',
        branchId: 'branch-456',
        action: AuditAction.LOGIN,
        resource: 'Auth',
        resourceId: 'user-123',
        meta: expect.objectContaining({
          email: 'admin@raho.id',
          actorSnapshot: expect.any(Object),
          branchSnapshot: expect.any(Object),
        }),
        ipAddress: undefined,
        userAgent: undefined,
      },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('keeps audit logging non-blocking when create fails', async () => {
    const createError = new Error('Database connection failed');
    mockPrisma.auditLog.create.mockRejectedValueOnce(createError);

    await expect(logAudit({
      userId: 'user-123',
      action: AuditAction.DELETE,
      resource: 'Member',
      resourceId: 'member-123',
    })).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      '[AuditLog] Failed to write audit log entry',
      expect.objectContaining({
        error: createError,
        payload: expect.objectContaining({
          userId: 'user-123',
          action: AuditAction.DELETE,
          resource: 'Member',
        }),
      }),
    );
  });

  it('sanitizes sensitive values and detects changed fields', () => {
    expect(sanitizeAuditData({
      email: 'admin@raho.id',
      password: 'secret',
      nested: { accessToken: 'token-value' },
      fileBuffer: Buffer.from('abc'),
    })).toEqual({
      email: 'admin@raho.id',
      password: '[REDACTED]',
      nested: { accessToken: '[REDACTED]' },
      fileBuffer: '[REDACTED]',
    });

    expect(buildChangedFields(
      { name: 'Before', password: 'old', age: 20 },
      { name: 'After', password: 'new', age: 20 },
    )).toEqual([
      { field: 'name', before: 'Before', after: 'After' },
    ]);
  });

  it('serializes Prisma Decimal values through toJSON', () => {
    expect(sanitizeAuditData({ totalCost: new Prisma.Decimal('123.4500') })).toEqual({
      totalCost: '123.45',
    });
  });
});
