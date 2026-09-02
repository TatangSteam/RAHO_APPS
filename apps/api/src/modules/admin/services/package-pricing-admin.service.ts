import { prisma } from '../../../lib/prisma';
import { PackageType, Prisma } from '@prisma/client';
import { enqueueMasterSafely } from '@modules/zoho/zoho.master.service';

function normalizeNullableString(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildPricingIdentityWhere(params: {
  branchId: string | null;
  packageType: PackageType;
  boosterType: string | null;
  serviceType: string | null;
  totalSessions: number;
  productCode: string | null;
  excludeId?: string;
}) {
  const where: Prisma.PackagePricingWhereInput = params.productCode
    ? {
        branchId: params.branchId,
        productCode: { equals: params.productCode, mode: 'insensitive' },
      }
    : {
        packageType: params.packageType,
        boosterType: params.boosterType,
        serviceType: params.serviceType,
        totalSessions: params.totalSessions,
        branchId: params.branchId,
        productCode: null,
      };

  if (params.excludeId) {
    where.id = { not: params.excludeId };
  }

  return where;
}

async function ensureActiveServiceType(code: string | null | undefined) {
  if (!code) return;
  const serviceType = await prisma.masterServiceType.findUnique({ where: { code } });
  if (!serviceType || !serviceType.isActive) {
    throw {
      status: 400,
      code: 'SERVICE_TYPE_INVALID',
      message: `Tipe layanan ${code} tidak ditemukan atau sudah nonaktif`,
    };
  }
}

function getPricingDuplicateMessage(branchId: string | null, productCode: string | null) {
  if (productCode) {
    return branchId
      ? `Kode produk ${productCode} sudah ada untuk kombinasi paket ini di cabang ini`
      : `Kode produk ${productCode} sudah ada untuk kombinasi paket global ini`;
  }

  return branchId
    ? 'Harga paket dengan tipe, layanan, jumlah sesi, dan kode produk kosong ini sudah ada untuk cabang ini'
    : 'Harga paket global dengan tipe, layanan, jumlah sesi, dan kode produk kosong ini sudah ada';
}

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
    const where: Prisma.PackagePricingWhereInput = {};

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
    boosterType?: string | null;
    serviceType?: string | null;
    name: string;
    totalSessions: number;
    price: number;
    productCode?: string | null;
    isActive?: boolean;
    branchId?: string | null; // Optional: null/undefined = global pricing
  }) {
    const boosterType = normalizeNullableString(data.boosterType);
    const serviceType = normalizeNullableString(data.serviceType);
    const productCode = normalizeNullableString(data.productCode)?.toUpperCase() || null;
    const branchId = normalizeNullableString(data.branchId);

    // Validate boosterType for BOOSTER packages
    if (data.packageType === 'BOOSTER' && !boosterType) {
      throw {
        status: 400,
        code: 'BOOSTER_TYPE_REQUIRED',
        message: 'Tipe booster wajib diisi untuk paket BOOSTER',
      };
    }

    // Validate serviceType for BOOSTER packages
    if (data.packageType === 'BOOSTER' && !serviceType) {
      throw {
        status: 400,
        code: 'SERVICE_TYPE_REQUIRED',
        message: 'Tipe layanan wajib diisi untuk paket BOOSTER',
      };
    }

    await ensureActiveServiceType(serviceType);

    // Check if pricing already exists
    const existing = await prisma.packagePricing.findFirst({
      where: buildPricingIdentityWhere({
        packageType: data.packageType,
        boosterType: boosterType || null,
        serviceType: serviceType || null,
        totalSessions: data.totalSessions,
        branchId: branchId || null,
        productCode,
      }),
    });

    if (existing) {
      throw {
        status: 409,
        code: 'PRICING_EXISTS',
        message: getPricingDuplicateMessage(branchId || null, productCode),
      };
    }

    // Validate branch if branchId is provided
    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
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
        boosterType: boosterType || null,
        serviceType: serviceType || null,
        name: data.name,
        totalSessions: data.totalSessions,
        price: data.price,
        productCode,
        isActive: data.isActive ?? true,
        branchId: branchId || null,
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

    await enqueueMasterSafely('PACKAGE_PRICING', pricing.id);

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
      boosterType?: string | null;
      serviceType?: string | null;
      name?: string;
      totalSessions?: number;
      productCode?: string | null;
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
    const normalizedBoosterType = newPackageType === 'BOOSTER'
      ? (data.boosterType !== undefined ? normalizeNullableString(data.boosterType) : pricing.boosterType)
      : null;
    const normalizedServiceType =
      data.serviceType !== undefined ? normalizeNullableString(data.serviceType) : pricing.serviceType;
    const normalizedProductCode =
      data.productCode !== undefined
        ? normalizeNullableString(data.productCode)?.toUpperCase() || null
        : undefined;
    const effectiveProductCode = data.productCode !== undefined
      ? normalizedProductCode || null
      : pricing.productCode;
    const newTotalSessions = data.totalSessions ?? pricing.totalSessions;

    if (newPackageType === 'BOOSTER') {
      if (!normalizedBoosterType) {
        throw {
          status: 400,
          code: 'BOOSTER_TYPE_REQUIRED',
          message: 'Tipe booster wajib diisi untuk paket BOOSTER',
        };
      }

      if (!normalizedServiceType) {
        throw {
          status: 400,
          code: 'SERVICE_TYPE_REQUIRED',
          message: 'Tipe layanan wajib diisi untuk paket BOOSTER',
        };
      }
    }


    // Existing legacy/custom codes remain editable even when they predate the
    // master table. Only a change to a different service code must reference
    // an active master entry.
    if (
      data.isActive !== false &&
      data.serviceType !== undefined &&
      normalizedServiceType !== pricing.serviceType
    ) {
      await ensureActiveServiceType(normalizedServiceType);
    }

    const duplicate = await prisma.packagePricing.findFirst({
      where: buildPricingIdentityWhere({
        packageType: newPackageType,
        boosterType: normalizedBoosterType || null,
        serviceType: normalizedServiceType || null,
        totalSessions: newTotalSessions,
        branchId: pricing.branchId || null,
        productCode: effectiveProductCode || null,
        excludeId: pricingId,
      }),
      select: { id: true },
    });

    if (duplicate) {
      throw {
        status: 409,
        code: 'PRICING_EXISTS',
        message: getPricingDuplicateMessage(pricing.branchId || null, effectiveProductCode || null),
      };
    }

    // Build update data object (only include fields that are provided)
    const updateData: Prisma.PackagePricingUncheckedUpdateInput = {};
    if (data.packageType !== undefined) updateData.packageType = data.packageType;
    if (data.boosterType !== undefined || newPackageType === 'BASIC') updateData.boosterType = normalizedBoosterType;
    if (data.serviceType !== undefined) updateData.serviceType = normalizedServiceType;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.totalSessions !== undefined) updateData.totalSessions = data.totalSessions;
    if (data.productCode !== undefined) updateData.productCode = normalizedProductCode;
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

    await enqueueMasterSafely('PACKAGE_PRICING', updated.id);

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
