import type { AdjustVoucherBalanceInput, AssignPackageInput, VerifyPaymentInput, CreatePackagePricingInput, UpdatePackagePricingInput } from './packages.schema';
import { PackageAssignmentService } from './services/package-assignment.service';
import { PaymentVerificationService } from './services/payment-verification.service';
import { PackageRetrievalService } from './services/package-retrieval.service';
import { PackagePricingService } from './services/package-pricing.service';
import { PackageRefundService } from './services/package-refund.service';
import { PackageCancelService } from './services/package-cancel.service';
import { PackageEditService } from './services/package-edit.service';
import { VoucherBalanceAdjustmentService } from './services/voucher-balance-adjustment.service';

/**
 * Main Packages Service - Orchestrates all package-related operations
 * 
 * This service delegates to specialized services:
 * - PackageAssignmentService: Handles package assignment to members
 * - PaymentVerificationService: Handles payment verification
 * - PackageRetrievalService: Handles fetching package data
 * - PackagePricingService: Handles package pricing management
 * - PackageRefundService: Handles refunding ACTIVE packages
 * - PackageCancelService: Handles cancelling PENDING_PAYMENT packages
 * - PackageEditService: Handles editing PENDING_PAYMENT packages
 */
export class PackagesService {
  private assignmentService: PackageAssignmentService;
  private verificationService: PaymentVerificationService;
  private retrievalService: PackageRetrievalService;
  private pricingService: PackagePricingService;
  private refundService: PackageRefundService;
  private cancelService: PackageCancelService;
  private editService: PackageEditService;
  private voucherBalanceAdjustmentService: VoucherBalanceAdjustmentService;

  constructor() {
    this.assignmentService = new PackageAssignmentService();
    this.verificationService = new PaymentVerificationService();
    this.retrievalService = new PackageRetrievalService();
    this.pricingService = new PackagePricingService();
    this.refundService = new PackageRefundService();
    this.cancelService = new PackageCancelService();
    this.editService = new PackageEditService();
    this.voucherBalanceAdjustmentService = new VoucherBalanceAdjustmentService();
  }

  // ============================================================
  // PACKAGE ASSIGNMENT
  // ============================================================

  /**
   * Assign package to member
   */
  async assignPackage(
    memberId: string,
    data: AssignPackageInput,
    branchId: string,
    userId: string
  ) {
    return await this.assignmentService.assignPackage(memberId, data, branchId, userId);
  }

  // ============================================================
  // PAYMENT VERIFICATION
  // ============================================================

  /**
   * Verify payment for package or add-on
   */
  async verifyPayment(packageId: string, data: VerifyPaymentInput, branchId: string | undefined, userId: string) {
    return await this.verificationService.verifyPayment(packageId, data, branchId, userId);
  }

  /**
   * Reject payment for package or add-on
   */
  async rejectPayment(packageId: string, rejectionReason: string, branchId: string | undefined, userId: string) {
    return await this.verificationService.rejectPayment(packageId, rejectionReason, branchId, userId);
  }

  // ============================================================
  // PACKAGE RETRIEVAL
  // ============================================================

  /**
   * Get member packages with grouping
   */
  async getMemberPackages(memberId: string, branchIds: string | string[]) {
    return await this.retrievalService.getMemberPackages(memberId, branchIds);
  }

  // ============================================================
  // PACKAGE PRICING MANAGEMENT
  // ============================================================

  /**
   * Get package pricings for a branch
   */
  async getPackagePricings(
    branchId: string,
    options: { includeGlobalFallback?: boolean } = {},
  ) {
    return await this.pricingService.getPackagePricings(branchId, options);
  }

  /**
   * Get all package pricings (for super admin)
   */
  async getAllPackagePricings() {
    return await this.pricingService.getAllPackagePricings();
  }

  /**
   * Create package pricing
   */
  async createPackagePricing(data: CreatePackagePricingInput, branchId: string, userId: string) {
    return await this.pricingService.createPackagePricing(data, branchId, userId);
  }

  /**
   * Update package pricing
   */
  async updatePackagePricing(pricingId: string, data: UpdatePackagePricingInput, userId: string) {
    return await this.pricingService.updatePackagePricing(pricingId, data, userId);
  }

  /**
   * Delete package pricing
   */
  async deletePackagePricing(pricingId: string, userId: string) {
    return await this.pricingService.deletePackagePricing(pricingId, userId);
  }

  // ============================================================
  // PACKAGE REFUND
  // ============================================================

  /**
   * Refund an ACTIVE package
   */
  async refundPackage(
    packageId: string,
    data: { reason: string; refundAmount?: number },
    userId: string,
    branchId: string | null,
    refundProofFile?: Express.Multer.File
  ) {
    return await this.refundService.refundPackage(packageId, data, userId, branchId, refundProofFile);
  }

  // ============================================================
  // PACKAGE CANCEL
  // ============================================================

  /**
   * Cancel a PENDING_PAYMENT package
   */
  async cancelPackage(
    packageId: string,
    data: { reason: string },
    userId: string,
    branchId: string | null
  ) {
    return await this.cancelService.cancelPackage(packageId, data, userId, branchId);
  }

  // ============================================================
  // PACKAGE EDIT
  // ============================================================

  /**
   * Edit an editable pending package
   */
  async editPackage(
    packageId: string,
    data: { quantity?: number; discount?: number; discountNote?: string; notes?: string },
    userId: string,
    branchId: string | null,
    userRole?: string
  ) {
    return await this.editService.editPackage(packageId, data, userId, branchId, userRole);
  }

  async adjustVoucherBalance(
    packageId: string,
    data: AdjustVoucherBalanceInput,
    userId: string,
    userRole?: string,
  ) {
    return await this.voucherBalanceAdjustmentService.adjustVoucherBalance(
      packageId,
      data,
      userId,
      userRole,
    );
  }
}
