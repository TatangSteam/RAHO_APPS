import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import type { CreateMaterialUsageInput } from '../sessions.schema';
import { AuditAction, Role, StockMutationType } from '@prisma/client';

export class MaterialUsageService {
  /**
   * Convert usage unit to base unit for stock calculation
   * Example: 450 ml → 0.9 botol (if conversionFactor = 500)
   */
  private convertToBaseUnit(usageQuantity: number, conversionFactor: number): number {
    return usageQuantity / conversionFactor;
  }

  /**
   * Convert base unit to usage unit for display
   * Example: 0.9 botol → 450 ml (if conversionFactor = 500)
   */
  private convertToUsageUnit(baseQuantity: number, conversionFactor: number): number {
    return baseQuantity * conversionFactor;
  }

  async createMaterialUsage(sessionId: string, data: CreateMaterialUsageInput, userId: string, branchId: string) {
    // Check if session exists
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      include: { infusion: true },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    // Relaxed validation - allow material usage without infusion for pending sessions
    // if (!session.infusion) {
    //   throw {
    //     status: 422,
    //     code: 'INFUSION_REQUIRED',
    //     message: 'Infus aktual harus dibuat terlebih dahulu',
    //   };
    // }

    // Validate inventory item
    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: data.inventoryItemId },
      include: { masterProduct: true },
    });

    if (!inventoryItem) {
      throw { status: 404, code: 'INVENTORY_ITEM_NOT_FOUND', message: 'Item inventory tidak ditemukan' };
    }

    if (inventoryItem.branchId !== branchId) {
      throw {
        status: 403,
        code: 'INVENTORY_BRANCH_MISMATCH',
        message: 'Item inventory tidak terdaftar di cabang ini',
      };
    }

    // Get conversion factor for unit conversion
    const conversionFactor = Number(inventoryItem.masterProduct.conversionFactor);
    const usageQuantity = data.quantity; // Quantity in usage unit (ml, piece, etc.)
    
    // Convert usage unit to base unit for stock calculation
    // Example: 450 ml → 0.9 botol (if conversionFactor = 500)
    const baseQuantityUsed = this.convertToBaseUnit(usageQuantity, conversionFactor);

    // Check stock availability (stock is stored in base unit)
    const stockBefore = Number(inventoryItem.stock);
    const stockAfter = stockBefore - baseQuantityUsed;

    if (stockAfter < 0) {
      const availableUsageUnit = this.convertToUsageUnit(stockBefore, conversionFactor);
      throw {
        status: 409,
        code: 'STOCK_INSUFFICIENT',
        message: `Stok ${inventoryItem.masterProduct.name} tidak mencukupi. Tersedia: ${stockBefore} ${inventoryItem.masterProduct.baseUnit} (${availableUsageUnit} ${inventoryItem.masterProduct.usageUnit})`,
      };
    }

    // Create material usage and update stock in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create material usage record (stored in usage unit for clarity)
      const materialUsage = await tx.materialUsage.create({
        data: {
          treatmentSessionId: sessionId,
          inventoryItemId: data.inventoryItemId,
          quantity: usageQuantity, // Store in usage unit (ml, piece, etc.)
          unit: data.unit || inventoryItem.masterProduct.usageUnit,
          recordedBy: data.recordedBy,
        },
      });

      // Update inventory stock (in base unit)
      await tx.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: { stock: stockAfter },
      });

      // Create stock mutation (in base unit for consistency)
      await tx.stockMutation.create({
        data: {
          inventoryItemId: data.inventoryItemId,
          type: StockMutationType.USED,
          quantity: baseQuantityUsed, // Store in base unit
          stockBefore,
          stockAfter,
          referenceType: 'MaterialUsage',
          referenceId: materialUsage.id,
          notes: `Digunakan untuk sesi ${session.sessionCode}: ${usageQuantity} ${inventoryItem.masterProduct.usageUnit} (${baseQuantityUsed.toFixed(4)} ${inventoryItem.masterProduct.baseUnit})`,
          createdBy: userId,
        },
      });

      // Check if stock is critical
      if (stockAfter < Number(inventoryItem.minThreshold)) {
        // Create notification for ADMIN_CABANG
        const adminCabang = await tx.user.findMany({
          where: {
            branchId,
            role: Role.ADMIN_CABANG,
            isActive: true,
          },
        });

        const availableUsageUnit = this.convertToUsageUnit(stockAfter, conversionFactor);
        
        for (const admin of adminCabang) {
          await tx.notification.create({
            data: {
              userId: admin.id,
              type: 'INFO',
              title: 'Stok Kritis',
              body: `Stok ${inventoryItem.masterProduct.name} hampir habis 🔴\nSisa: ${stockAfter.toFixed(2)} ${inventoryItem.masterProduct.baseUnit} (${availableUsageUnit.toFixed(2)} ${inventoryItem.masterProduct.usageUnit})`,
              status: 'UNREAD',
            },
          });
        }
      }

      return materialUsage;
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'MaterialUsage',
      resourceId: result.id,
      meta: { 
        sessionId, 
        inventoryItemId: data.inventoryItemId, 
        usageQuantity, 
        usageUnit: inventoryItem.masterProduct.usageUnit,
        baseQuantityUsed,
        baseUnit: inventoryItem.masterProduct.baseUnit,
        stockBefore,
        stockAfter,
      },
    });

    return result;
  }

  async getMaterialUsages(sessionId: string) {
    const materials = await prisma.materialUsage.findMany({
      where: { treatmentSessionId: sessionId },
      include: {
        inventoryItem: {
          include: { masterProduct: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Enrich with conversion info for display
    return materials.map(material => {
      const conversionFactor = Number(material.inventoryItem.masterProduct.conversionFactor);
      const baseQuantity = this.convertToBaseUnit(Number(material.quantity), conversionFactor);
      
      return {
        ...material,
        conversionInfo: {
          usageQuantity: Number(material.quantity),
          usageUnit: material.inventoryItem.masterProduct.usageUnit,
          baseQuantity: baseQuantity,
          baseUnit: material.inventoryItem.masterProduct.baseUnit,
          conversionFactor: conversionFactor,
          // Simple display: just show the usage quantity in ml
          displayText: `${Number(material.quantity).toFixed(2)} ${material.inventoryItem.masterProduct.usageUnit}`,
        },
      };
    });
  }

  /**
   * Get available inventory items for a branch with stock info in both units
   */
  async getAvailableInventoryItems(branchId: string) {
    const items = await prisma.inventoryItem.findMany({
      where: { 
        branchId,
        masterProduct: { isActive: true },
      },
      include: { 
        masterProduct: true,
      },
      orderBy: [
        { masterProduct: { category: 'asc' } },
        { masterProduct: { name: 'asc' } },
      ],
    });

    return items.map(item => {
      const stockBase = Number(item.stock);
      const conversionFactor = Number(item.masterProduct.conversionFactor);
      const stockUsage = this.convertToUsageUnit(stockBase, conversionFactor);
      const minThresholdUsage = this.convertToUsageUnit(Number(item.minThreshold), conversionFactor);
      const isLowStock = stockBase < Number(item.minThreshold);

      return {
        ...item,
        stockInfo: {
          baseStock: stockBase,
          baseUnit: item.masterProduct.baseUnit,
          usageStock: stockUsage,
          usageUnit: item.masterProduct.usageUnit,
          minThresholdBase: Number(item.minThreshold),
          minThresholdUsage: minThresholdUsage,
          isLowStock,
          displayText: `${stockBase.toFixed(2)} ${item.masterProduct.baseUnit} (${stockUsage.toFixed(2)} ${item.masterProduct.usageUnit} tersedia)`,
          displayShort: `${stockBase.toFixed(2)} ${item.masterProduct.baseUnit} (${stockUsage.toFixed(0)} ${item.masterProduct.usageUnit})`,
        },
      };
    });
  }
}
