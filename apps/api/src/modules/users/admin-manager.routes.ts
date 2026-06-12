import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { Role } from '@prisma/client';
import {
  getManagedBranches,
  addManagedBranch,
  removeManagedBranch,
} from './users.controller';

export const adminManagerRouter = Router();

// ══════════════════════════════════════════════════════════════
// ADMIN MANAGER BRANCH MANAGEMENT
// ══════════════════════════════════════════════════════════════

// ── Get Managed Branches ──────────────────────────────────────
adminManagerRouter.get(
  '/branches',
  authenticate,
  authorize([Role.ADMIN_MANAGER]),
  getManagedBranches,
);

// ── Add Branch to Managed List ────────────────────────────────
adminManagerRouter.post(
  '/branches',
  authenticate,
  authorize([Role.ADMIN_MANAGER]),
  addManagedBranch,
);

// ── Remove Branch from Managed List ───────────────────────────
adminManagerRouter.delete(
  '/branches/:branchId',
  authenticate,
  authorize([Role.ADMIN_MANAGER]),
  removeManagedBranch,
);
