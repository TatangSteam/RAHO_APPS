// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Role } from '@prisma/client';

/**
 * Service for approving/rejecting stock requests
 */
export class StockRequestApprovalService {
  /**
   * Approve stock request and create shipment
   */
  async approveRequest(requestId: string, userId: string, reviewNotes?: string) {
    // Validate user is SUPER_ADMIN
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, branchId: true },
    });

    if (!user || user.role !== Role.SUPER_ADMIN) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya super admin yang dapat menyetujui permintaan stok',
      };
    }

    // Get request
    const request = await prisma.stockRequest.findUnique({
      where: { id: requestId },
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        requestingBranch: true,
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

    // Get HQ branch (assuming branchCode 'HQ' or first branch)
    const hqBranch = await prisma.branch.findFirst({
      where: {
        OR: [
          { branchCode: 'HQ' },
          { branchCode: 'PST' },
        ],
      },
    });

    if (!hqBranch) {
      throw {
        status: 404,
        code: 'HQ_NOT_FOUND',
        message: 'Cabang pusat tidak ditemukan',
      };
    }

    // Generate shipment code
    const shipmentCode = await this.generateShipmentCode(hqBranch.id, request.requestingBranchId);

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
              masterProduct: true,
            },
          },
          requestingBranch: true,
          reviewedByUser: {
            include: {
              profile: true,
            },
          },
        },
      });

      // Create shipment
      const shipment = await tx.shipment.create({
        data: {
          shipmentCode,
          fromBranchId: hqBranch.id,
          toBranchId: request.requestingBranchId,
          stockRequestId: requestId,
          status: 'PENDING',
          notes: `Pengiriman untuk permintaan ${request.requestCode}`,
          items: {
            create: request.items.map(item => ({
              masterProductId: item.masterProductId,
              quantity: item.requestedQuantity,
            })),
          },
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

      return { updatedRequest, shipment };
    });

    // Audit logs
    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'StockRequest',
      resourceId: requestId,
      meta: { action: 'APPROVE', shipmentId: result.shipment.id },
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
      shipment: this.formatShipment(result.shipment),
    };
  }

  /**
   * Reject stock request
   */
  async rejectRequest(requestId: string, userId: string, reviewNotes: string) {
    // Validate user is SUPER_ADMIN
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== Role.SUPER_ADMIN) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya super admin yang dapat menolak permintaan stok',
      };
    }

    // Get request
    const request = await prisma.stockRequest.findUnique({
      where: { id: requestId },
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        requestingBranch: true,
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
            masterProduct: true,
          },
        },
        requestingBranch: true,
        reviewedByUser: {
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
      resource: 'StockRequest',
      resourceId: requestId,
      meta: { action: 'REJECT', reason: reviewNotes },
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
    
    const prefix = `SHP-${fromBranch?.branchCode}-${toBranch?.branchCode}-${year}${month}`;
    
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
      requestingBranchId: request.requestingBranchId,
      requestingBranchName: request.requestingBranch.name,
      status: request.status,
      notes: request.notes,
      requestedBy: request.requestedByUser?.profile?.fullName || request.requestedByUser?.email,
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

  /**
   * Format shipment
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
