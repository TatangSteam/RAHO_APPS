import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { sendSuccess } from '@utils/response';
import { Role, PackageType, AuditAction } from '@prisma/client';

const adminService = new AdminService();

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
    const filters = {
      branchId: req.query.branchId as string | undefined,
      packageType: req.query.packageType ? (req.query.packageType as PackageType) : undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

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
    const pricing = await adminService.createPackagePricing(req.body);
    sendSuccess(res, pricing, 201);
  } catch (err) {
    next(err);
  }
}

// ── Update Package Pricing ─────────────────────────────────────
export async function updatePackagePricing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { pricingId } = req.params;
    const pricing = await adminService.updatePackagePricing(pricingId, req.body);
    sendSuccess(res, pricing);
  } catch (err) {
    next(err);
  }
}

// ── Delete Package Pricing ─────────────────────────────────────
export async function deletePackagePricing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { pricingId } = req.params;
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
