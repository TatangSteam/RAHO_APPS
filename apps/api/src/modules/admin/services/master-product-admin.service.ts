// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { ProductCategory } from '@prisma/client';
import { AppError } from '@middleware/errorHandler';
import { enqueueMasterSafely } from '@modules/zoho/zoho.master.service';

/**
 * Service for Master Product management (SUPER_ADMIN only)
 */
export class MasterProductAdminService {
  /**
   * Get all master products with filtering
   */
  async getAllMasterProducts(filters: {
    category?: ProductCategory;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      category,
      isActive,
      search,
      page = 1,
      limit = 1000, // Increased default limit for inventory modal
    } = filters;

    // Build where clause
    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.masterProduct.count({ where });

    // Get products with pagination + per-branch stock info
    const products = await prisma.masterProduct.findMany({
      where,
      include: {
        inventoryItems: {
          select: {
            id: true,
            stock: true,
            minThreshold: true,
            branch: {
              select: {
                id: true,
                name: true,
                branchCode: true,
              },
            },
            _count: {
              select: {
                materialUsages: true,
              },
            },
          },
        },
        _count: {
          select: {
            inventoryItems: true,
          },
        },
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      products: products.map(product => {
        const branches = product.inventoryItems.map(item => ({
          inventoryItemId: item.id,
          branchId: item.branch.id,
          branchCode: item.branch.branchCode,
          branchName: item.branch.name,
          stock: Number(item.stock),
          minThreshold: Number(item.minThreshold),
          isLowStock: Number(item.stock) <= Number(item.minThreshold),
          isOutOfStock: Number(item.stock) <= 0,
          sessionUsageCount: item._count.materialUsages,
        }));

        const totalStock = branches.reduce((sum, b) => sum + b.stock, 0);
        const totalSessionUsage = branches.reduce((sum, b) => sum + b.sessionUsageCount, 0);
        const lowStockBranches = branches.filter(b => b.isLowStock).length;
        const outOfStockBranches = branches.filter(b => b.isOutOfStock).length;

        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          baseUnit: product.baseUnit,
          usageUnit: product.usageUnit,
          conversionFactor: Number(product.conversionFactor),
          description: product.description,
          isActive: product.isActive,
          usageCount: product._count.inventoryItems,
          // Stock & usage breakdown
          totalStock,
          totalSessionUsage,
          isUsedInSessions: totalSessionUsage > 0,
          lowStockBranches,
          outOfStockBranches,
          branches, // Per-branch detail
          createdAt: product.createdAt.toISOString(),
          updatedAt: product.updatedAt.toISOString(),
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get master product by ID
   */
  async getMasterProduct(productId: string) {
    const product = await prisma.masterProduct.findUnique({
      where: { id: productId },
      include: {
        inventoryItems: {
          include: {
            branch: {
              select: {
                id: true,
                branchCode: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Produk tidak ditemukan');
    }

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      baseUnit: product.baseUnit,
      usageUnit: product.usageUnit,
      conversionFactor: Number(product.conversionFactor),
      description: product.description,
      isActive: product.isActive,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      inventoryItems: product.inventoryItems.map(item => ({
        id: item.id,
        branchId: item.branchId,
        branchCode: item.branch.branchCode,
        branchName: item.branch.name,
        stock: Number(item.stock),
        minThreshold: Number(item.minThreshold),
      })),
    };
  }

  /**
   * Create master product
   */
  async createMasterProduct(data: {
    sku: string;
    name: string;
    category: ProductCategory;
    baseUnit: string;
    usageUnit: string;
    conversionFactor: number;
    description?: string;
  }, userId: string) {
    const sku = data.sku?.trim().toUpperCase();
    if (!sku) {
      throw new AppError(400, 'SKU_REQUIRED', 'SKU wajib diisi untuk sinkronisasi inventory.');
    }
    // Check if product with same name already exists
    const existing = await prisma.masterProduct.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new AppError(409, 'PRODUCT_EXISTS', 'Produk dengan nama ini sudah ada');
    }
    const existingSku = await prisma.masterProduct.findFirst({
      where: { sku: { equals: sku, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingSku) {
      throw new AppError(409, 'SKU_EXISTS', 'SKU sudah digunakan produk lain.');
    }

    const product = await prisma.masterProduct.create({
      data: {
        sku,
        name: data.name,
        category: data.category,
        unit: data.baseUnit, // Legacy field
        baseUnit: data.baseUnit,
        usageUnit: data.usageUnit,
        conversionFactor: data.conversionFactor,
        description: data.description,
        isActive: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        branchId: null, // Master product is global
        action: 'CREATE',
        resource: 'MasterProduct',
        resourceId: product.id,
        meta: {
          name: product.name,
          category: product.category,
        },
      },
    });

    await enqueueMasterSafely('MASTER_PRODUCT', product.id);

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      baseUnit: product.baseUnit,
      usageUnit: product.usageUnit,
      conversionFactor: Number(product.conversionFactor),
      description: product.description,
      isActive: product.isActive,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  /**
   * Update master product
   */
  async updateMasterProduct(
    productId: string,
    data: {
      sku?: string;
      name?: string;
      category?: ProductCategory;
      baseUnit?: string;
      usageUnit?: string;
      conversionFactor?: number;
      description?: string;
      isActive?: boolean;
    },
    userId: string
  ) {
    const product = await prisma.masterProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Produk tidak ditemukan');
    }

    // Check if new name conflicts with existing product
    if (data.name && data.name !== product.name) {
      const existing = await prisma.masterProduct.findUnique({
        where: { name: data.name },
      });

      if (existing) {
        throw new AppError(409, 'PRODUCT_EXISTS', 'Produk dengan nama ini sudah ada');
      }
    }
    const sku = data.sku?.trim().toUpperCase();
    if (data.sku !== undefined && !sku) {
      throw new AppError(400, 'SKU_REQUIRED', 'SKU tidak boleh dikosongkan.');
    }
    if (sku && sku !== product.sku) {
      const existingSku = await prisma.masterProduct.findFirst({
        where: { sku: { equals: sku, mode: 'insensitive' }, id: { not: productId } },
        select: { id: true },
      });
      if (existingSku) throw new AppError(409, 'SKU_EXISTS', 'SKU sudah digunakan produk lain.');
    }

    const updated = await prisma.masterProduct.update({
      where: { id: productId },
      data: {
        ...(sku && { sku }),
        ...(data.name && { name: data.name }),
        ...(data.category && { category: data.category }),
        ...(data.baseUnit && { baseUnit: data.baseUnit, unit: data.baseUnit }),
        ...(data.usageUnit && { usageUnit: data.usageUnit }),
        ...(data.conversionFactor !== undefined && { conversionFactor: data.conversionFactor }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        branchId: null, // Master product is global
        action: 'UPDATE',
        resource: 'MasterProduct',
        resourceId: updated.id,
        meta: {
          name: updated.name,
          changes: data,
        },
      },
    });

    await enqueueMasterSafely('MASTER_PRODUCT', updated.id);

    return {
      id: updated.id,
      sku: updated.sku,
      name: updated.name,
      category: updated.category,
      baseUnit: updated.baseUnit,
      usageUnit: updated.usageUnit,
      conversionFactor: Number(updated.conversionFactor),
      description: updated.description,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Delete master product (soft delete by setting isActive = false)
   */
  async deleteMasterProduct(productId: string, userId: string) {
    const product = await prisma.masterProduct.findUnique({
      where: { id: productId },
      include: {
        _count: {
          select: {
            inventoryItems: true,
          },
        },
      },
    });

    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Produk tidak ditemukan');
    }

    // Check if product is used in any inventory
    if (product._count.inventoryItems > 0) {
      throw new AppError(
        409,
        'PRODUCT_IN_USE',
        `Produk ini digunakan di ${product._count.inventoryItems} cabang. Nonaktifkan produk instead of delete.`
      );
    }

    // Soft delete
    const deleted = await prisma.masterProduct.update({
      where: { id: productId },
      data: { isActive: false },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        branchId: null, // Master product is global
        action: 'DELETE',
        resource: 'MasterProduct',
        resourceId: deleted.id,
        meta: {
          name: deleted.name,
        },
      },
    });

    await enqueueMasterSafely('MASTER_PRODUCT', deleted.id);

    return {
      message: 'Produk berhasil dinonaktifkan',
    };
  }

  /**
   * Get product categories
   */
  async getProductCategories() {
    return {
      categories: [
        { value: 'MEDICINE', label: 'Obat & Cairan' },
        { value: 'DEVICE', label: 'Alat Medis' },
        { value: 'CONSUMABLE', label: 'Bahan Habis Pakai' },
      ],
    };
  }
}
