// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Role, StockMutationType, DiscrepancyType } from '@prisma/client';

interface DiscrepancyItem {
  masterProductId: string;
  expectedQty: number;
  receivedQty: number;
  discrepancyType: DiscrepancyType;
  notes?: string;
  photoUrl?: string;
  photoFileName?: string;
}

interface ReceiveShipmentInput {
  receivedItems?: Array<{
    masterProductId: string;
    receivedQty: number;
  }>;
  discrepancies?: DiscrepancyItem[];
  notes?: string;
}

/**
 * Service for processing shipments (ship, receive with discrepancy support)
 */
export class ShipmentProcessingService {
  /**
   * Ship shipment (mark as shipped by Admin Manager)
   */
  async shipShipment(
    shipmentId: string, 
    userId: string, 
    data?: { 
      notes?: string;
      shipmentPhotoUrl?: string;
      shipmentPhotoName?: string;
    }
  ) {
    // Validate user is SUPER_ADMIN or ADMIN_MANAGER
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || ![Role.SUPER_ADMIN, Role.ADMIN_MANAGER].includes(user.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Super Admin atau Admin Manager yang dapat mengirim barang',
      };
    }

    // Get shipment
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
        stockRequest: true,
      },
    });

    if (!shipment) {
      throw {
        status: 404,
        code: 'SHIPMENT_NOT_FOUND',
        message: 'Pengiriman tidak ditemukan',
      };
    }

    if (shipment.status !== 'PREPARING') {
      throw {
        status: 422,
        code: 'INVALID_STATUS',
        message: 'Pengiriman sudah diproses atau belum siap',
      };
    }

    // For ADMIN_MANAGER, validate they manage the destination branch
    if (user.role === Role.ADMIN_MANAGER) {
      const managerBranch = await prisma.managerBranch.findFirst({
        where: {
          userId,
          branchId: shipment.toBranchId,
        },
      });

      if (!managerBranch) {
        throw {
          status: 403,
          code: 'BRANCH_ACCESS_DENIED',
          message: 'Anda tidak memiliki akses untuk mengirim ke cabang ini',
        };
      }
    }

    // Update shipment and stock request status
    const result = await prisma.$transaction(async (tx) => {
      // Update shipment
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: 'SHIPPED',
          shippedAt: new Date(),
          shippedBy: userId,
          shipmentPhotoUrl: data?.shipmentPhotoUrl,
          shipmentPhotoName: data?.shipmentPhotoName,
          notes: data?.notes || shipment.notes,
        },
        include: {
          items: {
            include: {
              masterProduct: true,
            },
          },
          fromBranch: true,
          toBranch: true,
        },
      });

      // Update stock request status
      if (shipment.stockRequestId) {
        await tx.stockRequest.update({
          where: { id: shipment.stockRequestId },
          data: {
            status: 'SHIPPED',
            shippedBy: userId,
            shippedAt: new Date(),
          },
        });
      }

      return updatedShipment;
    });

    // Audit log
    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'Shipment',
      resourceId: shipmentId,
      meta: { 
        action: 'SHIP', 
        shipmentCode: shipment.shipmentCode,
        toBranchId: shipment.toBranchId,
      },
    });

    return this.formatShipment(result);
  }

  /**
   * Receive shipment (by Admin Cabang)
   * Supports receiving with discrepancy reporting
   */
  async receiveShipment(
    shipmentId: string, 
    userId: string, 
    input: ReceiveShipmentInput = {}
  ) {
    // Validate user role - only ADMIN_CABANG can receive
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, branchId: true },
    });

    if (!user || user.role !== Role.ADMIN_CABANG) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Admin Cabang yang dapat menerima barang',
      };
    }

    // Get shipment
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
        stockRequest: true,
      },
    });

    if (!shipment) {
      throw {
        status: 404,
        code: 'SHIPMENT_NOT_FOUND',
        message: 'Pengiriman tidak ditemukan',
      };
    }

    if (shipment.status !== 'SHIPPED') {
      throw {
        status: 422,
        code: 'INVALID_STATUS',
        message: 'Pengiriman belum dikirim atau sudah diproses',
      };
    }

    // Validate user is from the destination branch
    if (user.branchId !== shipment.toBranchId) {
      throw {
        status: 403,
        code: 'BRANCH_MISMATCH',
        message: 'Anda hanya dapat menerima barang untuk cabang Anda sendiri',
      };
    }

    const hasDiscrepancies = input.discrepancies && input.discrepancies.length > 0;
    const newStatus = hasDiscrepancies ? 'RECEIVED_WITH_ISSUE' : 'RECEIVED';
    const requestStatus = hasDiscrepancies ? 'COMPLETED_WITH_ISSUE' : 'COMPLETED';

    // Process receiving
    const result = await prisma.$transaction(async (tx) => {
      // Update shipment items with received quantities
      if (input.receivedItems) {
        for (const receivedItem of input.receivedItems) {
          const shipmentItem = shipment.items.find(
            i => i.masterProductId === receivedItem.masterProductId
          );
          if (shipmentItem) {
            await tx.shipmentItem.update({
              where: { id: shipmentItem.id },
              data: { receivedQty: receivedItem.receivedQty },
            });
          }
        }
      }

      // Create discrepancy records if any
      if (hasDiscrepancies) {
        for (const discrepancy of input.discrepancies!) {
          const product = await tx.masterProduct.findUnique({
            where: { id: discrepancy.masterProductId },
            select: { name: true },
          });

          await tx.shipmentDiscrepancy.create({
            data: {
              shipmentId,
              masterProductId: discrepancy.masterProductId,
              productName: product?.name || 'Unknown',
              expectedQty: discrepancy.expectedQty,
              receivedQty: discrepancy.receivedQty,
              discrepancyType: discrepancy.discrepancyType,
              notes: discrepancy.notes,
              photoUrl: discrepancy.photoUrl,
              photoFileName: discrepancy.photoFileName,
              reportedBy: userId,
            },
          });
        }
      }

      // Update shipment status
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: newStatus,
          receivedAt: new Date(),
          receivedBy: userId,
          notes: input.notes || shipment.notes,
        },
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
        },
      });

      // Update stock request status
      if (shipment.stockRequestId) {
        await tx.stockRequest.update({
          where: { id: shipment.stockRequestId },
          data: {
            status: requestStatus,
            receivedBy: userId,
            receivedAt: new Date(),
            receivingNotes: input.notes,
          },
        });
      }

      // Add stock to destination branch
      for (const item of shipment.items) {
        // Determine actual received quantity
        let actualReceivedQty = Number(item.sentQty);
        
        if (input.receivedItems) {
          const receivedItem = input.receivedItems.find(
            ri => ri.masterProductId === item.masterProductId
          );
          if (receivedItem) {
            actualReceivedQty = receivedItem.receivedQty;
          }
        }

        // Find or create inventory item at destination branch
        let destInventoryItem = await tx.inventoryItem.findFirst({
          where: {
            branchId: shipment.toBranchId,
            masterProductId: item.masterProductId,
          },
        });

        if (!destInventoryItem) {
          // Create inventory item if doesn't exist
          destInventoryItem = await tx.inventoryItem.create({
            data: {
              branchId: shipment.toBranchId,
              masterProductId: item.masterProductId,
              stock: 0,
              minThreshold: 10,
            },
          });
        }

        const stockBefore = Number(destInventoryItem.stock);
        const stockAfter = stockBefore + actualReceivedQty;

        // Update stock
        await tx.inventoryItem.update({
          where: { id: destInventoryItem.id },
          data: {
            stock: stockAfter,
          },
        });

        // Create stock mutation record
        await tx.stockMutation.create({
          data: {
            inventoryItemId: destInventoryItem.id,
            type: StockMutationType.RECEIVED,
            quantity: actualReceivedQty,
            stockBefore,
            stockAfter,
            referenceType: 'SHIPMENT',
            referenceId: shipmentId,
            notes: `Penerimaan ${shipment.shipmentCode} dari ${shipment.fromBranch.name}${hasDiscrepancies ? ' (dengan ketidaksesuaian)' : ''}`,
            createdBy: userId,
          },
        });
      }

      return updatedShipment;
    });

    // Audit log
    await logAudit({
      userId,
      branchId: shipment.toBranchId,
      action: AuditAction.UPDATE,
      resource: 'Shipment',
      resourceId: shipmentId,
      meta: { 
        action: hasDiscrepancies ? 'RECEIVE_WITH_ISSUE' : 'RECEIVE',
        shipmentCode: shipment.shipmentCode,
        hasDiscrepancies,
        discrepancyCount: input.discrepancies?.length || 0,
      },
    });

    return this.formatShipment(result);
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
      shipmentPhotoUrl: shipment.shipmentPhotoUrl,
      shipmentPhotoName: shipment.shipmentPhotoName,
      items: shipment.items.map((item: any) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.masterProduct.name,
        productCategory: item.masterProduct.category,
        sentQty: Number(item.sentQty),
        receivedQty: item.receivedQty ? Number(item.receivedQty) : null,
        unit: item.masterProduct.baseUnit,
      })),
      discrepancies: shipment.discrepancies?.map((d: any) => ({
        id: d.id,
        masterProductId: d.masterProductId,
        productName: d.productName,
        expectedQty: Number(d.expectedQty),
        receivedQty: Number(d.receivedQty),
        discrepancyType: d.discrepancyType,
        notes: d.notes,
        photoUrl: d.photoUrl,
      })) || [],
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
}
