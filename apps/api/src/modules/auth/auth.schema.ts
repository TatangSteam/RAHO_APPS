import { z } from 'zod';

const loginIdentifierSchema = z
  .string()
  .trim()
  .min(3, 'Username atau email minimal 3 karakter.')
  .max(100, 'Username atau email maksimal 100 karakter.');

export const loginSchema = z
  .object({
    identifier: loginIdentifierSchema.optional(),
    // Backward compatibility for older clients that still send `email`.
    email: loginIdentifierSchema.optional(),
    password: z.string().min(6, 'Password minimal 6 karakter.'),
  })
  .refine((data) => data.identifier || data.email, {
    message: 'Username atau email wajib diisi.',
    path: ['identifier'],
  })
  .transform((data) => {
    const identifier = data.identifier || data.email!;
    return {
      // Member usernames are case-insensitive; legacy staff email behavior is preserved.
      identifier: identifier.includes('@') ? identifier : identifier.toLowerCase(),
      password: data.password,
    };
  });

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token diperlukan.'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token diperlukan.'),
});

const ownUsernameSchema = z
  .string()
  .trim()
  .min(3, 'Username minimal 3 karakter.')
  .max(100, 'Username maksimal 100 karakter.')
  .transform((value) => value.toLowerCase())
  .refine(
    (value) => (
      value.includes('@')
        ? z.string().email().safeParse(value).success
        : /^[a-z0-9._-]{3,50}$/.test(value)
    ),
    'Gunakan alamat email yang valid atau 3-50 karakter berupa huruf, angka, titik, garis bawah, atau strip.',
  );

export const updateOwnUsernameSchema = z.object({
  username: ownUsernameSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type UpdateOwnUsernameInput = z.infer<typeof updateOwnUsernameSchema>;
