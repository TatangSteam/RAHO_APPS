import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  JwtPayload,
} from '../jwt';
import { Role } from '@prisma/client';

describe('JWT Token Generation with Nested Impersonation', () => {
  // Set up test environment variables
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-32-chars-long-minimum';
    process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-32-chars-long-minimum';
    process.env.JWT_ACCESS_EXPIRES = '15m';
    process.env.JWT_REFRESH_EXPIRES = '7d';
  });

  describe('Normal Token Generation (No Impersonation)', () => {
    it('should generate a valid access token for Super Admin', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
      };

      const token = signAccessToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.branchId).toBeNull();
      expect(decoded.impersonating).toBeUndefined();
    });

    it('should generate a valid access token for Admin Manager', () => {
      const payload: JwtPayload = {
        userId: 'manager-uuid',
        email: 'manager@raho.id',
        role: Role.ADMIN_MANAGER,
        branchId: null,
        branchCode: null,
        fullName: 'Admin Manager',
        staffCode: 'MGR001',
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(Role.ADMIN_MANAGER);
      expect(decoded.impersonating).toBeUndefined();
    });

    it('should generate a valid access token for Admin Cabang', () => {
      const payload: JwtPayload = {
        userId: 'admin-cabang-uuid',
        email: 'admincabang@raho.id',
        role: Role.ADMIN_CABANG,
        branchId: 'branch-uuid-1',
        branchCode: 'PST',
        fullName: 'Admin Cabang Jakarta',
        staffCode: 'AC001',
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(Role.ADMIN_CABANG);
      expect(decoded.branchId).toBe('branch-uuid-1');
      expect(decoded.branchCode).toBe('PST');
      expect(decoded.impersonating).toBeUndefined();
    });
  });

  describe('Single Level Impersonation (Super Admin → Admin Manager)', () => {
    it('should generate token with impersonation data for Admin Manager', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-uuid',
          email: 'manager@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
          branches: ['branch-uuid-1', 'branch-uuid-2'],
        },
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      // Verify original user data
      expect(decoded.userId).toBe('super-admin-uuid');
      expect(decoded.email).toBe('superadmin@raho.id');
      expect(decoded.role).toBe(Role.SUPER_ADMIN);

      // Verify impersonation data
      expect(decoded.impersonating).toBeDefined();
      expect(decoded.impersonating?.userId).toBe('manager-uuid');
      expect(decoded.impersonating?.email).toBe('manager@raho.id');
      expect(decoded.impersonating?.role).toBe(Role.ADMIN_MANAGER);
      expect(decoded.impersonating?.branches).toEqual(['branch-uuid-1', 'branch-uuid-2']);
      expect(decoded.impersonating?.branchId).toBeNull();
    });

    it('should preserve all impersonation fields in token', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-uuid-123',
          email: 'manager.test@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
          branches: ['branch-a', 'branch-b', 'branch-c'],
        },
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.impersonating?.branches).toHaveLength(3);
      expect(decoded.impersonating?.branches).toContain('branch-a');
      expect(decoded.impersonating?.branches).toContain('branch-b');
      expect(decoded.impersonating?.branches).toContain('branch-c');
    });
  });

  describe('Single Level Impersonation (Admin Manager → Admin Cabang)', () => {
    it('should generate token with impersonation data for Admin Cabang', () => {
      const payload: JwtPayload = {
        userId: 'manager-uuid',
        email: 'manager@raho.id',
        role: Role.ADMIN_MANAGER,
        branchId: null,
        branchCode: null,
        fullName: 'Admin Manager',
        staffCode: 'MGR001',
        impersonating: {
          userId: 'admin-cabang-uuid',
          email: 'admincabang@raho.id',
          role: Role.ADMIN_CABANG,
          branchId: 'branch-uuid-1',
          branches: undefined,
        },
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      // Verify original user data (Admin Manager)
      expect(decoded.userId).toBe('manager-uuid');
      expect(decoded.email).toBe('manager@raho.id');
      expect(decoded.role).toBe(Role.ADMIN_MANAGER);

      // Verify impersonation data (Admin Cabang)
      expect(decoded.impersonating).toBeDefined();
      expect(decoded.impersonating?.userId).toBe('admin-cabang-uuid');
      expect(decoded.impersonating?.email).toBe('admincabang@raho.id');
      expect(decoded.impersonating?.role).toBe(Role.ADMIN_CABANG);
      expect(decoded.impersonating?.branchId).toBe('branch-uuid-1');
      expect(decoded.impersonating?.branches).toBeUndefined();
    });
  });

  describe('Nested Impersonation (Super Admin → Admin Manager → Admin Cabang)', () => {
    it('should generate token with nested impersonation data', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-uuid',
          email: 'manager@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
          branches: ['branch-uuid-1', 'branch-uuid-2'],
          impersonating: {
            userId: 'admin-cabang-uuid',
            email: 'admincabang@raho.id',
            role: Role.ADMIN_CABANG,
            branchId: 'branch-uuid-1',
            branches: undefined,
          },
        },
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      // Verify root user (Super Admin)
      expect(decoded.userId).toBe('super-admin-uuid');
      expect(decoded.email).toBe('superadmin@raho.id');
      expect(decoded.role).toBe(Role.SUPER_ADMIN);

      // Verify first level impersonation (Admin Manager)
      expect(decoded.impersonating).toBeDefined();
      expect(decoded.impersonating?.userId).toBe('manager-uuid');
      expect(decoded.impersonating?.email).toBe('manager@raho.id');
      expect(decoded.impersonating?.role).toBe(Role.ADMIN_MANAGER);
      expect(decoded.impersonating?.branches).toEqual(['branch-uuid-1', 'branch-uuid-2']);

      // Verify nested impersonation (Admin Cabang)
      expect(decoded.impersonating?.impersonating).toBeDefined();
      expect(decoded.impersonating?.impersonating?.userId).toBe('admin-cabang-uuid');
      expect(decoded.impersonating?.impersonating?.email).toBe('admincabang@raho.id');
      expect(decoded.impersonating?.impersonating?.role).toBe(Role.ADMIN_CABANG);
      expect(decoded.impersonating?.impersonating?.branchId).toBe('branch-uuid-1');
    });

    it('should handle complex nested impersonation chain', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid-123',
        email: 'superadmin.test@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin Test',
        staffCode: null,
        impersonating: {
          userId: 'manager-uuid-456',
          email: 'manager.jakarta@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
          branches: ['jakarta-1', 'jakarta-2', 'bandung-1'],
          impersonating: {
            userId: 'admin-cabang-uuid-789',
            email: 'admin.jakarta1@raho.id',
            role: Role.ADMIN_CABANG,
            branchId: 'jakarta-1',
            branches: undefined,
          },
        },
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      // Verify the entire chain is preserved
      expect(decoded.userId).toBe('super-admin-uuid-123');
      expect(decoded.impersonating?.userId).toBe('manager-uuid-456');
      expect(decoded.impersonating?.impersonating?.userId).toBe('admin-cabang-uuid-789');

      // Verify branch data at each level
      expect(decoded.branchId).toBeNull(); // Super Admin has no branch
      expect(decoded.impersonating?.branches).toHaveLength(3); // Manager has 3 branches
      expect(decoded.impersonating?.impersonating?.branchId).toBe('jakarta-1'); // Admin Cabang has 1 branch
    });

    it('should not have deeper nesting beyond 2 levels', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-uuid',
          email: 'manager@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
          branches: ['branch-uuid-1'],
          impersonating: {
            userId: 'admin-cabang-uuid',
            email: 'admincabang@raho.id',
            role: Role.ADMIN_CABANG,
            branchId: 'branch-uuid-1',
            branches: undefined,
          },
        },
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      // Verify max depth is 2 levels
      expect(decoded.impersonating?.impersonating).toBeDefined();
      expect(decoded.impersonating?.impersonating?.impersonating).toBeUndefined();
    });
  });

  describe('Token Expiration', () => {
    it('should use custom expiration for impersonation tokens', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-uuid',
          email: 'manager@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
          branches: ['branch-uuid-1'],
        },
      };

      // Generate token with 8 hour expiration (impersonation tokens should expire sooner)
      const token = signAccessToken(payload, '8h');
      const decoded = verifyAccessToken(token) as any;

      expect(decoded.impersonating).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();

      // Verify token expires in approximately 8 hours (28800 seconds)
      const expirationDuration = decoded.exp - decoded.iat;
      expect(expirationDuration).toBeGreaterThan(28700); // ~8 hours minus some buffer
      expect(expirationDuration).toBeLessThan(28900); // ~8 hours plus some buffer
    });
  });

  describe('Token Pair Generation', () => {
    it('should generate both access and refresh tokens', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
      };

      const tokenPair = generateTokenPair(payload);

      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(typeof tokenPair.accessToken).toBe('string');
      expect(typeof tokenPair.refreshToken).toBe('string');
    });

    it('should generate token pair with impersonation data', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-uuid',
          email: 'manager@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
          branches: ['branch-uuid-1'],
        },
      };

      const tokenPair = generateTokenPair(payload);
      const decodedAccess = verifyAccessToken(tokenPair.accessToken);
      const decodedRefresh = verifyRefreshToken(tokenPair.refreshToken);

      // Access token should have impersonation data
      expect(decodedAccess.impersonating).toBeDefined();
      expect(decodedAccess.impersonating?.userId).toBe('manager-uuid');

      // Refresh token should only have userId and email (no impersonation)
      expect(decodedRefresh.userId).toBe('super-admin-uuid');
      expect(decodedRefresh.email).toBe('superadmin@raho.id');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty branches array', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-uuid',
          email: 'manager@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
          branches: [],
        },
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.impersonating?.branches).toEqual([]);
      expect(Array.isArray(decoded.impersonating?.branches)).toBe(true);
    });

    it('should handle null branchId for Admin Manager', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-uuid',
          email: 'manager@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
          branches: ['branch-1'],
        },
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.impersonating?.branchId).toBeNull();
      expect(decoded.impersonating?.branches).toBeDefined();
    });

    it('should handle special characters in email addresses', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'super.admin+test@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-uuid',
          email: 'manager.test+impersonate@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
          branches: ['branch-1'],
        },
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.email).toBe('super.admin+test@raho.id');
      expect(decoded.impersonating?.email).toBe('manager.test+impersonate@raho.id');
    });

    it('should handle long branch arrays', () => {
      const branches = Array.from({ length: 50 }, (_, i) => `branch-uuid-${i + 1}`);

      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-uuid',
          email: 'manager@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
          branches,
        },
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.impersonating?.branches).toHaveLength(50);
      expect(decoded.impersonating?.branches?.[0]).toBe('branch-uuid-1');
      expect(decoded.impersonating?.branches?.[49]).toBe('branch-uuid-50');
    });
  });

  describe('Token Verification', () => {
    it('should verify token with nested impersonation correctly', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-uuid',
          email: 'manager@raho.id',
          role: Role.ADMIN_MANAGER,
          branchId: null,
          branches: ['branch-1', 'branch-2'],
          impersonating: {
            userId: 'admin-cabang-uuid',
            email: 'admincabang@raho.id',
            role: Role.ADMIN_CABANG,
            branchId: 'branch-1',
          },
        },
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token) as any;

      // Verify all levels are intact after verification
      expect(decoded.userId).toBe('super-admin-uuid');
      expect(decoded.impersonating?.userId).toBe('manager-uuid');
      expect(decoded.impersonating?.impersonating?.userId).toBe('admin-cabang-uuid');

      // Verify issuer and audience
      expect(decoded.iss).toBe('raho-api');
      expect(decoded.aud).toBe('raho-client');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        verifyAccessToken('invalid-token');
      }).toThrow();
    });

    it('should throw error for token with wrong secret', () => {
      const payload: JwtPayload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
        role: Role.SUPER_ADMIN,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
      };

      // Sign with different secret
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(payload, 'wrong-secret');

      expect(() => {
        verifyAccessToken(token);
      }).toThrow();
    });
  });

  describe('Refresh Token', () => {
    it('should generate refresh token without impersonation data', () => {
      const payload = {
        userId: 'super-admin-uuid',
        email: 'superadmin@raho.id',
      };

      const refreshToken = signRefreshToken(payload);
      const decoded = verifyRefreshToken(refreshToken);

      expect(decoded.userId).toBe('super-admin-uuid');
      expect(decoded.email).toBe('superadmin@raho.id');
      // Refresh token should not have role or impersonation data
      expect((decoded as any).role).toBeUndefined();
      expect((decoded as any).impersonating).toBeUndefined();
    });
  });
});
