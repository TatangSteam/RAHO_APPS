import { Request, Response, NextFunction } from 'express';
import { ShipmentService } from './shipment.service';
import { sendSuccess, sendError } from '../../utils/response';
import { ShipmentStatus } from '@prisma/client';

const shipmentService = new ShipmentService();

export class ShipmentController {
  async shipShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const { shipmentId } = req.params;
      const { notes } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      const result = await shipmentService.shipShipment(shipmentId, userId, notes);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  async receiveShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const { shipmentId } = req.params;
      const { notes } = req.body;
      const userId = req.user?.id;
      const branchId = req.user?.branchId;
      const userRole = req.user?.role;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      // ADMIN_MANAGER and SUPER_ADMIN can have null branchId
      if (!branchId && !['ADMIN_MANAGER', 'SUPER_ADMIN'].includes(userRole || '')) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak memiliki cabang');
      }

      const result = await shipmentService.receiveShipment(shipmentId, userId, branchId || '', notes);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  async approveShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const { shipmentId } = req.params;
      const { notes } = req.body;
      const userId = req.user?.id;
      const branchId = req.user?.branchId;
      const userRole = req.user?.role;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      // ADMIN_MANAGER and SUPER_ADMIN can have null branchId
      if (!branchId && !['ADMIN_MANAGER', 'SUPER_ADMIN'].includes(userRole || '')) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak memiliki cabang');
      }

      const result = await shipmentService.approveShipment(shipmentId, userId, branchId || '', notes);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  async getShipments(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId, status } = req.query;
      const userId = req.user?.id;
      const userBranchId = req.user?.branchId;
      const userRole = req.user?.role;

      // For ADMIN_MANAGER with null branchId, get their managed branches
      let targetBranchIds: string[] | undefined;
      
      if (branchId) {
        // If specific branchId is provided in query, use it
        targetBranchIds = [branchId as string];
      } else if (userRole === 'ADMIN_MANAGER' && !userBranchId) {
        // ADMIN_MANAGER with null branchId - get all managed branches
        const { prisma } = await import('../../lib/prisma');
        const managedBranches = await prisma.managerBranch.findMany({
          where: { userId },
          select: { branchId: true },
        });
        targetBranchIds = managedBranches.map(mb => mb.branchId);
      } else if (userRole === 'SUPER_ADMIN') {
        // SUPER_ADMIN can see all shipments
        targetBranchIds = undefined;
      } else if (userBranchId) {
        // Regular staff with assigned branch
        targetBranchIds = [userBranchId];
      }

      const result = await shipmentService.getShipments(
        targetBranchIds,
        status as ShipmentStatus
      );

      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  async getShipmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { shipmentId } = req.params;
      const result = await shipmentService.getShipmentById(shipmentId);

      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }
}
