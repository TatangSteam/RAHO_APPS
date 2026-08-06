import { ImpersonationService } from '../impersonation.service';
import { prisma } from '@lib/prisma';
import { signAccessToken } from '@lib/jwt';
import { Role } from '@prisma/client';

// Mock dependencies
jest.mock('@lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('@lib/jwt', () => ({
  signAccessToken: jest.fn(),
}));

jest.mock('@lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ImpersonationService', () => {
  let service: ImpersonationService;
  let mockFindUnique: jest.Mock;
  let mockFindMany: jest.Mock;
  let mockCount: jest.Mock;
  let mockSignAccessToken: jest.MockedFunction<typeof signAccessToken>;

  beforeEach(() => {
    service = new ImpersonationService();
    mockFindUnique = prisma.user.findUnique as jest.Mock;
    mockFindMany = prisma.user.findMany as jest.Mock;
    mockCount = prisma.user.count as jest.Mock;
    mockSignAccessToken = signAccessToken as jest.MockedFunction<typeof signAccessToken>;
    jest.clearAllMocks();
  });

  describe('createImpersonationToken', () => {
    const superAdminId = 'super-admin-id';
    const adminManagerId = 'admin-manager-id';
    const adminCabangId = 'admin-cabang-id';
    const branchId = 'branch-id';

    const mockSuperAdmin = {
      id: superAdminId,
      email: 'superadmin@raho.id',
      role: 'SUPER_ADMIN' as Role,
      isActive: true,
      branchId: null,
      branch: null,
      profile: { fullName: 'Super Admin' },
      managedBranches: [],
      staffCode: null,
    };

    const mockAdminManager = {
      id: adminManagerId,
      email: 'manager@raho.id',
      role: 'ADMIN_MANAGER' as Role,
      isActive: true,
      branchId: null,
      branch: null,
      profile: { fullName: 'Admin Manager' },
      managedBranches: [
        { branchId, branch: { id: branchId, name: 'Jakarta', branchCode: 'JKT' } },
      ],
      staffCode: null,
    };

    const mockAdminCabang = {
      id: adminCabangId,
      email: 'admincabang@raho.id',
      role: 'ADMIN_CABANG' as Role,
      isActive: true,
      branchId,
      branch: { id: branchId, name: 'Jakarta', branchCode: 'JKT' },
      profile: { fullName: 'Admin Cabang' },
      managedBranches: [],
      staffCode: null,
    };

    describe('Super Admin → Admin Manager impersonation', () => {
      it('should create impersonation token successfully', async () => {
        mockFindUnique
          .mockResolvedValueOnce(mockSuperAdmin as any)
          .mockResolvedValueOnce(mockAdminManager as any);

        mockSignAccessToken.mockReturnValue('mock-token');

        const result = await service.createImpersonationToken(
          superAdminId,
          adminManagerId
        );

        expect(result.token).toBe('mock-token');
        expect(result.targetUser.role).toBe('ADMIN_MANAGER');
        expect(result.targetUser.branches).toHaveLength(1);
        expect(mockSignAccessToken).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: superAdminId,
            email: 'superadmin@raho.id',
            role: 'SUPER_ADMIN',
            impersonating: expect.objectContaining({
              userId: adminManagerId,
              email: 'manager@raho.id',
              role: 'ADMIN_MANAGER',
              branches: [branchId],
            }),
          }),
          '8h'
        );
      });

      it('should throw error if target user not found', async () => {
        mockFindUnique
          .mockResolvedValueOnce(mockSuperAdmin as any)
          .mockResolvedValueOnce(null);

        await expect(
          service.createImpersonationToken(superAdminId, adminManagerId)
        ).rejects.toMatchObject({
          status: 404,
          code: 'TARGET_USER_NOT_FOUND',
        });
      });

      it('should throw error if target user is inactive', async () => {
        mockFindUnique
          .mockResolvedValueOnce(mockSuperAdmin as any)
          .mockResolvedValueOnce({ ...mockAdminManager, isActive: false } as any);

        await expect(
          service.createImpersonationToken(superAdminId, adminManagerId)
        ).rejects.toMatchObject({
          status: 400,
          code: 'TARGET_USER_INACTIVE',
        });
      });

      it('should throw error if Super Admin tries to impersonate non-Admin Manager', async () => {
        mockFindUnique
          .mockResolvedValueOnce(mockSuperAdmin as any)
          .mockResolvedValueOnce(mockAdminCabang as any);

        await expect(
          service.createImpersonationToken(superAdminId, adminCabangId)
        ).rejects.toMatchObject({
          status: 403,
          code: 'INVALID_IMPERSONATION_TARGET',
        });
      });
    });

    describe('Admin Manager → Admin Cabang impersonation', () => {
      it('should create impersonation token successfully', async () => {
        mockFindUnique
          .mockResolvedValueOnce(mockAdminManager as any)
          .mockResolvedValueOnce(mockAdminCabang as any);

        mockSignAccessToken.mockReturnValue('mock-token');

        const result = await service.createImpersonationToken(
          adminManagerId,
          adminCabangId
        );

        expect(result.token).toBe('mock-token');
        expect(result.targetUser.role).toBe('ADMIN_CABANG');
        expect(result.targetUser.branchId).toBe(branchId);
        expect(mockSignAccessToken).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: adminManagerId,
            email: 'manager@raho.id',
            role: 'ADMIN_MANAGER',
            impersonating: expect.objectContaining({
              userId: adminCabangId,
              email: 'admincabang@raho.id',
              role: 'ADMIN_CABANG',
              branchId,
            }),
          }),
          '8h'
        );
      });

      it('should throw error if Admin Manager tries to impersonate Admin Cabang from unassigned branch', async () => {
        const otherBranchId = 'other-branch-id';
        const adminCabangOtherBranch = {
          ...mockAdminCabang,
          branchId: otherBranchId,
          branch: { id: otherBranchId, name: 'Bandung', branchCode: 'BDG' },
        };

        mockFindUnique
          .mockResolvedValueOnce(mockAdminManager as any)
          .mockResolvedValueOnce(adminCabangOtherBranch as any);

        await expect(
          service.createImpersonationToken(adminManagerId, adminCabangId)
        ).rejects.toMatchObject({
          status: 403,
          code: 'BRANCH_ACCESS_DENIED',
        });
      });

      it('should throw error if Admin Manager tries to impersonate non-Admin Cabang', async () => {
        mockFindUnique
          .mockResolvedValueOnce(mockAdminManager as any)
          .mockResolvedValueOnce(mockSuperAdmin as any);

        await expect(
          service.createImpersonationToken(adminManagerId, superAdminId)
        ).rejects.toMatchObject({
          status: 403,
          code: 'INVALID_IMPERSONATION_TARGET',
        });
      });
    });

    describe('Nested impersonation (Super Admin → Admin Manager → Admin Cabang)', () => {
      it('should create nested impersonation token successfully', async () => {
        // First level: Super Admin → Admin Manager
        const firstLevelToken = {
          userId: superAdminId,
          email: 'superadmin@raho.id',
          role: 'SUPER_ADMIN' as Role,
          branchId: null,
          branchCode: null,
          fullName: 'Super Admin',
          staffCode: null,
          impersonating: {
            userId: adminManagerId,
            email: 'manager@raho.id',
            role: 'ADMIN_MANAGER' as Role,
            branches: [branchId],
          },
        };

        mockFindUnique
          .mockResolvedValueOnce(mockAdminManager as any) // Current user (Admin Manager)
          .mockResolvedValueOnce(mockAdminCabang as any); // Target user (Admin Cabang)

        mockSignAccessToken.mockReturnValue('mock-nested-token');

        const result = await service.createImpersonationToken(
          adminManagerId,
          adminCabangId,
          firstLevelToken
        );

        expect(result.token).toBe('mock-nested-token');
        expect(result.targetUser.role).toBe('ADMIN_CABANG');
        expect(mockSignAccessToken).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: superAdminId, // Original Super Admin
            email: 'superadmin@raho.id',
            role: 'SUPER_ADMIN',
            impersonating: expect.objectContaining({
              userId: adminManagerId,
              email: 'manager@raho.id',
              role: 'ADMIN_MANAGER',
              branches: [branchId],
              impersonating: expect.objectContaining({
                userId: adminCabangId,
                email: 'admincabang@raho.id',
                role: 'ADMIN_CABANG',
                branchId,
              }),
            }),
          }),
          '8h'
        );
      });

      it('should validate branch access in nested impersonation', async () => {
        const otherBranchId = 'other-branch-id';
        const adminCabangOtherBranch = {
          ...mockAdminCabang,
          branchId: otherBranchId,
          branch: { id: otherBranchId, name: 'Bandung', branchCode: 'BDG' },
        };

        const firstLevelToken = {
          userId: superAdminId,
          email: 'superadmin@raho.id',
          role: 'SUPER_ADMIN' as Role,
          branchId: null,
          branchCode: null,
          fullName: 'Super Admin',
          staffCode: null,
          impersonating: {
            userId: adminManagerId,
            email: 'manager@raho.id',
            role: 'ADMIN_MANAGER' as Role,
            branches: [branchId], // Only has access to branchId
          },
        };

        mockFindUnique
          .mockResolvedValueOnce(mockAdminManager as any)
          .mockResolvedValueOnce(adminCabangOtherBranch as any);

        await expect(
          service.createImpersonationToken(adminManagerId, adminCabangId, firstLevelToken)
        ).rejects.toMatchObject({
          status: 403,
          code: 'BRANCH_ACCESS_DENIED',
        });
      });
    });

    describe('Permission validation', () => {
      it('should throw error if non-Super Admin/Admin Manager tries to impersonate', async () => {
        mockFindUnique
          .mockResolvedValueOnce(mockAdminCabang as any)
          .mockResolvedValueOnce(mockAdminManager as any);

        await expect(
          service.createImpersonationToken(adminCabangId, adminManagerId)
        ).rejects.toMatchObject({
          status: 403,
          code: 'IMPERSONATION_NOT_ALLOWED',
        });
      });
    });
  });

  describe('stopImpersonation', () => {
    const superAdminId = 'super-admin-id';
    const adminManagerId = 'admin-manager-id';
    const adminCabangId = 'admin-cabang-id';
    const branchId = 'branch-id';

    const mockAdminManager = {
      id: adminManagerId,
      email: 'manager@raho.id',
      role: 'ADMIN_MANAGER' as Role,
      isActive: true,
      branchId: null,
      branch: null,
      profile: { fullName: 'Admin Manager' },
      managedBranches: [
        { branchId, branch: { id: branchId, name: 'Jakarta', branchCode: 'JKT' } },
      ],
      staffCode: null,
    };

    const mockSuperAdmin = {
      id: superAdminId,
      email: 'superadmin@raho.id',
      role: 'SUPER_ADMIN' as Role,
      isActive: true,
      branchId: null,
      branch: null,
      profile: { fullName: 'Super Admin' },
      managedBranches: [],
      staffCode: null,
    };

    it('should stop single level impersonation', async () => {
      const currentToken = {
        userId: superAdminId,
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: adminManagerId,
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER' as Role,
          branches: [branchId],
        },
      };

      mockFindUnique.mockResolvedValueOnce(mockSuperAdmin as any);
      mockSignAccessToken.mockReturnValue('original-token');

      const result = await service.stopImpersonation(currentToken);

      expect(result.token).toBe('original-token');
      expect(result.user.role).toBe('SUPER_ADMIN');
      expect(mockSignAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: superAdminId,
          email: 'superadmin@raho.id',
          role: 'SUPER_ADMIN',
          branchId: null,
          branchCode: null,
          fullName: 'Super Admin',
          staffCode: null,
        }),
        '24h'
      );
      // Ensure impersonating field is not present
      const callArgs = mockSignAccessToken.mock.calls[0][0] as any;
      expect(callArgs.impersonating).toBeUndefined();
    });

    it('should stop nested impersonation (go back one level)', async () => {
      const currentToken = {
        userId: superAdminId,
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: adminManagerId,
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER' as Role,
          branches: [branchId],
          impersonating: {
            userId: adminCabangId,
            email: 'admincabang@raho.id',
            role: 'ADMIN_CABANG' as Role,
            branchId,
          },
        },
      };

      mockFindUnique.mockResolvedValueOnce(mockAdminManager as any);
      mockSignAccessToken.mockReturnValue('back-to-manager-token');

      const result = await service.stopImpersonation(currentToken);

      expect(result.token).toBe('back-to-manager-token');
      expect(result.user.role).toBe('ADMIN_MANAGER');
      expect(mockSignAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: superAdminId,
          email: 'superadmin@raho.id',
          role: 'SUPER_ADMIN',
          branchId: null,
          branchCode: null,
          fullName: 'Super Admin',
          staffCode: null,
          impersonating: expect.objectContaining({
            userId: adminManagerId,
            email: 'manager@raho.id',
            role: 'ADMIN_MANAGER',
            branches: [branchId],
          }),
        }),
        '8h'
      );
      // Ensure nested impersonating field is not present
      const callArgs = mockSignAccessToken.mock.calls[0][0] as any;
      expect(callArgs.impersonating.impersonating).toBeUndefined();
    });

    it('should throw error if not currently impersonating', async () => {
      const currentToken = {
        userId: superAdminId,
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
      };

      await expect(service.stopImpersonation(currentToken)).rejects.toMatchObject({
        status: 400,
        code: 'NOT_IMPERSONATING',
      });
    });
  });

  describe('canImpersonate', () => {
    it('should return true for Super Admin without impersonation', () => {
      const result = service.canImpersonate('SUPER_ADMIN' as Role);
      expect(result).toBe(true);
    });

    it('should return false for Super Admin already impersonating', () => {
      const currentToken = {
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-id'],
        },
      };

      const result = service.canImpersonate('SUPER_ADMIN' as Role, currentToken);
      expect(result).toBe(true); // Can still impersonate (nested)
    });

    it('should return true for Admin Manager', () => {
      const result = service.canImpersonate('ADMIN_MANAGER' as Role);
      expect(result).toBe(true);
    });

    it('should return false for Admin Manager at max depth', () => {
      const currentToken = {
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-id'],
          impersonating: {
            userId: 'admin-cabang-id',
            email: 'admincabang@raho.id',
            role: 'ADMIN_CABANG' as Role,
            branchId: 'branch-id',
          },
        },
      };

      const result = service.canImpersonate('ADMIN_MANAGER' as Role, currentToken);
      expect(result).toBe(false); // Already at max depth
    });

    it('should return false for other roles', () => {
      const result = service.canImpersonate('ADMIN_CABANG' as Role);
      expect(result).toBe(false);
    });
  });

  describe('getImpersonationChain', () => {
    it('should return chain for single level impersonation', () => {
      const token = {
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-id'],
        },
      };

      const chain = service.getImpersonationChain(token);
      expect(chain).toEqual(['superadmin@raho.id', 'manager@raho.id']);
    });

    it('should return chain for nested impersonation', () => {
      const token = {
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER' as Role,
          branches: ['branch-id'],
          impersonating: {
            userId: 'admin-cabang-id',
            email: 'admincabang@raho.id',
            role: 'ADMIN_CABANG' as Role,
            branchId: 'branch-id',
          },
        },
      };

      const chain = service.getImpersonationChain(token);
      expect(chain).toEqual([
        'superadmin@raho.id',
        'manager@raho.id',
        'admincabang@raho.id',
      ]);
    });

    it('should return single email for non-impersonating token', () => {
      const token = {
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN' as Role,
        branchId: null,
        branchCode: null,
        fullName: 'Super Admin',
        staffCode: null,
      };

      const chain = service.getImpersonationChain(token);
      expect(chain).toEqual(['superadmin@raho.id']);
    });
  });

  describe('getAdminManagers', () => {
    const mockManagers = [
      {
        id: 'manager-1',
        email: 'manager1@raho.id',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        lastLoginAt: new Date('2024-01-15'),
        profile: { fullName: 'Manager One' },
        managedBranches: [
          {
            branch: {
              id: 'branch-1',
              name: 'Jakarta',
              branchCode: 'JKT',
            },
          },
        ],
      },
      {
        id: 'manager-2',
        email: 'manager2@raho.id',
        isActive: true,
        createdAt: new Date('2024-01-02'),
        lastLoginAt: null,
        profile: { fullName: 'Manager Two' },
        managedBranches: [
          {
            branch: {
              id: 'branch-2',
              name: 'Bandung',
              branchCode: 'BDG',
            },
          },
        ],
      },
    ];

    it('should return list of admin managers with pagination', async () => {
      mockFindMany.mockResolvedValue(mockManagers);
      mockCount.mockResolvedValue(2);

      const result = await service.getAdminManagers({
        page: 1,
        limit: 10,
      });

      expect(result.managers).toHaveLength(2);
      expect(result.managers[0].email).toBe('manager1@raho.id');
      expect(result.managers[0].fullName).toBe('Manager One');
      expect(result.managers[0].branches).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });

    it('should filter by search term', async () => {
      mockFindMany.mockResolvedValue([mockManagers[0]]);
      mockCount.mockResolvedValue(1);

      const result = await service.getAdminManagers({
        search: 'manager1',
        page: 1,
        limit: 10,
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'ADMIN_MANAGER',
            OR: expect.arrayContaining([
                { profile: { fullName: { contains: 'manager1', mode: 'insensitive' } } },
              { email: { contains: 'manager1', mode: 'insensitive' } },
            ]),
          }),
        })
      );
      expect(result.managers).toHaveLength(1);
    });

    it('should filter by active status', async () => {
      mockFindMany.mockResolvedValue(mockManagers);
      mockCount.mockResolvedValue(2);

      await service.getAdminManagers({
        isActive: true,
        page: 1,
        limit: 10,
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'ADMIN_MANAGER',
            isActive: true,
          }),
        })
      );
    });

    it('should handle pagination correctly', async () => {
      mockFindMany.mockResolvedValue([mockManagers[1]]);
      mockCount.mockResolvedValue(2);

      const result = await service.getAdminManagers({
        page: 2,
        limit: 1,
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 1,
          take: 1,
        })
      );
      expect(result.pagination).toEqual({
        page: 2,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
    });
  });

  describe('getBranchAdmins', () => {
    const branchId = 'branch-1';
    const mockAdmins = [
      {
        id: 'admin-1',
        email: 'admin1@raho.id',
        isActive: true,
        branchId,
        createdAt: new Date('2024-01-01'),
        lastLoginAt: new Date('2024-01-15'),
        profile: { fullName: 'Admin One' },
        branch: {
          id: branchId,
          name: 'Jakarta',
          branchCode: 'JKT',
        },
      },
      {
        id: 'admin-2',
        email: 'admin2@raho.id',
        isActive: true,
        branchId,
        createdAt: new Date('2024-01-02'),
        lastLoginAt: null,
        profile: { fullName: 'Admin Two' },
        branch: {
          id: branchId,
          name: 'Jakarta',
          branchCode: 'JKT',
        },
      },
    ];

    it('should return list of branch admins with pagination', async () => {
      mockFindMany.mockResolvedValue(mockAdmins);
      mockCount.mockResolvedValue(2);

      const result = await service.getBranchAdmins([branchId], {
        page: 1,
        limit: 10,
      });

      expect(result.admins).toHaveLength(2);
      expect(result.admins[0].email).toBe('admin1@raho.id');
      expect(result.admins[0].fullName).toBe('Admin One');
      expect(result.admins[0].branch.name).toBe('Jakarta');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });

    it('should filter by manager branch IDs', async () => {
      mockFindMany.mockResolvedValue(mockAdmins);
      mockCount.mockResolvedValue(2);

      await service.getBranchAdmins([branchId, 'branch-2'], {
        page: 1,
        limit: 10,
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'ADMIN_CABANG',
            branchId: {
              in: [branchId, 'branch-2'],
            },
          }),
        })
      );
    });

    it('should filter by specific branch', async () => {
      mockFindMany.mockResolvedValue([mockAdmins[0]]);
      mockCount.mockResolvedValue(1);

      await service.getBranchAdmins([branchId, 'branch-2'], {
        branchId,
        page: 1,
        limit: 10,
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'ADMIN_CABANG',
            branchId,
          }),
        })
      );
    });

    it('should filter by search term', async () => {
      mockFindMany.mockResolvedValue([mockAdmins[0]]);
      mockCount.mockResolvedValue(1);

      await service.getBranchAdmins([branchId], {
        search: 'admin1',
        page: 1,
        limit: 10,
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'ADMIN_CABANG',
            OR: expect.arrayContaining([
                { profile: { fullName: { contains: 'admin1', mode: 'insensitive' } } },
              { email: { contains: 'admin1', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should filter by active status', async () => {
      mockFindMany.mockResolvedValue(mockAdmins);
      mockCount.mockResolvedValue(2);

      await service.getBranchAdmins([branchId], {
        isActive: true,
        page: 1,
        limit: 10,
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'ADMIN_CABANG',
            isActive: true,
          }),
        })
      );
    });
  });
});

