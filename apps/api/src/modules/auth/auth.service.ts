import bcrypt from 'bcryptjs';
import { prisma } from '@lib/prisma';
import { generateTokenPair, verifyRefreshToken, JwtPayload } from '@lib/jwt';
import { AppError, errors } from '@middleware/errorHandler';
import { logAudit } from '@utils/auditLog';
import { LoginInput } from './auth.schema';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  branchId: string | null;
  branchCode: string | null;
  adminManagerAccessScope?: string | null;
  fullName: string;
  staffCode: string | null;
  roleTemplateName?: string | null;
}

function getAuditedBranchId(user: { role: string; branchId: string | null }) {
  return user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN_MANAGER' ? user.branchId : null;
}

export async function loginService(input: LoginInput, ipAddress?: string, userAgent?: string) {
  const identifier = input.identifier;
  const user = await prisma.user.findUnique({
    // The existing email column stores staff emails and member usernames.
    where: { email: identifier },
    include: {
      profile: { select: { fullName: true, avatarUrl: true } },
      branch: { select: { id: true, branchCode: true } },
      roleTemplate: { select: { name: true } },
    },
  });

  if (!user || !user.isActive) {
    logAudit({
      userId: user?.id || null,
      branchId: user ? getAuditedBranchId(user) : null,
      action: 'LOGIN_FAILED',
      module: 'AUTH',
      resource: 'Auth',
      resourceId: user?.id || identifier,
      entityType: 'User',
      entityId: user?.id || null,
      entityCode: identifier,
      description: user && !user.isActive
        ? `Percobaan login gagal untuk akun nonaktif ${identifier}.`
        : `Percobaan login gagal untuk username/email tidak terdaftar ${identifier}.`,
      meta: {
        attemptedIdentifier: identifier,
        reason: user && !user.isActive ? 'Account inactive' : 'User not found',
      },
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
    }).catch(() => void 0);

    throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Username/email atau password salah.');
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);
  if (!isPasswordValid) {
    logAudit({
      userId: user.id,
      branchId: getAuditedBranchId(user),
      action: 'LOGIN_FAILED',
      module: 'AUTH',
      resource: 'Auth',
      resourceId: user.id,
      entityType: 'User',
      entityId: user.id,
      entityCode: user.email,
      description: `Percobaan login gagal untuk ${user.email}: password salah.`,
      meta: {
        attemptedIdentifier: identifier,
        reason: 'Invalid password',
      },
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
    }).catch(() => void 0);

    throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Username/email atau password salah.');
  }

  prisma.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    .catch(() => void 0);

  try {
    await logAudit({
      userId: user.id,
      branchId: getAuditedBranchId(user),
      action: 'LOGIN_SUCCESS',
      module: 'AUTH',
      resource: 'Auth',
      resourceId: user.id,
      entityType: 'User',
      entityId: user.id,
      entityCode: user.email,
      description: `${user.profile?.fullName || user.email} berhasil login.`,
      meta: {
        email: user.email,
        role: user.role,
        branchId: user.branchId,
      },
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
    });
    console.log('LOGIN audit log created');
  } catch (error) {
    console.error('Failed to create LOGIN audit log:', error);
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
    branchCode: user.branch?.branchCode ?? null,
    adminManagerAccessScope: user.role === 'ADMIN_MANAGER' ? user.adminManagerAccessScope : null,
    fullName: user.profile?.fullName ?? '',
    staffCode: user.staffCode,
    roleTemplateName: user.roleTemplate?.name ?? null,
  };

  const tokens = generateTokenPair(payload);

  return {
    ...tokens,
    user: {
      ...payload,
      avatarUrl: user.profile?.avatarUrl ?? null,
    },
  };
}

export async function refreshService(refreshToken: string) {
  let decoded: { userId: string; email: string };

  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'AUTH_TOKEN_INVALID', 'Refresh token tidak valid atau kedaluwarsa.');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: {
      profile: { select: { fullName: true } },
      branch: { select: { branchCode: true } },
      roleTemplate: { select: { name: true } },
    },
  });

  if (!user || !user.isActive) {
    throw new AppError(401, 'AUTH_TOKEN_INVALID', 'Sesi tidak valid. Silakan login kembali.');
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
    branchCode: user.branch?.branchCode ?? null,
    adminManagerAccessScope: user.role === 'ADMIN_MANAGER' ? user.adminManagerAccessScope : null,
    fullName: user.profile?.fullName ?? '',
    staffCode: user.staffCode,
    roleTemplateName: user.roleTemplate?.name ?? null,
  };

  return generateTokenPair(payload);
}

export async function getMeService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      adminManagerAccessScope: true,
      staffCode: true,
      branchId: true,
      isActive: true,
      lastLoginAt: true,
      profile: { select: { fullName: true, phone: true, avatarUrl: true } },
      branch: { select: { id: true, branchCode: true, name: true } },
    },
  });

  if (!user) throw errors.notFound('User tidak ditemukan.');

  return user;
}
