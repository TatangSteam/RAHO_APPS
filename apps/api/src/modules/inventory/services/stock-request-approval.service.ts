// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Role } from '@prisma/client';

/**
 * Service for approving/rejecting stock requests
 * 
 * Approval Rules:
 * - SUPER_ADMIN: Can approve any request, shipment comes from "External/System" (not tied to any branch)
 * - ADMIN_MANAGER: Can only approve requests from branches they manage, shipment comes from their managed branch
 */
export class StockRequestApprovalService {
  // Branch code for external/system shipments (Super Admin)
  private readonly EXTERNAL_BRANCH_CODE = 'EXT';

  /**
   * Get or create the external/system branch for Super Admin shipments
   */
  private async getOrCreateExternalBranch() {
    let externalBranch = await prisma.branch.findFirst({
      where: { branchCode: this.EXTERNAL_BRANCH_CODE },
    });

    if (!externalBranch) {
      externalBranch = await prisma.branch.create({
        data: {
          branchCode: this.EXTERNAL_BRANCH_CODE,
          name: 'External / Sistem',
          address: 'Pengiriman dari sistem eksternal',
          phone: '-',
          isActive: true,
        },
      });
    }

    return externalBranch;
  }

  /**
   * Approve stock request and create shipment
   * 
   * - Super Admin: Can approve any request, shipment from External/System
   * - Admin Manager: Can only approve requests from branches they manage, shipment from External/System
   */
  async approveRequest(requestId: string, userId: string, reviewNotes?: string) {
    // Validate user role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, branchId: true },
    });

    if (!user || (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN_MANAGER)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Super Admin atau Admin Manager yang dapat menyetujui permintaan stok',
      };
    }

    // Get request
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
      },
    });

    if (!request) {
      throw {
        status: 404,
        code: 'REQUEST_NOT_FOUND',
        message: 'Permintaan stok tidak ditemukan',
      };
    }

    if (request.status !== 'PENDING') {
      throw {
        status: 422,
        code: 'INVALID_STATUS',
        message: 'Permintaan stok sudah diproses',
      };
    }

    // For Admin Manager: verify they manage the requesting branch
    if (user.role === Role.ADMIN_MANAGER) {
      const managerBranch = await prisma.managerBranch.findFirst({
        where: {
          userId,
          branchId: request.branchId,
        },
      });

      if (!managerBranch) {
        throw {
          status: 403,
          code: 'BRANCH_ACCESS_DENIED',
          message: 'Anda hanya dapat menyetujui permintaan dari cabang yang Anda kelola',
        };
      }
    }

    // Both Super Admin and Admin Manager: Shipment from External/System
    const senderBranch = await this.getOrCreateExternalBranch();
    const shipmentNotes = `Pengiriman untuk permintaan ${request.requestCode} dari Sistem/External`;

    // Generate shipment code
    const shipmentCode = await this.generateShipmentCode(senderBranch.id, request.branchId);

    // Create shipment and update request in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update request status
      const updatedRequest = await tx.stockRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes,
        },
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
      });

      // Create shipment
      const shipment = await tx.shipment.create({
        data: {
          shipmentCode,
          fromBranchId: senderBranch.id,
          toBranchId: request.branchId,
          stockRequestId: requestId,
          status: 'PREPARING',
          notes: shipmentNotes,
          items: {
            create: request.items.map(item => ({
              inventoryItemId: item.inventoryItemId,
              sentQty: item.requestedQty,
            })),
          },
        },
        include: {
          items: true,
          fromBranch: true,
          toBranch: true,
        },
      });

      return { updatedRequest, shipment };
    });

    // Audit logs
    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'StockRequest',
      resourceId: requestId,
      meta: { 
        action: 'APPROVE', 
        shipmentId: result.shipment.id,
        approverRole: user.role,
        senderBranchId: senderBranch.id,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'Shipment',
      resourceId: result.shipment.id,
      meta: { requestId, shipmentCode },
    });

    return {
      request: this.formatStockRequest(result.updatedRequest),
      shipment: this.formatShipment(result.shipment, result.updatedRequest.items),
    };
  }

  /**
   * Reject stock request
   * 
   * - Super Admin: Can reject any request
   * - Admin Manager: Can only reject requests from branches they manage
   */
  async rejectRequest(requestId: string, userId: string, reviewNotes: string) {
    // Validate user role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, branchId: true },
    });

    if (!user || (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN_MANAGER)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Super Admin atau Admin Manager yang dapat menolak permintaan stok',
      };
    }

    // Get request
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
      },
    });

    if (!request) {
      throw {
        status: 404,
        code: 'REQUEST_NOT_FOUND',
        message: 'Permintaan stok tidak ditemukan',
      };
    }

    // For ADMIN_MANAGER, verify they manage the requesting branch
    if (user.role === Role.ADMIN_MANAGER) {
      const managerBranch = await prisma.managerBranch.findFirst({
        where: {
          userId,
          branchId: request.branchId, // Must manage the requesting branch
        },
      });

      if (!managerBranch) {
        throw {
          status: 403,
          code: 'BRANCH_ACCESS_DENIED',
          message: 'Anda hanya dapat menolak permintaan dari cabang yang Anda kelola',
        };
      }
    }

    if (request.status !== 'PENDING') {
      throw {
        status: 422,
        code: 'INVALID_STATUS',
        message: 'Permintaan stok sudah diproses',
      };
    }

    // Update request status
    const updatedRequest = await prisma.stockRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes,
      },
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
    });

    // Audit log
    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'StockRequest',
      resourceId: requestId,
      meta: { action: 'REJECT', reason: reviewNotes, approverRole: user.role },
    });

    return this.formatStockRequest(updatedRequest);
  }

  /**
   * Generate shipment code
   */
  private async generateShipmentCode(fromBranchId: string, toBranchId: string): Promise<string> {
    const [fromBranch, toBranch] = await Promise.all([
      prisma.branch.findUnique({ where: { id: fromBranchId }, select: { branchCode: true } }),
      prisma.branch.findUnique({ where: { id: toBranchId }, select: { branchCode: true } }),
    ]);

    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    const prefix = `SHP-${fromBranch?.branchCode || 'EXT'}-${toBranch?.branchCode}-${year}${month}`;
    
    const lastShipment = await prisma.shipment.findFirst({
      where: {
        shipmentCode: {
          startsWith: prefix,
        },
      },
      orderBy: {
        shipmentCode: 'desc',
      },
    });

    let sequence = 1;
    if (lastShipment) {
      const lastSeq = parseInt(lastShipment.shipmentCode.split('-').pop() || '0');
      sequence = lastSeq + 1;
    }

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Format stock request
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

  /**
   * Format shipment
   */
  private formatShipment(shipment: any, requestItems?: any[]) {
    // Create a map of inventoryItemId to product info from request items
    const itemInfoMap = new Map<string, { productName: string; unit: string }>();
    if (requestItems) {
      requestItems.forEach((item: any) => {
        itemInfoMap.set(item.inventoryItemId, {
          productName: item.inventoryItem.masterProduct.name,
          unit: item.inventoryItem.masterProduct.baseUnit || item.inventoryItem.masterProduct.unit,
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
      items: shipment.items.map((item: any) => {
        const itemInfo = itemInfoMap.get(item.inventoryItemId);
        return {
          id: item.id,
          inventoryItemId: item.inventoryItemId,
          productName: itemInfo?.productName || 'Unknown Product',
          sentQty: Number(item.sentQty),
          unit: itemInfo?.unit || 'unit',
        };
      }),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    };
  }
}
