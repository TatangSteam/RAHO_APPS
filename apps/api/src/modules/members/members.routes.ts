import { Router } from 'express';
import { MembersController } from './members.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { assertBranchAccess } from '../../middleware/assertBranchAccess';
import { uploadMemberDocuments, uploadLabResult, uploadSpreadsheet } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import { bulkCreateTherapyPlansSchema, editTherapyPlanSchema, bulkEditTherapyPlanSetSchema } from './members.schema';
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
const MEMBER_DELETERS = [Role.ADMIN_MANAGER, Role.SUPER_ADMIN];
const ACCOUNT_IMPORTERS = [Role.ADMIN_MANAGER, Role.SUPER_ADMIN];

// Roles that can edit therapy plans and add rows to active therapy plan sets.
const THERAPY_PLAN_EDITORS = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.DOCTOR,
  Role.NURSE,
];

// GET /api/v1/members - List members
router.get('/', authenticate, authorize(ALLSTAFF), controller.getMembers.bind(controller));

// POST /api/v1/members/export - Export members data
router.post(
  '/export',
  authenticate,
  authorize(ADMIN_PLUS),
  controller.exportMembers.bind(controller)
);

// POST /api/v1/members/export/preview - Get export preview count
router.post(
  '/export/preview',
  authenticate,
  authorize(ADMIN_PLUS),
  controller.getExportPreview.bind(controller)
);

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
  uploadMemberDocuments.fields([
    { name: 'psp', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
  ]),
  controller.createMember.bind(controller)
);

// ============================================================
// MEMBER ACCOUNT IMPORT ROUTES (must be before /:memberId)
// ============================================================

// POST /api/v1/members/import/accounts/dry-run - Validate Excel without creating accounts
router.post(
  '/import/accounts/dry-run',
  authenticate,
  authorize(ACCOUNT_IMPORTERS),
  uploadSpreadsheet.single('file'),
  controller.dryRunAccountImport.bind(controller)
);

