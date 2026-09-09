import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { upload } from '@middleware/upload';
import { requirePermission } from '@middleware/requirePermission';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
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
  getAllMedicalStaff,
  getUserBranches,
  assignUserToBranch,
  removeUserFromBranch,
  getAvailableBranchesForUser,
  setPrimaryBranch,
  getStaffPerformanceSummary,
  getMonthlyStaffIncentives,
  getStaffSessionHistory,
  exportStaffPerformanceDetail,
  exportStaffPerformance,
  getUserCredentials,
  updateUserEmail,
  getDoctorsByBranch,
  assignDoctorToBranch,
  removeDoctorFromBranch,
} from './users.controller';

export const usersRouter = Router();

// ── List Users ────────────────────────────────────────────────
usersRouter.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.IAM_USER_READ),
  listUsers,
);

// ── Get Medical Staff Not In Branch (for assign modal) ───────
usersRouter.get(
  '/medical-staff',
  authenticate,
  requirePermission(PERMISSIONS.IAM_USER_READ),
  getMedicalStaffNotInBranch,
);

// ── Get All Medical Staff (for assign modal - shows all) ─────
usersRouter.get(
  '/medical-staff/all',
  authenticate,
  requirePermission(PERMISSIONS.IAM_USER_READ),
  getAllMedicalStaff,
);

// ══════════════════════════════════════════════════════════════
// STAFF PERFORMANCE (Kinerja Staff)
// ══════════════════════════════════════════════════════════════

// ── Get Staff Performance Summary ─────────────────────────────
usersRouter.get(
  '/incentives/monthly',
  authenticate,
  authorize([
    Role.SUPER_ADMIN,
    Role.ADMIN_MANAGER,
    Role.ADMIN_CABANG,
    Role.ADMIN_LAYANAN,
    Role.NURSE,
    Role.FINANCE_LOGISTICS_CONTROLLER,
  ]),
  getMonthlyStaffIncentives,
);

usersRouter.get(
  '/performance/export',
  authenticate,
  requirePermission(PERMISSIONS.IAM_USER_READ),
  exportStaffPerformance,
);

usersRouter.get(
  '/performance/summary',
  authenticate,
  requirePermission(PERMISSIONS.STAFF_PERFORMANCE_READ),
  getStaffPerformanceSummary,
);

// ── Get Staff Session History ─────────────────────────────────
usersRouter.get(
  '/performance/:staffId/history/export',
  authenticate,
  requirePermission(PERMISSIONS.STAFF_PERFORMANCE_READ),
  exportStaffPerformanceDetail,
);

usersRouter.get(
  '/performance/:staffId/history',
  authenticate,
  requirePermission(PERMISSIONS.STAFF_PERFORMANCE_READ),
  getStaffSessionHistory,
);

// ── Get Staff by Role (for dropdowns) ─────────────────────────
usersRouter.get(
  '/staff/:role',
  authenticate,
  requirePermission(PERMISSIONS.CLINICAL_STAFF_DIRECTORY_READ),
  getStaffByRole,
);

// Static route must be registered before /:userId.
usersRouter.get(
  '/doctors',
  authenticate,
  requirePermission(PERMISSIONS.IAM_USER_READ),
  getDoctorsByBranch,
);

// ── Get Single User ───────────────────────────────────────────
usersRouter.get(
  '/:userId',
  authenticate,
  requirePermission(PERMISSIONS.IAM_USER_READ),
  getUser,
);

// ── Create User ───────────────────────────────────────────────
usersRouter.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.IAM_USER_CREATE),
  createUser,
);

// ── Update User ───────────────────────────────────────────────
usersRouter.patch(
  '/:userId',
  authenticate,
  requirePermission(PERMISSIONS.IAM_USER_UPDATE),
  updateUser,
);

// ── Deactivate User ───────────────────────────────────────────
usersRouter.delete(
  '/:userId',
  authenticate,
  requirePermission(PERMISSIONS.IAM_USER_DEACTIVATE),
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
  requirePermission(PERMISSIONS.IAM_USER_RESET_PASSWORD),
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
  requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_READ),
  getUserBranches,
);

// ── Get Available Branches for User ───────────────────────────
usersRouter.get(
  '/:userId/branches/available',
  authenticate,
  requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_READ),
  getAvailableBranchesForUser,
);

// ── Assign User to Branch ─────────────────────────────────────
usersRouter.post(
  '/:userId/branches',
  authenticate,
  requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_MANAGE),
  assignUserToBranch,
);

// ── Remove User from Branch ───────────────────────────────────
usersRouter.delete(
  '/:userId/branches/:branchId',
  authenticate,
  requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_MANAGE),
  removeUserFromBranch,
);

// ── Set Primary Branch ────────────────────────────────────────
usersRouter.patch(
  '/:userId/branches/:branchId/set-primary',
  authenticate,
  requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_MANAGE),
  setPrimaryBranch,
);

// ══════════════════════════════════════════════════════════════
// CREDENTIAL MANAGEMENT (Super Admin Only)
// ══════════════════════════════════════════════════════════════

// ── Get User Credentials ──────────────────────────────────────
usersRouter.get(
  '/:userId/credentials',
  authenticate,
  requirePermission(PERMISSIONS.IAM_USER_READ),
  getUserCredentials,
);

// ── Update User Email ─────────────────────────────────────────
usersRouter.patch(
  '/:userId/email',
  authenticate,
  requirePermission(PERMISSIONS.IAM_USER_UPDATE),
  updateUserEmail,
);

// ══════════════════════════════════════════════════════════════
// DOCTOR BRANCH MANAGEMENT (Admin Manager & Super Admin)
// ══════════════════════════════════════════════════════════════

// ── Get Doctors by Branch ─────────────────────────────────────
// ── Assign Doctor to Branch ───────────────────────────────────
usersRouter.post(
  '/doctors/:doctorId/branches',
  authenticate,
  requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_MANAGE),
  assignDoctorToBranch,
);

// ── Remove Doctor from Branch ─────────────────────────────────
usersRouter.delete(
  '/doctors/:doctorId/branches/:branchId',
  authenticate,
  requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_MANAGE),
  removeDoctorFromBranch,
);
