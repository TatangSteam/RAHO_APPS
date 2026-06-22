// @ts-nocheck
import { StockRequestStatus, Role, AuditAction } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logAudit } from '../../utils/auditLog';
import { StockRequestCreationService, type CreateStockRequestInput } from './services/stock-request-creation.service';
import { StockRequestApprovalService } from './services/stock-request-approval.service';
import { StockRequestRetrievalService } from './services/stock-request-retrieval.service';
import { OverstockService } from './services/overstock.service';

/**
 * Main Stock Request Service - Orchestrates stock request operations
 * 
 * Flow:
 * 1. Admin Cabang creates request (PENDING)
 * 2. Admin Manager reviews:
 *    - PREMIER & PARTNERSHIP: Create Invoice (WAITING_PAYMENT)
 * 3. Payment flow:
 *    - Admin Manager uploads payment proof (PAYMENT_UPLOADED)
 *    - Admin Manager confirms payment (PAYMENT_CONFIRMED) → Create Shipment
 * 4. Admin Manager ships (SHIPPED)
 * 5. Admin Cabang receives (COMPLETED if matched, manager review if issue)
 */
export class StockRequestService {
  private creationService: StockRequestCreationService;
  private approvalService: StockRequestApprovalService;
  private retrievalService: StockRequestRetrievalService;
  private overstockService: OverstockService;

  constructor() {
    this.creationService = new StockRequestCreationService();
    this.approvalService = new StockRequestApprovalService();
    this.retrievalService = new StockRequestRetrievalService();
    this.overstockService = new OverstockService();
  }

  // ============================================================
  // CREATION
  // ============================================================

  /**
   * Create stock request (Admin Cabang only)
   */
  async createRequest(data: CreateStockRequestInput, branchId: string, userId: string) {
    return await this.creationService.createRequest(data, branchId, userId);
  }

  /**
   * Update a pending stock request (Admin Manager / Super Admin).
   */
  async updateRequest(
    requestId: string,
    userId: string,
    data: {
      notes?: string;
      items?: Array<{
        masterProductId: string;
        requestedQty: number;
        notes?: string;
      }>;
    }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || ![Role.SUPER_ADMIN, Role.ADMIN_MANAGER].includes(user.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Super Admin atau Admin Manager yang dapat mengedit request stok',
      };
    }

    const request = await prisma.stockRequest.findUnique({
      where: { id: requestId },
      include: {
        branch: true,
        items: true,
        invoice: true,
        shipment: true,
      },
    });

    if (!request) {
      throw {
        status: 404,
        code: 'REQUEST_NOT_FOUND',
        message: 'Permintaan stok tidak ditemukan',
      };
    }

