import { DocumentType, Role } from '@prisma/client';
import { MemberRetrievalService, type MemberFilters } from './services/member-retrieval.service';
import { MemberRegistrationService } from './services/member-registration.service';
import { MemberDocumentsService } from './services/member-documents.service';
import { MemberUpdateService } from './services/member-update.service';
import { MemberBranchAccessService } from './services/member-branch-access.service';
import {
  MemberMedicalRecordsService,
  type MemberDiagnosisInput,
} from './services/member-medical-records.service';
import {
  MemberTherapyPlanBulkService,
  type BulkCreateTherapyPlansInput,
} from './services/member-therapy-plan-bulk.service';
import {
  MemberTherapyPlanEditService,
  type EditTherapyPlanInput,
} from './services/member-therapy-plan-edit.service';
import {
  MemberTherapyPlanSetEditService,
  type BulkEditSetInput,
} from './services/member-therapy-plan-set-edit.service';
import { MemberDestructionService } from './services/member-destruction.service';

/**
 * Main Members Service - Orchestrates all member-related operations
 * 
 * This service delegates to specialized services:
 * - MemberRetrievalService: Handles fetching member data
 * - MemberRegistrationService: Handles member registration
 * - MemberUpdateService: Handles member updates and deletion
 * - MemberBranchAccessService: Handles branch access management
 * - MemberMedicalRecordsService: Handles medical records (diagnoses, therapy plans, infusions)
 * - MemberTherapyPlanBulkService: Handles bulk therapy plan creation
 * - MemberTherapyPlanEditService: Handles therapy plan editing with versioning
 */
export class MembersService {
  private retrievalService: MemberRetrievalService;
  private registrationService: MemberRegistrationService;
  private documentsService: MemberDocumentsService;
  private updateService: MemberUpdateService;
  private branchAccessService: MemberBranchAccessService;
  private medicalRecordsService: MemberMedicalRecordsService;
  private therapyPlanBulkService: MemberTherapyPlanBulkService;
  private therapyPlanEditService: MemberTherapyPlanEditService;
  private therapyPlanSetEditService: MemberTherapyPlanSetEditService;
  private destructionService: MemberDestructionService;

  constructor() {
    this.retrievalService = new MemberRetrievalService();
    this.registrationService = new MemberRegistrationService();
    this.documentsService = new MemberDocumentsService();
    this.updateService = new MemberUpdateService();
    this.branchAccessService = new MemberBranchAccessService();
    this.medicalRecordsService = new MemberMedicalRecordsService();
    this.therapyPlanBulkService = new MemberTherapyPlanBulkService();
    this.therapyPlanEditService = new MemberTherapyPlanEditService();
    this.therapyPlanSetEditService = new MemberTherapyPlanSetEditService();
    this.destructionService = new MemberDestructionService();
  }

  // ============================================================
  // MEMBER RETRIEVAL
  // ============================================================

  /**
   * Get members with filtering and pagination
   */
  async getMembers(branchId: string | null, role: Role, filters: MemberFilters) {
    return await this.retrievalService.getMembers(branchId, role, filters);
  }

  /**
   * Get members by specific branch
   */
  async getMembersByBranch(targetBranchId: string, filters: MemberFilters) {
    return await this.retrievalService.getMembersByBranch(targetBranchId, filters);
  }

  /**
   * Lookup member by member number
   */
  async lookupMember(memberNo: string, branchId: string | null, role: Role) {
    return await this.retrievalService.lookupMember(memberNo, branchId, role);
  }

  /**
   * Get member by ID
   */
  async getMemberById(memberId: string) {
    return await this.retrievalService.getMemberById(memberId);
  }

  /**
   * Get consent documents for a member
   */
  async getConsentDocuments(memberId: string) {
    return await this.retrievalService.getConsentDocuments(memberId);
  }

  /**
   * Get referral incentive records for a member
   */
  async getReferralIncentives(memberId: string) {
    return await this.retrievalService.getReferralIncentives(memberId);
  }

  // ============================================================
  // MEMBER REGISTRATION
  // ============================================================

  /**
   * Create new member
   */
  async createMember(
    data: Parameters<MemberRegistrationService['createMember']>[0],
    files: {
      psp?: Express.Multer.File;
      photo?: Express.Multer.File;
    },
    branchId: string,
    userId: string
  ) {
    return await this.registrationService.createMember(data, files, branchId, userId);
  }

  // ============================================================
  // MEMBER UPDATE
  // ============================================================

  /**
   * Update member
   */
  async updateMember(
    memberId: string,
    data: {
      fullName?: string;
      dateOfBirth?: string;
      gender?: string;
      phoneNumber?: string;
      email?: string;
      address?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      emergencyContactRelation?: string;
      photoUrl?: string;
      status?: string;
    },
    userId: string,
    actorRole: Role,
  ) {
    return await this.updateService.updateMember(memberId, data, userId, actorRole);
  }

  /**
   * Delete member (soft delete)
   */
  async deleteMember(memberId: string, userId: string) {
    return await this.updateService.deleteMember(memberId, userId);
  }

  async previewMemberDestruction(memberId: string) {
    return await this.destructionService.preview(memberId);
  }

  async destroyMember(
    memberId: string,
    input: Parameters<MemberDestructionService['destroy']>[1],
    userId: string,
  ) {
    return await this.destructionService.destroy(memberId, input, userId);
  }

