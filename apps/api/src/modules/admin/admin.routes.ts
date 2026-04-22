import { Router } from 'express';
import {
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
  createAdminManager,
  getAllUsers,
} from './admin.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import {
  createPackagePricingSchema,
  updatePackagePricingSchema,
  createAdminManagerSchema,
} from './admin.schema';

const router = Router();

// Apply authentication to all admin routes
router.use(authenticate);

// ============================================================
// SUPER ADMIN ROUTES
// ============================================================

// ── System Management ──────────────────────────────────────

// System Statistics
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
  authorize(['SUPER_ADMIN']),
  getAllPackagePricing
);

// Get single package pricing
router.get('/package-pricing/:pricingId',
  authorize(['SUPER_ADMIN']),
  getPackagePricing
);

// Create package pricing
router.post('/package-pricing',
  authorize(['SUPER_ADMIN']),
  validate(createPackagePricingSchema),
  createPackagePricing
);

// Update package pricing
router.patch('/package-pricing/:pricingId',
  authorize(['SUPER_ADMIN']),
  validate(updatePackagePricingSchema),
  updatePackagePricing
);

// Delete package pricing
router.delete('/package-pricing/:pricingId',
  authorize(['SUPER_ADMIN']),
  deletePackagePricing
);

// ── User Management ────────────────────────────────────────

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

export { router as adminRoutes };