    if (request.status !== StockRequestStatus.PENDING) {
      throw {
        status: 422,
        code: 'REQUEST_NOT_EDITABLE',
        message: 'Request stok hanya dapat diedit saat status masih PENDING',
      };
    }

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
          message: 'Anda hanya dapat mengedit request dari cabang yang Anda kelola',
        };
      }
    }

    const itemUpdates = Array.isArray(data.items) ? data.items : undefined;
    if (itemUpdates) {
      if (itemUpdates.length === 0) {
        throw {
          status: 400,
          code: 'ITEMS_REQUIRED',
          message: 'Minimal satu item harus dikirim untuk update',
        };
      }

      const existingProductIds = new Set(request.items.map(item => item.masterProductId));
      const seenProductIds = new Set<string>();

      for (const item of itemUpdates) {
        if (!item.masterProductId || !existingProductIds.has(item.masterProductId)) {
          throw {
            status: 400,
            code: 'INVALID_ITEM',
            message: 'Item yang diedit harus berasal dari request stok ini',
          };
        }

        if (seenProductIds.has(item.masterProductId)) {
          throw {
            status: 400,
            code: 'DUPLICATE_ITEM',
            message: 'Item request tidak boleh duplikat',
          };
        }

        if (!item.requestedQty || Number(item.requestedQty) <= 0) {
          throw {
            status: 400,
            code: 'INVALID_QUANTITY',
            message: 'Jumlah request harus lebih dari 0',
          };
        }

        seenProductIds.add(item.masterProductId);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockRequest.update({
        where: { id: requestId },
        data: {
          ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        },
      });

      if (!itemUpdates) {
        return;
      }

      const usages = await tx.overstockUsage.findMany({
        where: { stockRequestId: requestId },
        include: { overstock: true },
      });

      for (const usage of usages) {
        const restoredQty = Math.min(
          Number(usage.overstock.originalQty),
          Number(usage.overstock.quantity) + Number(usage.quantityUsed)
        );
        const status = restoredQty <= 0
          ? 'FULLY_USED'
          : restoredQty >= Number(usage.overstock.originalQty)
            ? 'AVAILABLE'
            : 'PARTIALLY_USED';

        await tx.branchOverstock.update({
          where: { id: usage.overstockId },
          data: {
            quantity: restoredQty,
            status,
          },
        });
      }

      await tx.overstockUsage.deleteMany({
        where: { stockRequestId: requestId },
      });

      await tx.stockRequestItem.updateMany({
        where: { stockRequestId: requestId },
        data: {
          approvedQty: null,
          overstockDeducted: 0,
          finalQty: null,
        },
      });

      for (const item of itemUpdates) {
        const existingItem = request.items.find(i => i.masterProductId === item.masterProductId);
        await tx.stockRequestItem.update({
          where: { id: existingItem.id },
          data: {
            requestedQty: item.requestedQty,
            approvedQty: null,
            overstockDeducted: 0,
            finalQty: item.requestedQty,
            notes: item.notes?.trim() || null,
          },
        });
      }

      const currentItems = await tx.stockRequestItem.findMany({
        where: { stockRequestId: requestId },
      });

      for (const item of currentItems) {
        await this.overstockService.applyOverstockDeduction(
          request.branchId,
          item.masterProductId,
          Number(item.requestedQty),
          requestId,
          item.id,
          userId,
          tx
        );
      }
    });

    await logAudit({
      userId,
      branchId: request.branchId,
      action: AuditAction.UPDATE,
      resource: 'StockRequest',
      resourceId: requestId,
      meta: {
        action: 'UPDATE_PENDING_REQUEST',
        requestCode: request.requestCode,
        itemCount: itemUpdates?.length,
      },
    });

    return await this.retrievalService.getRequestById(requestId);
  }

  // ============================================================
  // APPROVAL (Admin Manager / Super Admin)
  // ============================================================

  /**
   * Approve request for PREMIER branch (no payment required)
   */
  async approvePremierRequest(requestId: string, userId: string, reviewNotes?: string) {
    return await this.approvalService.approvePremierRequest(requestId, userId, reviewNotes);
  }

  /**
   * Create invoice for stock request (unified flow for both Premier and Partnership)
   */
  async createInvoice(
    requestId: string, 
    userId: string, 
    invoiceData: {
      items: Array<{
        masterProductId: string;
        quantity: number;
        pricePerUnit: number;
      }>;
      notes?: string;
      paymentMode?: 'NORMAL' | 'DEBT';
    }
  ) {
    return await this.approvalService.createInvoice(requestId, userId, invoiceData);
  }

  /**
   * @deprecated Use createInvoice instead. Kept for backward compatibility.
   * Create invoice for PARTNERSHIP branch
   */
  async createPartnershipInvoice(
    requestId: string, 
    userId: string, 
    invoiceData: {
      items: Array<{
        masterProductId: string;
        quantity: number;
        pricePerUnit: number;
      }>;
      notes?: string;
      paymentMode?: 'NORMAL' | 'DEBT';
    }
  ) {
    return await this.approvalService.createPartnershipInvoice(requestId, userId, invoiceData);
  }

  /**
   * Mark invoice payment as debt and continue stock request flow
   */
  async markPaymentAsDebt(requestId: string, userId: string, notes?: string) {
    return await this.approvalService.markPaymentAsDebt(requestId, userId, notes);
  }

  /**
   * Reject stock request
   */
  async rejectRequest(requestId: string, userId: string, reviewNotes: string) {
    return await this.approvalService.rejectRequest(requestId, userId, reviewNotes);
  }

  // ============================================================
  // PAYMENT (Partnership flow)
  // ============================================================

  /**
   * Upload payment proof (Admin Manager / Super Admin)
   */
  async uploadPaymentProof(
    requestId: string, 
    userId: string, 
    fileData: {
      url: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
    }
  ) {
    return await this.approvalService.uploadPaymentProof(requestId, userId, fileData);
  }

  /**
   * Confirm payment (Admin Manager)
   */
  async confirmPayment(requestId: string, userId: string, verificationNotes?: string) {
    return await this.approvalService.confirmPayment(requestId, userId, verificationNotes);
  }

  /**
   * Reject payment (Admin Manager)
   */
  async rejectPayment(requestId: string, userId: string, rejectionReason: string) {
    return await this.approvalService.rejectPayment(requestId, userId, rejectionReason);
  }

  // ============================================================
  // RETRIEVAL
  // ============================================================

  /**
   * Get stock requests with filtering
   */
  async getRequests(options: {
    branchId?: string;
    branchIds?: string[];
    status?: StockRequestStatus;
    statuses?: StockRequestStatus[];
    userId?: string;
    userRole?: Role;
    page?: number;
    limit?: number;
  } = {}) {
    return await this.retrievalService.getRequests(options);
  }

  /**
   * Get requests for Admin Manager (only from managed branches)
   */
  async getRequestsForManager(userId: string, options: {
    status?: StockRequestStatus;
    statuses?: StockRequestStatus[];
    page?: number;
    limit?: number;
  } = {}) {
    return await this.retrievalService.getRequestsForManager(userId, options);
  }

  /**
   * Get pending review requests (for dashboard)
   */
  async getPendingReviewRequests(userId: string, userRole: Role) {
    return await this.retrievalService.getPendingReviewRequests(userId, userRole);
  }

  /**
   * Get stock request by ID
   */
  async getRequestById(requestId: string) {
    return await this.retrievalService.getRequestById(requestId);
  }

  /**
   * Get requests by status for a branch
   */
  async getRequestsByStatus(branchId: string, statuses: StockRequestStatus[]) {
    return await this.retrievalService.getRequestsByStatus(branchId, statuses);
  }

  // ============================================================
  // LEGACY METHODS (for backward compatibility)
  // ============================================================

  /**
   * @deprecated Use approvePremierRequest or createPartnershipInvoice instead
   */
  async approveRequest(requestId: string, userId: string, reviewNotes?: string) {
    // This will be handled by the approval service based on branch type
    return await this.approvalService.approvePremierRequest(requestId, userId, reviewNotes);
  }
}

// Export type for use in other modules
export type { CreateStockRequestInput };
