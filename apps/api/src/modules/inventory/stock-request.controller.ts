import { Request, Response, NextFunction } from 'express';
import { StockRequestService, CreateStockRequestInput } from './stock-request.service';
import { sendSuccess, sendError } from '../../utils/response';
import { StockRequestStatus, Role, BranchType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { uploadFile } from '../../config/minio';
import { env } from '../../config/env';
import { v4 as uuidv4 } from 'uuid';

const stockRequestService = new StockRequestService();

export class StockRequestController {
  /**
   * Create stock request (Admin Cabang only)
   * POST /api/v1/inventory/stock-requests
   */
  async createRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { items, notes } = req.body;
      const branchId = req.user?.branchId;
      const userId = req.user?.userId;

      if (!branchId || !userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      const data: CreateStockRequestInput = { items, notes };
      const result = await stockRequestService.createRequest(data, branchId, userId);

      return sendSuccess(res, result, 201);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Approve request for PREMIERE branch
   * POST /api/v1/inventory/stock-requests/:requestId/approve-premiere
   */
  async approvePremiereRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const { reviewNotes } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      const result = await stockRequestService.approvePremiereRequest(requestId, userId, reviewNotes);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Create invoice for PARTNERSHIP branch
   * POST /api/v1/inventory/stock-requests/:requestId/create-invoice
   */
  async createPartnershipInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const { items, notes } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return sendError(res, 400, 'ITEMS_REQUIRED', 'Item invoice harus diisi');
      }

      // Validate each item has required fields
      for (const item of items) {
        if (!item.masterProductId || !item.quantity || !item.pricePerUnit) {
          return sendError(res, 400, 'INVALID_ITEM', 'Setiap item harus memiliki masterProductId, quantity, dan pricePerUnit');
        }
        if (item.quantity <= 0 || item.pricePerUnit < 0) {
          return sendError(res, 400, 'INVALID_VALUES', 'Quantity harus > 0 dan harga tidak boleh negatif');
        }
      }

      const result = await stockRequestService.createPartnershipInvoice(requestId, userId, { items, notes });
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Upload payment proof (Admin Cabang Partnership)
   * POST /api/v1/inventory/stock-requests/:requestId/upload-payment-proof
   */
  async uploadPaymentProof(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      // File should be uploaded via multer middleware
      const file = req.file;
      if (!file) {
        return sendError(res, 400, 'FILE_REQUIRED', 'File bukti pembayaran harus diupload');
      }

      // Generate unique key for the file
      const fileExt = file.originalname.split('.').pop() || 'jpg';
      const uniqueId = uuidv4();
      const key = `uploads/stock-requests/${requestId}/payment-proof-${uniqueId}.${fileExt}`;

      // Upload to MinIO
      const uploadResult = await uploadFile(file.buffer, key, file.mimetype);
      
      // Use API endpoint URL for consistent access
      const apiUrl = `${env.API_PREFIX}/files/${key}`;

      const fileData = {
        url: apiUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      };

      const result = await stockRequestService.uploadPaymentProof(requestId, userId, fileData);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Confirm payment (Admin Manager)
   * POST /api/v1/inventory/stock-requests/:requestId/confirm-payment
   */
  async confirmPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const { verificationNotes } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      const result = await stockRequestService.confirmPayment(requestId, userId, verificationNotes);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Reject payment (Admin Manager)
   * POST /api/v1/inventory/stock-requests/:requestId/reject-payment
   */
  async rejectPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const { rejectionReason } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      if (!rejectionReason) {
        return sendError(res, 400, 'REJECTION_REASON_REQUIRED', 'Alasan penolakan harus diisi');
      }

      const result = await stockRequestService.rejectPayment(requestId, userId, rejectionReason);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Reject stock request
   * POST /api/v1/inventory/stock-requests/:requestId/reject
   */
  async rejectRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const { reviewNotes } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      if (!reviewNotes) {
        return sendError(res, 400, 'REVIEW_NOTES_REQUIRED', 'Catatan penolakan harus diisi');
      }

      const result = await stockRequestService.rejectRequest(requestId, userId, reviewNotes);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Get stock requests
   * GET /api/v1/inventory/stock-requests
   */
  async getRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId, status, statuses, page, limit } = req.query;
      const userId = req.user?.userId;
      const userRole = req.user?.role as Role;
      const userBranchId = req.user?.branchId;

      let result;

      if (userRole === Role.SUPER_ADMIN) {
        // Super Admin can see all requests
        result = await stockRequestService.getRequests({
          branchId: branchId as string,
          status: status as StockRequestStatus,
          statuses: statuses ? (statuses as string).split(',') as StockRequestStatus[] : undefined,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 50,
        });
      } else if (userRole === Role.ADMIN_MANAGER) {
        // Admin Manager sees requests from managed branches
        result = await stockRequestService.getRequestsForManager(userId!, {
          status: status as StockRequestStatus,
          statuses: statuses ? (statuses as string).split(',') as StockRequestStatus[] : undefined,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 50,
        });
      } else if (userRole === Role.ADMIN_CABANG) {
        // Admin Cabang sees only their own branch requests
        result = await stockRequestService.getRequests({
          branchId: userBranchId,
          userId,
          userRole,
          status: status as StockRequestStatus,
          statuses: statuses ? (statuses as string).split(',') as StockRequestStatus[] : undefined,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 50,
        });
      } else {
        return sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', 'Anda tidak memiliki akses ke fitur ini');
      }

      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Get pending review requests (for dashboard)
   * GET /api/v1/inventory/stock-requests/pending-review
   */
  async getPendingReviewRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role as Role;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      if (userRole !== Role.SUPER_ADMIN && userRole !== Role.ADMIN_MANAGER) {
        return sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', 'Hanya Super Admin atau Admin Manager yang dapat melihat request pending');
      }

      const result = await stockRequestService.getPendingReviewRequests(userId, userRole);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Get stock request by ID
   * GET /api/v1/inventory/stock-requests/:requestId
   */
  async getRequestById(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const userId = req.user?.userId;
      const userRole = req.user?.role as Role;
      const userBranchId = req.user?.branchId;

      const result = await stockRequestService.getRequestById(requestId);

      // Validate access
      if (userRole === Role.ADMIN_CABANG && result.branchId !== userBranchId) {
        return sendError(res, 403, 'ACCESS_DENIED', 'Anda tidak memiliki akses ke request ini');
      }

      if (userRole === Role.ADMIN_MANAGER) {
        // Check if manager manages this branch
        const managerBranch = await prisma.managerBranch.findFirst({
          where: {
            userId,
            branchId: result.branchId,
          },
        });

        if (!managerBranch) {
          return sendError(res, 403, 'ACCESS_DENIED', 'Anda tidak memiliki akses ke request ini');
        }
      }

      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Legacy approve endpoint (for backward compatibility)
   * POST /api/v1/inventory/stock-requests/:requestId/approve
   */
  async approveRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const { reviewNotes, invoiceItems } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      // Get request to check branch type
      const request = await prisma.stockRequest.findUnique({
        where: { id: requestId },
        include: { branch: true },
      });

      if (!request) {
        return sendError(res, 404, 'REQUEST_NOT_FOUND', 'Permintaan stok tidak ditemukan');
      }

      // Route to appropriate handler based on branch type
      if (request.branch.type === BranchType.PARTNERSHIP) {
        if (!invoiceItems || !Array.isArray(invoiceItems) || invoiceItems.length === 0) {
          return sendError(res, 400, 'INVOICE_ITEMS_REQUIRED', 'Untuk cabang Partnership, item invoice harus diisi');
        }
        const result = await stockRequestService.createPartnershipInvoice(requestId, userId, { 
          items: invoiceItems, 
          notes: reviewNotes 
        });
        return sendSuccess(res, result);
      } else {
        const result = await stockRequestService.approvePremiereRequest(requestId, userId, reviewNotes);
        return sendSuccess(res, result);
      }
    } catch (err: any) {
      next(err);
    }
  }
}
