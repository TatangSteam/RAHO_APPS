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
        boosterType: p.boosterType,
        serviceType: p.serviceType,
        name: p.name,
        productCode: p.productCode,
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
      boosterType: pricing.boosterType,
      serviceType: pricing.serviceType,
      name: pricing.name,
      productCode: pricing.productCode,
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
    boosterType?: string;
    serviceType?: string;
    name: string;
    totalSessions: number;
    price: number;
    productCode?: string;
    isActive?: boolean;
    branchId?: string; // Optional: null/undefined = global pricing
  }) {
    // Validate boosterType for BOOSTER packages
    if (data.packageType === 'BOOSTER' && !data.boosterType) {
      throw {
        status: 400,
        code: 'BOOSTER_TYPE_REQUIRED',
        message: 'Tipe booster wajib diisi untuk paket BOOSTER',
      };
    }

    // Validate serviceType for BOOSTER packages
    if (data.packageType === 'BOOSTER' && !data.serviceType) {
      throw {
        status: 400,
        code: 'SERVICE_TYPE_REQUIRED',
        message: 'Tipe layanan wajib diisi untuk paket BOOSTER',
      };
    }

    // Check if pricing already exists
    const existing = await prisma.packagePricing.findFirst({
      where: {
        packageType: data.packageType,
        boosterType: data.boosterType || null,
        serviceType: data.serviceType || null,
        totalSessions: data.totalSessions,
        branchId: data.branchId || null,
      },
    });

    if (existing) {
      throw {
        status: 409,
        code: 'PRICING_EXISTS',
        message: data.branchId 
          ? 'Harga paket dengan tipe dan jumlah sesi ini sudah ada untuk cabang ini'
          : 'Harga paket global dengan tipe dan jumlah sesi ini sudah ada',
      };
    }

    // Validate branch if branchId is provided
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
        boosterType: data.boosterType || null,
        serviceType: data.serviceType || null,
        name: data.name,
        totalSessions: data.totalSessions,
        price: data.price,
        productCode: data.productCode,
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
      boosterType: pricing.boosterType,
      serviceType: pricing.serviceType,
      name: pricing.name,
      productCode: pricing.productCode,
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
   * Note: Changes to PackagePricing will NOT affect existing MemberPackages
   * because MemberPackage stores a snapshot of the data at assignment time.
   */
  async updatePackagePricing(
    pricingId: string,
    data: {
      packageType?: PackageType;
      boosterType?: string;
      serviceType?: string;
      name?: string;
      totalSessions?: number;
      productCode?: string;
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

    // Validate boosterType for BOOSTER packages
    const newPackageType = data.packageType ?? pricing.packageType;
    if (newPackageType === 'BOOSTER') {
      const newBoosterType = data.boosterType ?? pricing.boosterType;
      if (!newBoosterType) {
        throw {
          status: 400,
          code: 'BOOSTER_TYPE_REQUIRED',
          message: 'Tipe booster wajib diisi untuk paket BOOSTER',
        };
      }

      const newServiceType = data.serviceType ?? pricing.serviceType;
      if (!newServiceType) {
        throw {
          status: 400,
          code: 'SERVICE_TYPE_REQUIRED',
          message: 'Tipe layanan wajib diisi untuk paket BOOSTER',
        };
      }
    }

    // Build update data object (only include fields that are provided)
    const updateData: any = {};
    if (data.packageType !== undefined) updateData.packageType = data.packageType;
    if (data.boosterType !== undefined) updateData.boosterType = data.boosterType;
    if (data.serviceType !== undefined) updateData.serviceType = data.serviceType;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.totalSessions !== undefined) updateData.totalSessions = data.totalSessions;
    if (data.productCode !== undefined) updateData.productCode = data.productCode;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.packagePricing.update({
      where: { id: pricingId },
      data: updateData,
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
      boosterType: updated.boosterType,
      serviceType: updated.serviceType,
      name: updated.name,
      productCode: updated.productCode,
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
