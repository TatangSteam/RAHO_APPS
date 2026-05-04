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
      
      console.log('📊 DASHBOARD CONTROLLER');
      console.log('User Role:', userRole);
      console.log('User Branch ID:', branchId);
      console.log('Query Branch ID:', req.query.branchId);
      
      // For SUPER_ADMIN and ADMIN_MANAGER, allow branchId from query parameter or use first available branch
      if ((userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_MANAGER') && !branchId) {
        branchId = req.query.branchId as string;
        console.log('After query param check, branchId:', branchId);
        
        // If still no branchId, get first available branch
        if (!branchId) {
          console.log('Fetching first available branch...');
          const firstBranch = await prisma.branch.findFirst({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { createdAt: 'asc' }
          });
          
          console.log('First branch found:', firstBranch);
          
          if (firstBranch) {
            branchId = firstBranch.id;
          }
        }
      }
      
      console.log('Final branchId:', branchId);
      
      if (!branchId) {
        console.error('❌ No branchId available');
        throw { 
          status: 400, 
          code: 'BRANCH_REQUIRED', 
          message: (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_MANAGER')
            ? 'No branches available in the system' 
            : 'Branch information missing' 
        };
      }

      // Parse date range from query params
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      console.log('Fetching dashboard stats for branch:', branchId);
      const stats = await dashboardService.getBranchDashboard(branchId, startDate, endDate);
      
      console.log('✅ Dashboard stats retrieved successfully');
      return sendSuccess(res, stats);
    } catch (error) {
      console.error('❌ Dashboard error:', error);
      next(error);
    }
  }
}
