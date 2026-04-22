import { Router } from 'express';
import { MembersController } from './members.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { assertBranchAccess } from '../../middleware/assertBranchAccess';
import { upload } from '../../middleware/upload';
import { Role } from '@prisma/client';

const router = Router();
const controller = new MembersController();

const ALLSTAFF = [
  Role.ADMIN_LAYANAN,
  Role.ADMIN_CABANG,
  Role.ADMIN_MANAGER,
  Role.SUPER_ADMIN,
  Role.DOCTOR,
  Role.NURSE,
];

const ADMIN_PLUS = [Role.ADMIN_LAYANAN, Role.ADMIN_CABANG, Role.ADMIN_MANAGER, Role.SUPER_ADMIN];

// GET /api/v1/members - List members
router.get('/', authenticate, authorize(ALLSTAFF), controller.getMembers.bind(controller));

// GET /api/v1/members/lookup - Lookup member by memberNo
router.get(
  '/lookup',
  authenticate,
  authorize(ALLSTAFF),
  controller.lookupMember.bind(controller)
);

// POST /api/v1/members/grant-access - Grant branch access
router.post(
  '/grant-access',
  authenticate,
  authorize(ALLSTAFF),
  controller.grantAccess.bind(controller)
);

// POST /api/v1/members - Create new member
router.post(
  '/',
  authenticate,
  authorize(ADMIN_PLUS),
  upload.fields([
    { name: 'psp', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
  ]),
  controller.createMember.bind(controller)
);

// ============================================================
// PACKAGE ROUTES (must be before /:memberId to avoid conflict)
// ============================================================
import { PackagesController } from '../packages/packages.controller';
const packagesController = new PackagesController();

// POST /api/v1/members/:memberId/packages - Assign package
router.post(
  '/:memberId/packages',
  authenticate,
  authorize(ADMIN_PLUS),
  assertBranchAccess,
  packagesController.assignPackage.bind(packagesController)
);

// GET /api/v1/members/:memberId/packages - Get member packages
router.get(
  '/:memberId/packages',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  packagesController.getMemberPackages.bind(packagesController)
);

// POST /api/v1/members/:memberId/notifications - Send notification
router.post(
  '/:memberId/notifications',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.sendNotification.bind(controller)
);

// ============================================================
// DIAGNOSIS ROUTES
// ============================================================

// GET /api/v1/members/:memberId/diagnoses - Get member diagnoses
router.get(
  '/:memberId/diagnoses',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.getMemberDiagnoses.bind(controller)
);

// POST /api/v1/members/:memberId/diagnoses - Create diagnosis
router.post(
  '/:memberId/diagnoses',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.createMemberDiagnosis.bind(controller)
);

// ============================================================
// MEMBER CRUD (must be after specific routes)
// ============================================================

// GET /api/v1/members/:memberId - Get member detail
router.get(
  '/:memberId',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.getMemberById.bind(controller)
);

// PATCH /api/v1/members/:memberId - Update member
router.patch(
  '/:memberId',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  assertBranchAccess,
  controller.updateMember.bind(controller)
);

// DELETE /api/v1/members/:memberId - Delete member
router.delete(
  '/:memberId',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  assertBranchAccess,
  controller.deleteMember.bind(controller)
);

// ============================================================
// THERAPY PLAN ROUTES
// ============================================================

// GET /api/v1/members/:memberId/therapy-plans - Get member therapy plans
router.get(
  '/:memberId/therapy-plans',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.getMemberTherapyPlans.bind(controller)
);

// POST /api/v1/members/:memberId/therapy-plans - Create therapy plan
router.post(
  '/:memberId/therapy-plans',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.createMemberTherapyPlan.bind(controller)
);

// ============================================================
// INFUSION ROUTES
// ============================================================

// GET /api/v1/members/:memberId/infusions - Get member infusion history
router.get(
  '/:memberId/infusions',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.getMemberInfusions.bind(controller)
);

export default router;