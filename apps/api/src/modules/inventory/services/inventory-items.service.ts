// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { UnitConversionService } from './unit-conversion.service';

/**
 * Service for inventory items management with unit conversion support
 */
export class InventoryItemsService {
  /**
   * Get inventory items for a branch with unit conversion info
   */
  async getInventoryItems(branchId: string) {
    const items = await prisma.inventoryItem.findMany({
      where: { branchId },
      include: {
        masterProduct: {
          select: {
            id: true,
            name: true,
            category: true,
            unit: true,
            baseUnit: true,
            usageUnit: true,
            conversionFactor: true,
            description: true,
          },
        },
      },
      orderBy: [
        { masterProduct: { category: 'asc' } },
        { masterProduct: { name: 'asc' } },
      ],
    });

    return items.map((item) => this.formatInventoryItemWithConversion(item));
  }

  /**
   * Get inventory item by ID with unit conversion info
   */
  async getInventoryItemById(itemId: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        masterProduct: {
          select: {
            id: true,
            name: true,
            category: true,
            unit: true,
            baseUnit: true,
            usageUnit: true,
            conversionFactor: true,
            description: true,
          },
        },
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
      ...this.formatInventoryItemWithConversion(item),
      branch: {
        id: item.branch.id,
        branchCode: item.branch.branchCode,
        name: item.branch.name,
      },
    };
  }

  /**
   * Get low stock items with unit conversion info
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
        masterProduct: {
          select: {
            id: true,
            name: true,
            category: true,
            unit: true,
            baseUnit: true,
            usageUnit: true,
            conversionFactor: true,
            description: true,
          },
        },
        branch: true,
      },
      orderBy: [
        { stock: 'asc' },
      ],
    });

    return items.map((item) => ({
      ...this.formatInventoryItemWithConversion(item),
      branch: {
        id: item.branch.id,
        branchCode: item.branch.branchCode,
        name: item.branch.name,
      },
    }));
  }

  /**
   * Format inventory item with unit conversion information
   */
  private formatInventoryItemWithConversion(item: any) {
    const baseStock = Number(item.stock);
    const conversionFactor = Number(item.masterProduct.conversionFactor);
    const usageStock = UnitConversionService.baseToUsage(baseStock, conversionFactor);
    const minThreshold = Number(item.minThreshold);
    const minThresholdUsage = UnitConversionService.baseToUsage(minThreshold, conversionFactor);

    return {
      id: item.id,
      name: item.masterProduct.name,
      category: item.masterProduct.category,
      unit: item.masterProduct.unit, // Legacy field
      baseUnit: item.masterProduct.baseUnit,
      usageUnit: item.masterProduct.usageUnit,
      conversionFactor: conversionFactor,
      description: item.masterProduct.description,
      
      // Stock information in both units
      stock: baseStock,
      usageStock: usageStock,
      stockDisplay: UnitConversionService.formatQuantityDisplay(
        baseStock, 
        usageStock, 
        item.masterProduct.baseUnit, 
        item.masterProduct.usageUnit
      ),
      
      // Threshold information in both units
      minThreshold: minThreshold,
      minThresholdUsage: minThresholdUsage,
      thresholdDisplay: UnitConversionService.formatQuantityDisplay(
        minThreshold, 
        minThresholdUsage, 
        item.masterProduct.baseUnit, 
        item.masterProduct.usageUnit
      ),
      
      isLowStock: baseStock <= minThreshold,
      storageLocation: item.storageLocation,
      masterProductId: item.masterProductId,
      branchId: item.branchId,
    };
  }

  /**
   * Check availability for usage quantity
   */
  async checkUsageAvailability(itemId: string, requestedUsageQuantity: number) {
    return await UnitConversionService.isUsageQuantityAvailable(itemId, requestedUsageQuantity);
  }

  /**
   * Get conversion info for multiple items (for batch operations)
   */
  async getConversionInfoBatch(itemIds: string[]) {
    return await UnitConversionService.getConversionInfoBatch(itemIds);
  }

  /**
   * Adjust stock (for Admin Cabang Pusat only)
   * Creates stock mutation and updates inventory
   */
  async adjustStock(itemId: string, adjustment: number, notes: string | undefined, userId: string) {
    throw {
      status: 410,
      code: 'LEGACY_STOCK_ADJUSTMENT_DISABLED',
      message: 'Adjustment langsung dinonaktifkan. Gunakan dokumen Inventory Adjustment dengan approval dan posting jurnal.',
    };

    /* c8 ignore start -- retained temporarily for response compatibility during client migration */
    // Get inventory item
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

    const stockBefore = Number(item.stock);
    const stockAfter = stockBefore + adjustment;

    // Validate stock after adjustment
    if (stockAfter < 0) {
      throw {
        status: 422,
        code: 'INVALID_ADJUSTMENT',
        message: `Stok tidak boleh negatif. Stok saat ini: ${stockBefore} ${item.masterProduct.baseUnit}`,
      };
    }

    // Update stock and create mutation in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update inventory stock
      const updatedItem = await tx.inventoryItem.update({
        where: { id: itemId },
        data: { stock: stockAfter },
      });

      // Create stock mutation
      const mutation = await tx.stockMutation.create({
        data: {
          inventoryItemId: itemId,
          type: 'ADJUSTMENT',
          quantity: Math.abs(adjustment),
          stockBefore,
          stockAfter,
          referenceType: 'ManualAdjustment',
          referenceId: userId,
          notes: notes || `Manual adjustment by Admin Cabang Pusat: ${adjustment > 0 ? '+' : ''}${adjustment} ${item.masterProduct.baseUnit}`,
          createdBy: userId,
        },
      });

      return { updatedItem, mutation };
    });

    // Calculate usage stock for display
    const conversionFactor = Number(item.masterProduct.conversionFactor);
    const usageStockBefore = UnitConversionService.baseToUsage(stockBefore, conversionFactor);
    const usageStockAfter = UnitConversionService.baseToUsage(stockAfter, conversionFactor);

    return {
      success: true,
      message: 'Stok berhasil disesuaikan',
      item: {
        id: item.id,
        name: item.masterProduct.name,
        branchName: item.branch.name,
      },
      adjustment: {
        value: adjustment,
        unit: item.masterProduct.baseUnit,
      },
      stock: {
        before: {
          base: stockBefore,
          usage: usageStockBefore,
          display: `${stockBefore.toFixed(2)} ${item.masterProduct.baseUnit} (${usageStockBefore.toFixed(0)} ${item.masterProduct.usageUnit})`,
        },
        after: {
          base: stockAfter,
          usage: usageStockAfter,
          display: `${stockAfter.toFixed(2)} ${item.masterProduct.baseUnit} (${usageStockAfter.toFixed(0)} ${item.masterProduct.usageUnit})`,
        },
      },
      mutationId: result.mutation.id,
    };
    /* c8 ignore stop */
  }

  /**
   * Create new inventory item with master product
   */
  async createInventoryItem(data: {
    name?: string;
    category?: string;
    baseUnit?: string;
    usageUnit?: string;
    conversionFactor?: number;
    stock?: number;
    minThreshold?: number;
    storageLocation?: string;
    masterProductId?: string; // NEW: Use existing master product
    usageStock?: number;
    minThresholdUsage?: number;
  }, branchId: string, userId: string) {
    // If masterProductId is provided, use existing master product
    if (data.masterProductId) {
      return await this.createInventoryItemFromMasterProduct(data, branchId, userId);
    }

    // Otherwise, create new master product (legacy behavior)
    // Create master product and inventory item in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create master product
      const masterProduct = await tx.masterProduct.create({
        data: {
          name: data.name!,
          category: data.category!,
          baseUnit: data.baseUnit!,
          usageUnit: data.usageUnit!,
          conversionFactor: data.conversionFactor!,
          unit: data.baseUnit!, // Legacy field
        },
      });

      // Create inventory item
      const inventoryItem = await tx.inventoryItem.create({
        data: {
          masterProductId: masterProduct.id,
          branchId: branchId,
          stock: data.stock || 0,
          minThreshold: data.minThreshold || 10,
          storageLocation: data.storageLocation,
        },
        include: {
          masterProduct: true,
          branch: true,
        },
      });

      // Create initial stock mutation if stock > 0
      if (data.stock && data.stock > 0) {
        await tx.stockMutation.create({
          data: {
            inventoryItemId: inventoryItem.id,
            type: 'INITIAL_STOCK',
            quantity: data.stock,
            stockBefore: 0,
            stockAfter: data.stock,
            referenceType: 'InitialStock',
            referenceId: userId,
            notes: `Initial stock for new item: ${data.name}`,
            createdBy: userId,
          },
        });
      }

      return inventoryItem;
    });

    return {
      success: true,
      message: 'Item inventori berhasil ditambahkan',
      item: this.formatInventoryItemWithConversion(result),
    };
  }

  /**
   * Create inventory item from existing master product
   */
  async createInventoryItemFromMasterProduct(data: {
    masterProductId: string;
    stock?: number;
    minThreshold?: number;
    storageLocation?: string;
    usageStock?: number;
    minThresholdUsage?: number;
  }, branchId: string, userId: string) {
    // Verify master product exists
    const masterProduct = await prisma.masterProduct.findUnique({
      where: { id: data.masterProductId },
    });

    if (!masterProduct) {
      throw {
        status: 404,
        code: 'MASTER_PRODUCT_NOT_FOUND',
        message: 'Master produk tidak ditemukan',
      };
    }

    // Check if inventory item already exists for this branch and master product
    const existingItem = await prisma.inventoryItem.findUnique({
      where: {
        masterProductId_branchId: {
          masterProductId: data.masterProductId,
          branchId: branchId,
        },
      },
    });

    if (existingItem) {
      throw {
        status: 409,
        code: 'ITEM_ALREADY_EXISTS',
        message: `Item "${masterProduct.name}" sudah ada di cabang ini`,
      };
    }

    const stock = data.stock || 0;
    const minThreshold = data.minThreshold || 10;

    // Create inventory item in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create inventory item
      const inventoryItem = await tx.inventoryItem.create({
        data: {
          masterProductId: data.masterProductId,
          branchId: branchId,
          stock: stock,
          minThreshold: minThreshold,
          storageLocation: data.storageLocation || null,
        },
        include: {
          masterProduct: true,
          branch: true,
        },
      });

      // Create initial stock mutation if stock > 0
      if (stock > 0) {
        await tx.stockMutation.create({
          data: {
            inventoryItemId: inventoryItem.id,
            type: 'INITIAL_STOCK',
            quantity: stock,
            stockBefore: 0,
            stockAfter: stock,
            referenceType: 'InitialStock',
            referenceId: userId,
            notes: `Initial stock for item: ${masterProduct.name}`,
            createdBy: userId,
          },
        });
      }

      return inventoryItem;
    });

    return {
      success: true,
      message: 'Item inventori berhasil ditambahkan',
      item: this.formatInventoryItemWithConversion(result),
    };
  }

  /**
   * Update inventory item and master product
   */
  async updateInventoryItem(itemId: string, data: {
    name?: string;
    category?: string;
    baseUnit?: string;
    usageUnit?: string;
    conversionFactor?: number;
    stock?: number;
    minThreshold?: number;
    storageLocation?: string;
  }, userId: string) {
    if (data.stock !== undefined) {
      throw {
        status: 410,
        code: 'DIRECT_STOCK_UPDATE_DISABLED',
        message: 'Perubahan stock langsung dinonaktifkan. Gunakan Inventory Adjustment atau Stock Opname.',
      };
    }
    // Get current item
    const currentItem = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: { masterProduct: true },
    });

    if (!currentItem) {
      throw {
        status: 404,
        code: 'ITEM_NOT_FOUND',
        message: 'Item inventory tidak ditemukan',
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update master product if needed
      const masterProductUpdates: any = {};
      if (data.name !== undefined) masterProductUpdates.name = data.name;
      if (data.category !== undefined) masterProductUpdates.category = data.category;
      if (data.baseUnit !== undefined) {
        masterProductUpdates.baseUnit = data.baseUnit;
        masterProductUpdates.unit = data.baseUnit; // Legacy field
      }
      if (data.usageUnit !== undefined) masterProductUpdates.usageUnit = data.usageUnit;
      if (data.conversionFactor !== undefined) masterProductUpdates.conversionFactor = data.conversionFactor;

      if (Object.keys(masterProductUpdates).length > 0) {
        await tx.masterProduct.update({
          where: { id: currentItem.masterProductId },
          data: masterProductUpdates,
        });
      }

      // Update inventory item
      const inventoryUpdates: any = {};
      if (data.minThreshold !== undefined) inventoryUpdates.minThreshold = data.minThreshold;
      if (data.storageLocation !== undefined) inventoryUpdates.storageLocation = data.storageLocation;

      // Handle stock update with mutation
      if (data.stock !== undefined && data.stock !== currentItem.stock) {
        const stockBefore = Number(currentItem.stock);
        const stockAfter = data.stock;
        const adjustment = stockAfter - stockBefore;

        inventoryUpdates.stock = stockAfter;

        // Create stock mutation
        await tx.stockMutation.create({
          data: {
            inventoryItemId: itemId,
            type: 'ADJUSTMENT',
            quantity: Math.abs(adjustment),
            stockBefore,
            stockAfter,
            referenceType: 'ManualAdjustment',
            referenceId: userId,
            notes: `Stock updated via edit: ${adjustment > 0 ? '+' : ''}${adjustment} ${currentItem.masterProduct.baseUnit}`,
            createdBy: userId,
          },
        });
      }

      if (Object.keys(inventoryUpdates).length > 0) {
        await tx.inventoryItem.update({
          where: { id: itemId },
          data: inventoryUpdates,
        });
      }

      // Get updated item
      return await tx.inventoryItem.findUnique({
        where: { id: itemId },
        include: {
          masterProduct: true,
          branch: true,
        },
      });
    });

    return {
      success: true,
      message: 'Item inventori berhasil diperbarui',
      item: this.formatInventoryItemWithConversion(result),
    };
  }

  /**
   * Delete inventory item (soft delete by setting stock to 0 and marking as inactive)
   */
  async deleteInventoryItem(itemId: string, userId: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: { masterProduct: true },
    });

    if (!item) {
      throw {
        status: 404,
        code: 'ITEM_NOT_FOUND',
        message: 'Item inventory tidak ditemukan',
      };
    }

    // Check if item has been used in any sessions
    const usageCount = await prisma.materialUsage.count({
      where: { inventoryItemId: itemId },
    });

    if (usageCount > 0) {
      throw {
        status: 422,
        code: 'ITEM_IN_USE',
        message: 'Item tidak dapat dihapus karena sudah digunakan dalam sesi terapi',
      };
    }

    // Delete inventory item and all related records
    const result = await prisma.$transaction(async (tx) => {
      // Delete all stock mutations first (to avoid foreign key constraint)
      await tx.stockMutation.deleteMany({
        where: { inventoryItemId: itemId },
      });

      // Delete inventory item
      await tx.inventoryItem.delete({
        where: { id: itemId },
      });

      // Check if master product is used by other inventory items
      const otherItems = await tx.inventoryItem.count({
        where: { masterProductId: item.masterProductId },
      });

      // If no other items use this master product, delete it too
      if (otherItems === 0) {
        await tx.masterProduct.delete({
          where: { id: item.masterProductId },
        });
      }

      return item;
    });

    return {
      success: true,
      message: 'Item inventori berhasil dihapus',
      item: {
        id: result.id,
        name: result.masterProduct.name,
      },
    };
  }

  /**
   * Batch create inventory items from master products
   */
  async batchCreateInventoryItems(items: Array<{
    masterProductId: string;
    stock?: number;
    minThreshold?: number;
    storageLocation?: string;
  }>, branchId: string, userId: string) {
    let created = 0;
    let skipped = 0;
    const createdItems: any[] = [];
    const errors: string[] = [];

    // Process each item in a transaction
    const result = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        try {
          // Verify master product exists
          const masterProduct = await tx.masterProduct.findUnique({
            where: { id: item.masterProductId },
          });

          if (!masterProduct) {
            errors.push(`Produk dengan ID ${item.masterProductId} tidak ditemukan`);
            skipped++;
            continue;
          }

          // Check if inventory item already exists for this branch and master product
          const existingItem = await tx.inventoryItem.findUnique({
            where: {
              masterProductId_branchId: {
                masterProductId: item.masterProductId,
                branchId: branchId,
              },
            },
          });

          if (existingItem) {
            skipped++;
            continue;
          }

          const stock = item.stock || 0;
          const minThreshold = item.minThreshold || 10;

          // Create inventory item
          const inventoryItem = await tx.inventoryItem.create({
            data: {
              masterProductId: item.masterProductId,
              branchId: branchId,
              stock: stock,
              minThreshold: minThreshold,
              storageLocation: item.storageLocation || null,
            },
            include: {
              masterProduct: true,
            },
          });

          // Create initial stock mutation if stock > 0
          if (stock > 0) {
            await tx.stockMutation.create({
              data: {
                inventoryItemId: inventoryItem.id,
                type: 'INITIAL_STOCK',
                quantity: stock,
                stockBefore: 0,
                stockAfter: stock,
                referenceType: 'BatchCreate',
                referenceId: userId,
                notes: `Batch create initial stock for: ${masterProduct.name}`,
                createdBy: userId,
              },
            });
          }

          createdItems.push({
            id: inventoryItem.id,
            name: masterProduct.name,
            category: masterProduct.category,
            stock: stock,
            minThreshold: minThreshold,
          });
          created++;
        } catch (err: any) {
          errors.push(`Error creating item: ${err.message}`);
          skipped++;
        }
      }

      return { created, skipped, createdItems, errors };
    });

    return {
      success: true,
      message: `Berhasil menambahkan ${result.created} item inventori`,
      created: result.created,
      skipped: result.skipped,
      items: result.createdItems,
      errors: result.errors.length > 0 ? result.errors : undefined,
    };
  }
}
