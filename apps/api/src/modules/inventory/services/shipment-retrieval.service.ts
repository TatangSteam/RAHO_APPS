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
  async getShipments(branchId?: string, status?: ShipmentStatus) {
    const where: any = {};

    if (branchId) {
      where.OR = [
        { fromBranchId: branchId },
        { toBranchId: branchId },
      ];
    }

    if (status) {
      where.status = status;
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
        shippedByUser: {
          include: {
            profile: true,
          },
        },
        receivedByUser: {
          include: {
            profile: true,
          },
        },
        approvedByUser: {
          include: {
            profile: true,
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
        items: {
          include: {
            masterProduct: true,
          },
        },
        fromBranch: true,
        toBranch: true,
        shippedByUser: {
          include: {
            profile: true,
          },
        },
        receivedByUser: {
          include: {
            profile: true,
          },
        },
        approvedByUser: {
          include: {
            profile: true,
          },
        },
        stockRequest: {
          include: {
            requestingBranch: true,
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
        requestingBranchName: shipment.stockRequest.requestingBranch.name,
      } : null,
    };
  }

  /**
   * Format shipment for response
   */
  private formatShipment(shipment: any) {
    return {
      id: shipment.id,
      shipmentCode: shipment.shipmentCode,
      fromBranchId: shipment.fromBranchId,
      fromBranchName: shipment.fromBranch.name,
      toBranchId: shipment.toBranchId,
      toBranchName: shipment.toBranch.name,
      status: shipment.status,
      notes: shipment.notes,
      shippedBy: shipment.shippedByUser?.profile?.fullName || shipment.shippedByUser?.email,
      shippedAt: shipment.shippedAt?.toISOString(),
      receivedBy: shipment.receivedByUser?.profile?.fullName || shipment.receivedByUser?.email,
      receivedAt: shipment.receivedAt?.toISOString(),
      approvedBy: shipment.approvedByUser?.profile?.fullName || shipment.approvedByUser?.email,
      approvedAt: shipment.approvedAt?.toISOString(),
      items: shipment.items.map((item: any) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.masterProduct.name,
        productCategory: item.masterProduct.category,
        productUnit: item.masterProduct.unit,
        quantity: Number(item.quantity),
      })),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    };
  }
}
