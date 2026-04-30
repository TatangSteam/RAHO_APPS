/**
 * Frontend utility functions for unit conversion
 */

export interface UnitConversionInfo {
  baseUnit: string;
  usageUnit: string;
  conversionFactor: number;
}

export class UnitConversionUtils {
  /**
   * Convert from base unit to usage unit
   */
  static baseToUsage(baseQuantity: number, conversionFactor: number): number {
    return baseQuantity * conversionFactor;
  }

  /**
   * Convert from usage unit to base unit
   */
  static usageToBase(usageQuantity: number, conversionFactor: number): number {
    return usageQuantity / conversionFactor;
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
   * Get smart default quantity based on unit type
   */
  static getSmartDefaultQuantity(
    baseUnit: string,
    usageUnit: string,
    conversionFactor: number,
    availableStock: number
  ): { baseQty: number; usageQty: number; unit: 'base' | 'usage' } {
    // For liquid products (ml), default to usage unit
    if (usageUnit.toLowerCase().includes('ml') || usageUnit.toLowerCase().includes('liter')) {
      const defaultUsage = Math.min(100, this.baseToUsage(availableStock, conversionFactor));
      return {
        baseQty: Math.ceil(this.usageToBase(defaultUsage, conversionFactor)),
        usageQty: defaultUsage,
        unit: 'usage'
      };
    }

    // For tablets/capsules, default to usage unit
    if (usageUnit.toLowerCase().includes('tablet') || usageUnit.toLowerCase().includes('kapsul')) {
      const defaultUsage = Math.min(10, this.baseToUsage(availableStock, conversionFactor));
      return {
        baseQty: Math.ceil(this.usageToBase(defaultUsage, conversionFactor)),
        usageQty: defaultUsage,
        unit: 'usage'
      };
    }

    // For other products, default to base unit
    return {
      baseQty: Math.min(1, availableStock),
      usageQty: this.baseToUsage(Math.min(1, availableStock), conversionFactor),
      unit: 'base'
    };
  }

  /**
   * Validate quantity input
   */
  static validateQuantity(
    inputQuantity: number,
    inputUnit: 'base' | 'usage',
    conversionInfo: UnitConversionInfo,
    availableBaseStock: number
  ): {
    isValid: boolean;
    baseQuantity: number;
    usageQuantity: number;
    errorMessage?: string;
    suggestion?: string;
  } {
    let baseQuantity: number;
    let usageQuantity: number;

    if (inputUnit === 'base') {
      baseQuantity = inputQuantity;
      usageQuantity = this.baseToUsage(inputQuantity, conversionInfo.conversionFactor);
    } else {
      usageQuantity = inputQuantity;
      baseQuantity = Math.ceil(this.usageToBase(inputQuantity, conversionInfo.conversionFactor));
    }

    if (baseQuantity > availableBaseStock) {
      const maxUsage = this.baseToUsage(availableBaseStock, conversionInfo.conversionFactor);
      return {
        isValid: false,
        baseQuantity,
        usageQuantity,
        errorMessage: 'Quantity melebihi stok tersedia',
        suggestion: `Maksimal: ${availableBaseStock} ${conversionInfo.baseUnit} (${maxUsage} ${conversionInfo.usageUnit})`
      };
    }

    return {
      isValid: true,
      baseQuantity,
      usageQuantity
    };
  }

  /**
   * Get unit display name with icon
   */
  static getUnitDisplayName(unit: string): string {
    const unitMap: Record<string, string> = {
      'botol': '🍶 Botol',
      'box': '📦 Box',
      'pack': '📦 Pack',
      'ml': '💧 ml',
      'liter': '💧 Liter',
      'tablet': '💊 Tablet',
      'kapsul': '💊 Kapsul',
      'gram': '⚖️ Gram',
      'kg': '⚖️ Kg',
      'pcs': '🔢 Pcs',
      'unit': '🔢 Unit'
    };

    return unitMap[unit.toLowerCase()] || `🔢 ${unit}`;
  }

  /**
   * Calculate optimal request quantities for multiple items
   */
  static calculateOptimalRequest(
    items: Array<{
      id: string;
      conversionInfo: UnitConversionInfo;
      availableBaseStock: number;
      requestedUsageQuantity: number;
    }>
  ): Array<{
    id: string;
    baseQuantity: number;
    usageQuantity: number;
    isOptimal: boolean;
    wastePercentage: number;
    suggestion?: string;
  }> {
    return items.map(item => {
      const baseQuantity = Math.ceil(
        this.usageToBase(item.requestedUsageQuantity, item.conversionInfo.conversionFactor)
      );
      const actualUsageQuantity = this.baseToUsage(baseQuantity, item.conversionInfo.conversionFactor);
      const wasteQuantity = actualUsageQuantity - item.requestedUsageQuantity;
      const wastePercentage = (wasteQuantity / actualUsageQuantity) * 100;

      let suggestion: string | undefined;
      if (wastePercentage > 50) {
        suggestion = `Pertimbangkan request ${actualUsageQuantity} ${item.conversionInfo.usageUnit} untuk menghindari waste`;
      }

      return {
        id: item.id,
        baseQuantity,
        usageQuantity: actualUsageQuantity,
        isOptimal: wastePercentage < 20,
        wastePercentage,
        suggestion
      };
    });
  }
}