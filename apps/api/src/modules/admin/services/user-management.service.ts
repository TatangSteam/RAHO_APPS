// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateStaffCode } from '../../../utils/codeGenerator';

/**
 * Service for user management (admin operations)
 */
export class UserManagementService {
  /**
   * Create admin manager
   */
  async createAdminManager(data: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber: string;
    branchIds: string[];
  }) {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw {
        status: 409,
        code: 'EMAIL_EXISTS',
        message: 'Email sudah terdaftar',
      };
    }

    // Validate branches
    const branches = await prisma.branch.findMany({
      where: { id: { in: data.branchIds } },
    });

    if (branches.length !== data.branchIds.length) {
      throw {
        status: 404,
        code: 'BRANCH_NOT_FOUND',
        message: 'Beberapa cabang tidak ditemukan',
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Generate staff code
    const staffCode = generateStaffCode(Role.ADMIN_MANAGER);

    // Create user and assign branches
    // IMPORTANT: UserProfile model uses 'phone' field, not 'phoneNumber'
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: Role.ADMIN_MANAGER,
        staffCode,
        isActive: true,
        profile: {
          create: {
            fullName: data.fullName,
            phone: data.phoneNumber, // Frontend sends phoneNumber, DB field is phone
          },
        },
        managedBranches: {
          create: data.branchIds.map(branchId => ({
            branchId,
          })),
        },
      },
      include: {
        profile: true,
        managedBranches: {
          include: {
            branch: true,
          },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      profile: {
        fullName: user.profile?.fullName,
        phoneNumber: user.profile?.phone, // Map phone field to phoneNumber in response
      },
      managedBranches: user.managedBranches.map(mb => ({
        branchId: mb.branchId,
        branchName: mb.branch.name,
        branchCode: mb.branch.branchCode,
      })),
      createdAt: user.createdAt.toISOString(),
    };
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
      isActive?: boolean;
    },
    currentUserId: string
  ) {
    // Find existing manager
    const existingManager = await prisma.user.findUnique({
      where: { id: managerId },
      include: { profile: true }
    });

    if (!existingManager || existingManager.role !== 'ADMIN_MANAGER') {
      throw {
        status: 404,
        code: 'MANAGER_NOT_FOUND',
        message: 'Admin Manager tidak ditemukan',
      };
    }

    // Check if new email already exists (if email is being changed)
    if (data.email && data.email !== existingManager.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw {
          status: 409,
          code: 'EMAIL_EXISTS',
          message: 'Email sudah digunakan oleh user lain',
        };
      }
    }

    // Prepare update data
    const updateData: any = {};
    const profileUpdateData: any = {};

    if (data.email) {
      updateData.email = data.email;
    }

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    if (data.fullName) {
      profileUpdateData.fullName = data.fullName;
    }

    if (data.phoneNumber) {
      profileUpdateData.phone = data.phoneNumber;
    }

    // Update user and profile
    const updatedUser = await prisma.user.update({
      where: { id: managerId },
      data: {
        ...updateData,
        ...(Object.keys(profileUpdateData).length > 0 && {
          profile: {
            update: profileUpdateData
          }
        })
      },
      include: {
        profile: true,
        managedBranches: {
          include: {
            branch: true,
          },
        },
      },
    });

    // Audit log
    await logAudit({
      userId: currentUserId,
      action: AuditAction.UPDATE,
      resource: 'User',
      resourceId: managerId,
      meta: {
        action: 'update_admin_manager',
        managerId,
        managerEmail: updatedUser.email,
        changes: {
          email: data.email ? { from: existingManager.email, to: data.email } : undefined,
          fullName: data.fullName ? { from: existingManager.profile?.fullName, to: data.fullName } : undefined,
          phoneNumber: data.phoneNumber ? { from: existingManager.profile?.phone, to: data.phoneNumber } : undefined,
          isActive: data.isActive !== undefined ? { from: existingManager.isActive, to: data.isActive } : undefined,
          passwordChanged: !!data.password,
        }
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      profile: {
        fullName: updatedUser.profile?.fullName,
        phoneNumber: updatedUser.profile?.phone,
      },
      managedBranches: updatedUser.managedBranches.map(mb => ({
        branchId: mb.branchId,
        branchName: mb.branch.name,
        branchCode: mb.branch.branchCode,
      })),
      updatedAt: updatedUser.updatedAt.toISOString(),
    };
  }

  /**
   * Delete admin manager
   */
  async deleteAdminManager(managerId: string, currentUserId: string) {
    // Find existing manager
    const existingManager = await prisma.user.findUnique({
      where: { id: managerId },
      include: { 
        profile: true,
        managedBranches: true
      }
    });

    if (!existingManager || existingManager.role !== 'ADMIN_MANAGER') {
      throw {
        status: 404,
        code: 'MANAGER_NOT_FOUND',
        message: 'Admin Manager tidak ditemukan',
      };
    }

    // Delete in transaction: manager branches, profile, and user
    await prisma.$transaction(async (tx) => {
      // Delete manager branch assignments
      await tx.managerBranch.deleteMany({
        where: { userId: managerId }
      });

      // Delete user profile if exists
      if (existingManager.profile) {
        await tx.userProfile.delete({
          where: { userId: managerId }
        });
      }

      // Delete user
      await tx.user.delete({
        where: { id: managerId }
      });
    });

    // Audit log
    await logAudit({
      userId: currentUserId,
      action: AuditAction.DELETE,
      resource: 'User',
      resourceId: managerId,
      meta: {
        action: 'delete_admin_manager',
        managerId,
        managerEmail: existingManager.email,
        managerName: existingManager.profile?.fullName,
        branchCount: existingManager.managedBranches.length,
      },
    });

    return {
      message: `Admin Manager ${existingManager.profile?.fullName || existingManager.email} berhasil dihapus`,
    };
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
    const {
      role,
      branchId,
      isActive,
      search,
      page = 1,
      limit = 50,
    } = filters;

    // Build where clause
    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (branchId) {
      where.OR = [
        { branchId },
        { managedBranches: { some: { branchId } } },
      ];
    }

    if (search) {
      where.OR = [
        ...(where.OR || []),
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { fullName: { contains: search, mode: 'insensitive' } } },
        { profile: { phone: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Get total count
    const total = await prisma.user.count({ where });

    // Get users with pagination
    const users = await prisma.user.findMany({
      where,
      include: {
        profile: true,
        branch: {
          select: {
            id: true,
            name: true,
            branchCode: true,
          },
        },
        managedBranches: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                branchCode: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        profile: {
          fullName: user.profile?.fullName,
          phoneNumber: user.profile?.phone, // Map phone to phoneNumber in response
        },
        branch: user.branch ? {
          id: user.branch.id,
          name: user.branch.name,
          branchCode: user.branch.branchCode,
        } : null,
        managedBranches: user.managedBranches?.map(mb => ({
          branchId: mb.branchId,
          branchName: mb.branch.name,
          branchCode: mb.branch.branchCode,
        })) || [],
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
