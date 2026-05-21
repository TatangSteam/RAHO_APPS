// @ts-nocheck
import { StockRequestStatus, Role } from '@prisma/client';
import { StockRequestCreationService, type CreateStockRequestInput } from './services/stock-request-creation.service';
import { StockRequestApprovalService } from './services/stock-request-approval.service';
import { StockRequestRetrievalService } from './services/stock-request-retrieval.service';

/**
 * Main Stock Request Service - Orchestrates stock request operations
 * 
 * Flow:
 * 1. Admin Cabang creates request (PENDING)
 * 2. Admin Manager reviews:
 *    - PREMIER: Approve → Create Shipment (APPROVED)
 *    - PARTNERSHIP: Create Invoice (WAITING_PAYMENT)
 * 3. Partnership flow:
 *    - Admin Cabang uploads payment proof (PAYMENT_UPLOADED)
 *    - Admin Manager confirms payment (PAYMENT_CONFIRMED) → Create Shipment
 * 4. Admin Manager ships (SHIPPED)
 * 5. Admin Cabang receives (COMPLETED or COMPLETED_WITH_ISSUE)
 */
export class StockRequestService {
  private creationService: StockRequestCreationService;
  private approvalService: StockRequestApprovalService;
  private retrievalService: StockRequestRetrievalService;

  constructor() {
    this.creationService = new StockRequestCreationService();
    this.approvalService = new StockRequestApprovalService();
    this.retrievalService = new StockRequestRetrievalService();
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
    }
  ) {
    return await this.approvalService.createPartnershipInvoice(requestId, userId, invoiceData);
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
   * Upload payment proof (Admin Cabang Partnership)
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
