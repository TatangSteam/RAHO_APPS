// @ts-nocheck
import type {
  CreateSessionInput,
  CreateDiagnosisInput,
  CreateTherapyPlanInput,
  CreateVitalSignInput,
  CreateInfusionInput,
  CreateMaterialUsageInput,
  CreateEvaluationInput,
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
  }

  // ============================================================
  // SESSION CREATION & RETRIEVAL
  // ============================================================

  async createSession(data: CreateSessionInput, branchId: string, userId: string) {
    return this.creationService.createSession(data, branchId, userId);
  }

  async getSessionById(sessionId: string) {
    return this.retrievalService.getSessionById(sessionId);
  }

  async getAllSessions(params: { memberId?: string; page?: number; limit?: number }) {
    return this.retrievalService.getAllSessions(params);
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

  // ============================================================
  // STEP 2: THERAPY PLAN
  // ============================================================

  async createTherapyPlan(sessionId: string, data: CreateTherapyPlanInput, userId: string) {
    return this.therapyPlanService.createTherapyPlan(sessionId, data, userId);
  }

  async getTherapyPlan(sessionId: string) {
    return this.therapyPlanService.getTherapyPlan(sessionId);
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

  async completeSession(sessionId: string, userId: string) {
    return this.completionService.completeSession(sessionId, userId);
  }

  async saveProgress(sessionId: string, userId: string) {
    return this.completionService.saveProgress(sessionId, userId);
  }

  async getSessionProgress(sessionId: string) {
    return this.completionService.getSessionProgress(sessionId);
  }
}
