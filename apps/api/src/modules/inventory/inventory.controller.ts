import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';
import { InventoryExportService } from './services/inventory-export.service';
import { sendSuccess, sendError } from '../../utils/response';
import { prisma } from '../../lib/prisma';
import { BranchType } from '@prisma/client';

const inventoryService = new InventoryService();
const exportService = new InventoryExportService(prisma);

// Import MaterialUsageService for available items endpoint
import { MaterialUsageService } from '../sessions/services/material-usage.service';
const materialUsageService = new MaterialUsageService();

export class InventoryController {
  /**
   * Get available inventory items with stock info in both units
   * GET /api/v1/inventory/available/:branchId
   */
  async getAvailableItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId } = req.params;
      
      if (!branchId) {
        return sendError(res, 400, 'BRANCH_ID_REQUIRED', 'Branch ID is required');
      }

      const items = await materialUsageService.getAvailableInventoryItems(branchId);
      return sendSuccess(res, items);
    } catch (err: any) {
      next(err);
    }
  }

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

  /**
   * Get low stock items for a branch
   * GET /api/v1/inventory/low-stock/:branchId
   */
  async getLowStockItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId } = req.params;

      if (!branchId) {
        return sendError(res, 400, 'BRANCH_ID_REQUIRED', 'Branch ID is required');
      }

      // Get inventory items with stock below minimum threshold
      const lowStockItems = await prisma.inventoryItem.findMany({
        where: {
          branchId,
          stock: {
            lte: prisma.inventoryItem.fields.minThreshold,
          },
        },
        include: {
          masterProduct: {
            select: {
              name: true,
              category: true,
              baseUnit: true,
              usageUnit: true,
              conversionFactor: true,
            },
          },
        },
        orderBy: [
          {
            stock: 'asc',
          },
          {
            masterProduct: {
              name: 'asc',
            },
          },
        ],
      });

      return sendSuccess(res, lowStockItems);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Adjust stock (ADMIN_CABANG only - can edit their own branch stock)
   * PATCH /api/v1/inventory/items/:itemId/adjust-stock
   */
  async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const { adjustment, notes } = req.body;
      const userId = req.user!.userId;
      const userBranchId = req.user!.branchId;

      // Validate input
      if (typeof adjustment !== 'number' || adjustment === 0) {
        return sendError(res, 400, 'INVALID_ADJUSTMENT', 'Adjustment must be a non-zero number');
      }

      // Verify the inventory item belongs to user's branch
      const inventoryItem = await prisma.inventoryItem.findUnique({
        where: { id: itemId },
        select: { branchId: true },
      });

      if (!inventoryItem) {
        return sendError(res, 404, 'ITEM_NOT_FOUND', 'Item inventori tidak ditemukan');
      }

      if (inventoryItem.branchId !== userBranchId) {
        return sendError(
          res,
          403,
          'BRANCH_MISMATCH',
          'Anda hanya dapat mengedit stok di cabang Anda sendiri'
        );
      }

      // Adjust stock
      const result = await inventoryService.adjustStock(itemId, adjustment, notes, userId);

      return sendSuccess(res, result, 200);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Update master product (e.g., conversion factor)
   * PATCH /api/v1/inventory/master-products/:productId
   */
  async updateMasterProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const { conversionFactor } = req.body;

      // Validate input
      if (conversionFactor !== undefined) {
        const factor = parseFloat(conversionFactor);
        if (isNaN(factor) || factor <= 0) {
          return sendError(res, 400, 'INVALID_CONVERSION_FACTOR', 'Faktor konversi harus berupa angka positif');
        }
      }

      // Update master product
      const updatedProduct = await prisma.masterProduct.update({
        where: { id: productId },
        data: {
          ...(conversionFactor !== undefined && { conversionFactor: parseFloat(conversionFactor) }),
        },
      });

      return sendSuccess(res, updatedProduct, 200);
    } catch (err: any) {
      if (err.code === 'P2025') {
        return sendError(res, 404, 'PRODUCT_NOT_FOUND', 'Produk tidak ditemukan');
      }
      next(err);
    }
  }

  /**
   * Export inventory to CSV
   * GET /api/v1/inventory/export/csv?branchId=xxx
   */
  async exportToCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId } = req.query;
      const userBranchId = req.user?.branchId;
      const userRole = req.user?.role;

      // Determine target branch
      let targetBranchId: string | undefined;
      
      if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_MANAGER') {
        // Super admin and manager can export all branches or specific branch
        targetBranchId = branchId as string | undefined;
      } else {
        // Other roles can only export their own branch
        targetBranchId = userBranchId;
      }

      const csvContent = await exportService.exportToCSV(targetBranchId);
      
      // Get branch name for filename
      let branchName = 'semua-cabang';
      if (targetBranchId) {
        const branch = await prisma.branch.findUnique({
          where: { id: targetBranchId },
          select: { name: true },
        });
        if (branch) {
          // Clean branch name for filename (remove spaces and special chars)
          branchName = branch.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
        }
      }
      
      // Set headers for CSV download
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `inventori-${branchName}-${timestamp}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      // Add BOM for Excel UTF-8 compatibility
      res.write('\uFEFF');
      res.write(csvContent);
      res.end();
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Export inventory to Excel
   * GET /api/v1/inventory/export/excel?branchId=xxx
   */
  async exportToExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId } = req.query;
      const userBranchId = req.user?.branchId;
      const userRole = req.user?.role;

      // Determine target branch
      let targetBranchId: string | undefined;
      
      if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_MANAGER') {
        // Super admin and manager can export all branches or specific branch
        targetBranchId = branchId as string | undefined;
      } else {
        // Other roles can only export their own branch
        targetBranchId = userBranchId;
      }

      const excelBuffer = await exportService.exportToExcel(targetBranchId);
      
      // Get branch name for filename
      let branchName = 'semua-cabang';
      if (targetBranchId) {
        const branch = await prisma.branch.findUnique({
          where: { id: targetBranchId },
          select: { name: true },
        });
        if (branch) {
          // Clean branch name for filename (remove spaces and special chars)
          branchName = branch.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
        }
      }
      
      // Set headers for Excel download
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `inventori-${branchName}-${timestamp}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      res.send(excelBuffer);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Create new inventory item
   * POST /api/v1/inventory/items
   */
  async createInventoryItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId } = req.body;
      const userId = req.user!.userId;
      const userBranchId = req.user!.branchId;

      // Use provided branchId or user's branchId
      const targetBranchId = branchId || userBranchId;

      if (!targetBranchId) {
        return sendError(res, 400, 'BRANCH_ID_REQUIRED', 'Branch ID is required');
      }

      const result = await inventoryService.createInventoryItem(req.body, targetBranchId, userId);
      return sendSuccess(res, result, 201);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Update inventory item
   * PATCH /api/v1/inventory/items/:itemId
   */
  async updateInventoryItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const userId = req.user!.userId;

      const result = await inventoryService.updateInventoryItem(itemId, req.body, userId);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Delete inventory item
   * DELETE /api/v1/inventory/items/:itemId
   */
  async deleteInventoryItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const userId = req.user!.userId;

      const result = await inventoryService.deleteInventoryItem(itemId, userId);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }
}
