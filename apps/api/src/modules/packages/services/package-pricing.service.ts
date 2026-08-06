import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import type { CreatePackagePricingInput, UpdatePackagePricingInput } from '../packages.schema';
import { AuditAction, Prisma } from '@prisma/client';
import { enqueueMasterSafely } from '@modules/zoho/zoho.master.service';

function normalizeNullableString(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Service for managing package pricing
 */
export class PackagePricingService {
  /**
   * Get package pricings for a branch
   */
  async getPackagePricings(branchId: string) {
    try {
      const pricings = await prisma.packagePricing.findMany({
        where: { branchId },
        orderBy: [{ packageType: 'asc' }, { totalSessions: 'asc' }],
      });

      return pricings.map(p => ({
        id: p.id,
        branchId: p.branchId,
        packageType: p.packageType,
        boosterType: p.boosterType,
        serviceType: p.serviceType,
        productCode: p.productCode,
        name: p.name,
        totalSessions: p.totalSessions,
        price: Number(p.price),
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));
    } catch (error) {
      console.error('getPackagePricings service error:', error);
      throw error;
    }
  }

  /**
   * Get all package pricings (for ADMIN_MANAGER monitoring)
   */
  async getAllPackagePricings() {
    try {
      const pricings = await prisma.packagePricing.findMany({
        include: {
          branch: {
            select: {
              id: true,
              branchCode: true,
              name: true,
            },
          },
        },
        orderBy: [
          { branchId: 'asc' },
          { packageType: 'asc' },
          { totalSessions: 'asc' },
        ],
      });

      // Filter out pricings with null branches and map
      return pricings
        .filter(p => p.branch !== null)
        .map(p => ({
          id: p.id,
          branchId: p.branchId,
          branchCode: p.branch.branchCode,
          branchName: p.branch.name,
          packageType: p.packageType,
          boosterType: p.boosterType,
          serviceType: p.serviceType,
          productCode: p.productCode,
          name: p.name,
          totalSessions: p.totalSessions,
          price: Number(p.price),
          isActive: p.isActive,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }));
    } catch (error) {
      console.error('getAllPackagePricings service error:', error);
      throw error;
    }
  }

  /**
   * Create package pricing
   */
  async createPackagePricing(data: CreatePackagePricingInput, branchId: string, userId: string) {
    const boosterType = data.packageType === 'BOOSTER'
      ? normalizeNullableString(data.boosterType)
      : null;
    const serviceType = normalizeNullableString(data.serviceType);
    const productCode = normalizeNullableString(data.productCode);

    if (data.packageType === 'BOOSTER' && !boosterType) {
      throw {
        status: 400,
        code: 'BOOSTER_TYPE_REQUIRED',
        message: 'Tipe booster wajib diisi untuk paket BOOSTER',
      };
    }

    if (data.packageType === 'BOOSTER' && !serviceType) {
      throw {
        status: 400,
        code: 'SERVICE_TYPE_REQUIRED',
        message: 'Tipe layanan wajib diisi untuk paket BOOSTER',
      };
    }

    // Check for duplicate
    const existing = await prisma.packagePricing.findFirst({
      where: {
        branchId,
        packageType: data.packageType,
        boosterType,
        serviceType,
        totalSessions: data.totalSessions,
        productCode,
      },
    });

    if (existing) {
      throw {
        status: 409,
        code: 'PRICING_DUPLICATE',
        message: 'Harga paket dengan tipe dan jumlah sesi ini sudah ada',
      };
    }

    const pricing = await prisma.packagePricing.create({
      data: {
        ...data,
        branchId,
        boosterType,
        serviceType,
        productCode,
      } as Prisma.PackagePricingUncheckedCreateInput,
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'PackagePricing',
      resourceId: pricing.id,
      meta: { packageType: data.packageType, totalSessions: data.totalSessions },
    });

    await enqueueMasterSafely('PACKAGE_PRICING', pricing.id);

    return {
      ...pricing,
      price: Number(pricing.price)
    };
  }

  /**
   * Update package pricing
   */
  async updatePackagePricing(pricingId: string, data: UpdatePackagePricingInput, userId: string) {
    const current = await prisma.packagePricing.findUnique({
      where: { id: pricingId },
    });

    if (!current) {
      throw {
        status: 404,
        code: 'PRICING_NOT_FOUND',
        message: 'Harga paket tidak ditemukan',
      };
    }

    const packageType = data.packageType ?? current.packageType;
    const boosterType = packageType === 'BOOSTER'
      ? (data.boosterType !== undefined ? normalizeNullableString(data.boosterType) : current.boosterType)
      : null;
    const serviceType = data.serviceType !== undefined
      ? normalizeNullableString(data.serviceType)
      : current.serviceType;
    const productCode = data.productCode !== undefined
      ? normalizeNullableString(data.productCode)
      : current.productCode;
    const totalSessions = data.totalSessions ?? current.totalSessions;

    const duplicate = await prisma.packagePricing.findFirst({
      where: {
        id: { not: pricingId },
        branchId: current.branchId,
        packageType,
        boosterType,
        serviceType,
        totalSessions,
        productCode,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw {
        status: 409,
        code: 'PRICING_DUPLICATE',
        message: productCode
          ? `Kode produk ${productCode} sudah ada untuk kombinasi paket ini`
          : 'Harga paket dengan tipe, layanan, jumlah sesi, dan kode produk kosong ini sudah ada',
      };
    }

    const updateData: Prisma.PackagePricingUncheckedUpdateInput = { ...data };
    if (data.packageType !== undefined) updateData.packageType = packageType;
    if (data.boosterType !== undefined || packageType === 'BASIC') updateData.boosterType = boosterType;
    if (data.serviceType !== undefined) updateData.serviceType = serviceType;
    if (data.productCode !== undefined) updateData.productCode = productCode;
    if (data.totalSessions !== undefined) updateData.totalSessions = totalSessions;

    const pricing = await prisma.packagePricing.update({
      where: { id: pricingId },
      data: updateData,
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'PackagePricing',
      resourceId: pricingId,
      meta: data,
    });

    await enqueueMasterSafely('PACKAGE_PRICING', pricing.id);

    return {
      ...pricing,
      price: Number(pricing.price)
    };
  }

  /**
   * Delete package pricing
   */
  async deletePackagePricing(pricingId: string, userId: string) {
    await prisma.packagePricing.delete({
      where: { id: pricingId },
    });

    await logAudit({
      userId,
      action: AuditAction.DELETE,
      resource: 'PackagePricing',
      resourceId: pricingId,
      meta: {},
    });

    return { message: 'Harga paket berhasil dihapus' };
  }
}
