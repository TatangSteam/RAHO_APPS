import { Request, Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service';
import { sendSuccess } from '../../utils/response';
import { prisma } from '../../lib/prisma';

const dashboardService = new DashboardService();

export class DashboardController {
  /**
   * GET /api/v1/dashboard/branch
   * Get branch dashboard statistics
   */
  async getBranchDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const userRole = req.user?.role;
      let branchId = req.user?.branchId;
      
      // For ADMIN_MANAGER, allow branchId from query parameter or use first available branch
      if (userRole === 'ADMIN_MANAGER' && !branchId) {
        branchId = req.query.branchId as string;
        
        // If still no branchId, get first available branch for ADMIN_MANAGER
        if (!branchId) {
          const firstBranch = await prisma.branch.findFirst({
            select: { id: true },
            orderBy: { createdAt: 'asc' }
          });
          
          if (firstBranch) {
            branchId = firstBranch.id;
          }
        }
      }
      
      if (!branchId) {
        throw { 
          status: 401, 
          code: 'UNAUTHORIZED', 
          message: userRole === 'ADMIN_MANAGER' 
            ? 'No branches available for ADMIN_MANAGER' 
            : 'Branch information missing' 
        };
      }

      // Parse date range from query params
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const stats = await dashboardService.getBranchDashboard(branchId, startDate, endDate);
      
      return sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}
