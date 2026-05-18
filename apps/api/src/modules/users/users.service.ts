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
  const userIds = users.map(u => u.id);
  
  // Count for doctors
  const doctorCounts = await prisma.treatmentSession.groupBy({
    by: ['doctorId'],
    where: {
      doctorId: { in: userIds },
      isCompleted: true,
    },
    _count: true,
  });

  // Count for nurses
  const nurseCounts = await prisma.treatmentSession.groupBy({
    by: ['nurseId'],
    where: {
      nurseId: { in: userIds },
      isCompleted: true,
    },
    _count: true,
  });

  // Count for admin layanan
  const adminLayananCounts = await prisma.treatmentSession.groupBy({
    by: ['adminLayananId'],
    where: {
      adminLayananId: { in: userIds },
      isCompleted: true,
    },
    _count: true,
  });

  const therapyCountMap = new Map<string, number>();
  
  // Merge all counts
  doctorCounts.forEach(tc => therapyCountMap.set(tc.doctorId, tc._count));
  nurseCounts.forEach(tc => {
    const current = therapyCountMap.get(tc.nurseId) || 0;
    therapyCountMap.set(tc.nurseId, current + tc._count);
  });
  adminLayananCounts.forEach(tc => {
    const current = therapyCountMap.get(tc.adminLayananId) || 0;
    therapyCountMap.set(tc.adminLayananId, current + tc._count);
  });

  // Add therapy count to users
  const usersWithTherapyCount = users.map(user => ({
    ...user,
    therapyCount: therapyCountMap.get(user.id) || 0,
  }));

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

// ── Update Avatar ─────────────────────────────────────────────

export async function updateAvatarService(userId: string, avatarUrl: string) {
  return prisma.userProfile.update({
    where: { userId },
    data: { avatarUrl },
    select: { fullName: true, phone: true, avatarUrl: true },
  });
}

// ── Get Staff by Role (for dropdowns) ────────────────────────

export async function getStaffByRoleService(
  role: Role,
  branchId?: string,
) {
  // For DOCTOR and NURSE, use StaffBranch for multi-branch support
  if ((role === Role.DOCTOR || role === Role.NURSE) && branchId) {
    // Use raw query until Prisma client is regenerated
    const staff = await prisma.$queryRaw<Array<{
      id: string;
      staffCode: string;
      fullName: string;
    }>>`
      SELECT DISTINCT u.id, u."staffCode", up."fullName"
      FROM users u
      INNER JOIN staff_branches sb ON u.id = sb."userId"
      INNER JOIN user_profiles up ON u.id = up."userId"
      WHERE u.role = ${role}::"Role"
        AND u."isActive" = true
        AND sb."branchId" = ${branchId}
      ORDER BY up."fullName" ASC
    `;

    return staff.map((s) => ({
      userId: s.id,
      staffCode: s.staffCode || '',
      fullName: s.fullName || '',
    }));
  }

  // For DOCTOR and NURSE without branchId, return all active staff
  // This is useful for ADMIN_MANAGER who can see all doctors/nurses
  if ((role === Role.DOCTOR || role === Role.NURSE) && !branchId) {
    const staff = await prisma.user.findMany({
      where: {
        role,
        isActive: true,
      },
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
