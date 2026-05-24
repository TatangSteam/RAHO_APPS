import bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { generateStaffCode } from '@utils/codeGenerator';
import {
  CreateUserInput,
  UpdateUserInput,
  ChangePasswordInput,
  ResetPasswordInput,
  ListUsersQuery,
} from './users.schema';

const HASH_ROUNDS = 12;

// ── Shared User Select ───────────────────────────────────────

const userSelect = {
  id: true,
  email: true,
  role: true,
  staffCode: true,
  branchId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  profile: { select: { fullName: true, phone: true, avatarUrl: true } },
  branch: { select: { id: true, branchCode: true, name: true } },
} satisfies Prisma.UserSelect;

// ── List Users ───────────────────────────────────────────────

export async function listUsersService(
  query: ListUsersQuery,
  callerRole: Role,
  callerBranchId: string | null,
) {
  const { page, limit, role, branchId, search, isActive } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {
    // Only show active users by default
    isActive: isActive !== undefined ? (isActive === 'true') : true,
    // Staff at branch level can only see users in their branch
    ...(callerRole === Role.ADMIN_CABANG && callerBranchId
      ? { branchId: callerBranchId }
      : {}),
    // Filter by branchId query param (manager/SA only)
    ...(branchId && callerRole !== Role.ADMIN_CABANG ? { branchId } : {}),
    ...(role ? { role } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { staffCode: { contains: search, mode: 'insensitive' } },
            { profile: { fullName: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
    // Exclude members and admin managers from staff user list
    // Admin managers are shown in the separate "Managers" tab
    NOT: { role: { in: [Role.MEMBER, Role.ADMIN_MANAGER] } },
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userSelect,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Get therapy counts for doctors, nurses, and admin layanan
  // Separated by role position (not user role) for accurate performance tracking
  const userIds = users.map(u => u.id);
  
  // Count sessions where user acted as doctor
  const doctorCounts = await prisma.treatmentSession.groupBy({
    by: ['doctorId'],
    where: {
      doctorId: { in: userIds },
      isCompleted: true,
    },
    _count: true,
  });

  // Count sessions where user acted as nurse
  const nurseCounts = await prisma.treatmentSession.groupBy({
    by: ['nurseId'],
    where: {
      nurseId: { in: userIds },
      isCompleted: true,
    },
    _count: true,
  });

  // Count sessions where user acted as admin layanan
  const adminLayananCounts = await prisma.treatmentSession.groupBy({
    by: ['adminLayananId'],
    where: {
      adminLayananId: { in: userIds },
      isCompleted: true,
    },
    _count: true,
  });

  // Create separate maps for each role position
  const doctorCountMap = new Map<string, number>();
  const nurseCountMap = new Map<string, number>();
  const adminLayananCountMap = new Map<string, number>();
  
  doctorCounts.forEach(tc => doctorCountMap.set(tc.doctorId, tc._count));
  nurseCounts.forEach(tc => nurseCountMap.set(tc.nurseId, tc._count));
  adminLayananCounts.forEach(tc => adminLayananCountMap.set(tc.adminLayananId, tc._count));

  // Add therapy counts to users - separated by position
  const usersWithTherapyCount = users.map(user => {
    const asDoctor = doctorCountMap.get(user.id) || 0;
    const asNurse = nurseCountMap.get(user.id) || 0;
    const asAdminLayanan = adminLayananCountMap.get(user.id) || 0;
    
    return {
      ...user,
      // Total therapy count (sum of all positions)
      therapyCount: asDoctor + asNurse + asAdminLayanan,
      // Separated counts by position
      therapyCountAsDoctor: asDoctor,
      therapyCountAsNurse: asNurse,
      therapyCountAsAdminLayanan: asAdminLayanan,
    };
  });

  return { users: usersWithTherapyCount, total, page, limit };
}

// ── Get Single User ──────────────────────────────────────────

export async function getUserService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });
  if (!user) throw errors.notFound('User tidak ditemukan.');
  return user;
}

// ── Create User ──────────────────────────────────────────────

export async function createUserService(
  input: CreateUserInput,
  callerRole: Role,
  callerBranchId: string | null,
) {
  console.log('🔍 [UserService] Creating user with input:', input);
  console.log('🔍 [UserService] Caller role:', callerRole);
  console.log('🔍 [UserService] Caller branchId:', callerBranchId);

  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    console.log('❌ [UserService] Email already exists:', input.email);
    throw errors.conflict('USER_EMAIL_DUPLICATE', 'Email sudah digunakan.');
  }

  // If caller is ADMIN_CABANG, enforce branch assignment to their branch
  let branchId = input.branchId ?? null;
  if (callerRole === Role.ADMIN_CABANG) {
    if (!callerBranchId) {
      throw errors.badRequest('BRANCH_REQUIRED', 'Admin cabang harus memiliki branch.');
    }
    branchId = callerBranchId; // Force new user to same branch
  }

  console.log('🔍 [UserService] Final branchId to use:', branchId);

  // Validate branchId exists if provided
  if (branchId) {
    const branchExists = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branchExists) {
      console.log('❌ [UserService] Branch not found:', branchId);
      throw errors.badRequest('BRANCH_NOT_FOUND', 'Branch tidak ditemukan.');
    }
    console.log('✅ [UserService] Branch exists:', branchExists.name);
  }

  const hashed = await bcrypt.hash(input.password, HASH_ROUNDS);
  const staffCode = generateStaffCode(input.role);

  console.log('🔍 [UserService] Generated staffCode:', staffCode);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashed,
      role: input.role,
      staffCode,
      branchId,
      profile: {
        create: {
          fullName: input.fullName,
          phone: input.phone,
        },
      },
      // Auto-create StaffBranch for DOCTOR and NURSE
      ...(branchId && (input.role === Role.DOCTOR || input.role === Role.NURSE) ? {
        staffBranches: {
          create: {
            branchId,
          },
        },
      } : {}),
    },
    select: userSelect,
  });

  console.log('✅ [UserService] User created successfully:', user.id);
  return user;
}

