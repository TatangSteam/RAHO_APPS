// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Role } from '@prisma/client';

export interface CreateStockRequestInput {
  items: Array<{
    masterProductId: string;
    requestedQuantity: number;
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

    // Validate products
    const productIds = data.items.map(item => item.masterProductId);
    const products = await prisma.masterProduct.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      throw {
        status: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'Beberapa produk tidak ditemukan',
      };
    }

    // Generate request code
    const requestCode = await this.generateRequestCode(branchId);

    // Create request with items
    const request = await prisma.stockRequest.create({
      data: {
        requestCode,
        requestingBranchId: branchId,
        requestedBy: userId,
        status: 'PENDING',
        notes: data.notes,
        items: {
          create: data.items.map(item => ({
            masterProductId: item.masterProductId,
            requestedQuantity: item.requestedQuantity,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        requestingBranch: true,
        requestedByUser: {
          include: {
            profile: true,
          },
        },
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
      requestingBranchId: request.requestingBranchId,
      requestingBranchName: request.requestingBranch.name,
      status: request.status,
      notes: request.notes,
      requestedBy: request.requestedByUser.profile?.fullName || request.requestedByUser.email,
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
}
