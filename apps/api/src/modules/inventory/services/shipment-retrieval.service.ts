// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { ShipmentStatus, StockMutationType } from '@prisma/client';

/**
 * Service for retrieving shipments
 */
export class ShipmentRetrievalService {
  /**
   * Get shipments with filtering
   */
  async getShipments(
    branchIds?: string[],
    status?: ShipmentStatus,
    dateRange?: { startDate?: string; endDate?: string }
  ) {
    if (branchIds && branchIds.length === 0) {
      return [];
    }

    const where: any = {};

    if (branchIds && branchIds.length > 0) {
      where.OR = [
        { fromBranchId: { in: branchIds } },
        { toBranchId: { in: branchIds } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (dateRange?.startDate || dateRange?.endDate) {
      where.createdAt = {};

      if (dateRange.startDate) {
        const start = new Date(dateRange.startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }

      if (dateRange.endDate) {
        const end = new Date(dateRange.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        fromBranch: true,
        toBranch: true,
        discrepancies: {
          include: {
            masterProduct: true,
          },
        },
        stockRequest: {
          select: {
            id: true,
            requestCode: true,
            status: true,
            branch: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
            items: {
              select: {
                masterProductId: true,
                requestedQty: true,
                overstockDeducted: true,
                finalQty: true,
              },
            },
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                totalAmount: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Query stock mutations separately for all shipments
    const shipmentIds = shipments.map(s => s.id);
    let stockMutationsMap: Map<string, any> = new Map();

    if (shipmentIds.length > 0) {
      const stockMutations = await prisma.stockMutation.findMany({
        where: {
          referenceType: { in: ['SHIPMENT', 'Shipment'] },
          referenceId: { in: shipmentIds },
          type: StockMutationType.RECEIVED,
        },
        select: {
          id: true,
          referenceId: true,
          stockBefore: true,
          stockAfter: true,
          quantity: true,
          inventoryItem: {
            select: {
              masterProductId: true,
            },
          },
        },
      });

      // Create a map: shipmentId-masterProductId -> mutation
      stockMutations.forEach(mutation => {
        const key = `${mutation.referenceId}-${mutation.inventoryItem.masterProductId}`;
        stockMutationsMap.set(key, mutation);
      });
    }

    return shipments.map(shipment => this.formatShipment(shipment, stockMutationsMap));
  }

  /**
   * Get shipment by ID
   */
  async getShipmentById(shipmentId: string) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        fromBranch: true,
        toBranch: true,
        discrepancies: {
          include: {
            masterProduct: true,
          },
        },
        stockRequest: {
          include: {
            branch: true,
            items: {
              include: {
                masterProduct: true,
              },
            },
            invoice: {
              include: {
                items: true,
              },
            },
          },
        },
      },
    });

    if (!shipment) {
      throw {
        status: 404,
        code: 'SHIPMENT_NOT_FOUND',
        message: 'Pengiriman tidak ditemukan',
      };
    }

    return this.formatShipmentDetail(shipment);
  }

  /**
   * Format shipment for list response
   */
  private formatShipment(shipment: any, stockMutationsMap?: Map<string, any>) {
    return {
      id: shipment.id,
      shipmentCode: shipment.shipmentCode,
      fromBranchId: shipment.fromBranchId,
      fromBranchName: shipment.fromBranch.name,
      fromBranchCode: shipment.fromBranch.branchCode,
      toBranchId: shipment.toBranchId,
      toBranchName: shipment.toBranch.name,
      toBranchCode: shipment.toBranch.branchCode,
      toBranchType: shipment.stockRequest?.branch?.type,
      status: shipment.status,
      notes: shipment.notes,
      shipmentPhotoUrl: shipment.shipmentPhotoUrl,
      itemCount: shipment.items.length,
      totalItems: shipment.items.reduce((sum: number, item: any) => sum + Number(item.sentQty), 0),
      hasDiscrepancies: shipment.discrepancies?.length > 0,
      discrepancyCount: shipment.discrepancies?.length || 0,
      items: shipment.items.map((item: any) => {
        // Get original requestedQty and overstock info from StockRequestItem
        let originalRequestedQty = Number(item.sentQty); // Default to sentQty
        let overstockDeducted = 0;
        
        // Try to get from StockRequestItem for accurate original request info
        if (shipment.stockRequest?.items) {
          const stockRequestItem = shipment.stockRequest.items.find(
            (sri: any) => sri.masterProductId === item.masterProductId
          );
          if (stockRequestItem) {
            originalRequestedQty = Number(stockRequestItem.requestedQty);
            overstockDeducted = stockRequestItem.overstockDeducted ? Number(stockRequestItem.overstockDeducted) : 0;
          }
        }
        
        // requestedQty in ShipmentItem is the original request amount (stored for reference)
        // sentQty is the amount to send (after overstock deduction = finalQty)
        const requestedQty = item.requestedQty ? Number(item.requestedQty) : originalRequestedQty;

        // Get stock before/after from stock mutations (RECEIVED records)
        let stockBefore: number | null = null;
        let stockAfter: number | null = null;

        if (stockMutationsMap) {
          const key = `${shipment.id}-${item.masterProductId}`;
          const mutation = stockMutationsMap.get(key);
          if (mutation) {
            stockBefore = mutation.stockBefore ? Number(mutation.stockBefore) : null;
            stockAfter = mutation.stockAfter ? Number(mutation.stockAfter) : null;
          }
        }

        return {
          id: item.id,
          masterProductId: item.masterProductId,
          productName: item.masterProduct.name,
          productCategory: item.masterProduct.category,
          sentQty: Number(item.sentQty),
          requestedQty, // Original requested amount
          originalRequestedQty, // Same as requestedQty, for clarity
          overstockDeducted, // Amount already deducted from overstock
          overstockQty: item.overstockQty ? Number(item.overstockQty) : null, // New overstock from this shipment
          overstockReason: item.overstockReason || null, // Reason for overstock
          receivedQty: item.receivedQty ? Number(item.receivedQty) : null,
          stockBefore, // Stock quantity at destination branch before receiving
          stockAfter, // Stock quantity at destination branch after receiving
          unit: item.masterProduct.baseUnit,
        };
      }),
      // Stock request summary
      stockRequest: shipment.stockRequest ? {
        id: shipment.stockRequest.id,
        requestCode: shipment.stockRequest.requestCode,
        status: shipment.stockRequest.status,
        branchName: shipment.stockRequest.branch?.name,
        branchType: shipment.stockRequest.branch?.type,
        invoice: shipment.stockRequest.invoice ? {
          id: shipment.stockRequest.invoice.id,
          invoiceNumber: shipment.stockRequest.invoice.invoiceNumber,
          totalAmount: Number(shipment.stockRequest.invoice.totalAmount),
          status: shipment.stockRequest.invoice.status,
        } : null,
      } : null,
      // Timestamps
      shippedBy: shipment.shippedBy,
      shippedAt: shipment.shippedAt?.toISOString(),
      receivedBy: shipment.receivedBy,
      receivedAt: shipment.receivedAt?.toISOString(),
      approvedBy: shipment.approvedBy,
      approvedAt: shipment.approvedAt?.toISOString(),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    };
  }

  /**
   * Format shipment for detail response
   */
  private formatShipmentDetail(shipment: any) {
    const base = this.formatShipment(shipment);

    return {
      ...base,
      shipmentPhotoName: shipment.shipmentPhotoName,
      // Full discrepancies
      discrepancies: shipment.discrepancies?.map((d: any) => ({
        id: d.id,
        masterProductId: d.masterProductId,
        productName: d.productName,
        expectedQty: Number(d.expectedQty),
        receivedQty: Number(d.receivedQty),
        discrepancyType: d.discrepancyType,
        notes: d.notes,
        photoUrl: d.photoUrl,
        photoFileName: d.photoFileName,
        reportedBy: d.reportedBy,
        createdAt: d.createdAt?.toISOString(),
      })) || [],
      // Full stock request
      stockRequest: shipment.stockRequest ? {
        id: shipment.stockRequest.id,
        requestCode: shipment.stockRequest.requestCode,
        status: shipment.stockRequest.status,
        branchId: shipment.stockRequest.branch?.id,
        branchName: shipment.stockRequest.branch?.name,
        branchType: shipment.stockRequest.branch?.type,
        items: shipment.stockRequest.items?.map((item: any) => ({
          id: item.id,
          masterProductId: item.masterProductId,
          productName: item.masterProduct.name,
          requestedQty: Number(item.requestedQty),
          approvedQty: item.approvedQty ? Number(item.approvedQty) : null,
          unit: item.masterProduct.baseUnit,
        })),
        invoice: shipment.stockRequest.invoice ? {
          id: shipment.stockRequest.invoice.id,
          invoiceNumber: shipment.stockRequest.invoice.invoiceNumber,
          subtotal: Number(shipment.stockRequest.invoice.subtotal),
          totalAmount: Number(shipment.stockRequest.invoice.totalAmount),
          status: shipment.stockRequest.invoice.status,
          items: shipment.stockRequest.invoice.items?.map((item: any) => ({
            id: item.id,
            masterProductId: item.masterProductId,
            sku: item.sku,
            productName: item.productName,
            description: item.description,
            quantity: Number(item.quantity),
            pricePerUnit: Number(item.pricePerUnit),
            subtotal: Number(item.subtotal),
          })),
        } : null,
      } : null,
    };
  }
}
