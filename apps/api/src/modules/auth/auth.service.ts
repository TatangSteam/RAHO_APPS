import bcrypt from 'bcryptjs';
import { prisma } from '@lib/prisma';
import { generateTokenPair, verifyRefreshToken, JwtPayload } from '@lib/jwt';
import { AppError, errors } from '@middleware/errorHandler';
import { LoginInput } from './auth.schema';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  branchId: string | null;
  branchCode: string | null;
  fullName: string;
  staffCode: string | null;
}

// ── Login ─────────────────────────────────────────────────────

export async function loginService(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      profile: { select: { fullName: true } },
      branch: { select: { id: true, branchCode: true } },
    },
  });

  if (!user || !user.isActive) {
    throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Email atau password salah.');
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);
  if (!isPasswordValid) {
    throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Email atau password salah.');
  }

  // Fire-and-forget update lastLoginAt
  prisma.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    .catch(() => void 0);

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
    branchCode: user.branch?.branchCode ?? null,
    fullName: user.profile?.fullName ?? '',
    staffCode: user.staffCode,
  };

  const tokens = generateTokenPair(payload);

  return {
    ...tokens,
    user: payload,
  };
}

// ── Refresh ───────────────────────────────────────────────────

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
    fullName: user.profile?.fullName ?? '',
    staffCode: user.staffCode,
  };

  return generateTokenPair(payload);
}

// ── Me ────────────────────────────────────────────────────────

export async function getMeService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
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
