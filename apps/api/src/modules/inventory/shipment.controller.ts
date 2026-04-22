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

      if (!userId || !branchId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      const result = await shipmentService.receiveShipment(shipmentId, userId, branchId, notes);
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

      if (!userId || !branchId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      const result = await shipmentService.approveShipment(shipmentId, userId, branchId, notes);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  async getShipments(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId, status } = req.query;
      const userBranchId = req.user?.branchId;

      // Use query branchId if provided, otherwise use user's branchId
      const targetBranchId = (branchId as string) || userBranchId;

      const result = await shipmentService.getShipments(
        targetBranchId,
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
