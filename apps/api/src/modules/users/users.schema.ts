import { z } from 'zod';
import { Role } from '@prisma/client';

// ── Create User ───────────────────────────────────────────────
export const createUserSchema = z.object({
  email: z.string().email('Format email tidak valid.'),
  password: z.string().min(8, 'Password minimal 8 karakter.').regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password harus mengandung huruf besar, huruf kecil, dan angka.',
  ),
  role: z.nativeEnum(Role),
  fullName: z.string().min(2, 'Nama minimal 2 karakter.'),
  phone: z.string().optional(),
  branchId: z.string().cuid('Branch ID tidak valid.').nullish(),
});

// ── Update User ───────────────────────────────────────────────
export const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  branchId: z.string().cuid().nullish().optional(),
  isActive: z.boolean().optional(),
});

// ── Change Password ───────────────────────────────────────────
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password lama diperlukan.'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter.').regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password harus mengandung huruf besar, huruf kecil, dan angka.',
  ),
});

// ── Reset Password (Admin) ────────────────────────────────────
export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
});

// ── List Users Query ──────────────────────────────────────────
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(10),
  role: z.nativeEnum(Role).optional(),
  branchId: z.string().optional(),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export type CreateUserInput   = z.infer<typeof createUserSchema>;
export type UpdateUserInput   = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput  = z.infer<typeof resetPasswordSchema>;
export type ListUsersQuery    = z.infer<typeof listUsersQuerySchema>;
