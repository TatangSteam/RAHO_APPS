import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import {
  exportAuditLogs,
  getAuditLogDetail,
  getAuditLogs,
  getAuditLogStats,
} from './audit.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get audit logs (Super Admin: all, Admin Manager: managed branches only)
router.get(
  '/',
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN']),
  getAuditLogs
);

// Export audit logs as CSV
router.get(
  '/export',
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN']),
  exportAuditLogs
);

// Get audit log statistics
router.get(
  '/stats',
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN']),
  getAuditLogStats
);

// Get audit log detail
router.get(
  '/:id',
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN']),
  getAuditLogDetail
);

export default router;
