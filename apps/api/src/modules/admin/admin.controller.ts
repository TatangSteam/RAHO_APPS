import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { sendSuccess } from '@utils/response';
import {
  AdminManagerAccessScope,
  Role,
  PackageType,
  AuditAction,
  ProductCategory,
  ProductType,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import type { ConvertAdminManagerRoleInput } from './admin.schema';

const adminService = new AdminService();

function parseAdminManagerAccessScope(value: unknown): AdminManagerAccessScope {
  if (value === AdminManagerAccessScope.MEMBER_VIEW_ONLY) {
    return AdminManagerAccessScope.MEMBER_VIEW_ONLY;
  }

  if (value === undefined || value === null || value === '' || value === AdminManagerAccessScope.FULL) {
    return AdminManagerAccessScope.FULL;
  }

  throw {
    status: 400,
    code: 'INVALID_ADMIN_MANAGER_ACCESS_SCOPE',
    message: 'Mode akses Admin Manager tidak valid',
  };
}

// ── Get Branches for Admin Manager ────────────────────────────
export async function getBranches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    
    console.log('🔍 [getBranches] User:', { id: user.id, email: user.email, role: user.role });
    
    let branches;
    
    if (user.role === 'ADMIN_MANAGER') {
      // Get branches assigned to this manager via ManagerBranch table
      console.log('🔍 [getBranches] Fetching branches for ADMIN_MANAGER...');
      
      const managerBranches = await prisma.managerBranch.findMany({
        where: { userId: user.id },
        include: {
          branch: true
        }
      });
      
      console.log('🔍 [getBranches] ManagerBranch records found:', managerBranches.length);
      console.log('🔍 [getBranches] ManagerBranch data:', JSON.stringify(managerBranches, null, 2));
      
      branches = managerBranches.map(mb => ({
        ...mb.branch,
        accessScope: mb.accessScope,
        assignedAt: mb.createdAt,
      }));
      console.log('🔍 [getBranches] Branches extracted:', branches.length);
    } else if (user.role === 'SUPER_ADMIN') {
      // Super admin can see all branches
      console.log('🔍 [getBranches] Fetching all branches for SUPER_ADMIN...');
      
      branches = await prisma.branch.findMany({
        where: { isActive: true },
        orderBy: [
          { type: 'desc' }, // PUSAT first
          { name: 'asc' }
        ]
      });
      
      console.log('🔍 [getBranches] All branches found:', branches.length);
    } else if (user.branchId) {
      // Other roles see only their branch
      console.log('🔍 [getBranches] Fetching single branch for user...');
      
      const branch = await prisma.branch.findUnique({
        where: { id: user.branchId }
      });
      branches = branch ? [branch] : [];
      
      console.log('🔍 [getBranches] User branch found:', branches.length);
    } else {
      console.log('🔍 [getBranches] No branches available for user');
      branches = [];
    }
    
    console.log('🔍 [getBranches] Returning branches:', branches.length);
    console.log('🔍 [getBranches] Branch names:', branches.map((b) => b.name));
    
    sendSuccess(res, branches);
  } catch (err) {
    console.error('❌ [getBranches] Error:', err);
    next(err);
  }
}

// ── Get System Statistics ─────────────────────────────────────
export async function getSystemStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await adminService.getSystemStats();
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

// ── Get System Health ─────────────────────────────────────────
export async function getSystemHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const health = await adminService.getSystemHealth();
    sendSuccess(res, health);
  } catch (err) {
    next(err);
  }
}

// ── Get Recent Activities ─────────────────────────────────────
export async function getRecentActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const activities = await adminService.getRecentActivities(limit);
    sendSuccess(res, activities);
  } catch (err) {
    next(err);
  }
}

// ── Get Branch Performance ────────────────────────────────────
export async function getBranchPerformance(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const performance = await adminService.getBranchPerformance();
    sendSuccess(res, performance);
  } catch (err) {
    next(err);
  }
}

