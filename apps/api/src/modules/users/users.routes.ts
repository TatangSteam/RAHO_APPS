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
} from './users.controller';

export const usersRouter = Router();

// ── List Users ────────────────────────────────────────────────
usersRouter.get(
  '/',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG]),
  listUsers,
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
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
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
