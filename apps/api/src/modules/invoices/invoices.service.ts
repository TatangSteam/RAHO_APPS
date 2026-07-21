// @ts-nocheck
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  RecordPaymentInput,
  CancelInvoiceInput,
} from './invoices.schema';
import { InvoiceCreationService } from './services/invoice-creation.service';
import { InvoiceRetrievalService } from './services/invoice-retrieval.service';
import { InvoicePaymentService } from './services/invoice-payment.service';
import { InvoiceCancellationService } from './services/invoice-cancellation.service';

// ============================================================
// INVOICE SERVICE - MAIN ORCHESTRATOR
// ============================================================

/**
 * Main invoice service that orchestrates specialized services
 * 
 * This service delegates operations to specialized services:
 * - InvoiceCreationService: Create and update invoices
 * - InvoiceRetrievalService: Get and format invoices
 * - InvoicePaymentService: Process payments
 * - InvoiceCancellationService: Cancel invoices
 */
export const invoiceService = {
  // Initialize specialized services
  creationService: new InvoiceCreationService(),
  retrievalService: new InvoiceRetrievalService(),
  paymentService: new InvoicePaymentService(),
  cancellationService: new InvoiceCancellationService(),

  /**
   * Create a new invoice (DRAFT status)
   */
  async createInvoice(data: CreateInvoiceInput, user: { userId: string; role: string; branchId: string | null }) {
    return this.creationService.createInvoice(data, user);
  },

  /**
   * Get invoices
   */
  async getInvoices(
    user: { userId: string; role: string; branchId: string | null },
    options: { search?: string; status?: string; page?: number; limit?: number } = {}
  ) {
    return this.retrievalService.getInvoices(user, options);
  },

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string, user: { userId: string; role: string; branchId: string | null }) {
    return this.retrievalService.getInvoiceById(invoiceId, user);
  },

  /**
   * Get payment proof image
   */
  async getPaymentProofImage(paymentId: string, user: { userId: string; role: string; branchId: string | null }) {
    return this.retrievalService.getPaymentProofImage(paymentId, user);
  },

  /**
   * Get invoice by package ID
   */
  async getInvoiceByPackageId(packageId: string, user: { userId: string; role: string; branchId: string | null }) {
    return this.retrievalService.getInvoiceByPackageId(packageId, user);
  },

  /**
   * Get member's invoices
   */
  async getMemberInvoices(memberId: string, user: { userId: string; role: string; branchId: string | null }) {
    return this.retrievalService.getMemberInvoices(memberId, user);
  },

  /**
   * Update invoice (only DRAFT invoices can be updated)
   */
  async updateInvoice(invoiceId: string, data: UpdateInvoiceInput, userId: string) {
    const updated = await this.creationService.updateInvoice(invoiceId, data, userId);
    return this.retrievalService.formatInvoice(updated);
  },

  /**
   * Finalize invoice (DRAFT -> PENDING_PAYMENT)
   */
  async finalizeInvoice(invoiceId: string, dueDate: string | undefined, userId: string) {
    const updated = await this.paymentService.finalizeInvoice(invoiceId, dueDate, userId);
    return this.retrievalService.formatInvoice(updated);
  },

  /**
   * Record payment and mark invoice as PAID
   */
  async recordPayment(invoiceId: string, data: RecordPaymentInput, user: { userId: string; role: string; branchId: string | null }) {
    await this.paymentService.assertInvoiceBranch(invoiceId, user.userId);
    await this.paymentService.recordPayment(invoiceId, data, user.userId);
    return this.getInvoiceById(invoiceId, user);
  },

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string, data: CancelInvoiceInput, userId: string) {
    const updated = await this.cancellationService.cancelInvoice(invoiceId, data, userId);
    return this.retrievalService.formatInvoice(updated);
  },

  /**
   * Format invoice for API response
   * (Exposed for backward compatibility)
   */
  formatInvoice(invoice: any) {
    return this.retrievalService.formatInvoice(invoice);
  },
};
