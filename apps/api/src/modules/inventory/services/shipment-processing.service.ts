// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit, AuditAction } from '../../../utils/auditLog';
import { Role, StockMutationType } from '@prisma/client';

/**
 * Service for processing shipments (ship, receive, approve)
 */
export class ShipmentProcessingService {
  /**
   * Ship shipment (mark as shipped)
   */
  async shipShipment(shipmentId: string, userId: string, notes?: string) {
    // Validate user is SUPER_ADMIN
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== Role.SUPER_ADMIN) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya super admin yang dapat mengirim barang',
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
      },
    });

    if (!shipment) {
      throw {
        status: 404,
        code: 'SHIPMENT_NOT_FOUND',
        message: 'Pengiriman tidak ditemukan',
      };
    }

    if (shipment.status !== 'PENDING') {
      throw {
        status: 422,
        code: 'INVALID_STATUS',
        message: 'Pengiriman sudah diproses',
      };
    }

    // Update shipment status and deduct stock from source branch
    const result = await prisma.$transaction(async (tx) => {
      // Update shipment
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: 'SHIPPED',
          shippedBy: userId,
          shippedAt: new Date(),
          notes: notes || shipment.notes,
        },
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
        },
      });

      // Deduct stock from source branch
      for (const item of shipment.items) {
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: {
            branchId: shipment.fromBranchId,
            masterProductId: item.masterProductId,
          },
        });

        if (!inventoryItem) {
          throw {
            status: 404,
            code: 'INVENTORY_NOT_FOUND',
            message: `Item ${item.masterProduct.name} tidak ditemukan di cabang pengirim`,
          };
        }

        if (Number(inventoryItem.stock) < Number(item.quantity)) {
          throw {
            status: 422,
            code: 'INSUFFICIENT_STOCK',
            message: `Stok ${item.masterProduct.name} tidak mencukupi`,
          };
        }

        // Update stock
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        // Create stock mutation record
        await tx.stockMutation.create({
          data: {
            inventoryItemId: inventoryItem.id,
            type: StockMutationType.OUT,
            quantity: item.quantity,
            notes: `Pengiriman ${shipment.shipmentCode} ke ${shipment.toBranch.name}`,
            performedBy: userId,
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
      meta: { action: 'SHIP', shipmentCode: shipment.shipmentCode },
    });

    return this.formatShipment(result);
  }

  /**
   * Receive shipment (mark as received)
   */
  async receiveShipment(shipmentId: string, userId: string, branchId: string, notes?: string) {
    // Validate user role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, branchId: true },
    });

    if (!user || ![Role.ADMIN_CABANG, Role.ADMIN_LAYANAN, Role.SUPER_ADMIN].includes(user.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya admin cabang atau super admin yang dapat menerima barang',
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

    // Validate receiving branch
    if (shipment.toBranchId !== branchId && user.role !== Role.SUPER_ADMIN) {
      throw {
        status: 403,
        code: 'INVALID_BRANCH',
        message: 'Anda hanya dapat menerima barang untuk cabang Anda',
      };
    }

    // Update shipment status
    const updatedShipment = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'RECEIVED',
        receivedBy: userId,
        receivedAt: new Date(),
        notes: notes || shipment.notes,
      },
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        fromBranch: true,
        toBranch: true,
        receivedByUser: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Audit log
    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'Shipment',
      resourceId: shipmentId,
      meta: { action: 'RECEIVE', shipmentCode: shipment.shipmentCode },
    });

    return this.formatShipment(updatedShipment);
  }

  /**
   * Approve shipment (add stock to destination branch)
   */
  async approveShipment(shipmentId: string, userId: string, branchId: string, notes?: string) {
    // Validate user role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, branchId: true },
    });

    if (!user || ![Role.ADMIN_CABANG, Role.SUPER_ADMIN].includes(user.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya admin cabang atau super admin yang dapat menyetujui penerimaan barang',
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
      },
    });

    if (!shipment) {
      throw {
        status: 404,
        code: 'SHIPMENT_NOT_FOUND',
        message: 'Pengiriman tidak ditemukan',
      };
    }

    if (shipment.status !== 'RECEIVED') {
      throw {
        status: 422,
        code: 'INVALID_STATUS',
        message: 'Pengiriman belum diterima atau sudah diproses',
      };
    }

    // Validate approving branch
    if (shipment.toBranchId !== branchId && user.role !== Role.SUPER_ADMIN) {
      throw {
        status: 403,
        code: 'INVALID_BRANCH',
        message: 'Anda hanya dapat menyetujui barang untuk cabang Anda',
      };
    }

    // Update shipment and add stock to destination branch
    const result = await prisma.$transaction(async (tx) => {
      // Update shipment
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: 'APPROVED',
          approvedBy: userId,
          approvedAt: new Date(),
          notes: notes || shipment.notes,
        },
        include: {
          items: {
            include: {
              masterProduct: true,
            },
          },
          fromBranch: true,
          toBranch: true,
          approvedByUser: {
            include: {
              profile: true,
            },
          },
        },
      });

      // Add stock to destination branch
      for (const item of shipment.items) {
        let inventoryItem = await tx.inventoryItem.findFirst({
          where: {
            branchId: shipment.toBranchId,
            masterProductId: item.masterProductId,
          },
        });

        if (!inventoryItem) {
          // Create inventory item if doesn't exist
          inventoryItem = await tx.inventoryItem.create({
            data: {
              branchId: shipment.toBranchId,
              masterProductId: item.masterProductId,
              stock: 0,
              minThreshold: 10,
            },
          });
        }

        // Update stock
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });

        // Create stock mutation record
        await tx.stockMutation.create({
          data: {
            inventoryItemId: inventoryItem.id,
            type: StockMutationType.IN,
            quantity: item.quantity,
            notes: `Penerimaan ${shipment.shipmentCode} dari ${shipment.fromBranch.name}`,
            performedBy: userId,
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
      meta: { action: 'APPROVE', shipmentCode: shipment.shipmentCode },
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
