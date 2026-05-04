// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { ProductCategory } from '@prisma/client';
import { AppError } from '@middleware/errorHandler';

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
      limit = 50,
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
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.masterProduct.count({ where });

    // Get products with pagination
    const products = await prisma.masterProduct.findMany({
      where,
      include: {
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
      products: products.map(product => ({
        id: product.id,
        name: product.name,
        category: product.category,
        baseUnit: product.baseUnit,
        usageUnit: product.usageUnit,
        conversionFactor: Number(product.conversionFactor),
        description: product.description,
        isActive: product.isActive,
        usageCount: product._count.inventoryItems,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
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
    name: string;
    category: ProductCategory;
    baseUnit: string;
    usageUnit: string;
    conversionFactor: number;
    description?: string;
  }, userId: string) {
    // Check if product with same name already exists
    const existing = await prisma.masterProduct.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new AppError(409, 'PRODUCT_EXISTS', 'Produk dengan nama ini sudah ada');
    }

    const product = await prisma.masterProduct.create({
      data: {
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

    return {
      id: product.id,
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

    const updated = await prisma.masterProduct.update({
      where: { id: productId },
      data: {
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

    return {
      id: updated.id,
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