// ── Update User ──────────────────────────────────────────────

export async function updateUserService(userId: string, input: UpdateUserInput) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw errors.notFound('User tidak ditemukan.');

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      profile: {
        update: {
          ...(input.fullName ? { fullName: input.fullName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
      },
    },
    select: userSelect,
  });

  return user;
}

// ── Change Own Password ──────────────────────────────────────

export async function changePasswordService(
  userId: string,
  input: ChangePasswordInput,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw errors.notFound('User tidak ditemukan.');

  const isMatch = await bcrypt.compare(input.currentPassword, user.password);
  if (!isMatch)
    throw errors.badRequest('AUTH_INVALID_CREDENTIALS', 'Password lama tidak sesuai.');

  const hashed = await bcrypt.hash(input.newPassword, HASH_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
}

// ── Admin Reset Password ─────────────────────────────────────

export async function resetPasswordService(
  targetUserId: string,
  input: ResetPasswordInput,
) {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw errors.notFound('User tidak ditemukan.');

  const hashed = await bcrypt.hash(input.newPassword, HASH_ROUNDS);
  await prisma.user.update({ where: { id: targetUserId }, data: { password: hashed } });
}

// ── Get User Credentials (Super Admin Only) ──────────────────

export async function getUserCredentialsService(targetUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      role: true,
      staffCode: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
      profile: {
        select: {
          fullName: true,
          phone: true,
        },
      },
      branch: {
        select: {
          id: true,
          branchCode: true,
          name: true,
        },
      },
    },
  });

  if (!user) throw errors.notFound('User tidak ditemukan.');

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    staffCode: user.staffCode,
    fullName: user.profile?.fullName || '',
    phone: user.profile?.phone || '',
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    branch: user.branch,
    // Note: Password is never returned, only can be reset
  };
}

// ── Update User Email (Super Admin Only) ─────────────────────

export async function updateUserEmailService(targetUserId: string, newEmail: string) {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw errors.notFound('User tidak ditemukan.');

  // Check if email is already used by another user
  const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existingUser && existingUser.id !== targetUserId) {
    throw errors.conflict('EMAIL_DUPLICATE', 'Email sudah digunakan oleh user lain.');
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { email: newEmail },
    select: {
      id: true,
      email: true,
      role: true,
      staffCode: true,
      profile: {
        select: {
          fullName: true,
        },
      },
    },
  });

  return updatedUser;
}

// ── Update Avatar ─────────────────────────────────────────────

export async function updateAvatarService(userId: string, avatarUrl: string) {
  return prisma.userProfile.update({
    where: { userId },
    data: { avatarUrl },
    select: { fullName: true, phone: true, avatarUrl: true },
  });
}

// ── Get Staff by Role (for dropdowns) ────────────────────────

