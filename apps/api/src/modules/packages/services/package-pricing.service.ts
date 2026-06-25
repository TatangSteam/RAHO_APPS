// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import type { CreatePackagePricingInput, UpdatePackagePricingInput } from '../packages.schema';
import { AuditAction } from '@prisma/client';

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
    // Check for duplicate
    const existing = await prisma.packagePricing.findFirst({
      where: {
        branchId,
        packageType: data.packageType,
        totalSessions: data.totalSessions,
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
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'PackagePricing',
      resourceId: pricing.id,
      meta: { packageType: data.packageType, totalSessions: data.totalSessions },
    });

    return {
      ...pricing,
      price: Number(pricing.price)
    };
  }

  /**
   * Update package pricing
   */
  async updatePackagePricing(pricingId: string, data: UpdatePackagePricingInput, userId: string) {
    const pricing = await prisma.packagePricing.update({
      where: { id: pricingId },
      data,
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'PackagePricing',
      resourceId: pricingId,
      meta: data,
    });

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
