import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();
const controller = new DashboardController();

// All dashboard routes require authentication
router.use(authenticate);

// Get branch dashboard (All staff roles)
router.get(
  '/branch',
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG, Role.ADMIN_LAYANAN, Role.DOCTOR, Role.NURSE]),
  controller.getBranchDashboard.bind(controller)
);

export { router as dashboardRouter };
