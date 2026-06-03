// @ts-nocheck
import { prisma } from '../../lib/prisma';

export class InventoryService {
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

    return items.map((item) => ({
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
    }));
  }

  async getInventoryItemById(itemId: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        masterProduct: true,
        branch: true,
      },
    });

    if (!item) return null;

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
      branch: {
        id: item.branch.id,
        branchCode: item.branch.branchCode,
        branchName: item.branch.branchName,
      },
    };
  }
}
