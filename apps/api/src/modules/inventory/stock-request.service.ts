// @ts-nocheck
import { StockRequestStatus } from '@prisma/client';
import { StockRequestCreationService, type CreateStockRequestInput } from './services/stock-request-creation.service';
import { StockRequestApprovalService } from './services/stock-request-approval.service';
import { StockRequestRetrievalService } from './services/stock-request-retrieval.service';

/**
 * Main Stock Request Service - Orchestrates stock request operations
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

  /**
   * Create stock request
   */
  async createRequest(data: CreateStockRequestInput, branchId: string, userId: string) {
    return await this.creationService.createRequest(data, branchId, userId);
  }

  /**
   * Approve stock request
   */
  async approveRequest(requestId: string, userId: string, reviewNotes?: string) {
    return await this.approvalService.approveRequest(requestId, userId, reviewNotes);
  }

  /**
   * Reject stock request
   */
  async rejectRequest(requestId: string, userId: string, reviewNotes: string) {
    return await this.approvalService.rejectRequest(requestId, userId, reviewNotes);
  }

  /**
   * Get stock requests
   */
  async getRequests(branchId?: string, status?: StockRequestStatus) {
    return await this.retrievalService.getRequests(branchId, status);
  }

  /**
   * Get stock request by ID
   */
  async getRequestById(requestId: string) {
    return await this.retrievalService.getRequestById(requestId);
  }
}

// Export type for use in other modules
export type { CreateStockRequestInput };
