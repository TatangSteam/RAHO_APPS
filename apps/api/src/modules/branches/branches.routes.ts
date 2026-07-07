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
  forceDeleteBranch,
  getBranchManagers,
  getBranchSessions,
  assignManagerToBranch,
  unassignManagerFromBranch,
  getAvailableManagersForBranch,
} from './branches.controller';
import {
  getSystemStats,
  getSystemHealth,
  getRecentActivities,
  getBranchPerformance,
  getAuditLogs,
} from '../admin/admin.controller';
import { MembersController } from '../members/members.controller';
import { listBranchStaff } from '../users/users.controller';

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
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG, Role.ADMIN_LAYANAN]),
  getAllBranchesWithStats,
);

// ── Get Branch Members (must be before /:branchId) ────────────
branchesRouter.get(
  '/:branchId/members',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  membersController.getMembersByBranch.bind(membersController),
);

// ── Get Branch Staff ──────────────────────────────────────────
branchesRouter.get(
  '/:branchId/staff',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  listBranchStaff,
);

// ── Get Available Managers for Branch (not yet assigned) ──────
// NOTE: This route MUST be before /:branchId/managers to avoid route conflict
branchesRouter.get(
  '/:branchId/managers/available',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  getAvailableManagersForBranch,
);

// ── Get Branch Managers (Admin Managers assigned to this branch) ──
branchesRouter.get(
  '/:branchId/managers',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  getBranchManagers,
);

// ── Get Branch Sessions (Therapy Sessions in branch) ──────────
branchesRouter.get(
  '/:branchId/sessions',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG]),
  getBranchSessions,
);

// ── Assign Manager to Branch ──────────────────────────────────
branchesRouter.post(
  '/:branchId/managers',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  assignManagerToBranch,
);

// ── Unassign Manager from Branch ──────────────────────────────
branchesRouter.delete(
  '/:branchId/managers/:managerId',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  unassignManagerFromBranch,
);

// ── Get Single Branch ─────────────────────────────────────────
branchesRouter.get(
  '/:branchId',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG]),
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

// ── Force Delete Branch (SUPER_ADMIN ONLY - deletes ALL data) ─
// ⚠️ DANGEROUS: Must come BEFORE /:branchId route
branchesRouter.delete(
  '/:branchId/force',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  forceDeleteBranch,
);

// ── Delete Branch Permanently (Super Admin only) ──────────────
branchesRouter.delete(
  '/:branchId',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  deleteBranch,
);
