import { Router } from 'express';
import { SessionsController } from './sessions.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { upload } from '../../middleware/upload';
import { Role } from '@prisma/client';
import { validate } from '../../middleware/validate';
import { bulkEditTherapyPlanSetSchema } from '../members/members.schema';
import { UNFINISHED_SESSION_REMINDER_ROLES } from './services/unfinished-session-reminder.service';

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
const CLINICAL_WRITERS: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  ...MEDICAL_STAFF,
];
const DIAGNOSIS_WRITERS: Role[] = [
  ...CLINICAL_WRITERS,
  Role.ADMIN_LAYANAN,
];
const VITAL_WRITERS: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.NURSE,
];
const COMPLETION_REVERSERS: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG];
const WHATSAPP_CONSENT_MANAGERS: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
];

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

// Role-scoped work queue used by the unfinished-session reminder popup.
// Keep this route before /:sessionId so Express does not treat the literal as an ID.
router.get(
  '/unfinished-reminders',
  authenticate,
  authorize(UNFINISHED_SESSION_REMINDER_ROLES),
  controller.getUnfinishedSessionReminders.bind(controller)
);

router.get(
  '/workflow-burden',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  controller.getWorkflowBurden.bind(controller)
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

// Delete session (Super Admin or Admin Manager for managed branches)
router.delete(
  '/:sessionId',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  controller.deleteSession.bind(controller)
);

router.patch(
  '/:sessionId/details',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  controller.updateSessionDetails.bind(controller)
);

// ============================================================
// STEP 1: DIAGNOSIS
// ============================================================

router.post(
  '/encounters/:encounterId/diagnoses',
  authenticate,
  authorize(DIAGNOSIS_WRITERS),
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
  authorize([Role.DOCTOR]),
  controller.updateDiagnosis.bind(controller)
);

router.delete(
  '/encounters/:encounterId/diagnoses',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  controller.deleteDiagnosis.bind(controller)
);

// ============================================================
// STEP 2: THERAPY PLAN (review only; creation is bulk from member therapy-plan set)
// ============================================================

router.post(
  '/:sessionId/therapy-plan',
  authenticate,
  authorize(CLINICAL_WRITERS),
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
  authorize(ALLSTAFF),
  validate(bulkEditTherapyPlanSetSchema),
  controller.updateTherapyPlanSet.bind(controller)
);

// ============================================================
// STEP 3 & 8: VITAL SIGNS
// ============================================================

router.post(
  '/:sessionId/vital-signs',
  authenticate,
  authorize(VITAL_WRITERS),
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
  authorize(CLINICAL_WRITERS),
  controller.updateBoosterType.bind(controller)
);

router.patch(
  '/:sessionId/booster-package',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]),
  controller.updateSessionBoosterPackage.bind(controller)
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
  authorize(CLINICAL_WRITERS),
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

router.get(
  '/:sessionId/material-recommendations',
  authenticate,
  authorize(ALLSTAFF),
  controller.getMaterialRecommendations.bind(controller)
);

router.post(
  '/:sessionId/materials',
  authenticate,
  authorize(CLINICAL_WRITERS),
  controller.createMaterialUsage.bind(controller)
);

router.get(
  '/:sessionId/materials',
  authenticate,
  authorize(ALLSTAFF),
  controller.getMaterialUsages.bind(controller)
);

router.delete(
  '/:sessionId/materials/:usageId',
  authenticate,
  authorize(CLINICAL_WRITERS),
  controller.deleteMaterialUsage.bind(controller)
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
  authorize(CLINICAL_WRITERS),
  upload.single('photo'),
  controller.uploadPhoto.bind(controller)
);

router.delete(
  '/:sessionId/photo',
  authenticate,
  authorize(CLINICAL_WRITERS),
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
  authorize(CLINICAL_WRITERS),
  controller.deleteSupportingPhoto.bind(controller)
);

router.patch(
  '/supporting-photos/:photoId',
  authenticate,
  authorize(CLINICAL_WRITERS),
  controller.updateSupportingPhotoDescription.bind(controller)
);

router.post(
  '/:sessionId/supporting-photos',
  authenticate,
  authorize(CLINICAL_WRITERS),
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
  authorize(CLINICAL_WRITERS),
  controller.deleteSupportingPhoto.bind(controller)
);

router.patch(
  '/:sessionId/supporting-photos/:photoId',
  authenticate,
  authorize(CLINICAL_WRITERS),
  controller.updateSupportingPhotoDescription.bind(controller)
);

// ============================================================
// COMPLETE SESSION & PROGRESS
// ============================================================

// Save progress (no validation)
router.patch(
  '/:sessionId/save-progress',
  authenticate,
  authorize(CLINICAL_WRITERS),
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
router.get(
  '/:sessionId/whatsapp-report/preview',
  authenticate,
  authorize(ALLSTAFF),
  controller.previewWhatsAppReport.bind(controller)
);

router.post(
  '/:sessionId/whatsapp-report',
  authenticate,
  authorize(ALLSTAFF),
  controller.queueWhatsAppReport.bind(controller)
);

router.get(
  '/:sessionId/whatsapp-deliveries',
  authenticate,
  authorize(ALLSTAFF),
  controller.listWhatsAppReportDeliveries.bind(controller)
);

router.put(
  '/:sessionId/whatsapp-consent',
  authenticate,
  authorize(WHATSAPP_CONSENT_MANAGERS),
  controller.updateWhatsAppReportConsent.bind(controller)
);

router.patch(
  '/:sessionId/complete',
  authenticate,
  authorize(CLINICAL_WRITERS),
  controller.completeSession.bind(controller)
);

router.post(
  '/:sessionId/cancel-completion',
  authenticate,
  authorize(COMPLETION_REVERSERS),
  controller.cancelCompletion.bind(controller)
);

export default router;
