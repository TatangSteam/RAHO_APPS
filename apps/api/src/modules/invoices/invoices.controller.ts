import { Request, Response } from 'express';
import { invoiceService } from './invoices.service';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  finalizeInvoiceSchema,
  recordPaymentSchema,
  verifyPaymentSchema,
  rejectPaymentSchema,
  refundPaymentSchema,
  cancelInvoiceSchema,
} from './invoices.schema';
import { sendSuccess, sendCreated, sendError } from '../../utils/response';
import { logger } from '../../lib/logger';
import { createHash } from 'crypto';
import { safeDeleteFile, uploadFile } from '../../config/minio';

// ============================================================
// INVOICE CONTROLLER
// ============================================================

export const invoiceController = {
  /**
   * Get invoices
   * GET /api/v1/invoices
   */
  async getInvoices(req: Request, res: Response) {
    try {
      const invoices = await invoiceService.getInvoices(req.user, {
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        branchId: req.query.branchId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });

      return sendSuccess(res, invoices);
    } catch (error) {
      logger.error('Get invoices error:', error);
      return sendError(res, error.status || 400, error.code || 'GET_INVOICES_ERROR', error.message);
    }
  },

  /**
   * Create a new invoice
   * POST /api/v1/invoices
   */
  async createInvoice(req: Request, res: Response) {
    try {
      const validated = createInvoiceSchema.parse(req.body);
      const userId = req.user.userId;

      const invoice = await invoiceService.createInvoice(validated, req.user);

      logger.info(`Invoice created: ${invoice.invoiceNumber} by user ${userId}`);
      return sendCreated(res, invoice);
    } catch (error) {
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
      const invoice = await invoiceService.getInvoiceById(invoiceId, req.user);

      return sendSuccess(res, invoice);
    } catch (error) {
      logger.error('Get invoice error:', error);
      return sendError(res, 404, 'INVOICE_NOT_FOUND', error.message);
    }
  },

  /**
   * Get payment proof image
   * GET /api/v1/invoices/payment-proof/:paymentId
   */
  async getPaymentProofImage(req: Request, res: Response) {
    try {
      const { paymentId } = req.params;
      const result = await invoiceService.getPaymentProofImage(paymentId, req.user);

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Length', result.contentLength);
      res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
      res.setHeader('ETag', result.etag);

      return result.stream.pipe(res);
    } catch (error) {
      logger.error('Get payment proof image error:', error);
      if (error?.status) {
        return sendError(res, error.status, error.code, error.message);
      }
      return sendError(res, 404, 'PAYMENT_PROOF_NOT_FOUND', error.message);
    }
  },

  /**
   * Get invoice by package ID
   * GET /api/v1/invoices/package/:packageId
   */
  async getInvoiceByPackageId(req: Request, res: Response) {
    try {
      const { packageId } = req.params;
      const invoice = await invoiceService.getInvoiceByPackageId(packageId, req.user);

      return sendSuccess(res, invoice);
    } catch (error) {
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
      const invoices = await invoiceService.getMemberInvoices(memberId, req.user);

      return sendSuccess(res, invoices);
    } catch (error) {
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

      const invoice = await invoiceService.updateInvoice(invoiceId, validated, req.user.userId);

      logger.info(`Invoice updated: ${invoice.invoiceNumber}`);
      return sendSuccess(res, invoice);
    } catch (error) {
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

      const invoice = await invoiceService.finalizeInvoice(invoiceId, validated.dueDate, req.user.userId);

      logger.info(`Invoice finalized: ${invoice.invoiceNumber}`);
      return sendSuccess(res, invoice);
    } catch (error) {
      logger.error('Finalize invoice error:', error);
      return sendError(res, 400, 'FINALIZE_INVOICE_ERROR', error.message);
    }
  },

  /**
   * Record payment
   * POST /api/v1/invoices/:invoiceId/payment
   */
  async recordPayment(req: Request, res: Response) {
    let uploadedKey: string | undefined;
    try {
      const { invoiceId } = req.params;
      const validated = recordPaymentSchema.parse(req.body);
      const userId = req.user.userId;
      const idempotencyKey = req.get('Idempotency-Key');
      if (!idempotencyKey) {
        throw { status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Header Idempotency-Key wajib diisi.' };
      }
      if (idempotencyKey !== validated.postingKey) {
        throw { status: 400, code: 'IDEMPOTENCY_KEY_MISMATCH', message: 'Header Idempotency-Key harus sama dengan postingKey.' };
      }

      const proofChecksum = req.file ? createHash('sha256').update(req.file.buffer).digest('hex') : undefined;
      const keyHash = createHash('sha256').update(JSON.stringify({
        idempotencyKey,
        invoiceId,
        amount: validated.amount,
        paymentMethod: validated.paymentMethod,
        cashBankAccountId: validated.cashBankAccountId,
        paymentReference: validated.paymentReference || null,
        proofChecksum: proofChecksum || null,
      })).digest('hex');
      const extension = req.file?.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
      const evidence = req.file ? {
        proofFileUrl: `uploads/invoice-payments/${invoiceId}/${keyHash}-${proofChecksum}.${extension}`,
        proofFileName: req.file.originalname,
        proofFileSize: req.file.size,
        proofMimeType: req.file.mimetype,
        proofChecksum,
      } : {};
      if (req.file && evidence.proofFileUrl) {
        uploadedKey = evidence.proofFileUrl;
        await uploadFile(req.file.buffer, uploadedKey, req.file.mimetype);
      }

      const result = await invoiceService.recordPayment(invoiceId, validated, evidence, req.user);

      logger.info(`Payment submitted for invoice: ${invoiceId} by ${userId}`);
      return sendSuccess(res, result, result.idempotentReplay ? 200 : 201);
    } catch (error) {
      if (uploadedKey) await safeDeleteFile(uploadedKey);
      logger.error('Record payment error:', error);
      return sendError(res, error.status || 400, error.code || 'RECORD_PAYMENT_ERROR', error.message);
    }
  },

  async verifyPayment(req: Request, res: Response) {
    try {
      const result = await invoiceService.verifyPayment(
        req.params.paymentId,
        verifyPaymentSchema.parse(req.body),
        req.user.userId,
      );
      return sendSuccess(res, result);
    } catch (error) {
      logger.error('Verify payment error:', error);
      return sendError(res, error.status || 400, error.code || 'VERIFY_PAYMENT_ERROR', error.message);
    }
  },

  async rejectPayment(req: Request, res: Response) {
    try {
      const result = await invoiceService.rejectPayment(
        req.params.paymentId,
        rejectPaymentSchema.parse(req.body),
        req.user.userId,
      );
      return sendSuccess(res, result);
    } catch (error) {
      logger.error('Reject payment error:', error);
      return sendError(res, error.status || 400, error.code || 'REJECT_PAYMENT_ERROR', error.message);
    }
  },

  async refundPayment(req: Request, res: Response) {
    try {
      const validated = refundPaymentSchema.parse(req.body);
      const idempotencyKey = req.get('Idempotency-Key');
      if (!idempotencyKey) {
        throw { status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Header Idempotency-Key wajib diisi.' };
      }
      if (idempotencyKey !== validated.postingKey) {
        throw { status: 400, code: 'IDEMPOTENCY_KEY_MISMATCH', message: 'Header Idempotency-Key harus sama dengan postingKey.' };
      }
      const result = await invoiceService.refundPayment(
        req.params.paymentId,
        validated,
        req.user.userId,
      );
      return sendSuccess(res, result, result.idempotentReplay ? 200 : 201);
    } catch (error) {
      logger.error('Refund payment error:', error);
      return sendError(res, error.status || 400, error.code || 'REFUND_PAYMENT_ERROR', error.message);
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

      const invoice = await invoiceService.cancelInvoice(invoiceId, validated, req.user.userId);

      logger.info(`Invoice cancelled: ${invoice.invoiceNumber}`);
      return sendSuccess(res, invoice);
    } catch (error) {
      logger.error('Cancel invoice error:', error);
      return sendError(res, 400, 'CANCEL_INVOICE_ERROR', error.message);
    }
  },
};