// ── Get Audit Logs ────────────────────────────────────────────
export async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      search: req.query.search as string | undefined,
      action: req.query.action ? (req.query.action as AuditAction) : undefined,
      resource: req.query.resource as string | undefined,
      userId: req.query.userId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };

    const result = await adminService.getAuditLogs(filters);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// ══════════════════════════════════════════════════════════════
// PACKAGE PRICING MANAGEMENT
// ══════════════════════════════════════════════════════════════

// ── Get All Package Pricing ────────────────────────────────────
export async function getAllPackagePricing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    
    const filters = {
      branchId: req.query.branchId as string | undefined,
      packageType: req.query.packageType ? (req.query.packageType as PackageType) : undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    // ADMIN_CABANG can only see pricing for their branch
    if (user.role === 'ADMIN_CABANG' && user.branchId) {
      filters.branchId = user.branchId;
    }

    const result = await adminService.getAllPackagePricing(filters);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// ── Get Single Package Pricing ─────────────────────────────────
export async function getPackagePricing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { pricingId } = req.params;
    const pricing = await adminService.getPackagePricing(pricingId);
    sendSuccess(res, pricing);
  } catch (err) {
    next(err);
  }
}

// ── Create Package Pricing ─────────────────────────────────────
export async function createPackagePricing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    const data = req.body;
    
    // ADMIN_CABANG can only create pricing for their branch
    if (user.role === 'ADMIN_CABANG' && user.branchId) {
      data.branchId = user.branchId;
    }
    
    const pricing = await adminService.createPackagePricing(data);
    sendSuccess(res, pricing, 201);
  } catch (err) {
    next(err);
  }
}

// ── Update Package Pricing ─────────────────────────────────────
export async function updatePackagePricing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    const { pricingId } = req.params;
    
    // ADMIN_CABANG can only update pricing for their branch
    if (user.role === 'ADMIN_CABANG' && user.branchId) {
      const existingPricing = await adminService.getPackagePricing(pricingId);
      if (existingPricing.branchId !== user.branchId) {
        throw {
          status: 403,
          code: 'FORBIDDEN',
          message: 'Anda tidak memiliki akses untuk mengubah harga paket ini',
        };
      }
    }
    
    const pricing = await adminService.updatePackagePricing(pricingId, req.body);
    sendSuccess(res, pricing);
  } catch (err) {
    next(err);
  }
}

// ── Delete Package Pricing ─────────────────────────────────────
export async function deletePackagePricing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    const { pricingId } = req.params;
    
    // ADMIN_CABANG can only delete pricing for their branch
    if (user.role === 'ADMIN_CABANG' && user.branchId) {
      const existingPricing = await adminService.getPackagePricing(pricingId);
      if (existingPricing.branchId !== user.branchId) {
        throw {
          status: 403,
          code: 'FORBIDDEN',
          message: 'Anda tidak memiliki akses untuk menghapus harga paket ini',
        };
      }
    }
    
    const result = await adminService.deletePackagePricing(pricingId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// ══════════════════════════════════════════════════════════════
// USER MANAGEMENT (ADMIN MANAGER)
// ══════════════════════════════════════════════════════════════

// ── Create Admin Manager ───────────────────────────────────────
export async function createAdminManager(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await adminService.createAdminManager(req.body);
    sendSuccess(res, user, 201);
  } catch (err) {
    next(err);
  }
}

// ── Get All Users with Filters ─────────────────────────────────
export async function getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = {
      role: req.query.role ? (req.query.role as Role) : undefined,
      branchId: req.query.branchId as string | undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await adminService.getAllUsers(filters);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// ══════════════════════════════════════════════════════════════
// NON-THERAPY PRODUCT (ADD-ON) MANAGEMENT
// ══════════════════════════════════════════════════════════════

import { NonTherapyProductAdminService } from './services/non-therapy-product-admin.service';
const nonTherapyProductService = new NonTherapyProductAdminService();

import { MasterTypesAdminService } from './services/master-types-admin.service';
const masterTypesService = new MasterTypesAdminService();

import { ImpersonationService } from './services/impersonation.service';
const impersonationService = new ImpersonationService();

// ── Get All Non-Therapy Products ──────────────────────────────
export async function getAllNonTherapyProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productType, isActive, page, limit } = req.query;
    
    const filters = {
      productType: productType as ProductType | undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
    };

    const result = await nonTherapyProductService.getAllProducts(filters);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// ── Get Non-Therapy Product by ID ─────────────────────────────
