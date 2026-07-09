import { Router } from 'express';
import { SessionsController } from './sessions.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { upload } from '../../middleware/upload';
import { Role } from '@prisma/client';
import { validate } from '../../middleware/validate';
import { bulkEditTherapyPlanSetSchema } from '../members/members.schema';

const router = Router();
const controller = new SessionsController();

const ALLSTAFF: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.DOCTOR,
  Role.NURSE,
];

const SESSION_CREATORS: Role[] = ALLSTAFF.filter((role) => role !== Role.DOCTOR);
const MEDICAL_STAFF: Role[] = [Role.DOCTOR, Role.NURSE];

// ============================================================
// SESSION ROUTES
// ============================================================

// Get all sessions (with optional filters)
router.get(
  '/',
  authenticate,
  authorize(ALLSTAFF),
  controller.getAllSessions.bind(controller)
);

// Export sessions
router.post(
  '/export',
  authenticate,
  authorize(ALLSTAFF),
  controller.exportSessions.bind(controller)
);

// Create session
router.post(
  '/',
  authenticate,
  authorize(SESSION_CREATORS),
  controller.createSession.bind(controller)
);

// Get suggested next session numbers for create-session preview
router.get(
  '/members/:memberId/suggested-numbers',
  authenticate,
  authorize(SESSION_CREATORS),
  controller.getSuggestedSessionNumbers.bind(controller)
);

// Get booster stock using the branch that owns the session
router.get(
  '/:sessionId/booster-stock-availability',
  authenticate,
  authorize(ALLSTAFF),
  controller.getBoosterStockAvailability.bind(controller)
);

// Get session detail
router.get(
  '/:sessionId',
  authenticate,
  authorize(ALLSTAFF),
  controller.getSessionById.bind(controller)
);

// Delete session (Super Admin or Admin Cabang for their own branch)
router.delete(
  '/:sessionId',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_CABANG]),
  controller.deleteSession.bind(controller)
);

// ============================================================
// STEP 1: DIAGNOSIS
// ============================================================

router.post(
  '/encounters/:encounterId/diagnoses',
  authenticate,
  authorize(ALLSTAFF),
  controller.createDiagnosis.bind(controller)
);

router.get(
  '/encounters/:encounterId/diagnoses',
  authenticate,
  authorize(ALLSTAFF),
  controller.getDiagnosisByEncounter.bind(controller)
);

router.patch(
  '/encounters/:encounterId/diagnoses',
  authenticate,
  authorize(MEDICAL_STAFF),
  controller.updateDiagnosis.bind(controller)
);

// ============================================================
// STEP 2: THERAPY PLAN (review only; creation is bulk from member therapy-plan set)
// ============================================================

router.post(
  '/:sessionId/therapy-plan',
  authenticate,
  authorize(ALLSTAFF),
  controller.createTherapyPlan.bind(controller)
);

router.get(
  '/:sessionId/therapy-plan',
  authenticate,
  authorize(ALLSTAFF),
  controller.getTherapyPlan.bind(controller)
);

router.get(
  '/:sessionId/therapy-plan-set',
  authenticate,
  authorize(ALLSTAFF),
  controller.getTherapyPlanSet.bind(controller)
);

router.put(
  '/:sessionId/therapy-plan-set',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, ...MEDICAL_STAFF]),
  validate(bulkEditTherapyPlanSetSchema),
  controller.updateTherapyPlanSet.bind(controller)
);

// ============================================================
// STEP 3 & 8: VITAL SIGNS
// ============================================================

router.post(
  '/:sessionId/vital-signs',
  authenticate,
  authorize(ALLSTAFF),
  controller.upsertVitalSign.bind(controller)
);

router.get(
  '/:sessionId/vital-signs',
  authenticate,
  authorize(ALLSTAFF),
  controller.getVitalSigns.bind(controller)
);

// ============================================================
// STEP 4: BOOSTER TYPE SELECTION (Conditional)
// ============================================================

