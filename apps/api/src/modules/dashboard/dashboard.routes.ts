import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { getStaffDashboard, getAdminCabangDashboard, getAdminManagerDashboard, getSuperAdminDashboard } from './dashboard.controller';

const router = Router();

/**
 * @route  GET /dashboard/staff
 * @desc   Dashboard untuk ADMIN_LAYANAN, DOCTOR, NURSE
 * @access Bearer (ADMIN_LAYANAN, DOCTOR, NURSE)
 */
router.get(
  '/staff',
  authenticate,
  authorize(['ADMIN_LAYANAN', 'DOCTOR', 'NURSE']),
  getStaffDashboard,
);

/**
 * @route  GET /dashboard/admin-cabang
 * @desc   Dashboard untuk ADMIN_CABANG
 * @access Bearer (ADMIN_CABANG)
 */
router.get(
  '/admin-cabang',
  authenticate,
  authorize(['ADMIN_CABANG']),
  getAdminCabangDashboard,
);

/**
 * @route  GET /dashboard/admin-manager
 * @desc   Dashboard untuk ADMIN_MANAGER dan SUPER_ADMIN (agregat semua cabang)
 * @access Bearer (ADMIN_MANAGER, SUPER_ADMIN)
 */
router.get(
  '/admin-manager',
  authenticate,
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN']),
  getAdminManagerDashboard,
);

/**
 * @route  GET /dashboard/super-admin
 * @desc   Dashboard lengkap untuk SUPER_ADMIN
 * @access Bearer (SUPER_ADMIN)
 */
router.get(
  '/super-admin',
  authenticate,
  authorize(['SUPER_ADMIN']),
  getSuperAdminDashboard,
);

export { router as dashboardRouter };