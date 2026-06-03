// @ts-nocheck
import { prisma } from '../../lib/prisma';
import { ShipmentStatus, Role, StockMutationType } from '@prisma/client';
import { logAudit, AuditAction } from '../../utils/auditLog';

export class ShipmentService {
  async shipShipment(shipmentId: string, userId: string, notes?: string) {
    // 1. Validate user is SUPER_ADMIN
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== Role.SUPER_ADMIN) {
      throw {
        status: 403,
        code: 'UNAUTHORIZED',
        message: 'Hanya SUPER_ADMIN yang dapat mengirim shipment',
      };
    }

    // 2. Get shipment
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: {
          include: {
            inventoryItem: {
              include: { masterProduct: true },
            },
          },
        },
        fromBranch: true,
        toBranch: true,
      },
    });

    if (!shipment) {
      throw { status: 404, code: 'SHIPMENT_NOT_FOUND', message: 'Shipment tidak ditemukan' };
    }

    if (shipment.status !== ShipmentStatus.PREPARING) {
      throw {
        status: 422,
        code: 'INVALID_SHIPMENT_STATUS',
        message: `Shipment tidak dalam status PREPARING (status: ${shipment.status})`,
      };
    }

    // 3. Update shipment status
    const result = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: ShipmentStatus.SHIPPED,
        shippedAt: new Date(),
        notes: notes || shipment.notes,
      },
      include: {
        items: {
          include: {
            inventoryItem: {
              include: { masterProduct: true },
            },
          },
        },
      },
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'Shipment',
      resourceId: shipmentId,
      meta: {
        status: ShipmentStatus.SHIPPED,
        shipmentCode: result.shipmentCode,
      },
    });

    return {
      id: result.id,
      shipmentCode: result.shipmentCode,
      status: result.status,
      shippedAt: result.shippedAt,
      items: result.items.map((item) => ({
        id: item.id,
        productName: item.inventoryItem.masterProduct.name,
        sentQty: Number(item.sentQty),
        unit: item.inventoryItem.masterProduct.unit,
      })),
      message: 'Shipment berhasil dikirim',
    };
  }

  async receiveShipment(shipmentId: string, userId: string, branchId: string, notes?: string) {
    // 1. Validate user is ADMIN_CABANG or higher
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || ![Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG].includes(user.role)) {
      throw {
        status: 403,
        code: 'UNAUTHORIZED',
        message: 'Hanya ADMIN_CABANG atau lebih tinggi yang dapat menerima shipment',
      };
    }

    // 2. Get shipment
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: {
          include: {
            inventoryItem: {
              include: { masterProduct: true },
            },
          },
        },
        toBranch: true,
      },
    });

    if (!shipment) {
      throw { status: 404, code: 'SHIPMENT_NOT_FOUND', message: 'Shipment tidak ditemukan' };
    }

    // Validate shipment is for this branch
    if (shipment.toBranchId !== branchId) {
      throw {
        status: 403,
        code: 'SHIPMENT_BRANCH_MISMATCH',
        message: 'Shipment bukan untuk cabang ini',
      };
    }

    if (shipment.status !== ShipmentStatus.SHIPPED) {
      throw {
        status: 422,
        code: 'INVALID_SHIPMENT_STATUS',
        message: `Shipment tidak dalam status SHIPPED (status: ${shipment.status})`,
      };
    }

    // 3. Update shipment status
    const result = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: ShipmentStatus.RECEIVED,
        receivedAt: new Date(),
        notes: notes || shipment.notes,
      },
      include: {
        items: {
          include: {
            inventoryItem: {
              include: { masterProduct: true },
            },
          },
        },
      },
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'Shipment',
      resourceId: shipmentId,
      meta: {
        status: ShipmentStatus.RECEIVED,
        shipmentCode: result.shipmentCode,
      },
    });

    return {
      id: result.id,
      shipmentCode: result.shipmentCode,
      status: result.status,
      receivedAt: result.receivedAt,
      items: result.items.map((item) => ({
        id: item.id,
        productName: item.inventoryItem.masterProduct.name,
        sentQty: Number(item.sentQty),
        unit: item.inventoryItem.masterProduct.unit,
      })),
      message: 'Shipment berhasil diterima',
    };
  }

  async approveShipment(shipmentId: string, userId: string, branchId: string, notes?: string) {
    // 1. Validate user is ADMIN_CABANG or higher
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || ![Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG].includes(user.role)) {
      throw {
        status: 403,
        code: 'UNAUTHORIZED',
        message: 'Hanya ADMIN_CABANG atau lebih tinggi yang dapat approve shipment',
      };
    }

    // 2. Get shipment
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: {
          include: {
            inventoryItem: true,
          },
        },
        toBranch: true,
      },
    });

    if (!shipment) {
      throw { status: 404, code: 'SHIPMENT_NOT_FOUND', message: 'Shipment tidak ditemukan' };
    }

    // Validate shipment is for this branch
    if (shipment.toBranchId !== branchId) {
      throw {
        status: 403,
        code: 'SHIPMENT_BRANCH_MISMATCH',
        message: 'Shipment bukan untuk cabang ini',
      };
    }

    if (shipment.status !== ShipmentStatus.RECEIVED) {
      throw {
        status: 422,
        code: 'INVALID_SHIPMENT_STATUS',
        message: `Shipment tidak dalam status RECEIVED (status: ${shipment.status})`,
      };
    }

    // 3. Update shipment status and update inventory in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update shipment status
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.APPROVED,
          approvedAt: new Date(),
          notes: notes || shipment.notes,
        },
        include: {
          items: {
            include: {
              inventoryItem: {
                include: { masterProduct: true },
              },
            },
          },
        },
      });

      // Update inventory stock for each item
      for (const item of shipment.items) {
        const inventoryItem = await tx.inventoryItem.findUnique({
          where: { id: item.inventoryItemId },
        });

        if (!inventoryItem) {
          throw {
            status: 404,
            code: 'INVENTORY_ITEM_NOT_FOUND',
            message: `Item inventory tidak ditemukan: ${item.inventoryItemId}`,
          };
        }

        const stockBefore = Number(inventoryItem.stock);
        const stockAfter = stockBefore + Number(item.sentQty);

        // Update inventory item stock
        await tx.inventoryItem.update({
          where: { id: item.inventoryItemId },
          data: {
            stock: stockAfter,
          },
        });

        // Create stock mutation record
        await tx.stockMutation.create({
          data: {
            inventoryItemId: item.inventoryItemId,
            type: StockMutationType.RECEIVED,
            quantity: item.sentQty,
            stockBefore,
            stockAfter,
            referenceType: 'Shipment',
            referenceId: shipmentId,
            notes: `Penerimaan dari shipment ${updatedShipment.shipmentCode}`,
            createdBy: userId,
          },
        });
      }

      return updatedShipment;
    });

    await logAudit({
      userId,
      action: AuditAction.VERIFY,
      resource: 'Shipment',
      resourceId: shipmentId,
      meta: {
        status: ShipmentStatus.APPROVED,
        shipmentCode: result.shipmentCode,
        itemCount: result.items.length,
      },
    });

    return {
      id: result.id,
      shipmentCode: result.shipmentCode,
      status: result.status,
      approvedAt: result.approvedAt,
      items: result.items.map((item) => ({
        id: item.id,
        productName: item.inventoryItem.masterProduct.name,
        sentQty: Number(item.sentQty),
        unit: item.inventoryItem.masterProduct.unit,
      })),
      message: 'Shipment berhasil di-approve dan stok diperbarui',
    };
  }

  async getShipments(branchId?: string, status?: ShipmentStatus) {
    const where: any = {};

    if (branchId) {
      where.toBranchId = branchId;
    }

    if (status) {
      where.status = status;
    }

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        items: {
          include: {
            inventoryItem: {
              include: { masterProduct: true },
            },
          },
        },
        fromBranch: true,
        toBranch: true,
        stockRequest: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return shipments.map((shipment) => ({
      id: shipment.id,
      shipmentCode: shipment.shipmentCode,
      fromBranchId: shipment.fromBranchId,
      fromBranchName: shipment.fromBranch.name,
      toBranchId: shipment.toBranchId,
      toBranchName: shipment.toBranch.name,
      status: shipment.status,
      itemCount: shipment.items.length,
      items: shipment.items.map((item) => ({
        id: item.id,
        productName: item.inventoryItem.masterProduct.name,
        sentQty: Number(item.sentQty),
        unit: item.inventoryItem.masterProduct.unit,
      })),
      shippedAt: shipment.shippedAt,
      receivedAt: shipment.receivedAt,
      approvedAt: shipment.approvedAt,
      notes: shipment.notes,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    }));
  }

  async getShipmentById(shipmentId: string) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: {
          include: {
            inventoryItem: {
              include: { masterProduct: true },
            },
          },
        },
        fromBranch: true,
        toBranch: true,
        stockRequest: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!shipment) {
      throw { status: 404, code: 'SHIPMENT_NOT_FOUND', message: 'Shipment tidak ditemukan' };
    }

    return {
      id: shipment.id,
      shipmentCode: shipment.shipmentCode,
      fromBranchId: shipment.fromBranchId,
      fromBranchName: shipment.fromBranch.name,
      toBranchId: shipment.toBranchId,
      toBranchName: shipment.toBranch.name,
      status: shipment.status,
      items: shipment.items.map((item) => ({
        id: item.id,
        productName: item.inventoryItem.masterProduct.name,
        sentQty: Number(item.sentQty),
        unit: item.inventoryItem.masterProduct.unit,
      })),
      stockRequest: shipment.stockRequest
        ? {
            id: shipment.stockRequest.id,
            requestCode: shipment.stockRequest.requestCode,
            branchName: shipment.stockRequest.branch.name,
          }
        : null,
      shippedAt: shipment.shippedAt,
      receivedAt: shipment.receivedAt,
      approvedAt: shipment.approvedAt,
      notes: shipment.notes,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    };
  }
}
