// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { StockRequestStatus } from '@prisma/client';

/**
 * Service for retrieving stock requests
 */
export class StockRequestRetrievalService {
  /**
   * Get stock requests with filtering
   */
  async getRequests(branchId?: string, status?: StockRequestStatus) {
    const where: any = {};

    if (branchId) {
      where.branchId = branchId;
    }

    if (status) {
      where.status = status;
    }

    const requests = await prisma.stockRequest.findMany({
      where,
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
        branch: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map(request => this.formatStockRequest(request));
  }

  /**
   * Get stock request by ID
   */
  async getRequestById(requestId: string) {
    const request = await prisma.stockRequest.findUnique({
      where: { id: requestId },
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
        branch: true,
        shipment: {
          include: {
            fromBranch: true,
            toBranch: true,
          },
        },
      },
    });

    if (!request) {
      throw {
        status: 404,
        code: 'REQUEST_NOT_FOUND',
        message: 'Permintaan stok tidak ditemukan',
      };
    }

    return {
      ...this.formatStockRequest(request),
      shipment: request.shipment ? {
        id: request.shipment.id,
        shipmentCode: request.shipment.shipmentCode,
        status: request.shipment.status,
        fromBranchName: request.shipment.fromBranch.name,
        toBranchName: request.shipment.toBranch.name,
      } : null,
    };
  }

  /**
   * Format stock request for response
   */
  private formatStockRequest(request: any) {
    return {
      id: request.id,
      requestCode: request.requestCode,
      branchId: request.branchId,
      branchName: request.branch.name,
      status: request.status,
      notes: request.notes,
      itemCount: request.items.length,
      items: request.items.map((item: any) => ({
        id: item.id,
        inventoryItemId: item.inventoryItemId,
        productName: item.inventoryItem.masterProduct.name,
        requestedQty: Number(item.requestedQty),
        unit: item.inventoryItem.masterProduct.baseUnit || item.inventoryItem.masterProduct.unit,
        notes: item.notes,
      })),
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }
}
