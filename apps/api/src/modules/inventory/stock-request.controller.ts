import { Request, Response, NextFunction } from 'express';
import { StockRequestService, CreateStockRequestInput } from './stock-request.service';
import { sendSuccess, sendError } from '../../utils/response';
import { StockRequestStatus } from '@prisma/client';

const stockRequestService = new StockRequestService();

export class StockRequestController {
  async createRequest(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('📦 CREATE STOCK REQUEST CONTROLLER');
      console.log('Request Body:', req.body);
      console.log('User:', req.user);
      
      const { items, notes } = req.body;
      const branchId = req.user?.branchId;
      const userId = req.user?.id;

      console.log('Branch ID:', branchId);
      console.log('User ID:', userId);

      if (!branchId || !userId) {
        console.error('❌ Missing branchId or userId');
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      const data: CreateStockRequestInput = { items, notes };
      console.log('Calling service with data:', data);
      
      const result = await stockRequestService.createRequest(data, branchId, userId);
      console.log('✅ Request created successfully:', result);

      return sendSuccess(res, result, 201);
    } catch (err: any) {
      console.error('❌ Controller error:', err);
      next(err);
    }
  }

  async approveRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const { reviewNotes } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      const result = await stockRequestService.approveRequest(requestId, userId, reviewNotes);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  async rejectRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const { reviewNotes } = req.body;
      const userId = req.user?.id;

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

  async getRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId, status } = req.query;
      const userBranchId = req.user?.branchId;

      // Use query branchId if provided, otherwise use user's branchId
      const targetBranchId = (branchId as string) || userBranchId;

      const result = await stockRequestService.getRequests(
        targetBranchId,
        status as StockRequestStatus
      );

      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  async getRequestById(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const result = await stockRequestService.getRequestById(requestId);

      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }
}
