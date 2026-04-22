// @ts-nocheck
import { prisma } from '../../../lib/prisma';

/**
 * Service for inventory items management
 */
export class InventoryItemsService {
  /**
   * Get inventory items for a branch
   */
  async getInventoryItems(branchId: string) {
    const items = await prisma.inventoryItem.findMany({
      where: { branchId },
      include: {
        masterProduct: true,
      },
      orderBy: [
        { masterProduct: { category: 'asc' } },
        { masterProduct: { name: 'asc' } },
      ],
    });

    return items.map((item) => this.formatInventoryItem(item));
  }

  /**
   * Get inventory item by ID
   */
  async getInventoryItemById(itemId: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        masterProduct: true,
        branch: true,
      },
    });

    if (!item) {
      throw {
        status: 404,
        code: 'ITEM_NOT_FOUND',
        message: 'Item inventory tidak ditemukan',
      };
    }

    return {
      ...this.formatInventoryItem(item),
      branch: {
        id: item.branch.id,
        branchCode: item.branch.branchCode,
        name: item.branch.name,
      },
    };
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(branchId?: string) {
    const where: any = {};
    
    if (branchId) {
      where.branchId = branchId;
    }

    const items = await prisma.inventoryItem.findMany({
      where: {
        ...where,
        stock: {
          lte: prisma.inventoryItem.fields.minThreshold,
        },
      },
      include: {
        masterProduct: true,
        branch: true,
      },
      orderBy: [
        { stock: 'asc' },
      ],
    });

    return items.map((item) => ({
      ...this.formatInventoryItem(item),
      branch: {
        id: item.branch.id,
        branchCode: item.branch.branchCode,
        name: item.branch.name,
      },
    }));
  }

  /**
   * Format inventory item for response
   */
  private formatInventoryItem(item: any) {
    return {
      id: item.id,
      name: item.masterProduct.name,
      category: item.masterProduct.category,
      unit: item.masterProduct.unit,
      description: item.masterProduct.description,
      stock: Number(item.stock),
      minThreshold: Number(item.minThreshold),
      storageLocation: item.storageLocation,
      isLowStock: Number(item.stock) <= Number(item.minThreshold),
      masterProductId: item.masterProductId,
      branchId: item.branchId,
    };
  }
}
