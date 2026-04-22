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
  async createInvoice(data: CreateInvoiceInput, userId: string) {
    return this.creationService.createInvoice(data, userId);
  },

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string) {
    return this.retrievalService.getInvoiceById(invoiceId);
  },

  /**
   * Get invoice by package ID
   */
  async getInvoiceByPackageId(packageId: string) {
    return this.retrievalService.getInvoiceByPackageId(packageId);
  },

  /**
   * Get member's invoices
   */
  async getMemberInvoices(memberId: string) {
    return this.retrievalService.getMemberInvoices(memberId);
  },

  /**
   * Update invoice (only DRAFT invoices can be updated)
   */
  async updateInvoice(invoiceId: string, data: UpdateInvoiceInput) {
    const updated = await this.creationService.updateInvoice(invoiceId, data);
    return this.retrievalService.formatInvoice(updated);
  },

  /**
   * Finalize invoice (DRAFT -> PENDING_PAYMENT)
   */
  async finalizeInvoice(invoiceId: string, dueDate?: string) {
    const updated = await this.paymentService.finalizeInvoice(invoiceId, dueDate);
    return this.retrievalService.formatInvoice(updated);
  },

  /**
   * Record payment and mark invoice as PAID
   */
  async recordPayment(invoiceId: string, data: RecordPaymentInput, userId: string) {
    await this.paymentService.recordPayment(invoiceId, data, userId);
    return this.getInvoiceById(invoiceId);
  },

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string, data: CancelInvoiceInput) {
    const updated = await this.cancellationService.cancelInvoice(invoiceId, data);
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
