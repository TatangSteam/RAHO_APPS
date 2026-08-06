import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, OverstockStatus, Prisma } from '@prisma/client';
import {
  formatStockRequestQuantity,
  parseStockRequestQuantity,
} from './stock-request-units';

interface OverstockForResponse {
  id: string;
  branchId: string;
  masterProductId: string;
  quantity: unknown;
  originalQty: unknown;
  reason: string;
  status: OverstockStatus;
  createdAt: Date;
  updatedAt: Date;
  masterProduct?: { name: string; category: string; baseUnit: string } | null;
  sourceShipment?: { id: string; shipmentCode: string; createdAt?: Date } | null;
  usages?: Array<{
    id: string;
    quantityUsed: unknown;
    createdAt: Date;
    stockRequest?: { requestCode: string } | null;
  }>;
}

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
    const where: Prisma.BranchOverstockWhereInput = {
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
   * 
   * @param tx - Optional Prisma transaction client. If provided, uses the existing transaction.
   */
  async applyOverstockDeduction(
    branchId: string,
    masterProductId: string,
    requestedQty: number,
    stockRequestId: string,
    stockRequestItemId: string,
    userId: string,
    tx?: Prisma.TransactionClient
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
    // Use provided transaction or prisma client
    const client = tx || prisma;

    // Get available overstocks (FIFO order)
    const availableOverstocks = await client.branchOverstock.findMany({
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

    // Calculate total available overstock
    const totalAvailableOverstock = availableOverstocks.reduce((sum, o) => sum + Number(o.quantity), 0);
    
    // Maximum we can deduct is the minimum of available overstock and requested quantity
    let remainingToDeduct = Math.min(totalAvailableOverstock, requestedQty);
    let totalDeducted = 0;
    const usedOverstocks: Array<{
      overstockId: string;
      quantityUsed: number;
      reason: string;
      sourceShipmentCode: string;
    }> = [];

    // Helper function to apply deductions
    const applyDeductions = async (dbClient: Prisma.TransactionClient) => {
      for (const overstock of availableOverstocks) {
        if (remainingToDeduct <= 0) break;

        const availableQty = Number(overstock.quantity);
        const deductAmount = Math.min(availableQty, remainingToDeduct);

        // Update overstock quantity
        const newQty = availableQty - deductAmount;
        const newStatus: OverstockStatus = newQty <= 0 ? 'FULLY_USED' : 'PARTIALLY_USED';

        await dbClient.branchOverstock.update({
          where: { id: overstock.id },
          data: {
            quantity: newQty,
            status: newStatus,
          },
        });

        // Create usage record
        await dbClient.overstockUsage.create({
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
      await dbClient.stockRequestItem.update({
        where: { id: stockRequestItemId },
        data: {
          overstockDeducted: totalDeducted,
          finalQty: requestedQty - totalDeducted,
        },
      });
    };

    // If we have a transaction, use it directly; otherwise create a new one
    if (tx) {
      console.log(`[OverstockService] Applying deduction within transaction for product ${masterProductId}`);
      console.log(`[OverstockService] Available overstocks: ${availableOverstocks.length}, Total available: ${totalAvailableOverstock}`);
      console.log(`[OverstockService] Requested qty: ${requestedQty}, Will deduct: ${Math.min(totalAvailableOverstock, requestedQty)}`);
      await applyDeductions(tx);
      console.log(`[OverstockService] Deduction complete. Total deducted: ${totalDeducted}`);
    } else {
      await prisma.$transaction(async (newTx) => {
        await applyDeductions(newTx);
      });
    }

    // Audit log (outside transaction is fine)
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
  async getOverstockInfoForRequest(branchId: string, items: Array<{ masterProductId: string; requestedQty: number; unit?: string }>) {
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

    const masterProducts = await prisma.masterProduct.findMany({
      where: { id: { in: items.map((item) => item.masterProductId) } },
    });
    const masterProductById = new Map(masterProducts.map((product) => [product.id, product]));

    for (const item of items) {
      const masterProduct = masterProductById.get(item.masterProductId);
      const requestedQty = parseStockRequestQuantity(masterProduct, item.requestedQty, item.unit);
      const formatQuantity = (quantity: unknown) => (
        item.unit ? formatStockRequestQuantity(masterProduct, quantity) : Number(quantity || 0)
      );
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
      const deductedQty = Math.min(availableOverstock, requestedQty);
      const finalQty = requestedQty - deductedQty;

      result.push({
        masterProductId: item.masterProductId,
        requestedQty: formatQuantity(requestedQty),
        availableOverstock: formatQuantity(availableOverstock),
        deductedQty: formatQuantity(deductedQty),
        finalQty: formatQuantity(finalQty),
        overstockDetails: overstocks.map(o => ({
          quantity: formatQuantity(o.quantity),
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
  private formatOverstock(overstock: OverstockForResponse) {
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
      usages: overstock.usages?.map((u) => ({
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