export async function getNonTherapyProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productId } = req.params;
    const product = await nonTherapyProductService.getProduct(productId);
    sendSuccess(res, product);
  } catch (err) {
    next(err);
  }
}

// ── Create Non-Therapy Product ────────────────────────────────
export async function createNonTherapyProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await nonTherapyProductService.createProduct(req.body);
    sendSuccess(res, product, 201);
  } catch (err) {
    next(err);
  }
}

// ── Update Non-Therapy Product ────────────────────────────────
export async function updateNonTherapyProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productId } = req.params;
    const product = await nonTherapyProductService.updateProduct(productId, req.body);
    sendSuccess(res, product);
  } catch (err) {
    next(err);
  }
}

// ── Delete Non-Therapy Product ────────────────────────────────
export async function deleteNonTherapyProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productId } = req.params;
    const result = await nonTherapyProductService.deleteProduct(productId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}


// ══════════════════════════════════════════════════════════════
// MASTER TYPES MANAGEMENT (BOOSTER & SERVICE TYPES)
// ══════════════════════════════════════════════════════════════

// ── Get All Booster Types ──────────────────────────────────────
export async function getAllBoosterTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { isActive } = req.query;
    const filters = {
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    };
    const types = await masterTypesService.getAllBoosterTypes(filters);
    sendSuccess(res, { types });
  } catch (err) {
    next(err);
  }
}

// ── Create Booster Type ────────────────────────────────────────
export async function createBoosterType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const type = await masterTypesService.createBoosterType(req.body);
    sendSuccess(res, type, 201);
  } catch (err) {
    next(err);
  }
}

// ── Update Booster Type ────────────────────────────────────────
export async function updateBoosterType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { typeId } = req.params;
    const type = await masterTypesService.updateBoosterType(typeId, req.body);
    sendSuccess(res, type);
  } catch (err) {
    next(err);
  }
}

// ── Delete Booster Type ────────────────────────────────────────
export async function deleteBoosterType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { typeId } = req.params;
    const result = await masterTypesService.deleteBoosterType(typeId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// ── Get All Service Types ──────────────────────────────────────
export async function getAllServiceTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { isActive } = req.query;
    const filters = {
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    };
    const types = await masterTypesService.getAllServiceTypes(filters);
    sendSuccess(res, { types });
  } catch (err) {
    next(err);
  }
}

// ── Create Service Type ────────────────────────────────────────
export async function createServiceType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const type = await masterTypesService.createServiceType(req.body);
    sendSuccess(res, type, 201);
  } catch (err) {
    next(err);
  }
}

// ── Update Service Type ────────────────────────────────────────
export async function updateServiceType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { typeId } = req.params;
    const type = await masterTypesService.updateServiceType(typeId, req.body);
    sendSuccess(res, type);
  } catch (err) {
    next(err);
  }
}

// ── Delete Service Type ────────────────────────────────────────
export async function deleteServiceType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { typeId } = req.params;
    const result = await masterTypesService.deleteServiceType(typeId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}


// ══════════════════════════════════════════════════════════
// MASTER PRODUCT MANAGEMENT (SUPER_ADMIN only)
// ══════════════════════════════════════════════════════════

/**
 * Get all master products
 * GET /admin/master-products
 */
