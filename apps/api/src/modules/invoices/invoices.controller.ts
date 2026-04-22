import { Request, Response } from 'express';
import { invoiceService } from './invoices.service';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  finalizeInvoiceSchema,
  recordPaymentSchema,
  cancelInvoiceSchema,
} from './invoices.schema';
import { sendSuccess, sendCreated, sendError } from '../../utils/response';
import { logger } from '../../lib/logger';

// ============================================================
// INVOICE CONTROLLER
// ============================================================

export const invoiceController = {
  /**
   * Create a new invoice
   * POST /api/v1/invoices
   */
  async createInvoice(req: Request, res: Response) {
    try {
      const validated = createInvoiceSchema.parse(req.body);
      const userId = req.user.userId;

      const invoice = await invoiceService.createInvoice(validated, userId);

      logger.info(`Invoice created: ${invoice.invoiceNumber} by user ${userId}`);
      return sendCreated(res, invoice);
    } catch (error: any) {
      logger.error('Create invoice error:', error);
      return sendError(res, 400, 'CREATE_INVOICE_ERROR', error.message);
    }
  },

  /**
   * Get invoice by ID
   * GET /api/v1/invoices/:invoiceId
   */
  async getInvoiceById(req: Request, res: Response) {
    try {
      const { invoiceId } = req.params;
      const invoice = await invoiceService.getInvoiceById(invoiceId);

      return sendSuccess(res, invoice);
    } catch (error: any) {
      logger.error('Get invoice error:', error);
      return sendError(res, 404, 'INVOICE_NOT_FOUND', error.message);
    }
  },

  /**
   * Get invoice by package ID
   * GET /api/v1/invoices/package/:packageId
   */
  async getInvoiceByPackageId(req: Request, res: Response) {
    try {
      const { packageId } = req.params;
      const invoice = await invoiceService.getInvoiceByPackageId(packageId);

      return sendSuccess(res, invoice);
    } catch (error: any) {
      logger.error('Get invoice by package error:', error);
      return sendError(res, 404, 'INVOICE_NOT_FOUND', error.message);
    }
  },

  /**
   * Get member's invoices
   * GET /api/v1/invoices/member/:memberId
   */
  async getMemberInvoices(req: Request, res: Response) {
    try {
      const { memberId } = req.params;
      const invoices = await invoiceService.getMemberInvoices(memberId);

      return sendSuccess(res, invoices);
    } catch (error: any) {
      logger.error('Get member invoices error:', error);
      return sendError(res, 400, 'GET_INVOICES_ERROR', error.message);
    }
  },

  /**
   * Update invoice (DRAFT only)
   * PATCH /api/v1/invoices/:invoiceId
   */
  async updateInvoice(req: Request, res: Response) {
    try {
      const { invoiceId } = req.params;
      const validated = updateInvoiceSchema.parse(req.body);

      const invoice = await invoiceService.updateInvoice(invoiceId, validated);

      logger.info(`Invoice updated: ${invoice.invoiceNumber}`);
      return sendSuccess(res, invoice);
    } catch (error: any) {
      logger.error('Update invoice error:', error);
      return sendError(res, 400, 'UPDATE_INVOICE_ERROR', error.message);
    }
  },

  /**
   * Finalize invoice (DRAFT -> PENDING_PAYMENT)
   * POST /api/v1/invoices/:invoiceId/finalize
   */
  async finalizeInvoice(req: Request, res: Response) {
    try {
      const { invoiceId } = req.params;
      const validated = finalizeInvoiceSchema.parse(req.body);

      const invoice = await invoiceService.finalizeInvoice(invoiceId, validated.dueDate);

      logger.info(`Invoice finalized: ${invoice.invoiceNumber}`);
      return sendSuccess(res, invoice);
    } catch (error: any) {
      logger.error('Finalize invoice error:', error);
      return sendError(res, 400, 'FINALIZE_INVOICE_ERROR', error.message);
    }
  },

  /**
   * Record payment
   * POST /api/v1/invoices/:invoiceId/payment
   */
  async recordPayment(req: Request, res: Response) {
    try {
      const { invoiceId } = req.params;
      const validated = recordPaymentSchema.parse(req.body);
      const userId = req.user.userId;

      const invoice = await invoiceService.recordPayment(invoiceId, validated, userId);

      logger.info(`Payment recorded for invoice: ${invoice.invoiceNumber}`);
      return sendSuccess(res, invoice);
    } catch (error: any) {
      logger.error('Record payment error:', error);
      return sendError(res, 400, 'RECORD_PAYMENT_ERROR', error.message);
    }
  },

  /**
   * Cancel invoice
   * POST /api/v1/invoices/:invoiceId/cancel
   */
  async cancelInvoice(req: Request, res: Response) {
    try {
      const { invoiceId } = req.params;
      const validated = cancelInvoiceSchema.parse(req.body);

      const invoice = await invoiceService.cancelInvoice(invoiceId, validated);

      logger.info(`Invoice cancelled: ${invoice.invoiceNumber}`);
      return sendSuccess(res, invoice);
    } catch (error: any) {
      logger.error('Cancel invoice error:', error);
      return sendError(res, 400, 'CANCEL_INVOICE_ERROR', error.message);
    }
  },
};
