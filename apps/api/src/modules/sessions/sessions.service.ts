import type {
  CreateSessionInput,
  CreateDiagnosisInput,
  UpdateDiagnosisInput,
  CreateTherapyPlanInput,
  CreateVitalSignInput,
  CreateInfusionInput,
  CreateMaterialUsageInput,
  CreateEvaluationInput,
  UpdateSessionBoosterPackageInput,
  UpdateSessionDetailsInput,
  CompleteSessionInput,
  CancelSessionCompletionInput,
  SaveSessionProgressInput,
} from './sessions.schema';

// Import modular services
import { SessionCreationService } from './services/session-creation.service';
import { SessionRetrievalService } from './services/session-retrieval.service';
import { DiagnosisService } from './services/diagnosis.service';
import { TherapyPlanService } from './services/therapy-plan.service';
import { VitalSignsService } from './services/vital-signs.service';
import { InfusionService } from './services/infusion.service';
import { MaterialUsageService } from './services/material-usage.service';
import { EvaluationService } from './services/evaluation.service';
import { SessionCompletionService } from './services/session-completion.service';
import { BoosterService } from './services/booster.service';
import { PhotoService } from './services/photo.service';
import { SessionDeletionService } from './services/session-deletion.service';
import { SessionDetailsService } from './services/session-details.service';
import { UnfinishedSessionReminderService } from './services/unfinished-session-reminder.service';
import type { BulkEditSetInput } from '../members/services/member-therapy-plan-set-edit.service';
import {
  listSessionReportDeliveries,
  previewSessionReport,
  queueManualSessionReport,
  updateSessionReportConsent,
} from '../whatsapp/whatsapp-report.service';
import type { SessionReportBackgroundKey } from '../whatsapp/whatsapp-backgrounds';

/**
 * Main Sessions Service - Orchestrates all session-related operations
 * 
 * This service delegates to specialized services:
 * - SessionCreationService: Create new sessions with validations
 * - SessionRetrievalService: Get and format session data
 * - DiagnosisService: Handle diagnosis
 * - TherapyPlanService: Handle therapy plans
 * - VitalSignsService: Handle vital signs
 * - InfusionService: Handle infusion execution
 * - MaterialUsageService: Handle material/inventory usage
 * - PhotoService: Handle photo uploads
 * - EvaluationService: Handle doctor evaluations
 * - SessionCompletionService: Handle session completion
 * - BoosterService: Handle booster packages
 */
export class SessionsService {
  // Initialize modular services
  private creationService: SessionCreationService;
  private retrievalService: SessionRetrievalService;
  private diagnosisService: DiagnosisService;
  private therapyPlanService: TherapyPlanService;
  private vitalSignsService: VitalSignsService;
  private infusionService: InfusionService;
  private materialUsageService: MaterialUsageService;
  private evaluationService: EvaluationService;
  private completionService: SessionCompletionService;
  private boosterService: BoosterService;
  private photoService: PhotoService;
  private deletionService: SessionDeletionService;
  private detailsService: SessionDetailsService;
  private unfinishedReminderService: UnfinishedSessionReminderService;

  constructor() {
    this.creationService = new SessionCreationService();
    this.retrievalService = new SessionRetrievalService();
    this.diagnosisService = new DiagnosisService();
    this.therapyPlanService = new TherapyPlanService();
    this.vitalSignsService = new VitalSignsService();
    this.infusionService = new InfusionService();
    this.materialUsageService = new MaterialUsageService();
    this.evaluationService = new EvaluationService();
    this.completionService = new SessionCompletionService();
    this.boosterService = new BoosterService();
    this.photoService = new PhotoService();
    this.deletionService = new SessionDeletionService();
    this.detailsService = new SessionDetailsService();
    this.unfinishedReminderService = new UnfinishedSessionReminderService();
  }

  // ============================================================
  // SESSION CREATION & RETRIEVAL
  // ============================================================

  async createSession(data: CreateSessionInput, branchId: string, userId: string, userRole?: string) {
    return this.creationService.createSession(data, branchId, userId, userRole);
  }

