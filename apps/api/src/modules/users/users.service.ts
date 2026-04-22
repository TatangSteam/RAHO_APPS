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
    // Staff at branch level can only see users in their branch
    ...(callerRole === Role.ADMIN_CABANG && callerBranchId
      ? { branchId: callerBranchId }
      : {}),
    // Filter by branchId query param (manager/SA only)
    ...(branchId && callerRole !== Role.ADMIN_CABANG ? { branchId } : {}),
    ...(role ? { role } : {}),
    ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { staffCode: { contains: search, mode: 'insensitive' } },
            { profile: { fullName: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
    // Exclude members from staff user list
    NOT: { role: Role.MEMBER },
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

  return { users, total, page, limit };
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
  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw errors.conflict('USER_EMAIL_DUPLICATE', 'Email sudah digunakan.');

  // If caller is ADMIN_CABANG, enforce branch assignment to their branch
  let branchId = input.branchId ?? null;
  if (callerRole === Role.ADMIN_CABANG) {
    if (!callerBranchId) {
      throw errors.badRequest('BRANCH_REQUIRED', 'Admin cabang harus memiliki branch.');
    }
    branchId = callerBranchId; // Force new user to same branch
  }

  const hashed = await bcrypt.hash(input.password, HASH_ROUNDS);
  const staffCode = generateStaffCode(input.role);

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
    },
    select: userSelect,
  });

  return user;
}

// ── Update User ──────────────────────────────────────────────

export async function updateUserService(userId: string, input: UpdateUserInput) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw errors.notFound('User tidak ditemukan.');

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
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