/**
 * Get staff by role for dropdown selection
 * 
 * SPECIAL CASE: ADMIN_CABANG is a "super role" that can be assigned to:
 * - Admin Layanan position
 * - Doctor position  
 * - Nurse position
 * 
 * So when fetching DOCTOR, NURSE, or ADMIN_LAYANAN lists, we also include ADMIN_CABANG users.
 */
export async function getStaffByRoleService(
  role: Role,
  branchId?: string,
) {
  // For DOCTOR and NURSE, use StaffBranch for multi-branch support
  // Also include ADMIN_CABANG users who can act as doctors/nurses
  if ((role === Role.DOCTOR || role === Role.NURSE) && branchId) {
    // Get staff with the specific role via StaffBranch
    const roleStaff = await prisma.$queryRaw<Array<{
      id: string;
      staffCode: string;
      fullName: string;
      role: string;
    }>>`
      SELECT DISTINCT u.id, u."staffCode", up."fullName", u.role
      FROM users u
      INNER JOIN staff_branches sb ON u.id = sb."userId"
      INNER JOIN user_profiles up ON u.id = up."userId"
      WHERE u.role = ${role}::"Role"
        AND u."isActive" = true
        AND sb."branchId" = ${branchId}
      ORDER BY up."fullName" ASC
    `;

    // Also get ADMIN_CABANG users from the same branch (they can act as doctor/nurse)
    const adminCabangStaff = await prisma.user.findMany({
      where: {
        role: Role.ADMIN_CABANG,
        branchId,
        isActive: true,
      },
      select: {
        id: true,
        staffCode: true,
        role: true,
        profile: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: { profile: { fullName: 'asc' } },
    });

    // Combine both lists
    const combinedStaff = [
      ...roleStaff.map((s) => ({
        userId: s.id,
        staffCode: s.staffCode || '',
        fullName: s.fullName || '',
        role: s.role,
      })),
      ...adminCabangStaff.map((s) => ({
        userId: s.id,
        staffCode: s.staffCode || '',
        fullName: `${s.profile?.fullName || ''} (Admin Cabang)`,
        role: s.role,
      })),
    ];

    return combinedStaff;
  }

  // For DOCTOR and NURSE without branchId, return all active staff
  // This is useful for ADMIN_MANAGER who can see all doctors/nurses
  if ((role === Role.DOCTOR || role === Role.NURSE) && !branchId) {
    const staff = await prisma.user.findMany({
      where: {
        role: { in: [role, Role.ADMIN_CABANG] }, // Include ADMIN_CABANG
        isActive: true,
      },
      select: {
        id: true,
        staffCode: true,
        role: true,
        profile: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: { profile: { fullName: 'asc' } },
    });

    return staff.map((s) => ({
      userId: s.id,
      staffCode: s.staffCode,
      fullName: s.role === Role.ADMIN_CABANG 
        ? `${s.profile?.fullName || ''} (Admin Cabang)` 
        : s.profile?.fullName || '',
      role: s.role,
    }));
  }

  // For ADMIN_LAYANAN, also include ADMIN_CABANG (they can act as admin layanan)
  if (role === Role.ADMIN_LAYANAN) {
    const staff = await prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN_LAYANAN, Role.ADMIN_CABANG] },
        isActive: true,
        ...(branchId ? { branchId } : {}),
      },
      select: {
        id: true,
        staffCode: true,
        role: true,
        profile: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: { profile: { fullName: 'asc' } },
    });

    return staff.map((s) => ({
      userId: s.id,
      staffCode: s.staffCode,
      fullName: s.role === Role.ADMIN_CABANG 
        ? `${s.profile?.fullName || ''} (Admin Cabang)` 
        : s.profile?.fullName || '',
      role: s.role,
    }));
  }

  // For other roles, use branchId directly
  const where: Prisma.UserWhereInput = {
    role,
    isActive: true,
    ...(branchId ? { branchId } : {}),
  };

  const staff = await prisma.user.findMany({
    where,
    select: {
      id: true,
      staffCode: true,
      profile: {
        select: {
          fullName: true,
        },
      },
    },
    orderBy: { profile: { fullName: 'asc' } },
  });

  return staff.map((s) => ({
    userId: s.id,
    staffCode: s.staffCode,
    fullName: s.profile?.fullName || '',
  }));
}

// ══════════════════════════════════════════════════════════════
// STAFF BRANCH MANAGEMENT (Multi-Branch Assignment)
// ══════════════════════════════════════════════════════════════

