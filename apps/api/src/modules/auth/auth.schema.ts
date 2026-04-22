import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid.'),
  password: z.string().min(6, 'Password minimal 6 karakter.'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token diperlukan.'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token diperlukan.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