  async getSuggestedSessionNumbers(memberId: string, branchId: string) {
    return this.creationService.getSuggestedSessionNumbers(memberId, branchId);
  }

  async getSessionById(sessionId: string) {
    return this.retrievalService.getSessionById(sessionId);
  }

  async previewWhatsAppReport(
    sessionId: string,
    userId: string,
    backgroundKey?: SessionReportBackgroundKey,
  ) {
    return previewSessionReport(sessionId, userId, backgroundKey);
  }

  async queueWhatsAppReport(input: {
    sessionId: string;
    userId: string;
    idempotencyKey: string;
    backgroundKey?: SessionReportBackgroundKey;
  }) {
    return queueManualSessionReport({
      sessionId: input.sessionId,
      actorUserId: input.userId,
      idempotencyKey: input.idempotencyKey,
      backgroundKey: input.backgroundKey,
    });
  }

  async listWhatsAppReportDeliveries(sessionId: string, userId: string) {
    return listSessionReportDeliveries(sessionId, userId);
  }

  async updateWhatsAppReportConsent(input: {
    sessionId: string;
    userId: string;
    enabled: boolean;
    source?: string;
  }) {
    return updateSessionReportConsent({
      sessionId: input.sessionId,
      actorUserId: input.userId,
      enabled: input.enabled,
      source: input.source,
    });
  }

  async getAllSessions(params: { 
    memberId?: string; 
    branchId?: string; 
    branchIds?: string[];
    diagnosisCategories?: string[];
    role?: string; 
    userId?: string; 
    page?: number; 
    limit?: number;
    // Additional filters
    doctorId?: string;
    doctorIds?: string[];
    nurseId?: string;
    nurseIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    pelaksanaan?: string;
    assignedToMe?: boolean;
  }) {
    return this.retrievalService.getAllSessions(params);
  }

  async getUnfinishedSessionReminders(input: {
    userId: string;
    role: import('@prisma/client').Role;
    branchId: string | null;
  }) {
    return this.unfinishedReminderService.listForUser(input);
  }

  async deleteSession(sessionId: string, deletedBy: string) {
    return this.deletionService.deleteSession(sessionId, deletedBy);
  }

  async updateSessionDetails(
    sessionId: string,
    data: UpdateSessionDetailsInput,
    userId: string,
    branchId: string
  ) {
    return this.detailsService.updateSessionDetails(sessionId, data, userId, branchId);
  }

  // ============================================================
  // STEP 1: DIAGNOSIS
  // ============================================================

  async createDiagnosis(encounterId: string, data: CreateDiagnosisInput, userId: string) {
    return this.diagnosisService.createDiagnosis(encounterId, data, userId);
  }

  async getDiagnosisByEncounter(encounterId: string) {
    return this.diagnosisService.getDiagnosisByEncounter(encounterId);
  }

  async updateDiagnosis(encounterId: string, data: UpdateDiagnosisInput, userId: string) {
    return this.diagnosisService.updateDiagnosis(encounterId, data, userId);
  }

  async deleteDiagnosis(encounterId: string, userId: string) {
    return this.diagnosisService.deleteDiagnosis(encounterId, userId);
  }

  // ============================================================
  // STEP 2: THERAPY PLAN
  // ============================================================

  async createTherapyPlan(_sessionId: string, _data: CreateTherapyPlanInput, _userId: string) {
    throw {
      status: 410,
      code: 'THERAPY_PLAN_BULK_ONLY',
      message: 'Therapy plan sesi hanya sebagai acuan dari set bulk. Buat therapy plan melalui bulk di member detail.',
    };
  }

  async getTherapyPlan(sessionId: string) {
    return this.therapyPlanService.getTherapyPlan(sessionId);
  }

  async getTherapyPlanSetForSession(sessionId: string) {
    return this.therapyPlanService.getTherapyPlanSetForSession(sessionId);
  }

