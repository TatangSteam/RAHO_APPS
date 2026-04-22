// @ts-nocheck
import { Role } from '@prisma/client';
import { MemberRetrievalService, type MemberFilters } from './services/member-retrieval.service';
import { MemberRegistrationService } from './services/member-registration.service';
import { MemberUpdateService } from './services/member-update.service';
import { MemberBranchAccessService } from './services/member-branch-access.service';
import { MemberMedicalRecordsService } from './services/member-medical-records.service';

/**
 * Main Members Service - Orchestrates all member-related operations
 * 
 * This service delegates to specialized services:
 * - MemberRetrievalService: Handles fetching member data
 * - MemberRegistrationService: Handles member registration
 * - MemberUpdateService: Handles member updates and deletion
 * - MemberBranchAccessService: Handles branch access management
 * - MemberMedicalRecordsService: Handles medical records (diagnoses, therapy plans, infusions)
 */
export class MembersService {
  private retrievalService: MemberRetrievalService;
  private registrationService: MemberRegistrationService;
  private updateService: MemberUpdateService;
  private branchAccessService: MemberBranchAccessService;
  private medicalRecordsService: MemberMedicalRecordsService;

  constructor() {
    this.retrievalService = new MemberRetrievalService();
    this.registrationService = new MemberRegistrationService();
    this.updateService = new MemberUpdateService();
    this.branchAccessService = new MemberBranchAccessService();
    this.medicalRecordsService = new MemberMedicalRecordsService();
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

  // ============================================================
  // MEMBER REGISTRATION
  // ============================================================

  /**
   * Create new member
   */
  async createMember(
    data: {
      fullName: string;
      nik?: string;
      birthPlace?: string;
      birthDate?: string;
      gender?: string;
      phone: string;
      email?: string;
      address?: string;
      occupation?: string;
      maritalStatus?: string;
      emergencyContact?: string;
      emergencyContactPhone?: string;
      infoSource?: string;
      postalCode?: string;
      memberEmail: string;
      memberPassword: string;
      referralCode?: string;
      isConsentToPhoto?: boolean;
    },
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
    userId: string
  ) {
    return await this.updateService.updateMember(memberId, data, userId);
  }

  /**
   * Delete member (soft delete)
   */
  async deleteMember(memberId: string, userId: string) {
    return await this.updateService.deleteMember(memberId, userId);
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
  async createMemberDiagnosis(memberId: string, data: any, userId: string) {
    return await this.medicalRecordsService.createMemberDiagnosis(memberId, data, userId);
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
  async createMemberTherapyPlan(memberId: string, data: any, userId: string) {
    return await this.medicalRecordsService.createMemberTherapyPlan(memberId, data, userId);
  }

  /**
   * Get member infusions
   */
  async getMemberInfusions(memberId: string) {
    return await this.medicalRecordsService.getMemberInfusions(memberId);
  }
}

// Export MemberFilters type for use in other modules
export type { MemberFilters };
