import { Router } from 'express';
import {
  getBranches,
  getSystemStats,
  getSystemHealth,
  getRecentActivities,
  getBranchPerformance,
  getAuditLogs,
  getAllPackagePricing,
  getPackagePricing,
  createPackagePricing,
  updatePackagePricing,
  deletePackagePricing,
  getAllNonTherapyProducts,
  getNonTherapyProduct,
  createNonTherapyProduct,
  updateNonTherapyProduct,
  deleteNonTherapyProduct,
  getAllBoosterTypes,
  createBoosterType,
  updateBoosterType,
  deleteBoosterType,
  getAllServiceTypes,
  createServiceType,
  updateServiceType,
  deleteServiceType,
  createAdminManager,
  updateAdminManager,
  deleteAdminManager,
  getAllUsers,
  getAllMasterProducts,
  getMasterProduct,
  createMasterProduct,
  updateMasterProduct,
  deleteMasterProduct,
  getProductCategories,
  getAdminManagers,
  getAdminManagerDetail,
  getAvailableBranchesForManager,
  assignBranchToManager,
  updateManagerBranchAccessScope,
  unassignBranchFromManager,
  getBranchAdmins,
  startImpersonation,
  stopImpersonation,
} from './admin.controller';
import { getAllDoctors } from '../users/users.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { uploadSpreadsheet } from '../../middleware/upload';
import { validate, validateQuery, validateParams } from '../../middleware/validate';
import {
  dryRunMemberHistoricalImport,
  executeMemberHistoricalImport,
} from './member-historical-import.controller';
import {
  createPackagePricingSchema,
  updatePackagePricingSchema,
  createNonTherapyProductSchema,
  updateNonTherapyProductSchema,
  createAdminManagerSchema,
  getAdminManagersQuerySchema,
  getBranchAdminsQuerySchema,
  impersonateUserParamsSchema,
} from './admin.schema';

const router = Router();

// Apply authentication to all admin routes
router.use(authenticate);

// ============================================================
// BRANCH MANAGEMENT
// ============================================================

// Get branches for admin manager (multi-branch access)
router.get('/branches',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG']),
  getBranches
);

// Historical member import from RAHO Excel template
router.post('/member-import/dry-run',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER']),
  uploadSpreadsheet.single('file'),
  dryRunMemberHistoricalImport
);

router.post('/member-import/execute',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER']),
  uploadSpreadsheet.single('file'),
  executeMemberHistoricalImport
);

// ============================================================
// SUPER ADMIN ROUTES
// ============================================================

// ── System Management ──────────────────────────────────────

// System Statistics (Super Admin Dashboard)
router.get('/system-stats', 
  authorize(['SUPER_ADMIN']), 
  getSystemStats
);

// System Statistics (alternative route)
router.get('/system/stats', 
  authorize(['SUPER_ADMIN']), 
  getSystemStats
);

// System Health
router.get('/system/health', 
  authorize(['SUPER_ADMIN']), 
  getSystemHealth
);

// Recent Activities
router.get('/system/activities', 
  authorize(['SUPER_ADMIN']), 
  getRecentActivities
);

// Branch Performance
router.get('/system/performance', 
  authorize(['SUPER_ADMIN']), 
  getBranchPerformance
);

// Audit Logs
router.get('/system/audit-logs', 
  authorize(['SUPER_ADMIN']), 
  getAuditLogs
);

// ── Package Pricing Management ─────────────────────────────

// Get all package pricing (with filters)
router.get('/package-pricing',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG']),
  getAllPackagePricing
);

// Get single package pricing
router.get('/package-pricing/:pricingId',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG']),
  getPackagePricing
);

// Create package pricing
router.post('/package-pricing',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG']),
  validate(createPackagePricingSchema),
  createPackagePricing
);

// Update package pricing
router.patch('/package-pricing/:pricingId',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG']),
  validate(updatePackagePricingSchema),
  updatePackagePricing
);

// Delete package pricing
router.delete('/package-pricing/:pricingId',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG']),
  deletePackagePricing
);

// ── Non-Therapy Product (Add-on) Management ────────────────

// Get all non-therapy products
router.get('/non-therapy-products',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG']),
  getAllNonTherapyProducts
);

// Get single non-therapy product
router.get('/non-therapy-products/:productId',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG']),
  getNonTherapyProduct
);

// Create non-therapy product
router.post('/non-therapy-products',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER']),
  validate(createNonTherapyProductSchema),
  createNonTherapyProduct
);

// Update non-therapy product
router.patch('/non-therapy-products/:productId',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER']),
  validate(updateNonTherapyProductSchema),
  updateNonTherapyProduct
);

