import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';

export class AdminService {
  // ── Get System Statistics ─────────────────────────────────
  async getSystemStats() {
    try {
      // Parallel queries for better performance
      const [
        totalBranches,
        activeBranches,
        totalUsers,
        activeUsers,
        totalMembers,
        activeMembers,
        totalPackages,
        activePackages,
        totalSessions,
        completedSessions,
        totalRevenue,
        monthlyRevenue,
      ] = await Promise.all([
        // Branches
        prisma.branch.count(),
        prisma.branch.count({ where: { isActive: true } }),
        
        // Users (staff only, not members)
        prisma.user.count({ where: { role: { not: 'MEMBER' } } }),
        prisma.user.count({ where: { role: { not: 'MEMBER' }, isActive: true } }),
        
        // Members
        prisma.member.count(),
        prisma.member.count({ where: { isActive: true } }),
        
        // Packages
        prisma.memberPackage.count(),
        prisma.memberPackage.count({ where: { status: 'ACTIVE' } }),
        
        // Sessions
        prisma.treatmentSession.count(),
        prisma.treatmentSession.count({ where: { isCompleted: true } }),
        
        // Revenue - Total
        prisma.invoice.aggregate({
          where: { status: 'PAID' },
          _sum: { totalAmount: true },
        }),
        
        // Revenue - This month
        prisma.invoice.aggregate({
          where: {
            status: 'PAID',
            paidAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: { totalAmount: true },
        }),
      ]);

      return {
        totalBranches,
        activeBranches,
        totalUsers,
        activeUsers,
        totalMembers,
        activeMembers,
        totalPackages,
        activePackages,
        totalSessions,
        completedSessions,
        totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
        monthlyRevenue: Number(monthlyRevenue._sum.totalAmount || 0),
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      throw new Error('Gagal mengambil statistik sistem');
    }
  }

  // ── Get System Health ──────────────────────────────────────
  async getSystemHealth() {
    try {
      const health = {
        database: 'operational',
        api: 'operational',
        storage: 'operational',
        authentication: 'operational',
      };

      // Test database connection
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        health.database = 'error';
      }

      return health;
    } catch (error) {
      console.error('Error checking system health:', error);
      throw new Error('Gagal memeriksa kesehatan sistem');
    }
  }

  // ── Get Recent Activities ──────────────────────────────────
  async getRecentActivities(limit: number = 20) {
    try {
      const activities = await prisma.auditLog.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              profile: true,
              branch: true,
            },
          },
        },
      });

      return activities.map((activity: any) => ({
        id: activity.id,
        type: activity.action,
        description: `${activity.action} ${activity.resource}${activity.resourceId ? ` (${activity.resourceId})` : ''}`,
        timestamp: activity.createdAt,
        user: activity.user.profile?.fullName || activity.user.email,
        branch: activity.user.branch?.name,
        meta: activity.meta,
      }));
    } catch (error) {
      console.error('Error getting recent activities:', error);
      throw new Error('Gagal mengambil aktivitas terbaru');
    }
  }

  // ── Get Branch Performance Comparison ──────────────────────
  async getBranchPerformance() {
    try {
      const branches = await prisma.branch.findMany({
        where: { isActive: true },
        include: {
          _count: {
            select: {
              users: true,
              members: true,
              memberPackages: true,
              treatmentSessions: true,
            },
          },
        },
      });

      const branchPerformance = await Promise.all(
        branches.map(async (branch: any) => {
          const revenue = await prisma.invoice.aggregate({
            where: {
              branchId: branch.id,
              status: 'PAID',
            },
            _sum: { totalAmount: true },
          });

          const monthlyRevenue = await prisma.invoice.aggregate({
            where: {
              branchId: branch.id,
              status: 'PAID',
              paidAt: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              },
            },
            _sum: { totalAmount: true },
          });

          return {
            branchId: branch.id,
            branchCode: branch.branchCode,
            branchName: branch.name,
            totalUsers: branch._count.users,
            totalMembers: branch._count.members,
            totalPackages: branch._count.memberPackages,
            totalSessions: branch._count.treatmentSessions,
            totalRevenue: Number(revenue._sum.totalAmount || 0),
            monthlyRevenue: Number(monthlyRevenue._sum.totalAmount || 0),
          };
        })
      );

      return branchPerformance;
    } catch (error) {
      console.error('Error getting branch performance:', error);
      throw new Error('Gagal mengambil performa cabang');
    }
  }

  // ── Get Audit Logs with Filters ────────────────────────────
  async getAuditLogs(filters: {
    page?: number;
    limit?: number;
    search?: string;
    action?: string;
    resource?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    try {
      const {
        page = 1,
        limit = 50,
        search,
        action,
        resource,
        userId,
        startDate,
        endDate,
      } = filters;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (search) {
        where.OR = [
          { resource: { contains: search, mode: 'insensitive' } },
          { resourceId: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (action) {
        where.action = action;
      }

      if (resource) {
        where.resource = resource;
      }

      if (userId) {
        where.userId = userId;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              include: {
                profile: true,
                branch: true,
              },
            },
          },
        }),
      ]);

      const formattedLogs = logs.map((log: any) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        meta: log.meta,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        user: {
          id: log.user.id,
          email: log.user.email,
          fullName: log.user.profile?.fullName || log.user.email,
          role: log.user.role,
        },
        branch: log.user.branch
          ? {
              id: log.user.branch.id,
              name: log.user.branch.name,
              branchCode: log.user.branch.branchCode,
            }
          : null,
      }));

      return {
        logs: formattedLogs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error getting audit logs:', error);
      throw new Error('Gagal mengambil audit logs');
    }
  }

  // ══════════════════════════════════════════════════════════════
  // PACKAGE PRICING MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  // ── Get All Package Pricing with Filters ───────────────────
  async getAllPackagePricing(filters: {
    branchId?: string;
    packageType?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const {
        branchId,
        packageType,
        isActive,
        search,
        page = 1,
        limit = 20,
      } = filters;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (branchId) {
        where.branchId = branchId;
      }

      if (packageType) {
        where.packageType = packageType;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { productCode: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [total, pricings] = await Promise.all([
        prisma.packagePricing.count({ where }),
        prisma.packagePricing.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                branchCode: true,
              },
            },
            _count: {
              select: {
                memberPackages: true,
              },
            },
          },
        }),
      ]);

      const formattedPricings = pricings.map((pricing: any) => ({
        id: pricing.id,
        branchId: pricing.branchId,
        branch: pricing.branch,
        packageType: pricing.packageType,
        productCode: pricing.productCode,
        name: pricing.name,
        totalSessions: pricing.totalSessions,
        price: Number(pricing.price),
        isActive: pricing.isActive,
        usageCount: pricing._count.memberPackages,
        createdAt: pricing.createdAt,
        updatedAt: pricing.updatedAt,
      }));

      return {
        pricings: formattedPricings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error getting package pricing:', error);
      throw new Error('Gagal mengambil daftar harga paket');
    }
  }

  // ── Get Single Package Pricing ─────────────────────────────
  async getPackagePricing(pricingId: string) {
    try {
      const pricing = await prisma.packagePricing.findUnique({
        where: { id: pricingId },
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              branchCode: true,
            },
          },
          _count: {
            select: {
              memberPackages: true,
            },
          },
        },
      });

      if (!pricing) {
        throw errors.notFound('Harga paket tidak ditemukan');
      }

      return {
        id: pricing.id,
        branchId: pricing.branchId,
        branch: pricing.branch,
        packageType: pricing.packageType,
        productCode: pricing.productCode,
        name: pricing.name,
        totalSessions: pricing.totalSessions,
        price: Number(pricing.price),
        isActive: pricing.isActive,
        usageCount: pricing._count.memberPackages,
        createdAt: pricing.createdAt,
        updatedAt: pricing.updatedAt,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('tidak ditemukan')) {
        throw error;
      }
      console.error('Error getting package pricing:', error);
      throw new Error('Gagal mengambil detail harga paket');
    }
  }

  // ── Create Package Pricing ─────────────────────────────────
  async createPackagePricing(data: {
    branchId: string;
    packageType: string;
    productCode?: string;
    name: string;
    totalSessions: number;
    price: number;
  }) {
    try {
      // Check if branch exists
      const branch = await prisma.branch.findUnique({
        where: { id: data.branchId },
      });

      if (!branch) {
        throw errors.notFound('Cabang tidak ditemukan');
      }

      // Check for duplicate
      const existing = await prisma.packagePricing.findFirst({
        where: {
          branchId: data.branchId,
          packageType: data.packageType as any,
          totalSessions: data.totalSessions,
        },
      });

      if (existing) {
        throw errors.conflict(
          'PACKAGE_PRICING_EXISTS',
          'Harga paket dengan tipe dan jumlah sesi yang sama sudah ada untuk cabang ini'
        );
      }

      const pricing = await prisma.packagePricing.create({
        data: {
          branchId: data.branchId,
          packageType: data.packageType as any,
          productCode: data.productCode,
          name: data.name,
          totalSessions: data.totalSessions,
          price: data.price,
        },
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              branchCode: true,
            },
          },
        },
      });

      return {
        id: pricing.id,
        branchId: pricing.branchId,
        branch: pricing.branch,
        packageType: pricing.packageType,
        productCode: pricing.productCode,
        name: pricing.name,
        totalSessions: pricing.totalSessions,
        price: Number(pricing.price),
        isActive: pricing.isActive,
        createdAt: pricing.createdAt,
        updatedAt: pricing.updatedAt,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('tidak ditemukan') ||
          error.message.includes('sudah ada'))
      ) {
        throw error;
      }
      console.error('Error creating package pricing:', error);
      throw new Error('Gagal membuat harga paket');
    }
  }

  // ── Update Package Pricing ─────────────────────────────────
  async updatePackagePricing(
    pricingId: string,
    data: {
      name?: string;
      productCode?: string;
      price?: number;
      isActive?: boolean;
    }
  ) {
    try {
      const existing = await prisma.packagePricing.findUnique({
        where: { id: pricingId },
      });

      if (!existing) {
        throw errors.notFound('Harga paket tidak ditemukan');
      }

      const pricing = await prisma.packagePricing.update({
        where: { id: pricingId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.productCode !== undefined && { productCode: data.productCode }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              branchCode: true,
            },
          },
          _count: {
            select: {
              memberPackages: true,
            },
          },
        },
      });

      return {
        id: pricing.id,
        branchId: pricing.branchId,
        branch: pricing.branch,
        packageType: pricing.packageType,
        productCode: pricing.productCode,
        name: pricing.name,
        totalSessions: pricing.totalSessions,
        price: Number(pricing.price),
        isActive: pricing.isActive,
        usageCount: pricing._count.memberPackages,
        createdAt: pricing.createdAt,
        updatedAt: pricing.updatedAt,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('tidak ditemukan')) {
        throw error;
      }
      console.error('Error updating package pricing:', error);
      throw new Error('Gagal mengupdate harga paket');
    }
  }

  // ── Delete Package Pricing ─────────────────────────────────
  async deletePackagePricing(pricingId: string) {
    try {
      const existing = await prisma.packagePricing.findUnique({
        where: { id: pricingId },
        include: {
          _count: {
            select: {
              memberPackages: true,
            },
          },
        },
      });

      if (!existing) {
        throw errors.notFound('Harga paket tidak ditemukan');
      }

      if (existing._count.memberPackages > 0) {
        throw errors.conflict(
          'PACKAGE_PRICING_IN_USE',
          'Tidak dapat menghapus harga paket yang sudah digunakan oleh member'
        );
      }

      await prisma.packagePricing.delete({
        where: { id: pricingId },
      });

      return { message: 'Harga paket berhasil dihapus' };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('tidak ditemukan') ||
          error.message.includes('sudah digunakan'))
      ) {
        throw error;
      }
      console.error('Error deleting package pricing:', error);
      throw new Error('Gagal menghapus harga paket');
    }
  }

  // ══════════════════════════════════════════════════════════════
  // USER MANAGEMENT (ADMIN MANAGER)
  // ══════════════════════════════════════════════════════════════

  // ── Create Admin Manager ───────────────────────────────────
  async createAdminManager(data: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    branchIds: string[];
  }) {
    try {
      const bcrypt = require('bcryptjs');

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw errors.conflict('EMAIL_EXISTS', 'Email sudah terdaftar');
      }

      // Verify all branches exist
      const branches = await prisma.branch.findMany({
        where: {
          id: { in: data.branchIds },
        },
      });

      if (branches.length !== data.branchIds.length) {
        throw errors.notFound('Satu atau lebih cabang tidak ditemukan');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create user with profile and branch assignments
      const user = await prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          role: 'ADMIN_MANAGER',
          isActive: true,
          profile: {
            create: {
              fullName: data.fullName,
              phone: data.phone,
            },
          },
          managedBranches: {
            create: data.branchIds.map((branchId) => ({
              branchId,
            })),
          },
        },
        include: {
          profile: true,
          managedBranches: {
            include: {
              branch: {
                select: {
                  id: true,
                  name: true,
                  branchCode: true,
                },
              },
            },
          },
        },
      });

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        profile: user.profile,
        managedBranches: user.managedBranches.map((mb: any) => mb.branch),
        createdAt: user.createdAt,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('sudah terdaftar') ||
          error.message.includes('tidak ditemukan'))
      ) {
        throw error;
      }
      console.error('Error creating admin manager:', error);
      throw new Error('Gagal membuat admin manager');
    }
  }

  // ── Get All Users with Filters ─────────────────────────────
  async getAllUsers(filters: {
    role?: string;
    branchId?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const {
        role,
        branchId,
        isActive,
        search,
        page = 1,
        limit = 20,
      } = filters;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {
        role: { not: 'MEMBER' }, // Exclude members
      };

      if (role) {
        where.role = role;
      }

      if (branchId) {
        where.OR = [
          { branchId },
          {
            managedBranches: {
              some: {
                branchId,
              },
            },
          },
        ];
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          {
            profile: {
              fullName: { contains: search, mode: 'insensitive' },
            },
          },
        ];
      }

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            profile: true,
            branch: {
              select: {
                id: true,
                name: true,
                branchCode: true,
              },
            },
            managedBranches: {
              include: {
                branch: {
                  select: {
                    id: true,
                    name: true,
                    branchCode: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      const formattedUsers = users.map((user: any) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        profile: user.profile,
        branch: user.branch,
        managedBranches: user.managedBranches.map((mb: any) => mb.branch),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      return {
        users: formattedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error getting users:', error);
      throw new Error('Gagal mengambil daftar user');
    }
  }

}
