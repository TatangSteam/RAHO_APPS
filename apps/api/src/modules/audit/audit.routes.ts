import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
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
  getAuditLogs
);

// Export audit logs as CSV
router.get(
  '/export',
  exportAuditLogs
);

// Get audit log statistics
router.get(
  '/stats',
  getAuditLogStats
);

// Get audit log detail
router.get(
  '/:id',
  getAuditLogDetail
);

export default router;
