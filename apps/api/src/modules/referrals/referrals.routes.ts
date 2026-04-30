import { Router } from 'express';
import { ReferralsController } from './referrals.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();
const controller = new ReferralsController();

// Roles that can manage referrals
const ADMIN_PLUS = [
  Role.ADMIN_LAYANAN,
  Role.ADMIN_CABANG,
  Role.ADMIN_MANAGER,
  Role.SUPER_ADMIN,
];

// Roles that can view referrals
const ALLSTAFF = [
  Role.ADMIN_LAYANAN,
  Role.ADMIN_CABANG,
  Role.ADMIN_MANAGER,
  Role.SUPER_ADMIN,
  Role.DOCTOR,
  Role.NURSE,
];

// GET /api/v1/referrals - List referrals
router.get('/', authenticate, authorize(ADMIN_PLUS), controller.listReferrals.bind(controller));

// GET /api/v1/referrals/active - Get active referrals (for dropdown)
router.get(
  '/active',
  authenticate,
  authorize(ALLSTAFF),
  controller.getActiveReferrals.bind(controller)
);

// GET /api/v1/referrals/export/excel - Export incentives to Excel
router.get(
  '/export/excel',
  authenticate,
  authorize(ADMIN_PLUS),
  controller.exportIncentivesExcel.bind(controller)
);

// GET /api/v1/referrals/export/pdf - Export incentives to PDF
router.get(
  '/export/pdf',
  authenticate,
  authorize(ADMIN_PLUS),
  controller.exportIncentivesPDF.bind(controller)
);

// GET /api/v1/referrals/export/summary - Export summary per referral to Excel
router.get(
  '/export/summary',
  authenticate,
  authorize(ADMIN_PLUS),
  controller.exportSummaryExcel.bind(controller)
);

// POST /api/v1/referrals - Create referral
router.post(
  '/',
  authenticate,
  authorize(ADMIN_PLUS),
  controller.createReferral.bind(controller)
);

// GET /api/v1/referrals/:referralId - Get referral by ID
router.get(
  '/:referralId',
  authenticate,
  authorize(ADMIN_PLUS),
  controller.getReferralById.bind(controller)
);

// GET /api/v1/referrals/:referralId/incentives - Get referral incentive records
router.get(
  '/:referralId/incentives',
  authenticate,
  authorize(ADMIN_PLUS),
  controller.getReferralIncentives.bind(controller)
);

// PATCH /api/v1/referrals/:referralId - Update referral
router.patch(
  '/:referralId',
  authenticate,
  authorize(ADMIN_PLUS),
  controller.updateReferral.bind(controller)
);

// DELETE /api/v1/referrals/:referralId - Delete referral (soft delete)
router.delete(
  '/:referralId',
  authenticate,
  authorize(ADMIN_PLUS),
  controller.deleteReferral.bind(controller)
);

export default router;
