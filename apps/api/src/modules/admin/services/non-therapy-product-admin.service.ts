import { prisma } from '../../../lib/prisma';
import {
  AirNanoColor,
  AirNanoUnit,
  AirNanoVolume,
  Prisma,
  ProductType,
} from '@prisma/client';

/**
 * Service for admin non-therapy product (add-on) management
 */
export class NonTherapyProductAdminService {
  /**
   * Get all non-therapy products
   */
  async getAllProducts(filters: {
    productType?: ProductType;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const {
      productType,
      isActive,
      page = 1,
      limit = 50,
    } = filters;

    const where: Prisma.NonTherapyProductWhereInput = {};

    if (productType) {
      where.productType = productType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const total = await prisma.nonTherapyProduct.count({ where });

    const products = await prisma.nonTherapyProduct.findMany({
      where,
      orderBy: [
        { productType: 'asc' },
        { name: 'asc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      products: products.map(p => ({
        id: p.id,
        productCode: p.productCode,
        productType: p.productType,
        name: p.name,
        description: p.description,
        airNanoColor: p.airNanoColor,
        airNanoVolume: p.airNanoVolume,
        airNanoUnit: p.airNanoUnit,
        pricePerUnit: Number(p.pricePerUnit),
        isActive: p.isActive,
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
   * Get product by ID
   */
  async getProduct(productId: string) {
    const product = await prisma.nonTherapyProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw {
        status: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'Produk tidak ditemukan',
      };
    }

    return {
      id: product.id,
      productCode: product.productCode,
      productType: product.productType,
      name: product.name,
      description: product.description,
      airNanoColor: product.airNanoColor,
      airNanoVolume: product.airNanoVolume,
      airNanoUnit: product.airNanoUnit,
      pricePerUnit: Number(product.pricePerUnit),
      isActive: product.isActive,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  /**
   * Create product
   */
  async createProduct(data: {
    productCode: string;
    productType: ProductType;
    name: string;
    description?: string;
    pricePerUnit: number;
    airNanoColor?: string;
    airNanoVolume?: string;
    airNanoUnit?: string;
    isActive?: boolean;
  }) {
    // Check if product code already exists
    const existing = await prisma.nonTherapyProduct.findUnique({
      where: { productCode: data.productCode },
    });

    if (existing) {
      throw {
        status: 409,
        code: 'PRODUCT_CODE_EXISTS',
        message: 'Kode produk sudah digunakan',
      };
    }

    const product = await prisma.nonTherapyProduct.create({
      data: {
        productCode: data.productCode,
        productType: data.productType,
        name: data.name,
        description: data.description,
        pricePerUnit: data.pricePerUnit,
        airNanoColor: data.airNanoColor as AirNanoColor | undefined,
        airNanoVolume: data.airNanoVolume as AirNanoVolume | undefined,
        airNanoUnit: data.airNanoUnit as AirNanoUnit | undefined,
        isActive: data.isActive ?? true,
      },
    });

    return {
      id: product.id,
      productCode: product.productCode,
      productType: product.productType,
      name: product.name,
      description: product.description,
      airNanoColor: product.airNanoColor,
      airNanoVolume: product.airNanoVolume,
      airNanoUnit: product.airNanoUnit,
      pricePerUnit: Number(product.pricePerUnit),
      isActive: product.isActive,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    data: {
      name?: string;
      description?: string;
      pricePerUnit?: number;
      isActive?: boolean;
    }
  ) {
    const product = await prisma.nonTherapyProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw {
        status: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'Produk tidak ditemukan',
      };
    }

    const updated = await prisma.nonTherapyProduct.update({
      where: { id: productId },
      data: {
        name: data.name,
        description: data.description,
        pricePerUnit: data.pricePerUnit,
        isActive: data.isActive,
      },
    });

    return {
      id: updated.id,
      productCode: updated.productCode,
      productType: updated.productType,
      name: updated.name,
      description: updated.description,
      airNanoColor: updated.airNanoColor,
      airNanoVolume: updated.airNanoVolume,
      airNanoUnit: updated.airNanoUnit,
      pricePerUnit: Number(updated.pricePerUnit),
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Delete product
   */
  async deleteProduct(productId: string) {
    const product = await prisma.nonTherapyProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw {
        status: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'Produk tidak ditemukan',
      };
    }

    // Check if product is being used
    const usageCount = await prisma.memberNonTherapyPurchase.count({
      where: { productId },
    });

    if (usageCount > 0) {
      throw {
        status: 409,
        code: 'PRODUCT_IN_USE',
        message: `Produk tidak dapat dihapus karena sedang digunakan oleh ${usageCount} transaksi`,
      };
    }

    await prisma.nonTherapyProduct.delete({
      where: { id: productId },
    });

    return { message: 'Produk berhasil dihapus' };
  }
}