export async function getAllMasterProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { category, isActive, search, page, limit } = req.query;

    const result = await adminService.getAllMasterProducts({
      category: category as ProductCategory | undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search: search as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get master product by ID
 * GET /admin/master-products/:id
 */
export async function getMasterProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const result = await adminService.getMasterProduct(id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Create master product
 * POST /admin/master-products
 */
export async function createMasterProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sku, name, category, baseUnit, usageUnit, conversionFactor, description } = req.body;
    const userId = req.user.userId;

    const result = await adminService.createMasterProduct(
      {
        sku,
        name,
        category,
        baseUnit,
        usageUnit,
        conversionFactor: parseFloat(conversionFactor),
        description,
      },
      userId
    );

    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Update master product
 * PUT /admin/master-products/:id
 */
export async function updateMasterProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { sku, name, category, baseUnit, usageUnit, conversionFactor, description, isActive } = req.body;
    const userId = req.user.userId;

    const result = await adminService.updateMasterProduct(
      id,
      {
        sku,
        name,
        category,
        baseUnit,
        usageUnit,
        conversionFactor: conversionFactor !== undefined ? parseFloat(conversionFactor) : undefined,
        description,
        isActive,
      },
      userId
    );

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Delete master product
 * DELETE /admin/master-products/:id
 */
export async function deleteMasterProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await adminService.deleteMasterProduct(id, userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get product categories
 * GET /admin/master-products/categories
 */
export async function getProductCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await adminService.getProductCategories();
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// ══════════════════════════════════════════════════════════
// IMPERSONATION SYSTEM
// ══════════════════════════════════════════════════════════

/**
 * Get Admin Managers (for Super Admin)
 * GET /admin/managers
 */
export async function getAdminManagers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, isActive, page, limit } = req.query;

    const result = await impersonationService.getAdminManagers({
      search: search as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get Admin Manager Detail (for Super Admin)
 * GET /admin/managers/:managerId
 */
export async function getAdminManagerDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { managerId } = req.params;

    // Get manager with branches
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      include: {
        profile: true,
        managedBranches: {
          include: {
            branch: {
              select: {
                id: true,
                branchCode: true,
                name: true,
                city: true,
                type: true,
                isActive: true,
              }
            }
          }
        }
      }
    });

    if (!manager || manager.role !== 'ADMIN_MANAGER') {
      throw {
        status: 404,
        code: 'MANAGER_NOT_FOUND',
        message: 'Admin Manager tidak ditemukan'
      };
    }

    const result = {
      id: manager.id,
      email: manager.email,
      fullName: manager.profile?.fullName || manager.email,
      phoneNumber: manager.profile?.phone || '',
      adminManagerAccessScope: manager.adminManagerAccessScope,
      isActive: manager.isActive,
      createdAt: manager.createdAt,
      lastLoginAt: manager.lastLoginAt,
      branches: manager.managedBranches.map(mb => ({
        ...mb.branch,
        accessScope: mb.accessScope,
        assignedAt: mb.createdAt,
      }))
    };

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Update Admin Manager (for Super Admin)
 * PUT /admin/managers/:managerId
 */
export async function updateAdminManager(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { managerId } = req.params;
    const { email, password, fullName, phoneNumber, adminManagerAccessScope, isActive } = req.body;
    const currentUserId = req.user.userId;

    const result = await adminService.updateAdminManager(managerId, {
      email,
      password,
      fullName,
      phoneNumber,
      adminManagerAccessScope,
      isActive,
    }, currentUserId);

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Convert Admin Manager into Admin Logistik or Finance & Logistics.
 * POST /admin/managers/:managerId/convert-role
 */
export async function convertAdminManagerRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { managerId } = req.params;
    const { targetRole } = req.body as ConvertAdminManagerRoleInput;
    const currentUserId = req.user.userId;

    const result = await adminService.convertAdminManagerRole(
      managerId,
      targetRole,
      currentUserId,
    );

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Delete Admin Manager (for Super Admin)
 * DELETE /admin/managers/:managerId
 */
export async function deleteAdminManager(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { managerId } = req.params;
    const currentUserId = req.user.userId;

    const result = await adminService.deleteAdminManager(managerId, currentUserId);

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get available branches for a manager (branches not yet assigned)
 * GET /admin/managers/:managerId/available-branches
 */
export async function getAvailableBranchesForManager(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { managerId } = req.params;

    // Verify manager exists
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true, role: true }
    });

    if (!manager || manager.role !== 'ADMIN_MANAGER') {
      throw {
        status: 404,
        code: 'MANAGER_NOT_FOUND',
        message: 'Admin Manager tidak ditemukan'
      };
    }

    // Get branches already assigned to this manager
    const assignedBranches = await prisma.managerBranch.findMany({
      where: { userId: managerId },
      select: { branchId: true }
    });
    const assignedBranchIds = assignedBranches.map(mb => mb.branchId);

    // Get all active branches not assigned to this manager
    // Exclude External/System branch (EXT)
    const availableBranches = await prisma.branch.findMany({
      where: {
        isActive: true,
        branchCode: { not: 'EXT' }, // Exclude External/System branch
        id: { notIn: assignedBranchIds }
      },
      select: {
        id: true,
        branchCode: true,
        name: true,
        city: true,
        type: true,
        isActive: true,
      },
      orderBy: [
        { type: 'desc' }, // PUSAT first
        { name: 'asc' }
      ]
    });

    sendSuccess(res, availableBranches);
  } catch (err) {
    next(err);
  }
}

