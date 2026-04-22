// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

    // Create user and assign branches
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: Role.ADMIN_MANAGER,
        isActive: true,
        profile: {
          create: {
            fullName: data.fullName,
            phoneNumber: data.phoneNumber,
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
        phoneNumber: user.profile?.phoneNumber,
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
        { profile: { phoneNumber: { contains: search, mode: 'insensitive' } } },
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
          phoneNumber: user.profile?.phoneNumber,
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
