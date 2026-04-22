import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { getAuditLogs, getAuditLogStats } from './audit.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get audit logs (Admin Cabang and above)
router.get(
  '/',
  authorize(['ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  getAuditLogs
);

// Get audit log statistics
router.get(
  '/stats',
  authorize(['ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  getAuditLogStats
);

export default router;
