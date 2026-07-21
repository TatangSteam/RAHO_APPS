import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { Role } from '@prisma/client';
import { requirePermission } from '@middleware/requirePermission';
import { requireBranchAccess } from '@middleware/requireBranchAccess';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
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
  updateManagerBranchAccessScope,
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
  listBranches,
);

// ── Get All Branches with Stats ───────────────────────────────
branchesRouter.get(
  '/all',
  authenticate,
  getAllBranchesWithStats,
);

// ── Get Branch Members (must be before /:branchId) ────────────
branchesRouter.get(
  '/:branchId/members',
  authenticate,
  requirePermission(PERMISSIONS.IAM_USER_READ),
  requireBranchAccess,
  membersController.getMembersByBranch.bind(membersController),
);

// ── Get Branch Staff ──────────────────────────────────────────
branchesRouter.get(
  '/:branchId/staff',
  authenticate,
  requirePermission(PERMISSIONS.IAM_USER_READ),
  requireBranchAccess,
  listBranchStaff,
);

// ── Get Available Managers for Branch (not yet assigned) ──────
// NOTE: This route MUST be before /:branchId/managers to avoid route conflict
branchesRouter.get(
  '/:branchId/managers/available',
  authenticate,
  requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_READ),
  requireBranchAccess,
  getAvailableManagersForBranch,
);

// ── Get Branch Managers (Admin Managers assigned to this branch) ──
branchesRouter.get(
  '/:branchId/managers',
  authenticate,
  requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_READ),
  requireBranchAccess,
  getBranchManagers,
);

// ── Get Branch Sessions (Therapy Sessions in branch) ──────────
branchesRouter.get(
  '/:branchId/sessions',
  authenticate,
  requirePermission(PERMISSIONS.BRANCH_READ),
  requireBranchAccess,
  getBranchSessions,
);

// ── Assign Manager to Branch ──────────────────────────────────
branchesRouter.post(
  '/:branchId/managers',
  authenticate,
  requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_MANAGE),
  requireBranchAccess,
  assignManagerToBranch,
);

// ── Unassign Manager from Branch ──────────────────────────────
// Update manager assignment scope for a branch
branchesRouter.patch(
  '/:branchId/managers/:managerId',
  authenticate,
  requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_MANAGE),
  requireBranchAccess,
  updateManagerBranchAccessScope,
);

branchesRouter.delete(
  '/:branchId/managers/:managerId',
  authenticate,
  requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_MANAGE),
  requireBranchAccess,
  unassignManagerFromBranch,
);

// ── Get Single Branch ─────────────────────────────────────────
branchesRouter.get(
  '/:branchId',
  authenticate,
  requirePermission(PERMISSIONS.BRANCH_READ),
  requireBranchAccess,
  getBranch,
);

// ── Create Branch ─────────────────────────────────────────────
branchesRouter.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.BRANCH_CREATE),
  createBranch,
);

// ── Update Branch ─────────────────────────────────────────────
branchesRouter.patch(
  '/:branchId',
  authenticate,
  requirePermission(PERMISSIONS.BRANCH_UPDATE),
  requireBranchAccess,
  updateBranch,
);

// ── Force Delete Branch (SUPER_ADMIN ONLY - deletes ALL data) ─
// ⚠️ DANGEROUS: Must come BEFORE /:branchId route
branchesRouter.delete(
  '/:branchId/force',
  authenticate,
  requirePermission(PERMISSIONS.BRANCH_DELETE),
  requireBranchAccess,
  forceDeleteBranch,
);

// ── Delete Branch Permanently (Super Admin only) ──────────────
branchesRouter.delete(
  '/:branchId',
  authenticate,
  requirePermission(PERMISSIONS.BRANCH_DELETE),
  requireBranchAccess,
  deleteBranch,
);