// POST /api/v1/members/import/accounts/execute - Create member accounts from Excel
router.post(
  '/import/accounts/execute',
  authenticate,
  authorize(ACCOUNT_IMPORTERS),
  uploadSpreadsheet.single('file'),
  controller.executeAccountImport.bind(controller)
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
  (req, res, next) => {
    console.log('🚀 [Route] GET /members/:memberId/packages hit!');
    console.log('  - memberId:', req.params.memberId);
    console.log('  - user:', req.user?.email, req.user?.role);
    next();
  },
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
// CONSENT DOCUMENTS ROUTES
// ============================================================

// GET /api/v1/members/:memberId/documents/consent - Get member consent documents
router.get(
  '/:memberId/documents/consent',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.getConsentDocuments.bind(controller)
);

// ============================================================
// REFERRAL INCENTIVES ROUTES
// ============================================================

// GET /api/v1/members/:memberId/referral-incentives - Get member referral incentive records
router.get(
  '/:memberId/referral-incentives',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.getReferralIncentives.bind(controller)
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

// PUT /api/v1/members/:memberId/diagnoses/:diagnosisId - Update diagnosis
router.put(
  '/:memberId/diagnoses/:diagnosisId',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.updateMemberDiagnosis.bind(controller)
);

// DELETE /api/v1/members/:memberId/diagnoses/:diagnosisId - Delete diagnosis
router.delete(
  '/:memberId/diagnoses/:diagnosisId',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  assertBranchAccess,
  controller.deleteMemberDiagnosis.bind(controller)
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
  authorize(ADMIN_PLUS),
  assertBranchAccess,
  controller.updateMember.bind(controller)
);

// DELETE /api/v1/members/:memberId - Delete member
router.delete(
  '/:memberId',
  authenticate,
  authorize(MEMBER_DELETERS),
  assertBranchAccess,
  controller.deleteMember.bind(controller)
);

// ============================================================
// THERAPY PLAN ROUTES
// ============================================================

// GET /api/v1/members/:memberId/therapy-plans/package-summary - Get package summary for bulk creation
router.get(
  '/:memberId/therapy-plans/package-summary',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.getMemberPackageSummary.bind(controller)
);

// POST /api/v1/members/:memberId/therapy-plans/bulk - Bulk create therapy plans
router.post(
  '/:memberId/therapy-plans/bulk',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  validate(bulkCreateTherapyPlansSchema),
  controller.bulkCreateTherapyPlans.bind(controller)
);

// GET /api/v1/members/:memberId/therapy-plans - Get member therapy plans
router.get(
  '/:memberId/therapy-plans',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.getMemberTherapyPlans.bind(controller)
);

// POST /api/v1/members/:memberId/therapy-plans - Disabled: therapy plans must be created in bulk as one set
router.post(
  '/:memberId/therapy-plans',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.createMemberTherapyPlan.bind(controller)
);

// PUT /api/v1/members/:memberId/therapy-plans/:therapyPlanId - Edit one row by creating a new set version
// Only configured therapy plan editors can edit therapy plans
router.put(
  '/:memberId/therapy-plans/:therapyPlanId',
  authenticate,
  authorize(THERAPY_PLAN_EDITORS),
  assertBranchAccess,
  validate(editTherapyPlanSchema),
  controller.editTherapyPlan.bind(controller)
);

// PUT /api/v1/members/:memberId/therapy-plan-sets/:setId/bulk-edit - Bulk edit therapy plan set
router.put(
  '/:memberId/therapy-plan-sets/:setId/bulk-edit',
  authenticate,
  authorize(THERAPY_PLAN_EDITORS),
  assertBranchAccess,
  validate(bulkEditTherapyPlanSetSchema),
  controller.bulkEditTherapyPlanSet.bind(controller)
);

// DELETE /api/v1/members/:memberId/therapy-plan-sets/:setId - Delete unused therapy plan set
router.delete(
  '/:memberId/therapy-plan-sets/:setId',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  assertBranchAccess,
  controller.deleteTherapyPlanSet.bind(controller)
);

// GET /api/v1/members/:memberId/therapy-plans/:therapyPlanId/history - Get therapy plan history
router.get(
  '/:memberId/therapy-plans/:therapyPlanId/history',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.getTherapyPlanHistory.bind(controller)
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

// ============================================================
// CREDENTIAL MANAGEMENT ROUTES (Super Admin Only)
// ============================================================

// GET /api/v1/members/:memberId/credentials - Get member credentials
router.get(
  '/:memberId/credentials',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  controller.getMemberCredentials.bind(controller)
);

// PATCH /api/v1/members/:memberId/email - Update member email
router.patch(
  '/:memberId/email',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  controller.updateMemberEmail.bind(controller)
);

// PATCH /api/v1/members/:memberId/username - Update member login username
router.patch(
  '/:memberId/username',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  controller.updateMemberUsername.bind(controller)
);

// POST /api/v1/members/:memberId/reset-password - Reset member password
router.post(
  '/:memberId/reset-password',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  controller.resetMemberPassword.bind(controller)
);

// ============================================================
// DOCUMENT UPLOAD ROUTES (After Registration)
// ============================================================

// POST /api/v1/members/:memberId/documents - Upload member documents (PSP or Profile Photo)
// Accessible by ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN
router.post(
  '/:memberId/documents',
  authenticate,
  authorize([Role.ADMIN_LAYANAN, Role.ADMIN_CABANG, Role.ADMIN_MANAGER, Role.SUPER_ADMIN]),
  uploadMemberDocuments.single('file'),
  controller.uploadMemberDocuments.bind(controller)
);

// ============================================================
// LAB RESULTS ROUTES
// ============================================================

// GET /api/v1/members/:memberId/lab-results - Get member lab results
router.get(
  '/:memberId/lab-results',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.getMemberLabResults.bind(controller)
);

// GET /api/v1/members/:memberId/supporting-photos - Get supporting photos shown in lab result tab
router.get(
  '/:memberId/supporting-photos',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.getMemberSupportingPhotos.bind(controller)
);

// POST /api/v1/members/:memberId/lab-results - Upload lab result
router.post(
  '/:memberId/lab-results',
  authenticate,
  authorize(ALLSTAFF), // All staff can upload
  assertBranchAccess,
  uploadLabResult.single('file'),
  controller.uploadLabResult.bind(controller)
);

// DELETE /api/v1/members/:memberId/lab-results/:labResultId - Delete lab result
router.delete(
  '/:memberId/lab-results/:labResultId',
  authenticate,
  authorize([Role.ADMIN_MANAGER, Role.SUPER_ADMIN]),
  assertBranchAccess,
  controller.deleteLabResult.bind(controller)
);

export default router;
