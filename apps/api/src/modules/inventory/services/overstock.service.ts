// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, OverstockStatus } from '@prisma/client';

/**
 * Service for managing branch overstock
 * 
 * Overstock occurs when Admin Manager sends more items than requested.
 * The excess is tracked and automatically deducted from future requests.
 */
export class OverstockService {
  /**
   * Get available overstock for a branch
   */
  async getOverstockByBranch(branchId: string, options?: {
    masterProductId?: string;
    status?: OverstockStatus;
  }) {
    const where: any = {
      branchId,
      status: options?.status || { in: ['AVAILABLE', 'PARTIALLY_USED'] },
    };

    if (options?.masterProductId) {
      where.masterProductId = options.masterProductId;
    }

    const overstocks = await prisma.branchOverstock.findMany({
      where,
      include: {
        masterProduct: true,
        sourceShipment: {
          select: {
            id: true,
            shipmentCode: true,
            createdAt: true,
          },
        },
        usages: {
          include: {
            stockRequest: {
              select: {
                id: true,
                requestCode: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // FIFO - oldest first
    });

    return overstocks.map(o => this.formatOverstock(o));
  }

  /**
   * Get available overstock quantity for a specific product at a branch
   */
  async getAvailableOverstockQty(branchId: string, masterProductId: string): Promise<number> {
    const result = await prisma.branchOverstock.aggregate({
      where: {
        branchId,
        masterProductId,
        status: { in: ['AVAILABLE', 'PARTIALLY_USED'] },
      },
      _sum: {
        quantity: true,
      },
    });

    return Number(result._sum.quantity || 0);
  }

  /**
   * Get overstock summary for a branch (grouped by product)
   */
  async getOverstockSummary(branchId: string) {
    const overstocks = await prisma.branchOverstock.findMany({
      where: {
        branchId,
        status: { in: ['AVAILABLE', 'PARTIALLY_USED'] },
      },
      include: {
        masterProduct: true,
      },
    });

    // Group by product
    const summary: Record<string, {
      masterProductId: string;
      productName: string;
      productCategory: string;
      unit: string;
      totalQuantity: number;
      records: Array<{
        id: string;
        quantity: number;
        reason: string;
        createdAt: string;
      }>;
    }> = {};

    for (const o of overstocks) {
      if (!summary[o.masterProductId]) {
        summary[o.masterProductId] = {
          masterProductId: o.masterProductId,
          productName: o.masterProduct.name,
          productCategory: o.masterProduct.category,
          unit: o.masterProduct.baseUnit,
          totalQuantity: 0,
          records: [],
        };
      }

      summary[o.masterProductId].totalQuantity += Number(o.quantity);
      summary[o.masterProductId].records.push({
        id: o.id,
        quantity: Number(o.quantity),
        reason: o.reason,
        createdAt: o.createdAt.toISOString(),
      });
    }

    return Object.values(summary);
  }

  /**
   * Create overstock record when shipment is received with excess items
   */
  async createOverstock(data: {
    branchId: string;
    masterProductId: string;
    quantity: number;
    reason: string;
    sourceShipmentId: string;
  }) {
    const overstock = await prisma.branchOverstock.create({
      data: {
        branchId: data.branchId,
        masterProductId: data.masterProductId,
        quantity: data.quantity,
        originalQty: data.quantity,
        reason: data.reason,
        sourceShipmentId: data.sourceShipmentId,
        status: 'AVAILABLE',
      },
      include: {
        masterProduct: true,
        sourceShipment: {
          select: {
            id: true,
            shipmentCode: true,
          },
        },
      },
    });

    return this.formatOverstock(overstock);
  }

  /**
   * Apply overstock deduction to a stock request item
   * Returns the amount deducted and updates overstock records
   */
  async applyOverstockDeduction(
    branchId: string,
    masterProductId: string,
    requestedQty: number,
    stockRequestId: string,
    stockRequestItemId: string,
    userId: string
  ): Promise<{
    deductedQty: number;
    finalQty: number;
    usedOverstocks: Array<{
      overstockId: string;
      quantityUsed: number;
      reason: string;
      sourceShipmentCode: string;
    }>;
  }> {
    // Get available overstocks (FIFO order)
    const availableOverstocks = await prisma.branchOverstock.findMany({
      where: {
        branchId,
        masterProductId,
        status: { in: ['AVAILABLE', 'PARTIALLY_USED'] },
        quantity: { gt: 0 },
      },
      include: {
        sourceShipment: {
          select: {
            shipmentCode: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // FIFO
    });

    if (availableOverstocks.length === 0) {
      return {
        deductedQty: 0,
        finalQty: requestedQty,
        usedOverstocks: [],
      };
    }

    let remainingToDeduct = requestedQty;
    let totalDeducted = 0;
    const usedOverstocks: Array<{
      overstockId: string;
      quantityUsed: number;
      reason: string;
      sourceShipmentCode: string;
    }> = [];

    // Apply deductions in transaction
    await prisma.$transaction(async (tx) => {
      for (const overstock of availableOverstocks) {
        if (remainingToDeduct <= 0) break;

        const availableQty = Number(overstock.quantity);
        const deductAmount = Math.min(availableQty, remainingToDeduct);

        // Update overstock quantity
        const newQty = availableQty - deductAmount;
        const newStatus: OverstockStatus = newQty <= 0 ? 'FULLY_USED' : 'PARTIALLY_USED';

        await tx.branchOverstock.update({
          where: { id: overstock.id },
          data: {
            quantity: newQty,
            status: newStatus,
          },
        });

        // Create usage record
        await tx.overstockUsage.create({
          data: {
            overstockId: overstock.id,
            stockRequestId,
            stockRequestItemId,
            quantityUsed: deductAmount,
          },
        });

        usedOverstocks.push({
          overstockId: overstock.id,
          quantityUsed: deductAmount,
          reason: overstock.reason,
          sourceShipmentCode: overstock.sourceShipment.shipmentCode,
        });

        totalDeducted += deductAmount;
        remainingToDeduct -= deductAmount;
      }

      // Update stock request item with deduction info
      await tx.stockRequestItem.update({
        where: { id: stockRequestItemId },
        data: {
          overstockDeducted: totalDeducted,
          finalQty: requestedQty - totalDeducted,
        },
      });
    });

    // Audit log
    if (totalDeducted > 0) {
      await logAudit({
        userId,
        branchId,
        action: AuditAction.UPDATE,
        resource: 'BranchOverstock',
        resourceId: stockRequestId,
        meta: {
          action: 'APPLY_DEDUCTION',
          masterProductId,
          requestedQty,
          deductedQty: totalDeducted,
          finalQty: requestedQty - totalDeducted,
          usedOverstocks: usedOverstocks.map(u => u.overstockId),
        },
      });
    }

    return {
      deductedQty: totalDeducted,
      finalQty: requestedQty - totalDeducted,
      usedOverstocks,
    };
  }

  /**
   * Get overstock info for stock request items (for display in UI)
   */
  async getOverstockInfoForRequest(branchId: string, items: Array<{ masterProductId: string; requestedQty: number }>) {
    const result: Array<{
      masterProductId: string;
      requestedQty: number;
      availableOverstock: number;
      deductedQty: number;
      finalQty: number;
      overstockDetails: Array<{
        quantity: number;
        reason: string;
        sourceShipmentCode: string;
        createdAt: string;
      }>;
    }> = [];

    for (const item of items) {
      const overstocks = await prisma.branchOverstock.findMany({
        where: {
          branchId,
          masterProductId: item.masterProductId,
          status: { in: ['AVAILABLE', 'PARTIALLY_USED'] },
          quantity: { gt: 0 },
        },
        include: {
          sourceShipment: {
            select: {
              shipmentCode: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      const availableOverstock = overstocks.reduce((sum, o) => sum + Number(o.quantity), 0);
      const deductedQty = Math.min(availableOverstock, item.requestedQty);
      const finalQty = item.requestedQty - deductedQty;

      result.push({
        masterProductId: item.masterProductId,
        requestedQty: item.requestedQty,
        availableOverstock,
        deductedQty,
        finalQty,
        overstockDetails: overstocks.map(o => ({
          quantity: Number(o.quantity),
          reason: o.reason,
          sourceShipmentCode: o.sourceShipment.shipmentCode,
          createdAt: o.createdAt.toISOString(),
        })),
      });
    }

    return result;
  }

  /**
   * Format overstock for response
   */
  private formatOverstock(overstock: any) {
    return {
      id: overstock.id,
      branchId: overstock.branchId,
      masterProductId: overstock.masterProductId,
      productName: overstock.masterProduct?.name,
      productCategory: overstock.masterProduct?.category,
      unit: overstock.masterProduct?.baseUnit,
      quantity: Number(overstock.quantity),
      originalQty: Number(overstock.originalQty),
      reason: overstock.reason,
      status: overstock.status,
      sourceShipment: overstock.sourceShipment ? {
        id: overstock.sourceShipment.id,
        shipmentCode: overstock.sourceShipment.shipmentCode,
        createdAt: overstock.sourceShipment.createdAt?.toISOString(),
      } : null,
      usages: overstock.usages?.map((u: any) => ({
        id: u.id,
        quantityUsed: Number(u.quantityUsed),
        stockRequestCode: u.stockRequest?.requestCode,
        createdAt: u.createdAt.toISOString(),
      })) || [],
      createdAt: overstock.createdAt.toISOString(),
      updatedAt: overstock.updatedAt.toISOString(),
    };
  }
}
