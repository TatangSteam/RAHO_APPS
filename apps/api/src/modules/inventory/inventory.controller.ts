import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';
import { InventoryExportService } from './services/inventory-export.service';
import { sendSuccess, sendError } from '../../utils/response';
import { prisma } from '../../lib/prisma';
import { BranchType, ProductCategory, Role, StockMutationType } from '@prisma/client';
import { centralStockVisibleRoles } from './logistics.access';

const inventoryService = new InventoryService();
const exportService = new InventoryExportService(prisma);

// Import MaterialUsageService for available items endpoint
import { MaterialUsageService } from '../sessions/services/material-usage.service';
const materialUsageService = new MaterialUsageService();

// Import MaterialUsageHistoryService for usage history endpoint
import { MaterialUsageHistoryService } from './services/material-usage-history.service';
const materialUsageHistoryService = new MaterialUsageHistoryService();

export class InventoryController {
  private async canReadInventoryBranch(req: Request, res: Response, branchId: string): Promise<boolean> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { type: true },
    });

    if (!branch) {
      sendError(res, 404, 'BRANCH_NOT_FOUND', 'Cabang tidak ditemukan');
      return false;
    }

    if (branch.type === BranchType.PUSAT && !centralStockVisibleRoles.has(req.user?.role as Role)) {
      sendError(res, 403, 'CENTRAL_STOCK_HIDDEN', 'Anda tidak memiliki akses melihat jumlah stok pusat');
      return false;
    }

    return true;
  }

  private async getAccessibleMaterialUsageBranchIds(req: Request): Promise<string[] | undefined> {
    const userRole = req.user?.role;
    const userId = req.user?.userId;
    const userBranchId = req.user?.branchId;

    if (userRole === Role.SUPER_ADMIN) {
      return undefined;
    }

    if (userRole === Role.ADMIN_MANAGER && userId) {
      const managedBranches = await prisma.managerBranch.findMany({
        where: {
          userId,
          branch: { isActive: true },
        },
        select: { branchId: true },
      });

      return managedBranches.map((branch) => branch.branchId);
    }

    return userBranchId ? [userBranchId] : [];
  }

  /**
   * Get material usage history with filters
   * GET /api/v1/inventory/material-usage-history
   */
  async getMaterialUsageHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        branchId,
        staffId,
        staffGroupId,
        startDate,
        endDate,
        productName,
        category,
      } = req.query;

      const accessibleBranchIds = await this.getAccessibleMaterialUsageBranchIds(req);
      const requestedBranchId = branchId as string | undefined;

      if (accessibleBranchIds && accessibleBranchIds.length === 0) {
        return sendError(res, 403, 'ACCESS_DENIED', 'User tidak memiliki akses cabang');
      }

      if (requestedBranchId && accessibleBranchIds && !accessibleBranchIds.includes(requestedBranchId)) {
        return sendError(res, 403, 'ACCESS_DENIED', 'Anda tidak memiliki akses ke cabang ini');
      }

      if (category && !Object.values(ProductCategory).includes(category as ProductCategory)) {
        return sendError(res, 400, 'INVALID_CATEGORY', 'Kategori material tidak valid');
      }

      const filters = {
        branchId: requestedBranchId,
        branchIds: requestedBranchId ? undefined : accessibleBranchIds,
        staffId: staffId as string | undefined,
        staffGroupId: staffGroupId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(`${endDate as string}T23:59:59.999`) : undefined,
        productName: productName as string | undefined,
        category: category as ProductCategory | undefined,
      };

      const result = await materialUsageHistoryService.getMaterialUsageHistory(filters);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Get staff list for filter dropdown
   * GET /api/v1/inventory/material-usage-history/staff
   */
  async getStaffListForFilter(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId } = req.query;

      const accessibleBranchIds = await this.getAccessibleMaterialUsageBranchIds(req);
      const requestedBranchId = branchId as string | undefined;

      if (accessibleBranchIds && accessibleBranchIds.length === 0) {
        return sendError(res, 403, 'ACCESS_DENIED', 'User tidak memiliki akses cabang');
      }

      if (requestedBranchId && accessibleBranchIds && !accessibleBranchIds.includes(requestedBranchId)) {
        return sendError(res, 403, 'ACCESS_DENIED', 'Anda tidak memiliki akses ke cabang ini');
      }

      const result = await materialUsageHistoryService.getStaffList(
        requestedBranchId,
        requestedBranchId ? undefined : accessibleBranchIds
      );
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Get branch groups for filter dropdown
   * GET /api/v1/inventory/material-usage-history/branch-groups
   */
  async getBranchGroupsForFilter(req: Request, res: Response, next: NextFunction) {
    try {
      const accessibleBranchIds = await this.getAccessibleMaterialUsageBranchIds(req);

      if (accessibleBranchIds && accessibleBranchIds.length === 0) {
        return sendError(res, 403, 'ACCESS_DENIED', 'User tidak memiliki akses cabang');
      }

      const result = await materialUsageHistoryService.getBranchGroups(accessibleBranchIds);
      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Get master products for inventory modal (accessible by ADMIN_ROLES)
   * GET /api/v1/inventory/master-products
   */
  async getMasterProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, isActive, search, limit } = req.query;

      // Build where clause
      const where: any = {};

      if (category) {
        where.category = category;
      }

      if (isActive === 'true') {
        where.isActive = true;
      } else if (isActive === 'false') {
        where.isActive = false;
      }

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      // Get products with high limit for inventory modal
      const products = await prisma.masterProduct.findMany({
        where,
        select: {
          id: true,
          name: true,
          sku: true,
          category: true,
          baseUnit: true,
          usageUnit: true,
          conversionFactor: true,
          description: true,
          isActive: true,
        },
        orderBy: [
          { category: 'asc' },
          { name: 'asc' },
        ],
        take: limit ? parseInt(limit as string) : 1000,
      });

      return sendSuccess(res, {
        products: products.map(p => ({
          ...p,
          conversionFactor: Number(p.conversionFactor),
        })),
        total: products.length,
      });
    } catch (err: any) {
      next(err);
    }
  }

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

      if (!(await this.canReadInventoryBranch(req, res, branchId))) {
        return;
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

      if (!(await this.canReadInventoryBranch(req, res, targetBranchId))) {
        return;
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

      if (item.branch?.id && !(await this.canReadInventoryBranch(req, res, item.branch.id))) {
        return;
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

      if (!(await this.canReadInventoryBranch(req, res, branchId))) {
        return;
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
   * Adjust stock
   * - SUPER_ADMIN: can adjust any branch's stock
   * - ADMIN_MANAGER: can adjust branches they manage
   * PATCH /api/v1/inventory/items/:itemId/adjust-stock
   */
  async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const { adjustment } = req.body;
      const notes = req.body.notes ?? req.body.reason;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      if (userRole !== Role.SUPER_ADMIN && userRole !== Role.ADMIN_MANAGER && userRole !== Role.ADMIN_LOGISTIK) {
        return sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', 'Hanya Super Admin, Admin Manager, atau Admin Logistik yang dapat mengedit stok');
      }

      // Validate input
      if (typeof adjustment !== 'number' || adjustment === 0) {
        return sendError(res, 400, 'INVALID_ADJUSTMENT', 'Adjustment must be a non-zero number');
      }

      // Verify the inventory item exists
      const inventoryItem = await prisma.inventoryItem.findUnique({
        where: { id: itemId },
        select: {
          branchId: true,
          branch: {
            select: {
              isActive: true,
            },
          },
        },
      });

      if (!inventoryItem) {
        return sendError(res, 404, 'ITEM_NOT_FOUND', 'Item inventori tidak ditemukan');
      }

      if (!inventoryItem.branch.isActive) {
        return sendError(res, 422, 'BRANCH_INACTIVE', 'Stok tidak dapat diedit karena cabang sudah tidak aktif');
      }

      if (userRole === Role.ADMIN_MANAGER) {
        const managedBranch = await prisma.managerBranch.findFirst({
          where: {
            userId,
            branchId: inventoryItem.branchId,
            branch: { isActive: true },
          },
          select: { branchId: true },
        });

        if (!managedBranch) {
          return sendError(
            res,
            403,
            'BRANCH_ACCESS_DENIED',
            'Anda hanya dapat mengedit stok di cabang yang Anda kelola'
          );
        }
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
      const userRole = req.user!.role;

      if (userRole !== Role.SUPER_ADMIN && userRole !== Role.ADMIN_MANAGER && userRole !== Role.ADMIN_LOGISTIK) {
        return sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', 'Hanya Super Admin, Admin Manager, atau Admin Logistik yang dapat mengubah konversi stok');
      }

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
      
      if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_MANAGER' || userRole === 'ADMIN_LOGISTIK') {
        // Super admin and manager can export all branches or specific branch
        targetBranchId = branchId as string | undefined;
      } else {
        // Other roles can only export their own branch
        targetBranchId = userBranchId;
      }

      if (targetBranchId && !(await this.canReadInventoryBranch(req, res, targetBranchId))) {
        return;
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
      
      if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_MANAGER' || userRole === 'ADMIN_LOGISTIK') {
        // Super admin and manager can export all branches or specific branch
        targetBranchId = branchId as string | undefined;
      } else {
        // Other roles can only export their own branch
        targetBranchId = userBranchId;
      }

      if (targetBranchId && !(await this.canReadInventoryBranch(req, res, targetBranchId))) {
        return;
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

  /**
   * Batch create inventory items
   * POST /api/v1/inventory/items/batch
   */
  async batchCreateInventoryItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId, items } = req.body;
      const userId = req.user!.userId;
      const userBranchId = req.user!.branchId;

      // Use provided branchId or user's branchId
      const targetBranchId = branchId || userBranchId;

      if (!targetBranchId) {
        return sendError(res, 400, 'BRANCH_ID_REQUIRED', 'Branch ID is required');
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return sendError(res, 400, 'ITEMS_REQUIRED', 'Items array is required');
      }

      // Validate items
      for (const item of items) {
        if (!item.masterProductId) {
          return sendError(res, 400, 'MASTER_PRODUCT_ID_REQUIRED', 'Master product ID is required for each item');
        }
      }

      const result = await inventoryService.batchCreateInventoryItems(items, targetBranchId, userId);
      return sendSuccess(res, result, 201);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Get stock mutations with filters
   * GET /api/v1/inventory/stock-mutations
   * 
   * Role-based access:
   * - SUPER_ADMIN: See all stock mutations
   * - ADMIN_MANAGER: See mutations from branches they manage
   * - ADMIN_CABANG: See mutations from their branch only
   */
  async getStockMutations(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        inventoryItemId, 
        type, 
        startDate, 
        endDate,
        branchId,
        page, 
        limit 
      } = req.query;

      const userRole = req.user?.role;
      const userId = req.user?.userId;
      const userBranchId = req.user?.branchId;

      // Determine which branches to query based on role
      let targetBranchIds: string[] | undefined;

      if (userRole === Role.SUPER_ADMIN || userRole === Role.ADMIN_LOGISTIK) {
        // Super Admin and Admin Logistik see all mutations (no branch filter)
        targetBranchIds = branchId ? [branchId as string] : undefined;
      } else if (userRole === Role.ADMIN_MANAGER && userId) {
        // Admin Manager sees mutations from branches they manage
        const managedBranches = await prisma.managerBranch.findMany({
          where: {
            userId,
            branch: { isActive: true },
          },
          select: { branchId: true },
        });

        const managedBranchIds = managedBranches.map(mb => mb.branchId);

        if (branchId) {
          // If specific branch requested, check if manager has access
          if (managedBranchIds.includes(branchId as string)) {
            targetBranchIds = [branchId as string];
          } else {
            return sendError(res, 403, 'ACCESS_DENIED', 'Anda tidak memiliki akses ke cabang ini');
          }
        } else {
          // Show all managed branches
          targetBranchIds = managedBranchIds;
        }
      } else if (userBranchId) {
        // Other roles (ADMIN_CABANG, ADMIN_LAYANAN) see only their branch
        if (branchId && branchId !== userBranchId) {
          return sendError(res, 403, 'ACCESS_DENIED', 'Anda tidak memiliki akses ke cabang ini');
        }

        targetBranchIds = [userBranchId];
      } else {
        return sendError(res, 403, 'ACCESS_DENIED', 'User tidak memiliki akses cabang');
      }

      if (targetBranchIds && targetBranchIds.length > 0 && !centralStockVisibleRoles.has(userRole as Role)) {
        const centralBranchCount = await prisma.branch.count({
          where: {
            id: { in: targetBranchIds },
            type: BranchType.PUSAT,
          },
        });

        if (centralBranchCount > 0) {
          return sendError(res, 403, 'CENTRAL_STOCK_HIDDEN', 'Anda tidak memiliki akses melihat mutasi stok pusat');
        }
      }

      const result = await inventoryService.getStockMutations({
        inventoryItemId: inventoryItemId as string,
        type: type as StockMutationType,
        startDate: startDate as string,
        endDate: endDate as string,
        branchIds: targetBranchIds,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      return sendSuccess(res, result);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Export stock mutations to Excel
   * GET /api/v1/inventory/stock-mutations/export
   */
  async exportStockMutations(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = req.query;
      const workbook = await inventoryService.exportStockMutations(filters);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=stock-mutations-${Date.now()}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (err: any) {
      next(err);
    }
  }
}
