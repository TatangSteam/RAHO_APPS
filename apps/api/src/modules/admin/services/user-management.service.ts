import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateStaffCode } from '../../../utils/codeGenerator';

type ManagerConversionRole = 'ADMIN_LOGISTIK' | 'FINANCE_LOGISTICS_CONTROLLER';

const MANAGER_CONVERSION_TEMPLATE_CODES: Record<ManagerConversionRole, string> = {
  [Role.ADMIN_LOGISTIK]: 'ADMIN_LOGISTIK_DEFAULT',
  [Role.FINANCE_LOGISTICS_CONTROLLER]: 'FINANCE_LOGISTICS_CONTROLLER_DEFAULT',
};

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
    adminManagerAccessScope?: 'FULL' | 'MEMBER_VIEW_ONLY';
    branchIds?: string[];
    branchAssignments?: Array<{
      branchId: string;
      accessScope?: 'FULL' | 'MEMBER_VIEW_ONLY';
    }>;
  }) {
    const branchAssignments = data.branchAssignments?.length
      ? data.branchAssignments.map((assignment) => ({
          branchId: assignment.branchId,
          accessScope: assignment.accessScope || data.adminManagerAccessScope || 'FULL',
        }))
      : (data.branchIds || []).map((branchId) => ({
          branchId,
          accessScope: data.adminManagerAccessScope || 'FULL',
        }));

    const branchIds = branchAssignments.map((assignment) => assignment.branchId);

    // A deleted account releases its original email. Any remaining owner is a
    // conflict, regardless of status, and must not be allowed to hit P2002 later.
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw {
        status: 409,
        code: 'EMAIL_EXISTS',
        message: 'Email sudah digunakan oleh user lain',
      };
    }

    // Validate branches
    const branches = await prisma.branch.findMany({
      where: { id: { in: branchIds } },
    });

    if (branches.length !== branchIds.length) {
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
        adminManagerAccessScope: data.adminManagerAccessScope || 'FULL',
        staffCode,
        isActive: true,
        profile: {
          create: {
            fullName: data.fullName,
            phone: data.phoneNumber, // Frontend sends phoneNumber, DB field is phone
          },
        },
        managedBranches: {
          create: branchAssignments.map((assignment) => ({
            branchId: assignment.branchId,
            accessScope: assignment.accessScope,
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
      adminManagerAccessScope: user.adminManagerAccessScope,
      isActive: user.isActive,
      profile: {
        fullName: user.profile?.fullName,
        phoneNumber: user.profile?.phone, // Map phone field to phoneNumber in response
      },
      managedBranches: user.managedBranches.map(mb => ({
        branchId: mb.branchId,
        branchName: mb.branch.name,
        branchCode: mb.branch.branchCode,
        accessScope: mb.accessScope,
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
      adminManagerAccessScope?: 'FULL' | 'MEMBER_VIEW_ONLY';
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

    // Check if new email already exists (if email is being changed).
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
    const updateData: Prisma.UserUpdateInput = {};
    const profileUpdateData: Prisma.UserProfileUpdateWithoutUserInput = {};

    if (data.email) {
      updateData.email = data.email;
    }

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    if (data.adminManagerAccessScope !== undefined) {
      if (!['FULL', 'MEMBER_VIEW_ONLY'].includes(data.adminManagerAccessScope)) {
        throw {
          status: 400,
          code: 'INVALID_ADMIN_MANAGER_ACCESS_SCOPE',
          message: 'Mode akses Admin Manager tidak valid',
        };
      }

      updateData.adminManagerAccessScope = data.adminManagerAccessScope;
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
          adminManagerAccessScope: data.adminManagerAccessScope ? { from: existingManager.adminManagerAccessScope, to: data.adminManagerAccessScope } : undefined,
          isActive: data.isActive !== undefined ? { from: existingManager.isActive, to: data.isActive } : undefined,
          passwordChanged: !!data.password,
        }
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      adminManagerAccessScope: updatedUser.adminManagerAccessScope,
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
   * Convert an Admin Manager into a global Logistics or Finance & Logistics
   * account. Only IAM assignments are replaced; business and audit history
   * remain linked to the same user id.
   */
  async convertAdminManagerRole(
    managerId: string,
    targetRole: ManagerConversionRole,
    currentUserId: string,
  ) {
    if (managerId === currentUserId) {
      throw {
        status: 403,
        code: 'SELF_ROLE_CONVERSION_DENIED',
        message: 'Anda tidak dapat mengubah role akun sendiri.',
      };
    }

    const [manager, roleTemplate] = await Promise.all([
      prisma.user.findUnique({
        where: { id: managerId },
        select: {
          id: true,
          email: true,
          role: true,
          profile: { select: { fullName: true } },
        },
      }),
      prisma.roleTemplate.findUnique({
        where: { code: MANAGER_CONVERSION_TEMPLATE_CODES[targetRole] },
        select: { id: true, code: true, name: true, isActive: true },
      }),
    ]);

    if (!manager || manager.role !== Role.ADMIN_MANAGER) {
      throw {
        status: 404,
        code: 'MANAGER_NOT_FOUND',
        message: 'Admin Manager tidak ditemukan.',
      };
    }

    if (!roleTemplate?.isActive) {
      throw {
        status: 422,
        code: 'ROLE_TEMPLATE_NOT_READY',
        message: `Template ${MANAGER_CONVERSION_TEMPLATE_CODES[targetRole]} belum tersedia atau tidak aktif.`,
      };
    }

    const operationalBranches = targetRole === Role.FINANCE_LOGISTICS_CONTROLLER
      ? await prisma.branch.findMany({
          where: { isActive: true, branchCode: { not: 'EXT' } },
          select: { id: true },
        })
      : [];

    const converted = await prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.managerBranch.deleteMany({ where: { userId: managerId } }),
        tx.staffBranch.deleteMany({ where: { userId: managerId } }),
      ]);

      if (targetRole === Role.FINANCE_LOGISTICS_CONTROLLER) {
        await Promise.all([
          tx.managerBranch.createMany({
            data: operationalBranches.map((branch) => ({
              userId: managerId,
              branchId: branch.id,
              accessScope: 'FULL',
            })),
            skipDuplicates: true,
          }),
          tx.staffBranch.createMany({
            data: operationalBranches.map((branch) => ({
              userId: managerId,
              branchId: branch.id,
            })),
            skipDuplicates: true,
          }),
        ]);
      }

      return tx.user.update({
        where: { id: managerId },
        data: {
          role: targetRole,
          roleTemplateId: roleTemplate.id,
          branchId: null,
          adminManagerAccessScope: 'FULL',
        },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          roleTemplate: { select: { id: true, code: true, name: true } },
          profile: { select: { fullName: true, phone: true } },
        },
      });
    });

    await logAudit({
      userId: currentUserId,
      action: AuditAction.UPDATE,
      module: 'IAM',
      resource: 'User',
      resourceId: managerId,
      entityType: 'User',
      entityId: managerId,
      description: `Admin Manager dikonversi menjadi ${roleTemplate.name}.`,
      beforeData: {
        role: manager.role,
        fullName: manager.profile?.fullName,
      },
      afterData: {
        role: converted.role,
        roleTemplateCode: converted.roleTemplate?.code,
        assignedBranchCount: operationalBranches.length,
      },
    });

    return {
      ...converted,
      assignedBranchCount: operationalBranches.length,
      historyPreserved: true,
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
    const where: Prisma.UserWhereInput = {};

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
        adminManagerAccessScope: user.adminManagerAccessScope,
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
