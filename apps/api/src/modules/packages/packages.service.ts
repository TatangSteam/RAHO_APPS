// @ts-nocheck
import type { AssignPackageInput, VerifyPaymentInput, CreatePackagePricingInput, UpdatePackagePricingInput } from './packages.schema';
import { PackageAssignmentService } from './services/package-assignment.service';
import { PaymentVerificationService } from './services/payment-verification.service';
import { PackageRetrievalService } from './services/package-retrieval.service';
import { PackagePricingService } from './services/package-pricing.service';

/**
 * Main Packages Service - Orchestrates all package-related operations
 * 
 * This service delegates to specialized services:
 * - PackageAssignmentService: Handles package assignment to members
 * - PaymentVerificationService: Handles payment verification
 * - PackageRetrievalService: Handles fetching package data
 * - PackagePricingService: Handles package pricing management
 */
export class PackagesService {
  private assignmentService: PackageAssignmentService;
  private verificationService: PaymentVerificationService;
  private retrievalService: PackageRetrievalService;
  private pricingService: PackagePricingService;

  constructor() {
    this.assignmentService = new PackageAssignmentService();
    this.verificationService = new PaymentVerificationService();
    this.retrievalService = new PackageRetrievalService();
    this.pricingService = new PackagePricingService();
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
  async verifyPayment(packageId: string, data: VerifyPaymentInput, userId: string) {
    return await this.verificationService.verifyPayment(packageId, data, userId);
  }

  // ============================================================
  // PACKAGE RETRIEVAL
  // ============================================================

  /**
   * Get member packages with grouping
   */
  async getMemberPackages(memberId: string, branchId: string) {
    return await this.retrievalService.getMemberPackages(memberId, branchId);
  }

  // ============================================================
  // PACKAGE PRICING MANAGEMENT
  // ============================================================

  /**
   * Get package pricings for a branch
   */
  async getPackagePricings(branchId: string) {
    return await this.pricingService.getPackagePricings(branchId);
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
}