/**
 * Get medical staff (DOCTOR/NURSE) that are NOT assigned to a specific branch
 * Used for "Assign Staff from Other Branch" modal
 */
export async function getMedicalStaffNotInBranchService(excludeBranchId: string) {
  // Get all DOCTOR and NURSE users who are NOT in the specified branch
  const staff = await prisma.user.findMany({
    where: {
      role: { in: [Role.DOCTOR, Role.NURSE] },
      isActive: true,
      // Exclude users who already have StaffBranch record for this branch
      NOT: {
        staffBranches: {
          some: {
            branchId: excludeBranchId,
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
      staffCode: true,
      branchId: true,
      profile: {
        select: {
          fullName: true,
          phone: true,
        },
      },
      branch: {
        select: {
          id: true,
          branchCode: true,
          name: true,
        },
      },
      staffBranches: {
        select: {
          branch: {
            select: {
              id: true,
              branchCode: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      { role: 'asc' },
      { profile: { fullName: 'asc' } },
    ],
  });

  return staff.map((s) => ({
    id: s.id,
    email: s.email,
    role: s.role,
    staffCode: s.staffCode,
    fullName: s.profile?.fullName || '',
    phone: s.profile?.phone || '',
    primaryBranch: s.branch,
    assignedBranches: s.staffBranches.map((sb) => sb.branch),
  }));
}

/**
 * Get all branches assigned to a specific user (DOCTOR/NURSE)
 * Used for "Manage Staff Branches" modal
 */
export async function getUserBranchesService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      branchId: true,
      profile: {
        select: {
          fullName: true,
        },
      },
      branch: {
        select: {
          id: true,
          branchCode: true,
          name: true,
        },
      },
      staffBranches: {
        select: {
          id: true,
          branchId: true,
          createdAt: true,
          branch: {
            select: {
              id: true,
              branchCode: true,
              name: true,
              type: true,
            },
          },
        },
        orderBy: {
          branch: { name: 'asc' },
        },
      },
    },
  });

  if (!user) throw errors.notFound('User tidak ditemukan.');

  // Only DOCTOR and NURSE can have multi-branch assignments
  if (user.role !== Role.DOCTOR && user.role !== Role.NURSE) {
    throw errors.badRequest('INVALID_ROLE', 'Hanya DOCTOR dan NURSE yang dapat memiliki multi-branch assignment.');
  }

  return {
    userId: user.id,
    fullName: user.profile?.fullName || '',
    role: user.role,
    primaryBranch: user.branch,
    assignedBranches: user.staffBranches.map((sb) => ({
      staffBranchId: sb.id,
      branchId: sb.branchId,
      branchCode: sb.branch.branchCode,
      branchName: sb.branch.name,
      branchType: sb.branch.type,
      assignedAt: sb.createdAt,
      isPrimary: sb.branchId === user.branchId,
    })),
  };
}

/**
 * Assign a user (DOCTOR/NURSE) to a new branch
 */
export async function assignUserToBranchService(userId: string, branchId: string) {
  // Validate user exists and is DOCTOR or NURSE
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, profile: { select: { fullName: true } } },
  });

  if (!user) throw errors.notFound('User tidak ditemukan.');

  if (user.role !== Role.DOCTOR && user.role !== Role.NURSE) {
    throw errors.badRequest('INVALID_ROLE', 'Hanya DOCTOR dan NURSE yang dapat di-assign ke cabang lain.');
  }

  // Validate branch exists
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, branchCode: true },
  });

  if (!branch) throw errors.notFound('Branch tidak ditemukan.');

  // Check if already assigned
  const existing = await prisma.staffBranch.findUnique({
    where: {
      userId_branchId: {
        userId,
        branchId,
      },
    },
  });

  if (existing) {
    throw errors.conflict('ALREADY_ASSIGNED', `${user.profile?.fullName || 'User'} sudah di-assign ke cabang ${branch.name}.`);
  }

  // Create assignment
  const staffBranch = await prisma.staffBranch.create({
    data: {
      userId,
      branchId,
    },
    select: {
      id: true,
      userId: true,
      branchId: true,
      createdAt: true,
      branch: {
        select: {
          id: true,
          branchCode: true,
          name: true,
        },
      },
    },
  });

  return {
    staffBranchId: staffBranch.id,
    userId: staffBranch.userId,
    branch: staffBranch.branch,
    assignedAt: staffBranch.createdAt,
  };
}

