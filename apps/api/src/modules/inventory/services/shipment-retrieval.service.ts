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
  private formatShipment(shipment: any) {
    return {
      id: shipment.id,
      shipmentCode: shipment.shipmentCode,
      fromBranchId: shipment.fromBranchId,
      fromBranchName: shipment.fromBranch.name,
      toBranchId: shipment.toBranchId,
      toBranchName: shipment.toBranch.name,
      toBranchType: shipment.stockRequest?.branch?.type,
      status: shipment.status,
      notes: shipment.notes,
      shipmentPhotoUrl: shipment.shipmentPhotoUrl,
      itemCount: shipment.items.length,
      totalItems: shipment.items.reduce((sum: number, item: any) => sum + Number(item.sentQty), 0),
      hasDiscrepancies: shipment.discrepancies?.length > 0,
      discrepancyCount: shipment.discrepancies?.length || 0,
      items: shipment.items.map((item: any) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.masterProduct.name,
        productCategory: item.masterProduct.category,
        sentQty: Number(item.sentQty),
        receivedQty: item.receivedQty ? Number(item.receivedQty) : null,
        unit: item.masterProduct.baseUnit,
      })),
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
