import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { Role } from '@prisma/client';
import {
  listBranches,
  getAllBranchesWithStats,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch,
} from './branches.controller';
import {
  getSystemStats,
  getSystemHealth,
  getRecentActivities,
  getBranchPerformance,
  getAuditLogs,
} from '../admin/admin.controller';
import { MembersController } from '../members/members.controller';

export const branchesRouter = Router();

const membersController = new MembersController();

// ══════════════════════════════════════════════════════════════
// SUPER ADMIN ENDPOINTS
// ══════════════════════════════════════════════════════════════

// ── Get System Statistics ─────────────────────────────────────
branchesRouter.get(
  '/system/stats',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  getSystemStats,
);

// ── Get System Health ─────────────────────────────────────────
branchesRouter.get(
  '/system/health',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  getSystemHealth,
);

// ── Get Recent Activities ─────────────────────────────────────
branchesRouter.get(
  '/system/activities',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  getRecentActivities,
);

// ── Get Branch Performance ────────────────────────────────────
branchesRouter.get(
  '/system/performance',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  getBranchPerformance,
);

// ── Get Audit Logs ────────────────────────────────────────────
branchesRouter.get(
  '/system/audit-logs',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  getAuditLogs,
);

// ══════════════════════════════════════════════════════════════
// BRANCH MANAGEMENT ENDPOINTS
// ══════════════════════════════════════════════════════════════

// ── List Branches (with pagination) ───────────────────────────
branchesRouter.get(
  '/',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  listBranches,
);

// ── Get All Branches with Stats ───────────────────────────────
branchesRouter.get(
  '/all',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  getAllBranchesWithStats,
);

// ── Get Branch Members (must be before /:branchId) ────────────
branchesRouter.get(
  '/:branchId/members',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  membersController.getMembersByBranch.bind(membersController),
);

// ── Get Single Branch ─────────────────────────────────────────
branchesRouter.get(
  '/:branchId',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  getBranch,
);

// ── Create Branch ─────────────────────────────────────────────
branchesRouter.post(
  '/',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  createBranch,
);

// ── Update Branch ─────────────────────────────────────────────
branchesRouter.patch(
  '/:branchId',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  updateBranch,
);

// ── Delete Branch (Soft Delete) ───────────────────────────────
branchesRouter.delete(
  '/:branchId',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  deleteBranch,
);
