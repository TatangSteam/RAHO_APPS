// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Role } from '@prisma/client';

export interface CreateStockRequestInput {
  items: Array<{
    inventoryItemId: string;
    requestedQty: number;
    notes?: string;
  }>;
  notes?: string;
}

/**
 * Service for creating stock requests
 */
export class StockRequestCreationService {
  /**
   * Create stock request
   */
  async createRequest(data: CreateStockRequestInput, branchId: string, userId: string) {
    // Validate user role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || ![Role.ADMIN_CABANG, Role.ADMIN_LAYANAN, Role.SUPER_ADMIN].includes(user.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya admin cabang atau super admin yang dapat membuat permintaan stok',
      };
    }

    // Validate branch
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw {
        status: 404,
        code: 'BRANCH_NOT_FOUND',
        message: 'Cabang tidak ditemukan',
      };
    }

    // Validate inventory items
    const inventoryItemIds = data.items.map(item => item.inventoryItemId);
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { id: { in: inventoryItemIds } },
      include: {
        masterProduct: true,
      },
    });

    if (inventoryItems.length !== inventoryItemIds.length) {
      throw {
        status: 404,
        code: 'INVENTORY_ITEM_NOT_FOUND',
        message: 'Beberapa item inventori tidak ditemukan',
      };
    }

    // Generate request code
    const requestCode = await this.generateRequestCode(branchId);

    // Create request with items
    const request = await prisma.stockRequest.create({
      data: {
        requestCode,
        branchId: branchId,
        requestedBy: userId,
        status: 'PENDING',
        notes: data.notes,
        items: {
          create: data.items.map(item => ({
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
      action: AuditAction.CREATE,
      resource: 'StockRequest',
      resourceId: request.id,
      meta: { requestCode, branchId, itemCount: data.items.length },
    });

    return this.formatStockRequest(request);
  }

  /**
   * Generate request code
   */
  private async generateRequestCode(branchId: string): Promise<string> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { branchCode: true },
    });

    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    const prefix = `REQ-${branch?.branchCode}-${year}${month}`;
    
    const lastRequest = await prisma.stockRequest.findFirst({
      where: {
        requestCode: {
          startsWith: prefix,
        },
      },
      orderBy: {
        requestCode: 'desc',
      },
    });

    let sequence = 1;
    if (lastRequest) {
      const lastSeq = parseInt(lastRequest.requestCode.split('-').pop() || '0');
      sequence = lastSeq + 1;
    }

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Format stock request for response
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
}