  // ============================================================
  // BRANCH ACCESS MANAGEMENT
  // ============================================================

  /**
   * Grant branch access to member
   */
  async grantAccess(memberNo: string, branchId: string, userId: string) {
    return await this.branchAccessService.grantAccess(memberNo, branchId, userId);
  }

  // ============================================================
  // MEDICAL RECORDS
  // ============================================================

  /**
   * Send notification to member
   */
  async sendNotification(memberId: string, title: string, message: string, userId: string) {
    return await this.medicalRecordsService.sendNotification(memberId, title, message, userId);
  }

  /**
   * Get member diagnoses
   */
  async getMemberDiagnoses(memberId: string) {
    return await this.medicalRecordsService.getMemberDiagnoses(memberId);
  }

  /**
   * Create member diagnosis
   */
  async createMemberDiagnosis(memberId: string, data: MemberDiagnosisInput, userId: string) {
    return await this.medicalRecordsService.createMemberDiagnosis(memberId, data, userId);
  }

  /**
   * Update member diagnosis
   */
  async updateMemberDiagnosis(
    memberId: string,
    diagnosisId: string,
    data: MemberDiagnosisInput,
    userId: string,
  ) {
    return await this.medicalRecordsService.updateMemberDiagnosis(memberId, diagnosisId, data, userId);
  }

  /**
   * Delete member diagnosis
   */
  async deleteMemberDiagnosis(memberId: string, diagnosisId: string, userId: string) {
    return await this.medicalRecordsService.deleteMemberDiagnosis(memberId, diagnosisId, userId);
  }

  /**
   * Get member therapy plans
   */
  async getMemberTherapyPlans(memberId: string) {
    return await this.medicalRecordsService.getMemberTherapyPlans(memberId);
  }

  /**
   * Create member therapy plan
   */
  async createMemberTherapyPlan(_memberId: string, _data: unknown, _userId: string) {
    throw {
      status: 410,
      code: 'THERAPY_PLAN_BULK_ONLY',
      message: 'Therapy plan hanya bisa dibuat melalui bulk sebagai satu set.',
    };
  }

  /**
   * Get member infusions
   */
  async getMemberInfusions(memberId: string) {
    return await this.medicalRecordsService.getMemberInfusions(memberId);
  }

  // ============================================================
  // BULK THERAPY PLAN CREATION
  // ============================================================

  /**
   * Get member package summary for bulk therapy plan creation
   */
  async getMemberPackageSummary(memberId: string) {
    return await this.therapyPlanBulkService.getMemberPackageSummary(memberId);
  }

  /**
   * Bulk create therapy plans
   */
  async bulkCreateTherapyPlans(
    memberId: string,
    data: BulkCreateTherapyPlansInput,
    userId: string,
  ) {
    return await this.therapyPlanBulkService.bulkCreateTherapyPlans(memberId, data, userId);
  }

  /**
   * Edit therapy plan by creating a new version for the whole set.
   */
  async editTherapyPlan(therapyPlanId: string, data: EditTherapyPlanInput, _userId: string) {
    return await this.therapyPlanEditService.editTherapyPlan(therapyPlanId, data);
  }

  /**
   * Bulk edit therapy plan set (edit multiple plans at once, creates new set version)
   */
  async bulkEditTherapyPlanSet(setId: string, data: BulkEditSetInput, _userId: string) {
    return await this.therapyPlanSetEditService.bulkEditTherapyPlanSet(setId, data);
  }

  /**
   * Delete an unused therapy plan set.
   */
  async deleteTherapyPlanSet(memberId: string, setId: string, _userId: string) {
    return await this.therapyPlanSetEditService.deleteTherapyPlanSet(memberId, setId);
  }

  /**
   * Get therapy plan history (all versions)
   */
  async getTherapyPlanHistory(therapyPlanId: string) {
    return await this.therapyPlanEditService.getTherapyPlanHistory(therapyPlanId);
  }

  // ============================================================
  // CREDENTIAL MANAGEMENT (Super Admin Only)
  // ============================================================

  /**
   * Get member credentials (email, user info)
   */
  async getMemberCredentials(memberId: string) {
    return await this.updateService.getMemberCredentials(memberId);
  }

  async updateMemberUsername(memberId: string, username: string, adminUserId: string) {
    return await this.updateService.updateMemberUsername(memberId, username, adminUserId);
  }

  /**
   * Update member email
   */
  async updateMemberEmail(memberId: string, email: string, adminUserId: string) {
    return await this.updateService.updateMemberEmail(memberId, email, adminUserId);
  }

  /**
   * Reset member password
   */
  async resetMemberPassword(memberId: string, newPassword: string, adminUserId: string) {
    return await this.updateService.resetMemberPassword(memberId, newPassword, adminUserId);
  }

  // ============================================================
  // DOCUMENT UPLOAD (After Registration)
  // ============================================================

  /**
   * Upload member document (PSP or Profile Photo) after registration
   */
  async uploadMemberDocument(
    memberId: string,
    file: Express.Multer.File,
    documentType: DocumentType,
    userId: string
  ) {
    const document = await this.documentsService.uploadDocument(
      memberId,
      documentType,
      file,
      userId,
    );

    return {
      message: 'Dokumen berhasil diunggah.',
      document,
    };
  }
}

// Export MemberFilters type for use in other modules
export type { MemberFilters };
