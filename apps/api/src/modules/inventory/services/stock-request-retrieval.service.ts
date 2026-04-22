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
      where.requestingBranchId = branchId;
    }

    if (status) {
      where.status = status;
    }

    const requests = await prisma.stockRequest.findMany({
      where,
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        requestingBranch: true,
        requestedByUser: {
          include: {
            profile: true,
          },
        },
        reviewedByUser: {
          include: {
            profile: true,
          },
        },
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
            masterProduct: true,
          },
        },
        requestingBranch: true,
        requestedByUser: {
          include: {
            profile: true,
          },
        },
        reviewedByUser: {
          include: {
            profile: true,
          },
        },
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
      requestingBranchId: request.requestingBranchId,
      requestingBranchName: request.requestingBranch.name,
      status: request.status,
      notes: request.notes,
      requestedBy: request.requestedByUser.profile?.fullName || request.requestedByUser.email,
      reviewedBy: request.reviewedByUser?.profile?.fullName || request.reviewedByUser?.email,
      reviewNotes: request.reviewNotes,
      items: request.items.map((item: any) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.masterProduct.name,
        productCategory: item.masterProduct.category,
        productUnit: item.masterProduct.unit,
        requestedQuantity: Number(item.requestedQuantity),
        approvedQuantity: item.approvedQuantity ? Number(item.approvedQuantity) : null,
        notes: item.notes,
      })),
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }
}
