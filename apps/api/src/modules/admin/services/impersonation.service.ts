import { prisma } from '@lib/prisma';
import { Role } from '@prisma/client';
import { signAccessToken } from '@lib/jwt';
import { logger } from '@lib/logger';

interface ImpersonationData {
  userId: string;
  email: string;
  role: Role;
  branchId?: string | null;
  adminManagerAccessScope?: string | null;
  branches?: string[];
  impersonating?: ImpersonationData;
}

interface ImpersonationTokenPayload {
  userId: string;
  email: string;
  role: Role;
  branchId: string | null;
  branchCode: string | null;
  adminManagerAccessScope?: string | null;
  fullName: string;
  staffCode: string | null;
  impersonating?: ImpersonationData;
}

export class ImpersonationService {
  /**
   * Create impersonation token for Super Admin → Admin Manager
   * or Admin Manager → Admin Cabang
   */
  async createImpersonationToken(
    currentUserId: string,
    targetUserId: string,
    currentToken?: ImpersonationTokenPayload
  ): Promise<{ token: string; targetUser: any }> {
    console.log('🔐 [ImpersonationService] createImpersonationToken called:', {
      currentUserId,
      targetUserId,
      hasCurrentToken: !!currentToken
    });

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: {
        branch: true,
        profile: true,
        managedBranches: {
          include: { branch: true }
        }
      }
    });

    if (!currentUser) {
      console.error('❌ [ImpersonationService] Current user not found:', currentUserId);
      throw {
        status: 404,
        code: 'USER_NOT_FOUND',
        message: 'User tidak ditemukan'
      };
    }

    console.log('✅ [ImpersonationService] Current user found:', {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
      isActive: currentUser.isActive
    });

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        branch: true,
        profile: true,
        managedBranches: {
          include: { branch: true }
        }
      }
    });

    if (!targetUser) {
      console.error('❌ [ImpersonationService] Target user not found:', targetUserId);
      throw {
        status: 404,
        code: 'TARGET_USER_NOT_FOUND',
        message: 'User target tidak ditemukan'
      };
    }

    console.log('✅ [ImpersonationService] Target user found:', {
      id: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      isActive: targetUser.isActive,
      branchId: targetUser.branchId,
      managedBranchesCount: targetUser.managedBranches.length
    });

    if (!targetUser.isActive) {
      console.error('❌ [ImpersonationService] Target user is inactive');
      throw {
        status: 400,
        code: 'TARGET_USER_INACTIVE',
        message: 'Tidak dapat impersonate user yang tidak aktif'
      };
    }

    // Validate impersonation permissions
    console.log('🔍 [ImpersonationService] Validating impersonation permissions...');
    await this.validateImpersonation(currentUser, targetUser, currentToken);
    console.log('✅ [ImpersonationService] Validation passed');

    // Build impersonation data
    const impersonationData: ImpersonationData = {
      userId: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      adminManagerAccessScope: targetUser.role === 'ADMIN_MANAGER'
        ? targetUser.adminManagerAccessScope
        : null,
    };

    // Add branch data based on role
    if (targetUser.role === 'ADMIN_MANAGER') {
      // Admin Manager: multiple branches
      const branchIds = targetUser.managedBranches.map(mb => mb.branchId);
      impersonationData.branches = branchIds;
      console.log('📋 [ImpersonationService] Target is ADMIN_MANAGER with branches:', branchIds);
    } else if (targetUser.role === 'ADMIN_CABANG' && targetUser.branchId) {
      // Admin Cabang: single branch
      impersonationData.branchId = targetUser.branchId;
      console.log('📋 [ImpersonationService] Target is ADMIN_CABANG with branchId:', targetUser.branchId);
    }

    // Build token payload
    let tokenPayload: ImpersonationTokenPayload;

    if (currentToken?.impersonating) {
      // Nested impersonation (Super Admin → Admin Manager → Admin Cabang)
      console.log('🔗 [ImpersonationService] Creating nested impersonation token');
      tokenPayload = {
        userId: currentToken.userId, // Original Super Admin
        email: currentToken.email,
        role: currentToken.role as Role,
        branchId: null,
        branchCode: null,
        adminManagerAccessScope: currentToken.adminManagerAccessScope || null,
        fullName: currentToken.fullName,
        staffCode: null,
        impersonating: {
          ...currentToken.impersonating,
          impersonating: impersonationData // Nest the new impersonation
        }
      };
    } else {
      // Direct impersonation (Super Admin → Admin Manager or Admin Manager → Admin Cabang)
      console.log('🔗 [ImpersonationService] Creating direct impersonation token');
      tokenPayload = {
        userId: currentUser.id,
        email: currentUser.email,
        role: currentUser.role,
        branchId: currentUser.branchId,
        branchCode: currentUser.branch?.branchCode || null,
        adminManagerAccessScope: currentUser.role === 'ADMIN_MANAGER'
          ? currentUser.adminManagerAccessScope
          : null,
        fullName: currentUser.profile?.fullName || currentUser.email,
        staffCode: currentUser.staffCode,
        impersonating: impersonationData
      };
    }

    // Generate JWT token with 8 hour expiration
    const token = signAccessToken(tokenPayload, '8h');

    logger.info('[ImpersonationService] Impersonation started', {
      originalUser: currentUser.email,
      targetUser: targetUser.email,
      targetRole: targetUser.role,
      isNested: !!currentToken?.impersonating
    });

    console.log('✅ [ImpersonationService] Token generated successfully');

    return {
      token,
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        fullName: targetUser.profile?.fullName || targetUser.email,
        role: targetUser.role,
        branchId: targetUser.branchId,
        branchCode: targetUser.branch?.branchCode || null,
        adminManagerAccessScope: targetUser.role === 'ADMIN_MANAGER'
          ? targetUser.adminManagerAccessScope
          : null,
        branches: targetUser.role === 'ADMIN_MANAGER' 
          ? targetUser.managedBranches.map(mb => ({
              id: mb.branchId,
              name: mb.branch.name,
              branchCode: mb.branch.branchCode
            }))
          : undefined
      }
    };
  }

  /**
   * Stop impersonation - go back one level
   */
  async stopImpersonation(currentToken: ImpersonationTokenPayload): Promise<{ token: string; user: any }> {
    if (!currentToken.impersonating) {
      throw {
        status: 400,
        code: 'NOT_IMPERSONATING',
        message: 'Tidak sedang dalam mode impersonation'
      };
    }

    // Check if nested impersonation
    if (currentToken.impersonating.impersonating) {
      // Go back one level (Admin Cabang → Admin Manager)
      const newTokenPayload: ImpersonationTokenPayload = {
        userId: currentToken.userId,
        email: currentToken.email,
        role: currentToken.role,
        branchId: currentToken.branchId,
        branchCode: currentToken.branchCode,
        adminManagerAccessScope: currentToken.adminManagerAccessScope || null,
        fullName: currentToken.fullName,
        staffCode: currentToken.staffCode,
        impersonating: {
          userId: currentToken.impersonating.userId,
          email: currentToken.impersonating.email,
          role: currentToken.impersonating.role,
          branchId: currentToken.impersonating.branchId,
          adminManagerAccessScope: currentToken.impersonating.adminManagerAccessScope || null,
          branches: currentToken.impersonating.branches
        }
      };

      const token = signAccessToken(newTokenPayload, '8h');

      // Get user data for the level we're returning to
      const user = await prisma.user.findUnique({
        where: { id: currentToken.impersonating.userId },
        include: {
          branch: true,
          profile: true,
          managedBranches: { include: { branch: true } }
        }
      });

      logger.info('[ImpersonationService] Nested impersonation stopped - going back one level', {
        originalUser: currentToken.email,
        returningTo: currentToken.impersonating.email
      });

      return {
        token,
        user: {
          id: user!.id,
          email: user!.email,
          fullName: user!.profile?.fullName || user!.email,
          role: user!.role,
          branchId: user!.branchId,
          branchCode: user!.branch?.branchCode || null,
          adminManagerAccessScope: user!.role === 'ADMIN_MANAGER'
            ? user!.adminManagerAccessScope
            : null,
          branches: user!.role === 'ADMIN_MANAGER'
            ? user!.managedBranches.map(mb => ({
                id: mb.branchId,
                name: mb.branch.name,
                branchCode: mb.branch.branchCode
              }))
            : undefined
        }
      };
    } else {
      // Return to original user (Admin Manager → Super Admin or Admin Cabang → Admin Manager)
      const newTokenPayload: ImpersonationTokenPayload = {
        userId: currentToken.userId,
        email: currentToken.email,
        role: currentToken.role,
        branchId: currentToken.branchId,
        branchCode: currentToken.branchCode,
        adminManagerAccessScope: currentToken.adminManagerAccessScope || null,
        fullName: currentToken.fullName,
        staffCode: currentToken.staffCode
      };

      const token = signAccessToken(newTokenPayload, '24h'); // Normal token expiration

      // Get original user data
      const user = await prisma.user.findUnique({
        where: { id: currentToken.userId },
        include: {
          branch: true,
          profile: true,
          managedBranches: { include: { branch: true } }
        }
      });

      logger.info('[ImpersonationService] Impersonation stopped - returning to original user', {
        originalUser: currentToken.email,
        impersonatedUser: currentToken.impersonating.email
      });

      return {
        token,
        user: {
          id: user!.id,
          email: user!.email,
          fullName: user!.profile?.fullName || user!.email,
          role: user!.role,
          branchId: user!.branchId,
          branchCode: user!.branch?.branchCode || null,
          adminManagerAccessScope: user!.role === 'ADMIN_MANAGER'
            ? user!.adminManagerAccessScope
            : null,
          branches: user!.role === 'ADMIN_MANAGER'
            ? user!.managedBranches.map(mb => ({
                id: mb.branchId,
                name: mb.branch.name,
                branchCode: mb.branch.branchCode
              }))
            : undefined
        }
      };
    }
  }

  /**
   * Validate if current user can impersonate target user
   */
  private async validateImpersonation(
    currentUser: any,
    targetUser: any,
    currentToken?: ImpersonationTokenPayload
  ): Promise<void> {
    console.log('🔍 [validateImpersonation] Starting validation:', {
      currentUserRole: currentUser.role,
      targetUserRole: targetUser.role,
      hasCurrentToken: !!currentToken,
      isAlreadyImpersonating: !!currentToken?.impersonating
    });

    // Determine the effective role (if already impersonating, use the deepest level)
    const effectiveRole = currentToken?.impersonating?.impersonating?.role 
      || currentToken?.impersonating?.role 
      || currentUser.role;

    console.log('🔍 [validateImpersonation] Effective role:', effectiveRole);

    // Rule 1: Super Admin can impersonate Admin Manager
    if (currentUser.role === 'SUPER_ADMIN' && !currentToken?.impersonating) {
      console.log('🔍 [validateImpersonation] Rule 1: SUPER_ADMIN impersonating');
      if (targetUser.role !== 'ADMIN_MANAGER') {
        console.error('❌ [validateImpersonation] SUPER_ADMIN can only impersonate ADMIN_MANAGER, target is:', targetUser.role);
        throw {
          status: 403,
          code: 'INVALID_IMPERSONATION_TARGET',
          message: 'Super Admin hanya dapat impersonate Admin Manager'
        };
      }
      console.log('✅ [validateImpersonation] Rule 1 passed');
      return;
    }

    // Rule 2: Admin Manager can impersonate Admin Cabang (only from assigned branches)
    if (effectiveRole === 'ADMIN_MANAGER') {
      console.log('🔍 [validateImpersonation] Rule 2: ADMIN_MANAGER impersonating');
      if (targetUser.role !== 'ADMIN_CABANG') {
        console.error('❌ [validateImpersonation] ADMIN_MANAGER can only impersonate ADMIN_CABANG, target is:', targetUser.role);
        throw {
          status: 403,
          code: 'INVALID_IMPERSONATION_TARGET',
          message: 'Admin Manager hanya dapat impersonate Admin Cabang'
        };
      }

      // Check if target Admin Cabang is in one of the manager's branches
      const managerBranchIds = currentToken?.impersonating?.branches 
        || currentUser.managedBranches.map((mb: any) => mb.branchId);

      console.log('🔍 [validateImpersonation] Manager branch IDs:', managerBranchIds);
      console.log('🔍 [validateImpersonation] Target branch ID:', targetUser.branchId);

      if (!targetUser.branchId || !managerBranchIds.includes(targetUser.branchId)) {
        console.error('❌ [validateImpersonation] Target Admin Cabang not in manager branches');
        throw {
          status: 403,
          code: 'BRANCH_ACCESS_DENIED',
          message: 'Admin Cabang ini tidak ada di branches yang Anda kelola'
        };
      }
      console.log('✅ [validateImpersonation] Rule 2 passed');
      return;
    }

    // Rule 3: Cannot impersonate same or higher role
    console.error('❌ [validateImpersonation] No valid impersonation rule matched');
    throw {
      status: 403,
      code: 'IMPERSONATION_NOT_ALLOWED',
      message: 'Anda tidak memiliki izin untuk melakukan impersonation'
    };
  }

  /**
   * Get Admin Managers (for Super Admin)
   */
  async getAdminManagers(filters?: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ managers: any[]; pagination: any }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      role: 'ADMIN_MANAGER'
    };

    if (filters?.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [managers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          profile: true,
          managedBranches: {
            include: {
              branch: {
                select: {
                  id: true,
                  name: true,
                  branchCode: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    return {
      managers: managers.map(manager => ({
        id: manager.id,
        email: manager.email,
        fullName: manager.profile?.fullName || manager.email,
        phoneNumber: manager.profile?.phone || '',
        adminManagerAccessScope: manager.adminManagerAccessScope,
        isActive: manager.isActive,
        branches: manager.managedBranches.map(mb => mb.branch),
        createdAt: manager.createdAt,
        lastLoginAt: manager.lastLoginAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get Branch Admins (for Admin Manager)
   */
  async getBranchAdmins(
    managerBranchIds: string[],
    filters?: {
      branchId?: string;
      search?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<{ admins: any[]; pagination: any }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      role: 'ADMIN_CABANG',
      branchId: {
        in: managerBranchIds
      }
    };

    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters?.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [admins, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          profile: true,
          branch: {
            select: {
              id: true,
              name: true,
              branchCode: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    return {
      admins: admins.map(admin => ({
        id: admin.id,
        email: admin.email,
        fullName: admin.profile?.fullName || admin.email,
        isActive: admin.isActive,
        branch: admin.branch,
        createdAt: admin.createdAt,
        lastLoginAt: admin.lastLoginAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get impersonation chain from token
   */
  getImpersonationChain(token: ImpersonationTokenPayload): string[] {
    const chain: string[] = [token.email];

    let current = token.impersonating;
    while (current) {
      chain.push(current.email);
      current = current.impersonating;
    }

    return chain;
  }

  /**
   * Check if user can impersonate
   */
  canImpersonate(role: Role, currentToken?: ImpersonationTokenPayload): boolean {
    // Super Admin can always impersonate (if not already impersonating)
    if (role === 'SUPER_ADMIN' && !currentToken?.impersonating) {
      return true;
    }

    // Admin Manager can impersonate (if not already at max depth)
    if (role === 'ADMIN_MANAGER' || currentToken?.impersonating?.role === 'ADMIN_MANAGER') {
      // Check depth: max 2 levels (Super Admin → Admin Manager → Admin Cabang)
      if (currentToken?.impersonating?.impersonating) {
        return false; // Already at max depth
      }
      return true;
    }

    return false;
  }
}