/**
 * Set a branch as the primary branch for a user (DOCTOR/NURSE)
 * The new primary branch must already be in the user's assigned branches
 */
export async function setPrimaryBranchService(userId: string, branchId: string) {
  // Validate user exists and is DOCTOR or NURSE
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      id: true, 
      branchId: true, 
      role: true, 
      profile: { select: { fullName: true } } 
    },
  });

  if (!user) throw errors.notFound('User tidak ditemukan.');

  if (user.role !== Role.DOCTOR && user.role !== Role.NURSE) {
    throw errors.badRequest('INVALID_ROLE', 'Hanya DOCTOR dan NURSE yang dapat memiliki multi-branch assignment.');
  }

  // Check if already primary
  if (user.branchId === branchId) {
    throw errors.badRequest('ALREADY_PRIMARY', 'Cabang ini sudah menjadi cabang utama.');
  }

  // Validate branch exists
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, branchCode: true },
  });

  if (!branch) throw errors.notFound('Branch tidak ditemukan.');

  // Check if user is assigned to this branch
  const staffBranch = await prisma.staffBranch.findUnique({
    where: {
      userId_branchId: {
        userId,
        branchId,
      },
    },
  });

  if (!staffBranch) {
    throw errors.badRequest('NOT_ASSIGNED', 'User belum di-assign ke cabang ini. Tambahkan cabang terlebih dahulu.');
  }

  // Get old primary branch info for audit
  const oldBranch = user.branchId ? await prisma.branch.findUnique({
    where: { id: user.branchId },
    select: { name: true, branchCode: true },
  }) : null;

  // Update user's primary branch
  await prisma.user.update({
    where: { id: userId },
    data: { branchId },
  });

  // Ensure old primary branch is still in StaffBranch (if not already)
  if (user.branchId) {
    const oldStaffBranch = await prisma.staffBranch.findUnique({
      where: {
        userId_branchId: {
          userId,
          branchId: user.branchId,
        },
      },
    });

    if (!oldStaffBranch) {
      // Add old primary to StaffBranch so user still has access
      await prisma.staffBranch.create({
        data: {
          userId,
          branchId: user.branchId,
        },
      });
    }
  }

  return {
    success: true,
    message: `Cabang utama berhasil diubah ke ${branch.name}`,
    oldPrimaryBranch: oldBranch ? { name: oldBranch.name, branchCode: oldBranch.branchCode } : null,
    newPrimaryBranch: { name: branch.name, branchCode: branch.branchCode },
  };
}

/**
 * Remove a user (DOCTOR/NURSE) from a branch
 * Cannot remove from primary branch
 */
export async function removeUserFromBranchService(userId: string, branchId: string) {
  // Validate user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, branchId: true, role: true, profile: { select: { fullName: true } } },
  });

  if (!user) throw errors.notFound('User tidak ditemukan.');

  // Cannot remove from primary branch
  if (user.branchId === branchId) {
    throw errors.badRequest('CANNOT_REMOVE_PRIMARY', 'Tidak dapat menghapus assignment dari cabang utama. Ubah cabang utama terlebih dahulu.');
  }

  // Check if assignment exists
  const staffBranch = await prisma.staffBranch.findUnique({
    where: {
      userId_branchId: {
        userId,
        branchId,
      },
    },
  });

  if (!staffBranch) {
    throw errors.notFound('Assignment tidak ditemukan.');
  }

  // Delete assignment
  await prisma.staffBranch.delete({
    where: {
      userId_branchId: {
        userId,
        branchId,
      },
    },
  });

  return { success: true, message: 'Assignment berhasil dihapus.' };
}

/**
 * Get all branches (for dropdown in assign modal)
 * Optionally exclude branches where user is already assigned
 */
export async function getAvailableBranchesForUserService(userId: string) {
  // Get user's current assignments
  const userBranches = await prisma.staffBranch.findMany({
    where: { userId },
    select: { branchId: true },
  });

  const assignedBranchIds = userBranches.map((ub) => ub.branchId);

  // Get all active branches not yet assigned
  const branches = await prisma.branch.findMany({
    where: {
      isActive: true,
      id: { notIn: assignedBranchIds },
    },
    select: {
      id: true,
      branchCode: true,
      name: true,
      type: true,
      city: true,
    },
    orderBy: { name: 'asc' },
  });

  return branches;
}
