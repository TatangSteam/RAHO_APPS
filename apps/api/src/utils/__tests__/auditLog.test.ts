import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuditAction, Role } from '@prisma/client';
import { logAudit, logAuditFromRequest, AuditLogPayload } from '../auditLog';
import { prisma } from '@lib/prisma';
import { logger } from '@lib/logger';

// Mock Prisma client
jest.mock('@lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('@lib/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

describe('Audit Log - Nested Impersonation', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('logAudit - Basic Functionality', () => {
    it('should create audit log without impersonation', async () => {
      const payload: AuditLogPayload = {
        userId: 'user-123',
        branchId: 'branch-456',
        action: AuditAction.CREATE,
        resource: 'Member',
        resourceId: 'member-789',
        meta: { name: 'John Doe' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          branchId: 'branch-456',
          action: AuditAction.CREATE,
          resource: 'Member',
          resourceId: 'member-789',
          meta: { name: 'John Doe' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      });
    });

    it('should handle null branchId', async () => {
      const payload: AuditLogPayload = {
        userId: 'super-admin-123',
        branchId: null,
        action: AuditAction.CREATE,
        resource: 'AdminManager',
        resourceId: 'manager-456',
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          branchId: null,
        }),
      });
    });

    it('should handle missing optional fields', async () => {
      const payload: AuditLogPayload = {
        userId: 'user-123',
        action: AuditAction.UPDATE,
        resource: 'Member',
        resourceId: 'member-456',
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          action: AuditAction.UPDATE,
          resource: 'Member',
          resourceId: 'member-456',
          branchId: null,
          meta: {},
          ipAddress: undefined,
          userAgent: undefined,
        }),
      });
    });
  });

  describe('logAudit - Single Level Impersonation', () => {
    it('should add impersonation metadata for Super Admin → Admin Manager', async () => {
      const payload: AuditLogPayload = {
        userId: 'super-admin-123',
        branchId: null,
        action: AuditAction.CREATE,
        resource: 'Member',
        resourceId: 'member-789',
        meta: { memberName: 'Jane Doe' },
        impersonating: {
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
        },
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'super-admin-123',
          branchId: null,
          action: AuditAction.CREATE,
          resource: 'Member',
          resourceId: 'member-789',
          meta: {
            memberName: 'Jane Doe',
            impersonating: 'manager@raho.id',
            impersonatedRole: 'ADMIN_MANAGER',
            note: 'Action performed as manager@raho.id',
          },
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it('should add impersonation metadata for Admin Manager → Admin Cabang', async () => {
      const payload: AuditLogPayload = {
        userId: 'manager-123',
        branchId: 'branch-456',
        action: AuditAction.UPDATE,
        resource: 'Session',
        resourceId: 'session-789',
        impersonating: {
          email: 'admincabang@raho.id',
          role: 'ADMIN_CABANG',
        },
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'manager-123',
          branchId: 'branch-456',
          meta: {
            impersonating: 'admincabang@raho.id',
            impersonatedRole: 'ADMIN_CABANG',
            note: 'Action performed as admincabang@raho.id',
          },
        }),
      });
    });

    it('should use custom note if provided', async () => {
      const payload: AuditLogPayload = {
        userId: 'super-admin-123',
        action: AuditAction.DELETE,
        resource: 'Member',
        resourceId: 'member-999',
        impersonating: {
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          note: 'Custom action note',
        },
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          meta: expect.objectContaining({
            note: 'Custom action note',
          }),
        }),
      });
    });

    it('should preserve existing meta fields when adding impersonation', async () => {
      const payload: AuditLogPayload = {
        userId: 'super-admin-123',
        action: AuditAction.CREATE,
        resource: 'Invoice',
        resourceId: 'invoice-123',
        meta: {
          amount: 500000,
          currency: 'IDR',
          paymentMethod: 'TRANSFER',
        },
        impersonating: {
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
        },
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          meta: {
            amount: 500000,
            currency: 'IDR',
            paymentMethod: 'TRANSFER',
            impersonating: 'manager@raho.id',
            impersonatedRole: 'ADMIN_MANAGER',
            note: 'Action performed as manager@raho.id',
          },
        }),
      });
    });
  });

  describe('logAudit - Nested Impersonation (Super Admin → Admin Manager → Admin Cabang)', () => {
    it('should track nested impersonation in audit log', async () => {
      const payload: AuditLogPayload = {
        userId: 'super-admin-123',
        branchId: 'branch-456',
        action: AuditAction.CREATE,
        resource: 'TherapySession',
        resourceId: 'session-789',
        meta: {
          patientId: 'patient-123',
          therapyType: 'INFUSION',
        },
        impersonating: {
          email: 'admincabang@raho.id',
          role: 'ADMIN_CABANG',
          note: 'Nested impersonation: Super Admin → Admin Manager → Admin Cabang',
        },
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'super-admin-123',
          branchId: 'branch-456',
          action: AuditAction.CREATE,
          resource: 'TherapySession',
          resourceId: 'session-789',
          meta: {
            patientId: 'patient-123',
            therapyType: 'INFUSION',
            impersonating: 'admincabang@raho.id',
            impersonatedRole: 'ADMIN_CABANG',
            note: 'Nested impersonation: Super Admin → Admin Manager → Admin Cabang',
          },
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it('should log with deepest impersonated user email', async () => {
      const payload: AuditLogPayload = {
        userId: 'super-admin-123',
        action: AuditAction.UPDATE,
        resource: 'Inventory',
        resourceId: 'item-456',
        impersonating: {
          email: 'admincabang.jakarta@raho.id',
          role: 'ADMIN_CABANG',
        },
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'super-admin-123', // Original user
          meta: expect.objectContaining({
            impersonating: 'admincabang.jakarta@raho.id', // Deepest impersonated user
            impersonatedRole: 'ADMIN_CABANG',
          }),
        }),
      });
    });
  });

  describe('logAuditFromRequest - Request Integration', () => {
    it('should create audit log from request without impersonation', async () => {
      const mockRequest = {
        user: {
          userId: 'user-123',
          email: 'user@raho.id',
          role: Role.ADMIN_CABANG,
          branchId: 'branch-456',
        },
        isImpersonating: false,
        ip: '192.168.1.100',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      } as any;

      await logAuditFromRequest(
        mockRequest,
        AuditAction.CREATE,
        'Member',
        'member-789',
        { memberName: 'Test Member' }
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          branchId: 'branch-456',
          action: AuditAction.CREATE,
          resource: 'Member',
          resourceId: 'member-789',
          meta: { memberName: 'Test Member' },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });
    });

    it('should create audit log from request with single level impersonation', async () => {
      const mockRequest = {
        originalUser: {
          userId: 'super-admin-123',
          email: 'superadmin@raho.id',
          role: Role.SUPER_ADMIN,
        },
        user: {
          userId: 'manager-456',
          email: 'manager@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
          branches: ['branch-1', 'branch-2'],
        },
        isImpersonating: true,
        ip: '10.0.0.1',
        headers: {
          'user-agent': 'Chrome/120.0',
        },
      } as any;

      await logAuditFromRequest(
        mockRequest,
        AuditAction.UPDATE,
        'Branch',
        'branch-1'
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'super-admin-123', // Original user
          branchId: null,
          action: AuditAction.UPDATE,
          resource: 'Branch',
          resourceId: 'branch-1',
          meta: {
            impersonating: 'manager@raho.id',
            impersonatedRole: Role.ADMIN_MANAGER,
            note: 'Action performed as manager@raho.id',
          },
          ipAddress: '10.0.0.1',
          userAgent: 'Chrome/120.0',
        },
      });
    });

    it('should create audit log from request with nested impersonation', async () => {
      const mockRequest = {
        originalUser: {
          userId: 'super-admin-123',
          email: 'superadmin@raho.id',
          role: Role.SUPER_ADMIN,
        },
        user: {
          userId: 'admin-cabang-789',
          email: 'admincabang@raho.id',
          role: Role.ADMIN_CABANG,
          branchId: 'branch-1',
        },
        isImpersonating: true,
        impersonationChain: ['superadmin@raho.id', 'manager@raho.id', 'admincabang@raho.id'],
        ip: '172.16.0.1',
        headers: {
          'user-agent': 'Safari/17.0',
        },
      } as any;

      await logAuditFromRequest(
        mockRequest,
        AuditAction.CREATE,
        'TherapySession',
        'session-999',
        { sessionType: 'INFUSION' }
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'super-admin-123', // Root user
          branchId: 'branch-1', // Deepest impersonated user's branch
          action: AuditAction.CREATE,
          resource: 'TherapySession',
          resourceId: 'session-999',
          meta: {
            sessionType: 'INFUSION',
            impersonating: 'admincabang@raho.id', // Deepest impersonated user
            impersonatedRole: Role.ADMIN_CABANG,
            note: 'Action performed as admincabang@raho.id',
          },
          ipAddress: '172.16.0.1',
          userAgent: 'Safari/17.0',
        },
      });
    });

    it('should handle request without originalUser when not impersonating', async () => {
      const mockRequest = {
        user: {
          userId: 'user-123',
          email: 'user@raho.id',
          role: Role.DOCTOR,
          branchId: 'branch-456',
        },
        isImpersonating: false,
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Firefox/120.0',
        },
      } as any;

      await logAuditFromRequest(
        mockRequest,
        AuditAction.VERIFY,
        'MedicalRecord',
        'record-123'
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          branchId: 'branch-456',
        }),
      });
    });

    it('should handle missing IP address and user agent', async () => {
      const mockRequest = {
        user: {
          userId: 'user-123',
          branchId: 'branch-456',
        },
        isImpersonating: false,
        headers: {},
      } as any;

      await logAuditFromRequest(
        mockRequest,
        AuditAction.DELETE,
        'Member',
        'member-456'
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: undefined,
          userAgent: undefined,
        }),
      });
    });
  });

  describe('Error Handling', () => {
    it('should not throw error when audit log creation fails', async () => {
      const mockError = new Error('Database connection failed');
      (prisma.auditLog.create as any).mockRejectedValueOnce(mockError);

      const payload: AuditLogPayload = {
        userId: 'user-123',
        action: AuditAction.CREATE,
        resource: 'Member',
        resourceId: 'member-456',
      };

      // Should not throw
      await expect(logAudit(payload)).resolves.toBeUndefined();

      // Should log warning
      expect(logger.warn).toHaveBeenCalledWith(
        '[AuditLog] Failed to write audit log entry',
        expect.objectContaining({
          error: mockError,
          payload,
        })
      );
    });

    it('should handle Prisma errors gracefully', async () => {
      const prismaError = new Error('Unique constraint violation');
      (prisma.auditLog.create as any).mockRejectedValueOnce(prismaError);

      const payload: AuditLogPayload = {
        userId: 'user-123',
        action: AuditAction.UPDATE,
        resource: 'Branch',
        resourceId: 'branch-456',
        impersonating: {
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
        },
      };

      await logAudit(payload);

      expect(logger.warn).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout');
      (prisma.auditLog.create as any).mockRejectedValueOnce(networkError);

      const mockRequest = {
        originalUser: {
          userId: 'super-admin-123',
        },
        user: {
          userId: 'manager-456',
          email: 'manager@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
        },
        isImpersonating: true,
        ip: '10.0.0.1',
        headers: {
          'user-agent': 'Test Agent',
        },
      } as any;

      await logAuditFromRequest(
        mockRequest,
        AuditAction.CREATE,
        'Member',
        'member-789'
      );

      expect(logger.warn).toHaveBeenCalledWith(
        '[AuditLog] Failed to write audit log entry',
        expect.any(Object)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty meta object', async () => {
      const payload: AuditLogPayload = {
        userId: 'user-123',
        action: AuditAction.CREATE,
        resource: 'Member',
        resourceId: 'member-456',
        meta: {},
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          meta: {},
        }),
      });
    });

    it('should handle complex meta objects with nested data', async () => {
      const payload: AuditLogPayload = {
        userId: 'user-123',
        action: AuditAction.UPDATE,
        resource: 'Session',
        resourceId: 'session-456',
        meta: {
          vitalSigns: {
            bloodPressure: '120/80',
            heartRate: 72,
            temperature: 36.5,
          },
          medications: ['Med A', 'Med B'],
          notes: 'Patient doing well',
        },
        impersonating: {
          email: 'doctor@raho.id',
          role: 'DOCTOR',
        },
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          meta: expect.objectContaining({
            vitalSigns: expect.any(Object),
            medications: expect.any(Array),
            notes: expect.any(String),
            impersonating: 'doctor@raho.id',
          }),
        }),
      });
    });

    it('should handle special characters in email addresses', async () => {
      const payload: AuditLogPayload = {
        userId: 'user-123',
        action: AuditAction.CREATE,
        resource: 'Member',
        resourceId: 'member-456',
        impersonating: {
          email: 'admin.test+impersonate@raho.id',
          role: 'ADMIN_MANAGER',
        },
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          meta: expect.objectContaining({
            impersonating: 'admin.test+impersonate@raho.id',
          }),
        }),
      });
    });

    it('should handle very long resource IDs', async () => {
      const longResourceId = 'a'.repeat(500);
      const payload: AuditLogPayload = {
        userId: 'user-123',
        action: AuditAction.DELETE,
        resource: 'Document',
        resourceId: longResourceId,
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          resourceId: longResourceId,
        }),
      });
    });

    it('should handle all AuditAction types', async () => {
      const actions = [
        AuditAction.CREATE,
        AuditAction.UPDATE,
        AuditAction.DELETE,
        AuditAction.VERIFY,
        AuditAction.LOGIN,
        AuditAction.LOGOUT,
      ];

      for (const action of actions) {
        jest.clearAllMocks();

        const payload: AuditLogPayload = {
          userId: 'user-123',
          action,
          resource: 'TestResource',
          resourceId: 'resource-123',
        };

        await logAudit(payload);

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action,
          }),
        });
      }
    });
  });

  describe('Impersonation Chain Tracking', () => {
    it('should track full impersonation chain in meta', async () => {
      const payload: AuditLogPayload = {
        userId: 'super-admin-123',
        action: AuditAction.CREATE,
        resource: 'Member',
        resourceId: 'member-789',
        meta: {
          impersonationChain: [
            'superadmin@raho.id',
            'manager@raho.id',
            'admincabang@raho.id',
          ],
        },
        impersonating: {
          email: 'admincabang@raho.id',
          role: 'ADMIN_CABANG',
        },
      };

      await logAudit(payload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          meta: expect.objectContaining({
            impersonationChain: [
              'superadmin@raho.id',
              'manager@raho.id',
              'admincabang@raho.id',
            ],
            impersonating: 'admincabang@raho.id',
          }),
        }),
      });
    });

    it('should differentiate between direct and nested impersonation', async () => {
      // Direct impersonation (Admin Manager → Admin Cabang)
      const directPayload: AuditLogPayload = {
        userId: 'manager-123',
        action: AuditAction.UPDATE,
        resource: 'Session',
        resourceId: 'session-456',
        meta: {
          impersonationType: 'direct',
        },
        impersonating: {
          email: 'admincabang@raho.id',
          role: 'ADMIN_CABANG',
        },
      };

      await logAudit(directPayload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'manager-123',
          meta: expect.objectContaining({
            impersonationType: 'direct',
            impersonating: 'admincabang@raho.id',
          }),
        }),
      });

      jest.clearAllMocks();

      // Nested impersonation (Super Admin → Admin Manager → Admin Cabang)
      const nestedPayload: AuditLogPayload = {
        userId: 'super-admin-123',
        action: AuditAction.UPDATE,
        resource: 'Session',
        resourceId: 'session-456',
        meta: {
          impersonationType: 'nested',
        },
        impersonating: {
          email: 'admincabang@raho.id',
          role: 'ADMIN_CABANG',
        },
      };

      await logAudit(nestedPayload);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'super-admin-123',
          meta: expect.objectContaining({
            impersonationType: 'nested',
            impersonating: 'admincabang@raho.id',
          }),
        }),
      });
    });
  });
});
