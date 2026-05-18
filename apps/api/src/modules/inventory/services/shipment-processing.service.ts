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
    // Validate user is SUPER_ADMIN or ADMIN_MANAGER
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || ![Role.SUPER_ADMIN, Role.ADMIN_MANAGER].includes(user.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya super admin atau admin manager yang dapat mengirim barang',
      };
    }

    // Get shipment with stock request items for product info
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
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

    // For ADMIN_MANAGER, validate they manage the from branch
    if (user.role === Role.ADMIN_MANAGER) {
      const managerBranch = await prisma.managerBranch.findFirst({
        where: {
          userId,
          branchId: shipment.fromBranchId,
        },
      });

      if (!managerBranch) {
        throw {
          status: 403,
          code: 'BRANCH_ACCESS_DENIED',
          message: 'Anda tidak memiliki akses untuk mengirim dari cabang ini',
        };
      }
    }

    // Build inventory item map from stock request
    const inventoryItemMap = new Map<string, { masterProductId: string; productName: string }>();
    if (shipment.stockRequest?.items) {
      shipment.stockRequest.items.forEach((item: any) => {
        inventoryItemMap.set(item.inventoryItemId, {
          masterProductId: item.inventoryItem.masterProductId,
          productName: item.inventoryItem.masterProduct.name,
        });
      });
    }

    // Update shipment status and deduct stock from source branch
    const result = await prisma.$transaction(async (tx) => {
      // Update shipment
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: 'SHIPPED',
          shippedAt: new Date(),
          notes: notes || shipment.notes,
        },
        include: {
          items: true,
          fromBranch: true,
          toBranch: true,
        },
      });

      // Deduct stock from source branch
      for (const item of shipment.items) {
        const itemInfo = inventoryItemMap.get(item.inventoryItemId);
        
        // Find inventory item at source branch
        const inventoryItem = await tx.inventoryItem.findUnique({
          where: { id: item.inventoryItemId },
          include: { masterProduct: true },
        });

        if (!inventoryItem) {
          throw {
            status: 404,
            code: 'INVENTORY_NOT_FOUND',
            message: `Item tidak ditemukan di cabang pengirim`,
          };
        }

        if (Number(inventoryItem.stock) < Number(item.sentQty)) {
          throw {
            status: 422,
            code: 'INSUFFICIENT_STOCK',
            message: `Stok ${inventoryItem.masterProduct.name} tidak mencukupi`,
          };
        }

        // Update stock
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            stock: {
              decrement: item.sentQty,
            },
          },
        });

        // Create stock mutation record
        await tx.stockMutation.create({
          data: {
            inventoryItemId: inventoryItem.id,
            type: StockMutationType.OUT,
            quantity: item.sentQty,
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

    return this.formatShipmentBasic(result);
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

    if (!user || ![Role.ADMIN_CABANG, Role.ADMIN_LAYANAN, Role.ADMIN_MANAGER, Role.SUPER_ADMIN].includes(user.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya admin cabang, admin manager, atau super admin yang dapat menerima barang',
      };
    }

    // Get shipment
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: true,
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

    // Validate receiving branch access
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
          message: 'Anda tidak memiliki akses untuk menerima barang di cabang ini',
        };
      }
    } else if (user.role !== Role.SUPER_ADMIN && shipment.toBranchId !== user.branchId) {
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
        receivedAt: new Date(),
        notes: notes || shipment.notes,
      },
      include: {
        items: true,
        fromBranch: true,
        toBranch: true,
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

    return this.formatShipmentBasic(updatedShipment);
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

    if (!user || ![Role.ADMIN_CABANG, Role.ADMIN_MANAGER, Role.SUPER_ADMIN].includes(user.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya admin cabang, admin manager, atau super admin yang dapat menyetujui penerimaan barang',
      };
    }

    // Get shipment with stock request for product info
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
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

    // Validate approving branch access
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
          message: 'Anda tidak memiliki akses untuk menyetujui barang di cabang ini',
        };
      }
    } else if (user.role !== Role.SUPER_ADMIN && shipment.toBranchId !== user.branchId) {
      throw {
        status: 403,
        code: 'INVALID_BRANCH',
        message: 'Anda hanya dapat menyetujui barang untuk cabang Anda',
      };
    }

    // Build inventory item map from stock request
    const inventoryItemMap = new Map<string, { masterProductId: string; productName: string }>();
    if (shipment.stockRequest?.items) {
      shipment.stockRequest.items.forEach((item: any) => {
        inventoryItemMap.set(item.inventoryItemId, {
          masterProductId: item.inventoryItem.masterProductId,
          productName: item.inventoryItem.masterProduct.name,
        });
      });
    }

    // Update shipment and add stock to destination branch
    const result = await prisma.$transaction(async (tx) => {
      // Update shipment
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          notes: notes || shipment.notes,
        },
        include: {
          items: true,
          fromBranch: true,
          toBranch: true,
        },
      });

      // Add stock to destination branch
      for (const item of shipment.items) {
        const itemInfo = inventoryItemMap.get(item.inventoryItemId);
        
        // Find or create inventory item at destination branch
        let destInventoryItem = await tx.inventoryItem.findFirst({
          where: {
            branchId: shipment.toBranchId,
            masterProductId: itemInfo?.masterProductId,
          },
        });

        if (!destInventoryItem && itemInfo) {
          // Create inventory item if doesn't exist
          destInventoryItem = await tx.inventoryItem.create({
            data: {
              branchId: shipment.toBranchId,
              masterProductId: itemInfo.masterProductId,
              stock: 0,
              minThreshold: 10,
            },
          });
        }

        if (destInventoryItem) {
          // Update stock
          await tx.inventoryItem.update({
            where: { id: destInventoryItem.id },
            data: {
              stock: {
                increment: item.sentQty,
              },
            },
          });

          // Create stock mutation record
          await tx.stockMutation.create({
            data: {
              inventoryItemId: destInventoryItem.id,
              type: StockMutationType.IN,
              quantity: item.sentQty,
              notes: `Penerimaan ${shipment.shipmentCode} dari ${shipment.fromBranch.name}`,
              performedBy: userId,
            },
          });
        }
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

    return this.formatShipmentBasic(result);
  }

  /**
   * Format shipment for response (basic - without user relations)
   */
  private formatShipmentBasic(shipment: any) {
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
      items: shipment.items.map((item: any) => ({
        id: item.id,
        inventoryItemId: item.inventoryItemId,
        sentQty: Number(item.sentQty),
      })),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    };
  }

  /**
   * Format shipment for response (with user relations - legacy)
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
        productName: item.masterProduct?.name || 'Unknown',
        productCategory: item.masterProduct?.category,
        productUnit: item.masterProduct?.unit,
        quantity: Number(item.quantity || item.sentQty),
      })),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    };
  }
}
