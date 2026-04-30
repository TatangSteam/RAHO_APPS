import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { sendSuccess } from '@utils/response';
import { Role, PackageType, AuditAction } from '@prisma/client';
import { prisma } from '@lib/prisma';

const adminService = new AdminService();

// ── Get Branches for Admin Manager ────────────────────────────
export async function getBranches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    
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
      
      branches = managerBranches.map(mb => mb.branch);
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
    console.log('🔍 [getBranches] Branch names:', branches.map((b: any) => b.name));
    
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
    const user = (req as any).user;
    
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
    const user = (req as any).user;
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
    const user = (req as any).user;
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
    const user = (req as any).user;
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

// ── Get All Non-Therapy Products ──────────────────────────────
export async function getAllNonTherapyProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productType, isActive, page, limit } = req.query;
    
    const filters = {
      productType: productType as any,
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
