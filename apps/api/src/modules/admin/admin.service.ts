// @ts-nocheck
import { AuditAction, PackageType, ProductCategory, Role } from '@prisma/client';
import { SystemStatsService } from './services/system-stats.service';
import { BranchPerformanceService } from './services/branch-performance.service';
import { AuditLogsService } from './services/audit-logs.service';
import { PackagePricingAdminService } from './services/package-pricing-admin.service';
import { UserManagementService } from './services/user-management.service';
import { MasterProductAdminService } from './services/master-product-admin.service';

/**
 * Main Admin Service - Orchestrates all admin-related operations
 * 
 * This service delegates to specialized services:
 * - SystemStatsService: System statistics and health monitoring
 * - BranchPerformanceService: Branch performance analytics
 * - AuditLogsService: Audit log management
 * - PackagePricingAdminService: Package pricing management
 * - UserManagementService: User management operations
 * - MasterProductAdminService: Master product management
 */
export class AdminService {
  private systemStatsService: SystemStatsService;
  private branchPerformanceService: BranchPerformanceService;
  private auditLogsService: AuditLogsService;
  private packagePricingService: PackagePricingAdminService;
  private userManagementService: UserManagementService;
  private masterProductService: MasterProductAdminService;

  constructor() {
    this.systemStatsService = new SystemStatsService();
    this.branchPerformanceService = new BranchPerformanceService();
    this.auditLogsService = new AuditLogsService();
    this.packagePricingService = new PackagePricingAdminService();
    this.userManagementService = new UserManagementService();
    this.masterProductService = new MasterProductAdminService();
  }

  // ============================================================
  // SYSTEM STATISTICS & HEALTH
  // ============================================================

  /**
   * Get system statistics
   */
  async getSystemStats() {
    return await this.systemStatsService.getSystemStats();
  }

  /**
   * Get system health status
   */
  async getSystemHealth() {
    return await this.systemStatsService.getSystemHealth();
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(limit: number = 20) {
    return await this.systemStatsService.getRecentActivities(limit);
  }

  // ============================================================
  // BRANCH PERFORMANCE
  // ============================================================

  /**
   * Get branch performance metrics
   */
  async getBranchPerformance() {
    return await this.branchPerformanceService.getBranchPerformance();
  }

  // ============================================================
  // AUDIT LOGS
  // ============================================================

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters: {
    userId?: string;
    action?: AuditAction;
    resource?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    return await this.auditLogsService.getAuditLogs(filters);
  }

  // ============================================================
  // PACKAGE PRICING MANAGEMENT
  // ============================================================

  /**
   * Get all package pricing with filtering
   */
  async getAllPackagePricing(filters: {
    packageType?: PackageType;
    branchId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    return await this.packagePricingService.getAllPackagePricing(filters);
  }

  /**
   * Get package pricing by ID
   */
  async getPackagePricing(pricingId: string) {
    return await this.packagePricingService.getPackagePricing(pricingId);
  }

  /**
   * Create package pricing
   */
  async createPackagePricing(data: {
    packageType: PackageType;
    totalSessions: number;
    price: number;
    isActive?: boolean;
    branchId?: string;
  }) {
    return await this.packagePricingService.createPackagePricing(data);
  }

  /**
   * Update package pricing
   */
  async updatePackagePricing(
    pricingId: string,
    data: {
      price?: number;
      isActive?: boolean;
    }
  ) {
    return await this.packagePricingService.updatePackagePricing(pricingId, data);
  }

  /**
   * Delete package pricing
   */
  async deletePackagePricing(pricingId: string) {
    return await this.packagePricingService.deletePackagePricing(pricingId);
  }

  // ============================================================
  // USER MANAGEMENT
  // ============================================================

  /**
   * Create admin manager
   */
  async createAdminManager(data: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber: string;
    adminManagerAccessScope?: 'FULL' | 'MEMBER_VIEW_ONLY';
    branchIds?: string[];
    branchAssignments?: Array<{
      branchId: string;
      accessScope?: 'FULL' | 'MEMBER_VIEW_ONLY';
    }>;
  }) {
    return await this.userManagementService.createAdminManager(data);
  }

  /**
   * Update admin manager
   */
  async updateAdminManager(
    managerId: string,
    data: {
      email?: string;
      password?: string;
      fullName?: string;
      phoneNumber?: string;
      adminManagerAccessScope?: 'FULL' | 'MEMBER_VIEW_ONLY';
      isActive?: boolean;
    },
    currentUserId: string
  ) {
    return await this.userManagementService.updateAdminManager(managerId, data, currentUserId);
  }

  /**
   * Delete admin manager
   */
  async deleteAdminManager(managerId: string, currentUserId: string) {
    return await this.userManagementService.deleteAdminManager(managerId, currentUserId);
  }

  /**
   * Get all users with filtering
   */
  async getAllUsers(filters: {
    role?: Role;
    branchId?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return await this.userManagementService.getAllUsers(filters);
  }

  // ============================================================
  // MASTER PRODUCT MANAGEMENT
  // ============================================================

  /**
   * Get all master products with filtering
   */
  async getAllMasterProducts(filters: {
    category?: ProductCategory;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return await this.masterProductService.getAllMasterProducts(filters);
  }

  /**
   * Get master product by ID
   */
  async getMasterProduct(productId: string) {
    return await this.masterProductService.getMasterProduct(productId);
  }

  /**
   * Create master product
   */
  async createMasterProduct(
    data: {
      name: string;
      category: ProductCategory;
      baseUnit: string;
      usageUnit: string;
      conversionFactor: number;
      description?: string;
    },
    userId: string
  ) {
    return await this.masterProductService.createMasterProduct(data, userId);
  }

  /**
   * Update master product
   */
  async updateMasterProduct(
    productId: string,
    data: {
      name?: string;
      category?: ProductCategory;
      baseUnit?: string;
      usageUnit?: string;
      conversionFactor?: number;
      description?: string;
      isActive?: boolean;
    },
    userId: string
  ) {
    return await this.masterProductService.updateMasterProduct(productId, data, userId);
  }

  /**
   * Delete master product
   */
  async deleteMasterProduct(productId: string, userId: string) {
    return await this.masterProductService.deleteMasterProduct(productId, userId);
  }

  /**
   * Get product categories
   */
  async getProductCategories() {
    return await this.masterProductService.getProductCategories();
  }
}
