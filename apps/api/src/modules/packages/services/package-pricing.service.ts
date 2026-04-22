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
    const pricings = await prisma.packagePricing.findMany({
      where: {
        OR: [
          { branchId },
          { branchId: null }, // Global pricings
        ],
      },
      orderBy: [
        { packageType: 'asc' },
        { totalSessions: 'asc' },
      ],
    });

    return pricings.map(p => ({
      id: p.id,
      packageType: p.packageType,
      totalSessions: p.totalSessions,
      price: Number(p.price),
      isActive: p.isActive,
      branchId: p.branchId,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  /**
   * Get all package pricings (for super admin)
   */
  async getAllPackagePricings() {
    const pricings = await prisma.packagePricing.findMany({
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
    });

    return pricings.map(p => ({
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
    }));
  }

  /**
   * Create package pricing
   */
  async createPackagePricing(data: CreatePackagePricingInput, branchId: string, userId: string) {
    // Check if pricing already exists
    const existing = await prisma.packagePricing.findFirst({
      where: {
        packageType: data.packageType,
        totalSessions: data.totalSessions,
        branchId: data.branchId || branchId,
      },
    });

    if (existing) {
      throw {
        status: 409,
        code: 'PRICING_EXISTS',
        message: 'Harga paket dengan tipe dan jumlah sesi ini sudah ada',
      };
    }

    const pricing = await prisma.packagePricing.create({
      data: {
        packageType: data.packageType,
        totalSessions: data.totalSessions,
        price: data.price,
        isActive: data.isActive ?? true,
        branchId: data.branchId || branchId,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'PackagePricing',
      resourceId: pricing.id,
      meta: { packageType: pricing.packageType, totalSessions: pricing.totalSessions },
    });

    return {
      id: pricing.id,
      packageType: pricing.packageType,
      totalSessions: pricing.totalSessions,
      price: Number(pricing.price),
      isActive: pricing.isActive,
      branchId: pricing.branchId,
      createdAt: pricing.createdAt.toISOString(),
      updatedAt: pricing.updatedAt.toISOString(),
    };
  }

  /**
   * Update package pricing
   */
  async updatePackagePricing(pricingId: string, data: UpdatePackagePricingInput, userId: string) {
    const pricing = await prisma.packagePricing.findUnique({
      where: { id: pricingId },
    });

    if (!pricing) {
      throw { status: 404, code: 'PRICING_NOT_FOUND', message: 'Harga paket tidak ditemukan' };
    }

    const updated = await prisma.packagePricing.update({
      where: { id: pricingId },
      data: {
        price: data.price,
        isActive: data.isActive,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'PackagePricing',
      resourceId: pricingId,
      meta: { price: data.price, isActive: data.isActive },
    });

    return {
      id: updated.id,
      packageType: updated.packageType,
      totalSessions: updated.totalSessions,
      price: Number(updated.price),
      isActive: updated.isActive,
      branchId: updated.branchId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Delete package pricing
   */
  async deletePackagePricing(pricingId: string, userId: string) {
    const pricing = await prisma.packagePricing.findUnique({
      where: { id: pricingId },
    });

    if (!pricing) {
      throw { status: 404, code: 'PRICING_NOT_FOUND', message: 'Harga paket tidak ditemukan' };
    }

    await prisma.packagePricing.delete({
      where: { id: pricingId },
    });

    await logAudit({
      userId,
      action: AuditAction.DELETE,
      resource: 'PackagePricing',
      resourceId: pricingId,
      meta: { packageType: pricing.packageType, totalSessions: pricing.totalSessions },
    });

    return { message: 'Harga paket berhasil dihapus' };
  }
}
