import { Request, Response, NextFunction } from 'express';
import { ShipmentService, type ReceiveShipmentInput } from './shipment.service';
import { sendSuccess, sendError } from '../../utils/response';
import { ShipmentStatus, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getAccessibleBranchIds } from '../iam/authorization.service';

const shipmentService = new ShipmentService();

function parseJsonField<T>(value: unknown, fieldName: string): T | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    throw {
      status: 400,
      code: 'INVALID_JSON_FIELD',
      message: `Field ${fieldName} harus berupa JSON yang valid`,
    };
  }
}

export class ShipmentController {
  /**
   * Ship shipment (Admin Manager / Super Admin)
   * POST /api/v1/inventory/shipments/:shipmentId/ship
   * 
   * Body:
   * - notes: string (optional)
   * - shipmentPhotoUrl: string (optional)
   * - shipmentPhotoName: string (optional)
   * - items: Array of { masterProductId, sentQty, overstockReason? } (optional - for overstock)
   */
  async shipShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const { shipmentId } = req.params;
      const { notes, shipmentPhotoUrl, shipmentPhotoName, items, occurredAt } = req.body;
      const idempotencyKey = req.body.idempotencyKey || req.header('Idempotency-Key');
      const userId = req.user?.userId;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      const result = await shipmentService.shipShipment(shipmentId, userId, {
        notes,
        shipmentPhotoUrl,
        shipmentPhotoName,
        items,
        occurredAt,
        idempotencyKey,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Receive shipment (Admin Cabang)
   * POST /api/v1/inventory/shipments/:shipmentId/receive
   * 
   * Multipart body:
   * - receivedItems: Array of { masterProductId, receivedQty }
   * - discrepancies: Array of { masterProductId, expectedQty, receivedQty, discrepancyType, notes, photoUrl }
   * - notes: string
   * - receiptFile: PDF/JPG tanda terima (required)
   */
  async receiveShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const { shipmentId } = req.params;
      const receivedItems = parseJsonField<NonNullable<ReceiveShipmentInput['receivedItems']>>(req.body.receivedItems, 'receivedItems');
      const discrepancies = parseJsonField<NonNullable<ReceiveShipmentInput['discrepancies']>>(req.body.discrepancies, 'discrepancies');
      const { notes, isFinal, occurredAt } = req.body;
      const idempotencyKey = req.body.idempotencyKey || req.header('Idempotency-Key');
      const userId = req.user?.userId;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      if (!req.file) {
        return sendError(res, 400, 'RECEIPT_FILE_REQUIRED', 'File tanda terima wajib diupload');
      }

      const result = await shipmentService.receiveShipment(shipmentId, userId, {
        receivedItems,
        discrepancies,
        notes,
        isFinal,
        occurredAt,
        idempotencyKey,
        receiptFile: req.file,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Review shipment issue (Admin Manager / Super Admin)
   * POST /api/v1/inventory/shipments/:shipmentId/review-issue
   *
   * Body:
   * - decision: SEND_SHORTAGE | CLOSE_CASE | COMPLETE_CASE
   * - notes: string (optional)
   * - shortageItems: Array of { masterProductId, quantity } (optional)
   */
  async reviewShipmentIssue(req: Request, res: Response, next: NextFunction) {
    try {
      const { shipmentId } = req.params;
      const { decision, notes, shortageItems } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      const validDecisions = ['SEND_SHORTAGE', 'CLOSE_CASE', 'COMPLETE_CASE'];
      if (!validDecisions.includes(decision)) {
        return sendError(res, 400, 'INVALID_DECISION', `Keputusan tidak valid. Gunakan: ${validDecisions.join(', ')}`);
      }

      if (shortageItems && !Array.isArray(shortageItems)) {
        return sendError(res, 400, 'INVALID_SHORTAGE_ITEMS', 'shortageItems harus berupa array');
      }

      const result = await shipmentService.reviewShipmentIssue(shipmentId, userId, {
        decision,
        notes,
        shortageItems,
      });

      return sendSuccess(res, result);
    } catch (err) {
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

      // ADMIN_MANAGER, ADMIN_LOGISTIK, and SUPER_ADMIN can have null branchId
      if (!branchId && ![
        'ADMIN_MANAGER',
        'ADMIN_LOGISTIK',
        'FINANCE_LOGISTICS_CONTROLLER',
        'SUPER_ADMIN',
      ].includes(userRole || '')) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak memiliki cabang');
      }

      const result = await shipmentService.approveShipment(shipmentId, userId, branchId || '', notes);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get shipments
   * GET /api/v1/inventory/shipments
   */
  async getShipments(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId, status, startDate, endDate } = req.query;
      const userId = req.user?.userId;
      const userBranchId = req.user?.branchId;
      const userRole = req.user?.role;

      // Determine which branches to filter by
      let targetBranchIds: string[] | undefined;
      
      if (userRole === Role.SUPER_ADMIN || userRole === Role.ADMIN_LOGISTIK) {
        // SUPER_ADMIN and ADMIN_LOGISTIK can see all shipments
        targetBranchIds = branchId ? [branchId as string] : undefined;
      } else if (userRole === Role.FINANCE_LOGISTICS_CONTROLLER && userId) {
        const accessibleBranchIds = await getAccessibleBranchIds(userId);
        targetBranchIds = accessibleBranchIds ?? [];
        if (branchId) {
          if (!targetBranchIds.includes(branchId as string)) {
            return sendError(res, 403, 'ACCESS_DENIED', 'Anda tidak memiliki akses ke cabang ini');
          }
          targetBranchIds = [branchId as string];
        } else if (targetBranchIds.length === 0) {
          return sendSuccess(res, []);
        }
      } else if (userRole === Role.ADMIN_MANAGER && userId) {
        // ADMIN_MANAGER can only see shipments for active branches they manage
        const managedBranches = await prisma.managerBranch.findMany({
          where: {
            userId,
            branch: { isActive: true },
          },
          select: { branchId: true },
        });
        targetBranchIds = managedBranches.map(mb => mb.branchId);

        if (branchId) {
          if (!targetBranchIds.includes(branchId as string)) {
            return sendError(res, 403, 'ACCESS_DENIED', 'Anda tidak memiliki akses ke cabang ini');
          }

          targetBranchIds = [branchId as string];
        } else if (targetBranchIds.length === 0) {
          return sendSuccess(res, []);
        }
      } else if (userBranchId) {
        // Regular branch staff can only see their own branch shipments
        if (branchId && branchId !== userBranchId) {
          return sendError(res, 403, 'ACCESS_DENIED', 'Anda tidak memiliki akses ke cabang ini');
        }

        targetBranchIds = [userBranchId];
      } else {
        return sendError(res, 403, 'ACCESS_DENIED', 'User tidak memiliki akses cabang');
      }

      const result = await shipmentService.getShipments(
        targetBranchIds,
        status as ShipmentStatus,
        {
          startDate: startDate as string,
          endDate: endDate as string,
        }
      );

      return sendSuccess(res, result);
    } catch (err) {
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
      if (userRole === Role.FINANCE_LOGISTICS_CONTROLLER && userId) {
        const accessibleBranchIds = await getAccessibleBranchIds(userId);
        if (accessibleBranchIds !== null && !accessibleBranchIds.includes(result.toBranchId)) {
          return sendError(res, 403, 'ACCESS_DENIED', 'Anda tidak memiliki akses ke shipment ini');
        }
      }

      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update shipment
   * PATCH /api/v1/inventory/shipments/:shipmentId
   */
  async updateShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const { shipmentId } = req.params;
      const { notes, items } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'User tidak terautentikasi');
      }

      if (items !== undefined && !Array.isArray(items)) {
        return sendError(res, 400, 'INVALID_ITEMS', 'Items harus berupa array');
      }

      const result = await shipmentService.updateShipment(shipmentId, userId, {
        notes,
        items,
      });

      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
