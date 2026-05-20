import { Request, Response, NextFunction } from 'express';
import { ShipmentService } from './shipment.service';
import { sendSuccess, sendError } from '../../utils/response';
import { ShipmentStatus, Role, DiscrepancyType } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const shipmentService = new ShipmentService();

export class ShipmentController {
  /**
   * Ship shipment (Admin Manager / Super Admin)
   * POST /api/v1/inventory/shipments/:shipmentId/ship
   */
  async shipShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const { shipmentId } = req.params;
      const { notes, shipmentPhotoUrl, shipmentPhotoName } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      const result = await shipmentService.shipShipment(shipmentId, userId, {
        notes,
        shipmentPhotoUrl,
        shipmentPhotoName,
      });
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Receive shipment (Admin Cabang)
   * POST /api/v1/inventory/shipments/:shipmentId/receive
   * 
   * Body:
   * - receivedItems: Array of { masterProductId, receivedQty }
   * - discrepancies: Array of { masterProductId, expectedQty, receivedQty, discrepancyType, notes, photoUrl }
   * - notes: string
   */
  async receiveShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const { shipmentId } = req.params;
      const { receivedItems, discrepancies, notes } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      // Validate discrepancies if provided
      if (discrepancies && Array.isArray(discrepancies)) {
        for (const d of discrepancies) {
          if (!d.masterProductId || d.expectedQty === undefined || d.receivedQty === undefined || !d.discrepancyType) {
            return sendError(res, 400, 'INVALID_DISCREPANCY', 'Setiap ketidaksesuaian harus memiliki masterProductId, expectedQty, receivedQty, dan discrepancyType');
          }
          
          // Validate discrepancy type
          const validTypes: DiscrepancyType[] = ['SHORTAGE', 'DAMAGE', 'WRONG_ITEM', 'OTHER'];
          if (!validTypes.includes(d.discrepancyType)) {
            return sendError(res, 400, 'INVALID_DISCREPANCY_TYPE', `Tipe ketidaksesuaian tidak valid. Gunakan: ${validTypes.join(', ')}`);
          }
        }
      }

      const result = await shipmentService.receiveShipment(shipmentId, userId, {
        receivedItems,
        discrepancies,
        notes,
      });
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Legacy approve shipment endpoint (for backward compatibility)
   * POST /api/v1/inventory/shipments/:shipmentId/approve
   */
  async approveShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const { shipmentId } = req.params;
      const { notes } = req.body;
      const userId = req.user?.userId;
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

  /**
   * Get shipments
   * GET /api/v1/inventory/shipments
   */
  async getShipments(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId, status } = req.query;
      const userId = req.user?.userId;
      const userBranchId = req.user?.branchId;
      const userRole = req.user?.role;

      // Determine which branches to filter by
      let targetBranchIds: string[] | undefined;
      
      if (branchId) {
        // If specific branchId is provided in query, use it
        targetBranchIds = [branchId as string];
      } else if (userRole === 'SUPER_ADMIN') {
        // SUPER_ADMIN can see all shipments
        targetBranchIds = undefined;
      } else if (userRole === 'ADMIN_MANAGER') {
        // ADMIN_MANAGER - get all managed branches (regardless of their own branchId)
        const managedBranches = await prisma.managerBranch.findMany({
          where: { userId },
          select: { branchId: true },
        });
        targetBranchIds = managedBranches.map(mb => mb.branchId);
        
        // If no managed branches found, return empty
        if (targetBranchIds.length === 0) {
          return sendSuccess(res, []);
        }
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

  /**
   * Get shipment by ID
   * GET /api/v1/inventory/shipments/:shipmentId
   */
  async getShipmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { shipmentId } = req.params;
      const userId = req.user?.userId;
      const userRole = req.user?.role as Role;
      const userBranchId = req.user?.branchId;

      const result = await shipmentService.getShipmentById(shipmentId);

      // Validate access
      if (userRole === Role.ADMIN_CABANG && result.toBranchId !== userBranchId) {
        return sendError(res, 403, 'ACCESS_DENIED', 'Anda tidak memiliki akses ke shipment ini');
      }

      if (userRole === Role.ADMIN_MANAGER) {
        // Check if manager manages the destination branch
        const managerBranch = await prisma.managerBranch.findFirst({
          where: {
            userId,
            branchId: result.toBranchId,
          },
        });

        if (!managerBranch) {
          return sendError(res, 403, 'ACCESS_DENIED', 'Anda tidak memiliki akses ke shipment ini');
        }
      }

      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }
}