  async updateTherapyPlanSetForSession(
    sessionId: string,
    data: Omit<BulkEditSetInput, 'plans'> & {
      sessionPlanNumber?: number;
      plans?: BulkEditSetInput['plans'];
    },
    userId: string,
  ) {
    return this.therapyPlanService.updateTherapyPlanSetForSession(sessionId, data, userId);
  }

  // ============================================================
  // STEP 3 & 7: VITAL SIGNS
  // ============================================================

  async upsertVitalSign(sessionId: string, data: CreateVitalSignInput, userId: string) {
    return this.vitalSignsService.upsertVitalSign(sessionId, data, userId);
  }

  async getVitalSigns(sessionId: string) {
    return this.vitalSignsService.getVitalSigns(sessionId);
  }

  // ============================================================
  // STEP 4: INFUSION
  // ============================================================

  async createInfusion(sessionId: string, data: CreateInfusionInput, userId: string, branchId: string) {
    return this.infusionService.createInfusion(sessionId, data, userId, branchId);
  }

  async getInfusion(sessionId: string) {
    return this.infusionService.getInfusion(sessionId);
  }

  // ============================================================
  // STEP 4: BOOSTER (Conditional)
  // ============================================================

  async updateBoosterType(sessionId: string, boosterType: string, userId: string, branchId: string) {
    return this.boosterService.updateBoosterType(sessionId, boosterType, userId, branchId);
  }

  async updateSessionBoosterPackage(
    sessionId: string,
    data: UpdateSessionBoosterPackageInput,
    userId: string,
    branchId: string
  ) {
    return this.boosterService.updateSessionBoosterPackage(sessionId, data, userId, branchId);
  }

  async getBoosterStockAvailability(branchId: string) {
    return this.boosterService.getBoosterStockAvailability(branchId);
  }

  // ============================================================
  // STEP 5: MATERIAL USAGE
  // ============================================================

  async createMaterialUsage(sessionId: string, data: CreateMaterialUsageInput, userId: string, branchId: string) {
    return this.materialUsageService.createMaterialUsage(sessionId, data, userId, branchId);
  }

  async getMaterialUsages(sessionId: string) {
    return this.materialUsageService.getMaterialUsages(sessionId);
  }

  async deleteMaterialUsage(sessionId: string, usageId: string, userId: string, branchId: string) {
    return this.materialUsageService.deleteMaterialUsage(sessionId, usageId, userId, branchId);
  }

  // ============================================================
  // STEP 6: PHOTO UPLOAD
  // ============================================================

  async uploadPhoto(sessionId: string, file: Express.Multer.File, uploadedBy: string) {
    return this.photoService.uploadPhoto(sessionId, file, uploadedBy);
  }

  async deletePhoto(sessionId: string) {
    return this.photoService.deletePhoto(sessionId);
  }

  async getPhoto(sessionId: string) {
    return this.photoService.getPhoto(sessionId);
  }

  // ============================================================
  // STEP 8: EVALUATION
  // ============================================================

  async createEvaluation(sessionId: string, data: CreateEvaluationInput, userId: string) {
    return this.evaluationService.createEvaluation(sessionId, data, userId);
  }

  async updateEvaluation(sessionId: string, data: Partial<CreateEvaluationInput>, userId: string) {
    return this.evaluationService.updateEvaluation(sessionId, data, userId);
  }

  async getEvaluation(sessionId: string) {
    return this.evaluationService.getEvaluation(sessionId);
  }

  // ============================================================
  // SESSION COMPLETION
  // ============================================================

  async completeSession(sessionId: string, userId: string, input?: CompleteSessionInput) {
    return this.completionService.completeSession(sessionId, userId, input);
  }

  async cancelCompletion(sessionId: string, userId: string, input: CancelSessionCompletionInput) {
    return this.completionService.cancelCompletion(sessionId, userId, input);
  }

  async saveProgress(sessionId: string, userId: string, input: SaveSessionProgressInput) {
    return this.completionService.saveProgress(sessionId, userId, input);
  }

  async getSessionProgress(sessionId: string) {
    return this.completionService.getSessionProgress(sessionId);
  }
}
