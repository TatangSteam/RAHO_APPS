import { Request, Response, NextFunction } from 'express';
import { OverstockService } from './services/overstock.service';
import { sendSuccess, sendError } from '../../utils/response';
import { OverstockStatus, Role } from '@prisma/client';

const overstockService = new OverstockService();

/**
 * Controller for overstock management
 */
export class OverstockController {
  /**
   * Get overstock for current user's branch
   * GET /inventory/overstock
   */
  async getOverstock(req: Request, res: Response, next: NextFunction) {
    try {
      const userRole = req.user?.role as Role;
      const userBranchId = req.user?.branchId;

      // For Admin Cabang, only show their branch's overstock
      if (userRole === Role.ADMIN_CABANG) {
        if (!userBranchId) {
          return sendError(res, 400, 'NO_BRANCH', 'User tidak memiliki cabang');
        }

        const overstocks = await overstockService.getOverstockByBranch(userBranchId, {
          masterProductId: req.query.masterProductId as string,
          status: req.query.status as OverstockStatus | undefined,
        });

        return sendSuccess(res, overstocks);
      }

      // For Admin Manager, show overstock from managed branches
      if (userRole === Role.ADMIN_MANAGER || userRole === Role.SUPER_ADMIN) {
        const branchId = req.query.branchId as string;
        
        if (!branchId) {
          return sendError(res, 400, 'BRANCH_REQUIRED', 'Parameter branchId diperlukan');
        }

        const overstocks = await overstockService.getOverstockByBranch(branchId, {
          masterProductId: req.query.masterProductId as string,
          status: req.query.status as OverstockStatus | undefined,
        });

        return sendSuccess(res, overstocks);
      }

      return sendError(res, 403, 'FORBIDDEN', 'Akses ditolak');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get overstock summary for a branch
   * GET /inventory/overstock/summary
   */
  async getOverstockSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userRole = req.user?.role as Role;
      const userBranchId = req.user?.branchId;

      let branchId: string;

      if (userRole === Role.ADMIN_CABANG) {
        if (!userBranchId) {
          return sendError(res, 400, 'NO_BRANCH', 'User tidak memiliki cabang');
        }
        branchId = userBranchId;
      } else if (userRole === Role.ADMIN_MANAGER || userRole === Role.SUPER_ADMIN) {
        branchId = req.query.branchId as string;
        if (!branchId) {
          return sendError(res, 400, 'BRANCH_REQUIRED', 'Parameter branchId diperlukan');
        }
      } else {
        return sendError(res, 403, 'FORBIDDEN', 'Akses ditolak');
      }

      const summary = await overstockService.getOverstockSummary(branchId);
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get overstock info for stock request items (preview before creating request)
   * POST /inventory/overstock/preview
   * Body: { branchId, items: [{ masterProductId, requestedQty }] }
   */
  async previewOverstockDeduction(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId, items } = req.body;

      if (!branchId) {
        return sendError(res, 400, 'BRANCH_REQUIRED', 'branchId diperlukan');
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return sendError(res, 400, 'ITEMS_REQUIRED', 'items diperlukan');
      }

      const preview = await overstockService.getOverstockInfoForRequest(branchId, items);
      return sendSuccess(res, preview);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available overstock quantity for a specific product
   * GET /inventory/overstock/available/:branchId/:masterProductId
   */
  async getAvailableOverstock(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId, masterProductId } = req.params;

      const quantity = await overstockService.getAvailableOverstockQty(branchId, masterProductId);
      
      return sendSuccess(res, { 
        branchId, 
        masterProductId, 
        availableQuantity: quantity 
      });
    } catch (error) {
      next(error);
    }
  }
}
