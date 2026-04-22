import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';
import { sendSuccess, sendError } from '../../utils/response';

const inventoryService = new InventoryService();

export class InventoryController {
  async getInventoryItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId } = req.query;
      const userBranchId = req.user?.branchId;

      // Use query branchId if provided, otherwise use user's branchId
      const targetBranchId = (branchId as string) || userBranchId;

      if (!targetBranchId) {
        return sendError(res, 400, 'BRANCH_ID_REQUIRED', 'Branch ID is required');
      }

      const items = await inventoryService.getInventoryItems(targetBranchId);
      return sendSuccess(res, items);
    } catch (err: any) {
      next(err);
    }
  }

  async getInventoryItemById(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const item = await inventoryService.getInventoryItemById(itemId);

      if (!item) {
        return sendError(res, 404, 'ITEM_NOT_FOUND', 'Inventory item not found');
      }

      return sendSuccess(res, item);
    } catch (err: any) {
      next(err);
    }
  }
}
