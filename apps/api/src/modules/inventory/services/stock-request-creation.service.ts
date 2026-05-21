// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Role, BranchType } from '@prisma/client';

export interface CreateStockRequestInput {
  items: Array<{
    masterProductId: string;
    requestedQty: number;
    notes?: string;
  }>;
  notes?: string;
}

/**
 * Service for creating stock requests
 * 
 * Flow:
 * 1. Admin Cabang creates request with master products
 * 2. Request status starts as PENDING
 * 3. Admin Manager reviews and approves/rejects
 * 4. For Partnership branches: Invoice is created, payment required
 * 5. For Premiere branches: Direct approval and shipment
 */
export class StockRequestCreationService {
  /**
   * Create stock request
   */
  async createRequest(data: CreateStockRequestInput, branchId: string, userId: string) {
    // Validate user role - only ADMIN_CABANG can create requests
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, branchId: true },
    });

    if (!user || user.role !== Role.ADMIN_CABANG) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Admin Cabang yang dapat membuat permintaan stok',
      };
    }

    // Verify user belongs to the branch
    if (user.branchId !== branchId) {
      throw {
        status: 403,
        code: 'BRANCH_MISMATCH',
        message: 'Anda hanya dapat membuat permintaan untuk cabang Anda sendiri',
      };
    }

    // Validate branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, branchCode: true, name: true, type: true },
    });

    if (!branch) {
      throw {
        status: 404,
        code: 'BRANCH_NOT_FOUND',
        message: 'Cabang tidak ditemukan',
      };
    }

    // Validate items
    if (!data.items || data.items.length === 0) {
      throw {
        status: 400,
        code: 'ITEMS_REQUIRED',
        message: 'Minimal satu item harus dipilih',
      };
    }

    // Validate notes is required
    if (!data.notes || data.notes.trim() === '') {
      throw {
        status: 400,
        code: 'NOTES_REQUIRED',
        message: 'Keterangan request wajib diisi',
      };
    }

    // Validate master products exist
    const masterProductIds = data.items.map(item => item.masterProductId);
    const masterProducts = await prisma.masterProduct.findMany({
      where: { 
        id: { in: masterProductIds },
        isActive: true,
      },
    });

    if (masterProducts.length !== masterProductIds.length) {
      throw {
        status: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'Beberapa produk tidak ditemukan atau tidak aktif',
      };
    }

    // Validate quantities
    for (const item of data.items) {
      if (!item.requestedQty || item.requestedQty <= 0) {
        throw {
          status: 400,
          code: 'INVALID_QUANTITY',
          message: 'Jumlah yang diminta harus lebih dari 0',
        };
      }
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
            masterProductId: item.masterProductId,
            requestedQty: item.requestedQty,
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
        branch: true,
      },
    });

    // Audit log
    await logAudit({
      userId,
      branchId,
      action: AuditAction.CREATE,
      resource: 'StockRequest',
      resourceId: request.id,
      meta: { 
        requestCode, 
        branchId, 
        branchType: branch.type,
        itemCount: data.items.length,
        items: data.items.map(i => ({
          masterProductId: i.masterProductId,
          requestedQty: i.requestedQty,
        })),
      },
    });

    return this.formatStockRequest(request);
  }

  /**
   * Generate request code
   * Format: REQ-[BRANCH_CODE]-[YYMM]-[SEQUENCE]
   */
  private async generateRequestCode(branchId: string): Promise<string> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { branchCode: true },
    });

    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const prefix = `REQ-${branch?.branchCode}-${year}${month}${day}`;
    
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

    return `${prefix}-${sequence.toString().padStart(3, '0')}`;
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
      branchType: request.branch.type,
      status: request.status,
      notes: request.notes,
      itemCount: request.items.length,
      items: request.items.map((item: any) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.masterProduct.name,
        productCategory: item.masterProduct.category,
        requestedQty: Number(item.requestedQty),
        approvedQty: item.approvedQty ? Number(item.approvedQty) : null,
        unit: item.masterProduct.baseUnit,
        notes: item.notes,
      })),
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }
}
