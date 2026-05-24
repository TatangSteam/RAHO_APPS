import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { upload } from '@middleware/upload';
import { Role } from '@prisma/client';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  changePassword,
  resetPassword,
  uploadAvatar,
  getStaffByRole,
  getMedicalStaffNotInBranch,
  getUserBranches,
  assignUserToBranch,
  removeUserFromBranch,
  getAvailableBranchesForUser,
  setPrimaryBranch,
  getStaffPerformanceSummary,
  getStaffSessionHistory,
  getUserCredentials,
  updateUserEmail,
} from './users.controller';

export const usersRouter = Router();

// ── List Users ────────────────────────────────────────────────
usersRouter.get(
  '/',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG]),
  listUsers,
);

// ── Get Medical Staff Not In Branch (for assign modal) ───────
usersRouter.get(
  '/medical-staff',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  getMedicalStaffNotInBranch,
);

// ══════════════════════════════════════════════════════════════
// STAFF PERFORMANCE (Kinerja Staff)
// ══════════════════════════════════════════════════════════════

// ── Get Staff Performance Summary ─────────────────────────────
usersRouter.get(
  '/performance/summary',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG]),
  getStaffPerformanceSummary,
);

// ── Get Staff Session History ─────────────────────────────────
usersRouter.get(
  '/performance/:staffId/history',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG]),
  getStaffSessionHistory,
);

// ── Get Staff by Role (for dropdowns) ─────────────────────────
usersRouter.get(
  '/staff/:role',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG, Role.ADMIN_LAYANAN, Role.DOCTOR, Role.NURSE]),
  getStaffByRole,
);

// ── Get Single User ───────────────────────────────────────────
usersRouter.get(
  '/:userId',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG]),
  getUser,
);

// ── Create User ───────────────────────────────────────────────
usersRouter.post(
  '/',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG]),
  createUser,
);

// ── Update User ───────────────────────────────────────────────
usersRouter.patch(
  '/:userId',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG]),
  updateUser,
);

// ── Deactivate User ───────────────────────────────────────────
usersRouter.delete(
  '/:userId',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG]),
  deactivateUser,
);

// ── Change Own Password ───────────────────────────────────────
usersRouter.post(
  '/me/change-password',
  authenticate,
  changePassword,
);

// ── Admin Reset Password ──────────────────────────────────────
usersRouter.post(
  '/:userId/reset-password',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  resetPassword,
);

// ── Upload Avatar ─────────────────────────────────────────────
usersRouter.post(
  '/me/avatar',
  authenticate,
  upload.single('avatar'),
  uploadAvatar,
);

// ══════════════════════════════════════════════════════════════
// STAFF BRANCH MANAGEMENT (Multi-Branch Assignment)
// ══════════════════════════════════════════════════════════════

// ── Get User's Assigned Branches ──────────────────────────────
usersRouter.get(
  '/:userId/branches',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  getUserBranches,
);

// ── Get Available Branches for User ───────────────────────────
usersRouter.get(
  '/:userId/branches/available',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  getAvailableBranchesForUser,
);

// ── Assign User to Branch ─────────────────────────────────────
usersRouter.post(
  '/:userId/branches',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  assignUserToBranch,
);

// ── Remove User from Branch ───────────────────────────────────
usersRouter.delete(
  '/:userId/branches/:branchId',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  removeUserFromBranch,
);

// ── Set Primary Branch ────────────────────────────────────────
usersRouter.patch(
  '/:userId/branches/:branchId/set-primary',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  setPrimaryBranch,
);

// ══════════════════════════════════════════════════════════════
// CREDENTIAL MANAGEMENT (Super Admin Only)
// ══════════════════════════════════════════════════════════════

// ── Get User Credentials ──────────────────────────────────────
usersRouter.get(
  '/:userId/credentials',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  getUserCredentials,
);

// ── Update User Email ─────────────────────────────────────────
usersRouter.patch(
  '/:userId/email',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  updateUserEmail,
);
