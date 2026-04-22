// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { PackageType } from '@prisma/client';

/**
 * Service for admin package pricing management
 */
export class PackagePricingAdminService {
  /**
   * Get all package pricing with filtering
   */
  async getAllPackagePricing(filters: {
    packageType?: PackageType;
    branchId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const {
      packageType,
      branchId,
      isActive,
      page = 1,
      limit = 50,
    } = filters;

    // Build where clause
    const where: any = {};

    if (packageType) {
      where.packageType = packageType;
    }

    if (branchId) {
      where.branchId = branchId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Get total count
    const total = await prisma.packagePricing.count({ where });

    // Get pricing with pagination
    const pricings = await prisma.packagePricing.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            branchCode: true,
          },
        },
      },
      orderBy: [
        { packageType: 'asc' },
        { totalSessions: 'asc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      pricings: pricings.map(p => ({
        id: p.id,
        packageType: p.packageType,
        totalSessions: p.totalSessions,
        price: Number(p.price),
        isActive: p.isActive,
        branchId: p.branchId,
        branch: p.branch ? {
          id: p.branch.id,
          name: p.branch.name,
          branchCode: p.branch.branchCode,
        } : null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get package pricing by ID
   */
  async getPackagePricing(pricingId: string) {
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
      },
    });

    if (!pricing) {
      throw {
        status: 404,
        code: 'PRICING_NOT_FOUND',
        message: 'Harga paket tidak ditemukan',
      };
    }

    return {
      id: pricing.id,
      packageType: pricing.packageType,
      totalSessions: pricing.totalSessions,
      price: Number(pricing.price),
      isActive: pricing.isActive,
      branchId: pricing.branchId,
      branch: pricing.branch ? {
        id: pricing.branch.id,
        name: pricing.branch.name,
        branchCode: pricing.branch.branchCode,
      } : null,
      createdAt: pricing.createdAt.toISOString(),
      updatedAt: pricing.updatedAt.toISOString(),
    };
  }

  /**
   * Create package pricing
   */
  async createPackagePricing(data: {
    packageType: PackageType;
    totalSessions: number;
    price: number;
    isActive?: boolean;
    branchId?: string;
  }) {
    // Check if pricing already exists
    const existing = await prisma.packagePricing.findFirst({
      where: {
        packageType: data.packageType,
        totalSessions: data.totalSessions,
        branchId: data.branchId || null,
      },
    });

    if (existing) {
      throw {
        status: 409,
        code: 'PRICING_EXISTS',
        message: 'Harga paket dengan tipe dan jumlah sesi ini sudah ada',
      };
    }

    // Validate branch if provided
    if (data.branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: data.branchId },
      });

      if (!branch) {
        throw {
          status: 404,
          code: 'BRANCH_NOT_FOUND',
          message: 'Cabang tidak ditemukan',
        };
      }
    }

    const pricing = await prisma.packagePricing.create({
      data: {
        packageType: data.packageType,
        totalSessions: data.totalSessions,
        price: data.price,
        isActive: data.isActive ?? true,
        branchId: data.branchId || null,
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
      packageType: pricing.packageType,
      totalSessions: pricing.totalSessions,
      price: Number(pricing.price),
      isActive: pricing.isActive,
      branchId: pricing.branchId,
      branch: pricing.branch ? {
        id: pricing.branch.id,
        name: pricing.branch.name,
        branchCode: pricing.branch.branchCode,
      } : null,
      createdAt: pricing.createdAt.toISOString(),
      updatedAt: pricing.updatedAt.toISOString(),
    };
  }

  /**
   * Update package pricing
   */
  async updatePackagePricing(
    pricingId: string,
    data: {
      price?: number;
      isActive?: boolean;
    }
  ) {
    const pricing = await prisma.packagePricing.findUnique({
      where: { id: pricingId },
    });

    if (!pricing) {
      throw {
        status: 404,
        code: 'PRICING_NOT_FOUND',
        message: 'Harga paket tidak ditemukan',
      };
    }

    const updated = await prisma.packagePricing.update({
      where: { id: pricingId },
      data: {
        price: data.price,
        isActive: data.isActive,
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
      id: updated.id,
      packageType: updated.packageType,
      totalSessions: updated.totalSessions,
      price: Number(updated.price),
      isActive: updated.isActive,
      branchId: updated.branchId,
      branch: updated.branch ? {
        id: updated.branch.id,
        name: updated.branch.name,
        branchCode: updated.branch.branchCode,
      } : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Delete package pricing
   */
  async deletePackagePricing(pricingId: string) {
    const pricing = await prisma.packagePricing.findUnique({
      where: { id: pricingId },
    });

    if (!pricing) {
      throw {
        status: 404,
        code: 'PRICING_NOT_FOUND',
        message: 'Harga paket tidak ditemukan',
      };
    }

    // Check if pricing is being used
    const usageCount = await prisma.memberPackage.count({
      where: { packagePricingId: pricingId },
    });

    if (usageCount > 0) {
      throw {
        status: 409,
        code: 'PRICING_IN_USE',
        message: `Harga paket tidak dapat dihapus karena sedang digunakan oleh ${usageCount} paket member`,
      };
    }

    await prisma.packagePricing.delete({
      where: { id: pricingId },
    });

    return { message: 'Harga paket berhasil dihapus' };
  }
}