// Delete non-therapy product
router.delete('/non-therapy-products/:productId',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER']),
  deleteNonTherapyProduct
);

// ── User Management ────────────────────────────────────────

// Get all doctors (Super Admin only)
router.get('/doctors',
  authorize(['SUPER_ADMIN']),
  getAllDoctors
);

// Create Admin Manager
router.post('/users/admin-manager',
  authorize(['SUPER_ADMIN']),
  validate(createAdminManagerSchema),
  createAdminManager
);

// Get all users (with filters by role, branch, etc.)
router.get('/users',
  authorize(['SUPER_ADMIN']),
  getAllUsers
);

// ── Master Product Management ──────────────────────────────

// Get product categories
router.get('/master-products/categories',
  authorize(['SUPER_ADMIN']),
  getProductCategories
);

// Get all master products
router.get('/master-products',
  authorize(['SUPER_ADMIN']),
  getAllMasterProducts
);

// Get single master product
router.get('/master-products/:id',
  authorize(['SUPER_ADMIN']),
  getMasterProduct
);

// Create master product
router.post('/master-products',
  authorize(['SUPER_ADMIN']),
  createMasterProduct
);

// Update master product
router.put('/master-products/:id',
  authorize(['SUPER_ADMIN']),
  updateMasterProduct
);

// Delete master product
router.delete('/master-products/:id',
  authorize(['SUPER_ADMIN']),
  deleteMasterProduct
);

// ── Master Types Management ────────────────────────────────────

// Booster Types
router.get('/master/booster-types',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG']),
  getAllBoosterTypes
);

router.post('/master/booster-types',
  authorize(['SUPER_ADMIN', 'ADMIN_CABANG']),
  createBoosterType
);

router.patch('/master/booster-types/:typeId',
  authorize(['SUPER_ADMIN', 'ADMIN_CABANG']),
  updateBoosterType
);

router.delete('/master/booster-types/:typeId',
  authorize(['SUPER_ADMIN']),
  deleteBoosterType
);

// Service Types
router.get('/master/service-types',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG']),
  getAllServiceTypes
);

router.post('/master/service-types',
  authorize(['SUPER_ADMIN', 'ADMIN_CABANG']),
  createServiceType
);

router.patch('/master/service-types/:typeId',
  authorize(['SUPER_ADMIN', 'ADMIN_CABANG']),
  updateServiceType
);

router.delete('/master/service-types/:typeId',
  authorize(['SUPER_ADMIN']),
  deleteServiceType
);

// ============================================================
// IMPERSONATION SYSTEM
// ============================================================

// Get Admin Managers (Super Admin only)
router.get('/managers',
  authorize(['SUPER_ADMIN']),
  validateQuery(getAdminManagersQuerySchema),
  getAdminManagers
);

// Get available branches for a manager (Super Admin only)
router.get('/managers/:managerId/available-branches',
  authorize(['SUPER_ADMIN']),
  getAvailableBranchesForManager
);

// Assign branch to manager (Super Admin only)
router.post('/managers/:managerId/branches',
  authorize(['SUPER_ADMIN']),
  assignBranchToManager
);

// Update branch assignment scope (Super Admin only)
router.patch('/managers/:managerId/branches/:branchId',
  authorize(['SUPER_ADMIN']),
  updateManagerBranchAccessScope
);

// Unassign branch from manager (Super Admin only)
router.delete('/managers/:managerId/branches/:branchId',
  authorize(['SUPER_ADMIN']),
  unassignBranchFromManager
);

// Get Admin Manager Detail (Super Admin only) - MUST be after /managers
router.get('/managers/:managerId',
  authorize(['SUPER_ADMIN']),
  getAdminManagerDetail
);

// Update Admin Manager (Super Admin only)
router.put('/managers/:managerId',
  authorize(['SUPER_ADMIN']),
  updateAdminManager
);

// Delete Admin Manager (Super Admin only)
router.delete('/managers/:managerId',
  authorize(['SUPER_ADMIN']),
  deleteAdminManager
);

// Get Branch Admins (Admin Manager only)
router.get('/branch-admins',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER']),
  validateQuery(getBranchAdminsQuerySchema),
  getBranchAdmins
);

// Start Impersonation (Super Admin or Admin Manager)
router.post('/impersonate/:userId',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER']),
  validateParams(impersonateUserParamsSchema),
  startImpersonation
);

// Stop Impersonation
router.post('/stop-impersonation',
  authenticate, // Only authenticate, no specific role check
  stopImpersonation
);


export { router as adminRoutes };
