// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { ShipmentStatus } from '@prisma/client';

/**
 * Service for retrieving shipments
 */
export class ShipmentRetrievalService {
  /**
   * Get shipments with filtering
   */
  async getShipments(branchIds?: string[], status?: ShipmentStatus) {
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

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        items: true,
        fromBranch: true,
        toBranch: true,
        stockRequest: {
          include: {
            items: {
              include: {
                inventoryItem: {
                  include: {
                    masterProduct: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return shipments.map(shipment => this.formatShipment(shipment));
  }

  /**
   * Get shipment by ID
   */
  async getShipmentById(shipmentId: string) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: true,
        fromBranch: true,
        toBranch: true,
        stockRequest: {
          include: {
            branch: true,
            items: {
              include: {
                inventoryItem: {
                  include: {
                    masterProduct: true,
                  },
                },
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

    return {
      ...this.formatShipment(shipment),
      stockRequest: shipment.stockRequest ? {
        id: shipment.stockRequest.id,
        requestCode: shipment.stockRequest.requestCode,
        requestingBranchName: shipment.stockRequest.branch.name,
      } : null,
    };
  }

  /**
   * Format shipment for response
   */
  private formatShipment(shipment: any) {
    // Build item info map from stock request items
    const itemInfoMap = new Map<string, { productName: string; unit: string; category: string }>();
    if (shipment.stockRequest?.items) {
      shipment.stockRequest.items.forEach((item: any) => {
        itemInfoMap.set(item.inventoryItemId, {
          productName: item.inventoryItem.masterProduct.name,
          unit: item.inventoryItem.masterProduct.baseUnit || item.inventoryItem.masterProduct.unit,
          category: item.inventoryItem.masterProduct.category,
        });
      });
    }

    return {
      id: shipment.id,
      shipmentCode: shipment.shipmentCode,
      fromBranchId: shipment.fromBranchId,
      fromBranchName: shipment.fromBranch.name,
      toBranchId: shipment.toBranchId,
      toBranchName: shipment.toBranch.name,
      status: shipment.status,
      notes: shipment.notes,
      shippedAt: shipment.shippedAt?.toISOString(),
      receivedAt: shipment.receivedAt?.toISOString(),
      approvedAt: shipment.approvedAt?.toISOString(),
      itemCount: shipment.items.length,
      items: shipment.items.map((item: any) => {
        const itemInfo = itemInfoMap.get(item.inventoryItemId);
        return {
          id: item.id,
          inventoryItemId: item.inventoryItemId,
          productName: itemInfo?.productName || 'Unknown Product',
          unit: itemInfo?.unit || 'unit',
          sentQty: Number(item.sentQty),
        };
      }),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    };
  }
}
