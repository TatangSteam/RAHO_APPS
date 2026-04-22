// @ts-nocheck
import { prisma } from '../../lib/prisma';
import { StockRequestStatus, Role, AuditAction } from '@prisma/client';
import { logAudit } from '../../utils/auditLog';

export interface CreateStockRequestInput {
  items: Array<{
    inventoryItemId: string;
    requestedQty: number;
    notes?: string;
  }>;
  notes?: string;
}

export class StockRequestService {
  async createRequest(data: CreateStockRequestInput, branchId: string, userId: string) {
    // 1. Validate user is ADMIN_CABANG or higher
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || ![Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG].includes(user.role)) {
      throw {
        status: 403,
        code: 'UNAUTHORIZED',
        message: 'Hanya ADMIN_CABANG atau lebih tinggi yang dapat membuat request stok',
      };
    }

    // 2. Validate branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan' };
    }

    // 3. Validate items exist and belong to branch
    if (!data.items || data.items.length === 0) {
      throw {
        status: 400,
        code: 'EMPTY_ITEMS',
        message: 'Minimal harus ada 1 item dalam request',
      };
    }

    const inventoryItems = await prisma.inventoryItem.findMany({
      where: {
        id: { in: data.items.map((item) => item.inventoryItemId) },
      },
      include: { masterProduct: true },
    });

    if (inventoryItems.length !== data.items.length) {
      throw {
        status: 404,
        code: 'INVENTORY_ITEM_NOT_FOUND',
        message: 'Beberapa item inventory tidak ditemukan',
      };
    }

    // Validate all items belong to the requesting branch
    for (const item of inventoryItems) {
      if (item.branchId !== branchId) {
        throw {
          status: 403,
          code: 'ITEM_BRANCH_MISMATCH',
          message: `Item ${item.masterProduct.name} bukan milik cabang ini`,
        };
      }
    }

    // 4. Generate request code
    const requestCode = await this.generateRequestCode(branchId);

    // 5. Create stock request with items in transaction
    const result = await prisma.$transaction(async (tx) => {
      const stockRequest = await tx.stockRequest.create({
        data: {
          requestCode,
          branchId,
          requestedBy: userId,
          status: StockRequestStatus.PENDING,
          notes: data.notes,
          items: {
            create: data.items.map((item) => ({
              inventoryItemId: item.inventoryItemId,
              requestedQty: item.requestedQty,
              notes: item.notes,
            })),
          },
        },
        include: {
          items: {
            include: {
              inventoryItem: {
                include: { masterProduct: true },
              },
            },
          },
          branch: true,
        },
      });

      return stockRequest;
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'StockRequest',
      resourceId: result.id,
      meta: {
        requestCode: result.requestCode,
        itemCount: result.items.length,
        branchId,
      },
    });

    return {
      id: result.id,
      requestCode: result.requestCode,
      status: result.status,
      items: result.items.map((item) => ({
        id: item.id,
        inventoryItemId: item.inventoryItemId,
        productName: item.inventoryItem.masterProduct.name,
        requestedQty: Number(item.requestedQty),
        unit: item.inventoryItem.masterProduct.unit,
        notes: item.notes,
      })),
      notes: result.notes,
      createdAt: result.createdAt,
      message: 'Request stok berhasil dibuat',
    };
  }

  async approveRequest(requestId: string, userId: string, reviewNotes?: string) {
    // 1. Validate user is SUPER_ADMIN
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== Role.SUPER_ADMIN) {
      throw {
        status: 403,
        code: 'UNAUTHORIZED',
        message: 'Hanya SUPER_ADMIN yang dapat approve request stok',
      };
    }

    // 2. Get stock request
    const stockRequest = await prisma.stockRequest.findUnique({
      where: { id: requestId },
      include: {
        items: {
          include: {
            inventoryItem: {
              include: { masterProduct: true },
            },
          },
        },
        branch: true,
      },
    });

    if (!stockRequest) {
      throw { status: 404, code: 'REQUEST_NOT_FOUND', message: 'Request stok tidak ditemukan' };
    }

    if (stockRequest.status !== StockRequestStatus.PENDING) {
      throw {
        status: 422,
        code: 'INVALID_REQUEST_STATUS',
        message: `Request stok tidak dalam status PENDING (status: ${stockRequest.status})`,
      };
    }

    // 3. Update request status and create shipment
    const result = await prisma.$transaction(async (tx) => {
      // Update request status
      const updatedRequest = await tx.stockRequest.update({
        where: { id: requestId },
        data: {
          status: StockRequestStatus.APPROVED,
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes,
        },
      });

      // Create shipment from Pusat (main branch) to requesting branch
      const pusat = await tx.branch.findFirst({
        where: { branchCode: 'PST' },
      });

      if (!pusat) {
        throw {
          status: 500,
          code: 'PUSAT_BRANCH_NOT_FOUND',
          message: 'Cabang Pusat tidak ditemukan',
        };
      }

      const shipmentCode = await this.generateShipmentCode(pusat.id, stockRequest.branchId);

      const shipment = await tx.shipment.create({
        data: {
          shipmentCode,
          stockRequestId: requestId,
          fromBranchId: pusat.id,
          toBranchId: stockRequest.branchId,
          status: 'PREPARING',
          items: {
            create: stockRequest.items.map((item) => ({
              inventoryItemId: item.inventoryItemId,
              sentQty: item.requestedQty,
            })),
          },
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

      return { updatedRequest, shipment };
    });

    await logAudit({
      userId,
      action: AuditAction.VERIFY,
      resource: 'StockRequest',
      resourceId: requestId,
      meta: {
        status: StockRequestStatus.APPROVED,
        shipmentCode: result.shipment.shipmentCode,
      },
    });

    return {
      id: result.updatedRequest.id,
      requestCode: result.updatedRequest.requestCode,
      status: result.updatedRequest.status,
      shipment: {
        id: result.shipment.id,
        shipmentCode: result.shipment.shipmentCode,
        status: result.shipment.status,
        items: result.shipment.items.map((item) => ({
          id: item.id,
          productName: item.inventoryItem.masterProduct.name,
          sentQty: Number(item.sentQty),
          unit: item.inventoryItem.masterProduct.unit,
        })),
      },
      message: 'Request stok berhasil di-approve dan shipment dibuat',
    };
  }

  async rejectRequest(requestId: string, userId: string, reviewNotes: string) {
    // 1. Validate user is SUPER_ADMIN
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== Role.SUPER_ADMIN) {
      throw {
        status: 403,
        code: 'UNAUTHORIZED',
        message: 'Hanya SUPER_ADMIN yang dapat reject request stok',
      };
    }

    // 2. Get stock request
    const stockRequest = await prisma.stockRequest.findUnique({
      where: { id: requestId },
    });

    if (!stockRequest) {
      throw { status: 404, code: 'REQUEST_NOT_FOUND', message: 'Request stok tidak ditemukan' };
    }

    if (stockRequest.status !== StockRequestStatus.PENDING) {
      throw {
        status: 422,
        code: 'INVALID_REQUEST_STATUS',
        message: `Request stok tidak dalam status PENDING (status: ${stockRequest.status})`,
      };
    }

    // 3. Update request status
    const result = await prisma.stockRequest.update({
      where: { id: requestId },
      data: {
        status: StockRequestStatus.REJECTED,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'StockRequest',
      resourceId: requestId,
      meta: {
        status: StockRequestStatus.REJECTED,
      },
    });

    return {
      id: result.id,
      requestCode: result.requestCode,
      status: result.status,
      message: 'Request stok berhasil di-reject',
    };
  }

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
              include: { masterProduct: true },
            },
          },
        },
        branch: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((req) => ({
      id: req.id,
      requestCode: req.requestCode,
      branchId: req.branchId,
      branchName: req.branch.name,
      status: req.status,
      itemCount: req.items.length,
      items: req.items.map((item) => ({
        id: item.id,
        productName: item.inventoryItem.masterProduct.name,
        requestedQty: Number(item.requestedQty),
        unit: item.inventoryItem.masterProduct.unit,
        notes: item.notes,
      })),
      notes: req.notes,
      reviewedBy: req.reviewedBy,
      reviewedAt: req.reviewedAt,
      reviewNotes: req.reviewNotes,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    }));
  }

  async getRequestById(requestId: string) {
    const request = await prisma.stockRequest.findUnique({
      where: { id: requestId },
      include: {
        items: {
          include: {
            inventoryItem: {
              include: { masterProduct: true },
            },
          },
        },
        branch: true,
        shipment: {
          include: {
            items: {
              include: {
                inventoryItem: {
                  include: { masterProduct: true },
                },
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw { status: 404, code: 'REQUEST_NOT_FOUND', message: 'Request stok tidak ditemukan' };
    }

    return {
      id: request.id,
      requestCode: request.requestCode,
      branchId: request.branchId,
      branchName: request.branch.name,
      status: request.status,
      items: request.items.map((item) => ({
        id: item.id,
        productName: item.inventoryItem.masterProduct.name,
        requestedQty: Number(item.requestedQty),
        unit: item.inventoryItem.masterProduct.unit,
        notes: item.notes,
      })),
      notes: request.notes,
      reviewedBy: request.reviewedBy,
      reviewedAt: request.reviewedAt,
      reviewNotes: request.reviewNotes,
      shipment: request.shipment
        ? {
            id: request.shipment.id,
            shipmentCode: request.shipment.shipmentCode,
            status: request.shipment.status,
            items: request.shipment.items.map((item) => ({
              id: item.id,
              productName: item.inventoryItem.masterProduct.name,
              sentQty: Number(item.sentQty),
              unit: item.inventoryItem.masterProduct.unit,
            })),
          }
        : null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private async generateRequestCode(branchId: string): Promise<string> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan' };
    }

    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const branchCode = branch.branchCode;

    // Get count of requests for this branch today
    const count = await prisma.stockRequest.count({
      where: {
        branchId,
        createdAt: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        },
      },
    });

    return `REQ-${branchCode}-${dateStr}-${String(count + 1).padStart(3, '0')}`;
  }

  private async generateShipmentCode(fromBranchId: string, toBranchId: string): Promise<string> {
    const fromBranch = await prisma.branch.findUnique({
      where: { id: fromBranchId },
    });

    const toBranch = await prisma.branch.findUnique({
      where: { id: toBranchId },
    });

    if (!fromBranch || !toBranch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan' };
    }

    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    // Get count of shipments for this route today
    const count = await prisma.shipment.count({
      where: {
        fromBranchId,
        toBranchId,
        createdAt: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        },
      },
    });

    return `SHP-${fromBranch.branchCode}-${toBranch.branchCode}-${dateStr}-${String(count + 1).padStart(3, '0')}`;
  }
}
