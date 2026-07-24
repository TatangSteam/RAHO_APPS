import { Request, Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service';
import { RoleDashboardService } from './role-dashboard.service';
import { sendSuccess } from '../../utils/response';
import { prisma } from '../../lib/prisma';

const dashboardService = new DashboardService();
const roleDashboardService = new RoleDashboardService();

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

      // Operational roles receive counts only, never monetary dashboard data.
      if (userRole === 'ADMIN_CABANG' || userRole === 'ADMIN_LAYANAN' || userRole === 'DOCTOR' || userRole === 'NURSE') {
        const { revenue: financialRevenue, recentTransactions, topPackages, ...operationalStats } = stats;
        return sendSuccess(res, {
          ...operationalStats,
          revenue: { transactionCount: financialRevenue.transactionCount },
        });
      }
      
      console.log('✅ Dashboard stats retrieved successfully');
      return sendSuccess(res, stats);
    } catch (error) {
      console.error('❌ Dashboard error:', error);
      next(error);
    }
  }

  /**
   * GET /api/v1/dashboard/doctor
   * Get doctor-specific dashboard
   */
  async getDoctorDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const branchId = req.user?.branchId;
      const userRole = req.user?.role;

      if (!userId || !branchId) {
        throw { status: 400, code: 'INVALID_REQUEST', message: 'User or branch information missing' };
      }

      if (userRole !== 'DOCTOR') {
        throw { status: 403, code: 'FORBIDDEN', message: 'Only doctors can access this dashboard' };
      }

      const data = await roleDashboardService.getDoctorDashboard(userId, branchId);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/dashboard/nurse
   * Get nurse-specific dashboard
   */
  async getNurseDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.user?.branchId;
      const userRole = req.user?.role;

      if (!branchId) {
        throw { status: 400, code: 'INVALID_REQUEST', message: 'Branch information missing' };
      }

      if (userRole !== 'NURSE') {
        throw { status: 403, code: 'FORBIDDEN', message: 'Only nurses can access this dashboard' };
      }

      const data = await roleDashboardService.getNurseDashboard(branchId);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/dashboard/admin-manager
   * Get admin manager-specific dashboard (multi-branch overview)
   */
  async getAdminManagerDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!userId) {
        throw { status: 400, code: 'INVALID_REQUEST', message: 'User information missing' };
      }

      if (userRole !== 'ADMIN_MANAGER') {
        throw { status: 403, code: 'FORBIDDEN', message: 'Only Admin Manager can access this dashboard' };
      }

      // Parse date range from query params
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const data = await roleDashboardService.getAdminManagerDashboard(userId, startDate, endDate);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/dashboard/admin-layanan
   * Get admin layanan-specific dashboard
   */
  async getAdminLayananDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.user?.branchId;
      const userRole = req.user?.role;

      if (!branchId) {
        throw { status: 400, code: 'INVALID_REQUEST', message: 'Branch information missing' };
      }

      if (userRole !== 'ADMIN_LAYANAN') {
        throw { status: 403, code: 'FORBIDDEN', message: 'Only Admin Layanan can access this dashboard' };
      }

      const data = await roleDashboardService.getAdminLayananDashboard(branchId);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/dashboard/member
   * Get enhanced member dashboard
   */
  async getMemberDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!userId) {
        throw { status: 400, code: 'INVALID_REQUEST', message: 'User information missing' };
      }

      if (userRole !== 'MEMBER') {
        throw { status: 403, code: 'FORBIDDEN', message: 'Only members can access this dashboard' };
      }

      // Get member ID from user
      const member = await prisma.member.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!member) {
        throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member not found' };
      }

      const data = await roleDashboardService.getMemberDashboardEnhanced(member.id);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }
}