/**
 * Assign branch to manager
 * POST /admin/managers/:managerId/branches
 */
export async function assignBranchToManager(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { managerId } = req.params;
    const { branchId } = req.body;
    const accessScope = parseAdminManagerAccessScope(req.body.accessScope);
    const currentUserId = req.user.userId;

    if (!branchId) {
      throw {
        status: 400,
        code: 'BRANCH_ID_REQUIRED',
        message: 'branchId harus diisi'
      };
    }

    // Verify manager exists
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true, role: true, email: true }
    });

    if (!manager || manager.role !== 'ADMIN_MANAGER') {
      throw {
        status: 404,
        code: 'MANAGER_NOT_FOUND',
        message: 'Admin Manager tidak ditemukan'
      };
    }

    // Verify branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, branchCode: true, isActive: true }
    });

    if (!branch) {
      throw {
        status: 404,
        code: 'BRANCH_NOT_FOUND',
        message: 'Cabang tidak ditemukan'
      };
    }

    if (!branch.isActive) {
      throw {
        status: 422,
        code: 'BRANCH_INACTIVE',
        message: 'Cabang tidak aktif'
      };
    }

    // Check if already assigned
    const existingAssignment = await prisma.managerBranch.findFirst({
      where: { userId: managerId, branchId }
    });

    if (existingAssignment) {
      throw {
        status: 422,
        code: 'ALREADY_ASSIGNED',
        message: 'Cabang sudah di-assign ke manager ini'
      };
    }

    // Create assignment
    const assignment = await prisma.managerBranch.create({
      data: {
        userId: managerId,
        branchId,
        accessScope,
      },
      include: {
        branch: {
          select: {
            id: true,
            branchCode: true,
            name: true,
            city: true,
            type: true,
            isActive: true,
          }
        }
      }
    });

    // Audit log
    const { logAudit } = await import('@utils/auditLog');
    await logAudit({
      userId: currentUserId,
      branchId: branchId,
      action: AuditAction.CREATE,
      resource: 'ManagerBranch',
      resourceId: `${managerId}_${branchId}`,
      meta: { 
        action: 'assign_branch_to_manager', 
        managerId, 
        managerEmail: manager.email,
        branchId, 
        branchName: branch.name,
        accessScope,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    sendSuccess(res, {
      message: `Cabang ${branch.name} berhasil di-assign ke manager`,
      branch: {
        ...assignment.branch,
        accessScope: assignment.accessScope,
        assignedAt: assignment.createdAt,
      }
    }, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Update branch assignment scope for manager
 * PATCH /admin/managers/:managerId/branches/:branchId
 */
export async function updateManagerBranchAccessScope(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { managerId, branchId } = req.params;
    const accessScope = parseAdminManagerAccessScope(req.body.accessScope);
    const currentUserId = req.user.userId;

    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true, role: true, email: true },
    });

    if (!manager || manager.role !== 'ADMIN_MANAGER') {
      throw {
        status: 404,
        code: 'MANAGER_NOT_FOUND',
        message: 'Admin Manager tidak ditemukan'
      };
    }

    const existingAssignment = await prisma.managerBranch.findUnique({
      where: {
        userId_branchId: {
          userId: managerId,
          branchId,
        },
      },
      include: {
        branch: {
          select: {
            id: true,
            branchCode: true,
            name: true,
            city: true,
            type: true,
            isActive: true,
          },
        },
      },
    });

    if (!existingAssignment) {
      throw {
        status: 404,
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'Cabang tidak di-assign ke manager ini'
      };
    }

    const updatedAssignment = await prisma.managerBranch.update({
      where: { id: existingAssignment.id },
      data: { accessScope },
      include: {
        branch: {
          select: {
            id: true,
            branchCode: true,
            name: true,
            city: true,
            type: true,
            isActive: true,
          },
        },
      },
    });

    const { logAudit } = await import('@utils/auditLog');
    await logAudit({
      userId: currentUserId,
      branchId,
      action: AuditAction.UPDATE,
      resource: 'ManagerBranch',
      resourceId: `${managerId}_${branchId}`,
      meta: {
        action: 'update_manager_branch_access_scope',
        managerId,
        managerEmail: manager.email,
        branchId,
        branchName: existingAssignment.branch.name,
        accessScope: {
          from: existingAssignment.accessScope,
          to: accessScope,
        },
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, {
      message: `Akses cabang ${existingAssignment.branch.name} berhasil diperbarui`,
      branch: {
        ...updatedAssignment.branch,
        accessScope: updatedAssignment.accessScope,
        assignedAt: updatedAssignment.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Unassign branch from manager
 * DELETE /admin/managers/:managerId/branches/:branchId
 */
export async function unassignBranchFromManager(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { managerId, branchId } = req.params;
    const currentUserId = req.user.userId;

    // Verify manager exists
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true, role: true, email: true }
    });

    if (!manager || manager.role !== 'ADMIN_MANAGER') {
      throw {
        status: 404,
        code: 'MANAGER_NOT_FOUND',
        message: 'Admin Manager tidak ditemukan'
      };
    }

    // Verify branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true }
    });

    if (!branch) {
      throw {
        status: 404,
        code: 'BRANCH_NOT_FOUND',
        message: 'Cabang tidak ditemukan'
      };
    }

    // Check if assignment exists
    const existingAssignment = await prisma.managerBranch.findFirst({
      where: { userId: managerId, branchId }
    });

    if (!existingAssignment) {
      throw {
        status: 404,
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'Cabang tidak di-assign ke manager ini'
      };
    }

    // Delete assignment
    await prisma.managerBranch.delete({
      where: { id: existingAssignment.id }
    });

    // Audit log
    const { logAudit } = await import('@utils/auditLog');
    await logAudit({
      userId: currentUserId,
      branchId: branchId,
      action: AuditAction.DELETE,
      resource: 'ManagerBranch',
      resourceId: `${managerId}_${branchId}`,
      meta: { 
        action: 'unassign_branch_from_manager', 
        managerId, 
        managerEmail: manager.email,
        branchId, 
        branchName: branch.name 
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    sendSuccess(res, {
      message: `Cabang ${branch.name} berhasil di-unassign dari manager`
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Branch Admins (for Admin Manager)
 * GET /admin/branch-admins
 */
export async function getBranchAdmins(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    const { branchId, search, isActive, page, limit } = req.query;

    // Get manager's branch IDs
    let managerBranchIds: string[];
    
    if (user.branches) {
      // Already impersonating Admin Manager or is Admin Manager
      managerBranchIds = user.branches;
    } else if (user.role === 'ADMIN_MANAGER') {
      // Get branches from database
      const managerBranches = await prisma.managerBranch.findMany({
        where: { userId: user.id },
        select: { branchId: true }
      });
      managerBranchIds = managerBranches.map(mb => mb.branchId);
    } else {
      throw {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Hanya Admin Manager yang dapat mengakses endpoint ini'
      };
    }

    const result = await impersonationService.getBranchAdmins(managerBranchIds, {
      branchId: branchId as string,
      search: search as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * Start Impersonation
 * POST /admin/impersonate/:userId
 */
export async function startImpersonation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    const { userId } = req.params;

    console.log('🎭 [startImpersonation] Request received:', {
      currentUserId: user.id,
      currentUserEmail: user.email,
      currentUserRole: user.role,
      targetUserId: userId,
      hasBranchId: !!user.branchId,
      branchId: user.branchId
    });

    // Get current token payload (may include existing impersonation)
    const authHeader = req.headers.authorization;
    const token = authHeader?.slice(7);
    
    let currentToken;
    if (token) {
      const { verifyAccessToken } = await import('@lib/jwt');
      currentToken = verifyAccessToken(token);
      console.log('🎭 [startImpersonation] Current token decoded:', {
        userId: currentToken.userId,
        role: currentToken.role,
        isImpersonating: !!currentToken.impersonating
      });
    }

    console.log('🎭 [startImpersonation] Calling impersonationService.createImpersonationToken...');
    const result = await impersonationService.createImpersonationToken(
      user.id,
      userId,
      currentToken
    );

    console.log('🎭 [startImpersonation] Impersonation successful:', {
      targetUserId: result.targetUser.id,
      targetUserEmail: result.targetUser.email,
      targetUserRole: result.targetUser.role,
      tokenGenerated: !!result.token
    });

    // Log impersonation start
    const { logAudit } = await import('@utils/auditLog');
    await logAudit({
      userId: user.id,
      branchId: user.branchId,
      action: AuditAction.LOGIN, // Using LOGIN as proxy for IMPERSONATE_START
      resource: 'Impersonation',
      resourceId: userId,
      meta: {
        type: 'IMPERSONATE_START',
        targetUser: result.targetUser.email,
        targetRole: result.targetUser.role,
        isNested: !!currentToken?.impersonating
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    console.log('🎭 [startImpersonation] Audit log created, sending response');
    sendSuccess(res, result);
  } catch (err) {
    console.error('❌ [startImpersonation] Error occurred:', {
      message: err.message,
      code: err.code,
      status: err.status,
      stack: err.stack
    });
    next(err);
  }
}

/**
 * Stop Impersonation
 * POST /admin/stop-impersonation
 */
export async function stopImpersonation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;

    // Get current token payload
    const authHeader = req.headers.authorization;
    const token = authHeader?.slice(7);
    
    if (!token) {
      throw {
        status: 401,
        code: 'AUTH_TOKEN_MISSING',
        message: 'Token autentikasi diperlukan'
      };
    }

    const { verifyAccessToken } = await import('@lib/jwt');
    const currentToken = verifyAccessToken(token);

    const result = await impersonationService.stopImpersonation(currentToken);

    // Log impersonation stop
    const { logAudit } = await import('@utils/auditLog');
    await logAudit({
      userId: currentToken.userId, // Original user
      branchId: currentToken.branchId,
      action: AuditAction.LOGOUT, // Using LOGOUT as proxy for IMPERSONATE_STOP
      resource: 'Impersonation',
      resourceId: user.id,
      meta: {
        type: 'IMPERSONATE_STOP',
        impersonatedUser: currentToken.impersonating?.email,
        impersonatedRole: currentToken.impersonating?.role
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
