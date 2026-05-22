// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Role, BranchType } from '@prisma/client';
import { OverstockService } from './overstock.service';

export interface CreateStockRequestInput {
  items: Array<{
    masterProductId: string;
    requestedQty: number;
    notes?: string;
  }>;
  notes?: string;
}

const overstockService = new OverstockService();

/**
 * Service for creating stock requests
 * 
 * Flow:
 * 1. Admin Cabang creates request with master products
 * 2. System auto-deducts available overstock (FIFO)
 * 3. Request status starts as PENDING
 * 4. Admin Manager reviews and approves/rejects
 * 5. For Partnership branches: Invoice is created, payment required
 * 6. For Premier branches: Direct approval and shipment
 */
export class StockRequestCreationService {
  /**
   * Create stock request with automatic overstock deduction
   */
  async createRequest(data: CreateStockRequestInput, branchId: string, userId: string) {
    console.log('=== STOCK REQUEST CREATION SERVICE ===');
    console.log('Input data:', JSON.stringify(data, null, 2));
    console.log('Branch ID:', branchId);
    console.log('User ID:', userId);

    // Validate user role - only ADMIN_CABANG can create requests
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, branchId: true },
    });

    console.log('User from DB:', user);

    if (!user || user.role !== Role.ADMIN_CABANG) {
      console.log('ERROR: User role is not ADMIN_CABANG');
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Admin Cabang yang dapat membuat permintaan stok',
      };
    }

    // Verify user belongs to the branch
    if (user.branchId !== branchId) {
      console.log('ERROR: Branch mismatch - user.branchId:', user.branchId, 'branchId:', branchId);
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
      console.log('ERROR: Branch not found');
      throw {
        status: 404,
        code: 'BRANCH_NOT_FOUND',
        message: 'Cabang tidak ditemukan',
      };
    }

    console.log('Branch:', branch);

    // Check for pending shipments (PREPARING or SHIPPED status)
    const pendingShipments = await prisma.shipment.findMany({
      where: {
        toBranchId: branchId,
        status: { in: ['PREPARING', 'SHIPPED'] },
      },
      select: {
        id: true,
        shipmentCode: true,
        status: true,
        stockRequest: {
          select: {
            requestCode: true,
          },
        },
      },
    });

    if (pendingShipments.length > 0) {
      const shipmentCodes = pendingShipments.map(s => s.shipmentCode).join(', ');
      console.log('ERROR: Pending shipments found:', shipmentCodes);
      throw {
        status: 422,
        code: 'PENDING_SHIPMENT_EXISTS',
        message: `Tidak dapat membuat request baru. Masih ada pengiriman yang belum selesai: ${shipmentCodes}. Harap terima pengiriman terlebih dahulu.`,
      };
    }

    // Also check for pending stock requests (not yet completed)
    const pendingRequests = await prisma.stockRequest.findMany({
      where: {
        branchId,
        status: { in: ['PENDING', 'WAITING_PAYMENT', 'PAYMENT_UPLOADED', 'APPROVED', 'SHIPPED'] },
      },
      select: {
        id: true,
        requestCode: true,
        status: true,
      },
    });

    if (pendingRequests.length > 0) {
      const requestCodes = pendingRequests.map(r => r.requestCode).join(', ');
      console.log('ERROR: Pending requests found:', requestCodes);
      throw {
        status: 422,
        code: 'PENDING_REQUEST_EXISTS',
        message: `Tidak dapat membuat request baru. Masih ada request yang belum selesai: ${requestCodes}. Harap selesaikan request sebelumnya terlebih dahulu.`,
      };
    }

    // Validate items
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      console.log('ERROR: Items required - items:', data.items);
      throw {
        status: 400,
        code: 'ITEMS_REQUIRED',
        message: 'Minimal satu item harus dipilih',
      };
    }

    // Validate notes is required
    if (!data.notes || typeof data.notes !== 'string' || data.notes.trim() === '') {
      console.log('ERROR: Notes required - notes:', data.notes);
      throw {
        status: 400,
        code: 'NOTES_REQUIRED',
        message: 'Keterangan request wajib diisi',
      };
    }

    // Validate master products exist
    const masterProductIds = data.items.map(item => item.masterProductId);
    console.log('Master product IDs:', masterProductIds);
    
    const masterProducts = await prisma.masterProduct.findMany({
      where: { 
        id: { in: masterProductIds },
        isActive: true,
      },
    });

    console.log('Found master products:', masterProducts.length, 'of', masterProductIds.length);

    if (masterProducts.length !== masterProductIds.length) {
      const foundIds = masterProducts.map(p => p.id);
      const missingIds = masterProductIds.filter(id => !foundIds.includes(id));
      console.log('ERROR: Missing products:', missingIds);
      throw {
        status: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: `Beberapa produk tidak ditemukan atau tidak aktif: ${missingIds.join(', ')}`,
      };
    }

    // Validate quantities
    for (const item of data.items) {
      if (!item.requestedQty || item.requestedQty <= 0) {
        console.log('ERROR: Invalid quantity for item:', item);
        throw {
          status: 400,
          code: 'INVALID_QUANTITY',
          message: 'Jumlah yang diminta harus lebih dari 0',
        };
      }
    }

    console.log('All validations passed, proceeding with creation...');

    // Get overstock info for all items
    const overstockInfo = await overstockService.getOverstockInfoForRequest(branchId, data.items);

    // Generate request code
    const requestCode = await this.generateRequestCode(branchId);

    // Create request with items (including overstock deduction info)
    const request = await prisma.$transaction(async (tx) => {
      // Create the stock request
      const newRequest = await tx.stockRequest.create({
        data: {
          requestCode,
          branchId: branchId,
          requestedBy: userId,
          status: 'PENDING',
          notes: data.notes,
          items: {
            create: data.items.map(item => {
              const itemOverstock = overstockInfo.find(o => o.masterProductId === item.masterProductId);
              return {
                masterProductId: item.masterProductId,
                requestedQty: item.requestedQty,
                overstockDeducted: itemOverstock?.deductedQty || 0,
                finalQty: itemOverstock?.finalQty || item.requestedQty,
                notes: item.notes,
              };
            }),
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

      // Apply overstock deductions for items that have available overstock
      for (const item of newRequest.items) {
        const itemOverstock = overstockInfo.find(o => o.masterProductId === item.masterProductId);
        if (itemOverstock && itemOverstock.deductedQty > 0) {
          await overstockService.applyOverstockDeduction(
            branchId,
            item.masterProductId,
            Number(item.requestedQty),
            newRequest.id,
            item.id,
            userId,
            tx  // Pass the transaction context
          );
        }
      }

      // Refetch to get updated data
      return await tx.stockRequest.findUnique({
        where: { id: newRequest.id },
        include: {
          items: {
            include: {
              masterProduct: true,
              overstockUsages: {
                include: {
                  overstock: {
                    include: {
                      sourceShipment: {
                        select: {
                          shipmentCode: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          branch: true,
        },
      });
    });

    // Audit log
    const totalDeducted = overstockInfo.reduce((sum, o) => sum + o.deductedQty, 0);
    await logAudit({
      userId,
      branchId,
      action: AuditAction.CREATE,
      resource: 'StockRequest',
      resourceId: request!.id,
      meta: { 
        requestCode, 
        branchId, 
        branchType: branch.type,
        itemCount: data.items.length,
        items: data.items.map(i => ({
          masterProductId: i.masterProductId,
          requestedQty: i.requestedQty,
        })),
        overstockDeducted: totalDeducted > 0,
        totalOverstockDeducted: totalDeducted,
      },
    });

    return this.formatStockRequest(request!);
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
        overstockDeducted: item.overstockDeducted ? Number(item.overstockDeducted) : 0,
        finalQty: item.finalQty ? Number(item.finalQty) : Number(item.requestedQty),
        unit: item.masterProduct.baseUnit,
        notes: item.notes,
        overstockUsages: item.overstockUsages?.map((u: any) => ({
          id: u.id,
          quantityUsed: Number(u.quantityUsed),
          reason: u.overstock?.reason,
          sourceShipmentCode: u.overstock?.sourceShipment?.shipmentCode,
        })) || [],
      })),
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }
}
