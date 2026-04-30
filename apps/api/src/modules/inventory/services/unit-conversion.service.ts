import { prisma } from '../../../lib/prisma';

/**
 * Service for handling unit conversions in inventory system
 */
export class UnitConversionService {
  /**
   * Convert from base unit to usage unit
   * Example: 2 botol × 500ml/botol = 1000ml
   */
  static baseToUsage(baseQuantity: number, conversionFactor: number): number {
    return baseQuantity * conversionFactor;
  }

  /**
   * Convert from usage unit to base unit
   * Example: 1000ml ÷ 500ml/botol = 2 botol
   */
  static usageToBase(usageQuantity: number, conversionFactor: number): number {
    return usageQuantity / conversionFactor;
  }

  /**
   * Get available usage quantity for an inventory item
   */
  static async getAvailableUsageQuantity(inventoryItemId: string): Promise<{
    baseStock: number;
    usageStock: number;
    baseUnit: string;
    usageUnit: string;
    conversionFactor: number;
  }> {
    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: {
        masterProduct: {
          select: {
            baseUnit: true,
            usageUnit: true,
            conversionFactor: true,
          },
        },
      },
    });

    if (!inventoryItem) {
      throw new Error('Inventory item not found');
    }

    const baseStock = Number(inventoryItem.stock);
    const conversionFactor = Number(inventoryItem.masterProduct.conversionFactor);
    const usageStock = this.baseToUsage(baseStock, conversionFactor);

    return {
      baseStock,
      usageStock,
      baseUnit: inventoryItem.masterProduct.baseUnit,
      usageUnit: inventoryItem.masterProduct.usageUnit,
      conversionFactor,
    };
  }

  /**
   * Check if requested usage quantity is available
   */
  static async isUsageQuantityAvailable(
    inventoryItemId: string,
    requestedUsageQuantity: number
  ): Promise<{
    available: boolean;
    availableUsageQuantity: number;
    requiredBaseQuantity: number;
    availableBaseQuantity: number;
  }> {
    const stockInfo = await this.getAvailableUsageQuantity(inventoryItemId);
    const requiredBaseQuantity = this.usageToBase(requestedUsageQuantity, stockInfo.conversionFactor);

    return {
      available: requestedUsageQuantity <= stockInfo.usageStock,
      availableUsageQuantity: stockInfo.usageStock,
      requiredBaseQuantity: Math.ceil(requiredBaseQuantity), // Round up for partial units
      availableBaseQuantity: stockInfo.baseStock,
    };
  }

  /**
   * Format quantity display with both units
   */
  static formatQuantityDisplay(
    baseQuantity: number,
    usageQuantity: number,
    baseUnit: string,
    usageUnit: string
  ): string {
    if (baseUnit === usageUnit) {
      return `${baseQuantity} ${baseUnit}`;
    }
    return `${baseQuantity} ${baseUnit} (${usageQuantity} ${usageUnit})`;
  }

  /**
   * Get conversion info for multiple inventory items
   */
  static async getConversionInfoBatch(inventoryItemIds: string[]): Promise<Map<string, {
    baseUnit: string;
    usageUnit: string;
    conversionFactor: number;
    baseStock: number;
    usageStock: number;
  }>> {
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { id: { in: inventoryItemIds } },
      include: {
        masterProduct: {
          select: {
            baseUnit: true,
            usageUnit: true,
            conversionFactor: true,
          },
        },
      },
    });

    const conversionMap = new Map();

    for (const item of inventoryItems) {
      const baseStock = Number(item.stock);
      const conversionFactor = Number(item.masterProduct.conversionFactor);
      const usageStock = this.baseToUsage(baseStock, conversionFactor);

      conversionMap.set(item.id, {
        baseUnit: item.masterProduct.baseUnit,
        usageUnit: item.masterProduct.usageUnit,
        conversionFactor,
        baseStock,
        usageStock,
      });
    }

    return conversionMap;
  }

  /**
   * Validate and suggest optimal quantities for stock requests
   */
  static async validateStockRequest(items: Array<{
    inventoryItemId: string;
    requestedQuantity: number;
    unit: 'base' | 'usage';
  }>): Promise<Array<{
    inventoryItemId: string;
    isValid: boolean;
    requestedBaseQuantity: number;
    requestedUsageQuantity: number;
    availableBaseQuantity: number;
    availableUsageQuantity: number;
    suggestion?: string;
  }>> {
    const results = [];

    for (const item of items) {
      const stockInfo = await this.getAvailableUsageQuantity(item.inventoryItemId);
      
      let requestedBaseQuantity: number;
      let requestedUsageQuantity: number;

      if (item.unit === 'base') {
        requestedBaseQuantity = item.requestedQuantity;
        requestedUsageQuantity = this.baseToUsage(item.requestedQuantity, stockInfo.conversionFactor);
      } else {
        requestedUsageQuantity = item.requestedQuantity;
        requestedBaseQuantity = Math.ceil(this.usageToBase(item.requestedQuantity, stockInfo.conversionFactor));
      }

      const isValid = requestedBaseQuantity <= stockInfo.baseStock;
      let suggestion: string | undefined;

      if (!isValid) {
        if (stockInfo.baseStock > 0) {
          const maxUsage = this.baseToUsage(stockInfo.baseStock, stockInfo.conversionFactor);
          suggestion = `Maksimal tersedia: ${stockInfo.baseStock} ${stockInfo.baseUnit} (${maxUsage} ${stockInfo.usageUnit})`;
        } else {
          suggestion = 'Stok tidak tersedia';
        }
      }

      results.push({
        inventoryItemId: item.inventoryItemId,
        isValid,
        requestedBaseQuantity,
        requestedUsageQuantity,
        availableBaseQuantity: stockInfo.baseStock,
        availableUsageQuantity: stockInfo.usageStock,
        suggestion,
      });
    }

    return results;
  }
}