router.patch(
  '/:sessionId/booster-type',
  authenticate,
  authorize(ALLSTAFF),
  controller.updateBoosterType.bind(controller)
);

router.get(
  '/booster-stock-availability',
  authenticate,
  authorize(ALLSTAFF),
  controller.getBoosterStockAvailability.bind(controller)
);

// ============================================================
// STEP 5: INFUSION
// ============================================================

router.post(
  '/:sessionId/infusion',
  authenticate,
  authorize(ALLSTAFF),
  controller.createInfusion.bind(controller)
);

router.get(
  '/:sessionId/infusion',
  authenticate,
  authorize(ALLSTAFF),
  controller.getInfusion.bind(controller)
);

// ============================================================
// STEP 5: MATERIAL USAGE
// ============================================================

router.post(
  '/:sessionId/materials',
  authenticate,
  authorize(ALLSTAFF),
  controller.createMaterialUsage.bind(controller)
);

router.get(
  '/:sessionId/materials',
  authenticate,
  authorize(ALLSTAFF),
  controller.getMaterialUsages.bind(controller)
);

// ============================================================
// STEP 8: DOCTOR EVALUATION
// ============================================================

router.post(
  '/:sessionId/evaluation',
  authenticate,
  authorize(ALLSTAFF),
  controller.createEvaluation.bind(controller)
);

router.patch(
  '/:sessionId/evaluation',
  authenticate,
  authorize(ALLSTAFF),
  controller.updateEvaluation.bind(controller)
);

router.get(
  '/:sessionId/evaluation',
  authenticate,
  authorize(ALLSTAFF),
  controller.getEvaluation.bind(controller)
);

// ============================================================
// STEP 7: PHOTO UPLOAD
// ============================================================

router.post(
  '/:sessionId/photo',
  authenticate,
  authorize(ALLSTAFF),
  upload.single('photo'),
  controller.uploadPhoto.bind(controller)
);

router.delete(
  '/:sessionId/photo',
  authenticate,
  authorize(ALLSTAFF),
  controller.deletePhoto.bind(controller)
);

router.get(
  '/:sessionId/photo',
  authenticate,
  authorize(ALLSTAFF),
  controller.getPhoto.bind(controller)
);

// ============================================================
// STEP 7: SUPPORTING PHOTOS (MULTIPLE)
// ============================================================

router.delete(
  '/supporting-photos/:photoId',
  authenticate,
  authorize(ALLSTAFF),
  controller.deleteSupportingPhoto.bind(controller)
);

router.patch(
  '/supporting-photos/:photoId',
  authenticate,
  authorize(ALLSTAFF),
  controller.updateSupportingPhotoDescription.bind(controller)
);

router.post(
  '/:sessionId/supporting-photos',
  authenticate,
  authorize(ALLSTAFF),
  upload.single('photo'),
  controller.uploadSupportingPhoto.bind(controller)
);

router.get(
  '/:sessionId/supporting-photos',
  authenticate,
  authorize(ALLSTAFF),
  controller.getSupportingPhotos.bind(controller)
);

router.delete(
  '/:sessionId/supporting-photos/:photoId',
  authenticate,
  authorize(ALLSTAFF),
  controller.deleteSupportingPhoto.bind(controller)
);

router.patch(
  '/:sessionId/supporting-photos/:photoId',
  authenticate,
  authorize(ALLSTAFF),
  controller.updateSupportingPhotoDescription.bind(controller)
);

// ============================================================
// COMPLETE SESSION & PROGRESS
// ============================================================

// Save progress (no validation)
router.patch(
  '/:sessionId/save-progress',
  authenticate,
  authorize(ALLSTAFF),
  controller.saveProgress.bind(controller)
);

// Get session progress
router.get(
  '/:sessionId/progress',
  authenticate,
  authorize(ALLSTAFF),
  controller.getSessionProgress.bind(controller)
);

// Complete session (with validation)
router.patch(
  '/:sessionId/complete',
  authenticate,
  authorize(ALLSTAFF),
  controller.completeSession.bind(controller)
);

export default router;
