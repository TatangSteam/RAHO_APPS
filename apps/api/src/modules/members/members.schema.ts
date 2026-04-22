import { z } from 'zod';

// Gender enum sesuai dengan Prisma schema
const GenderEnum = z.enum(['L', 'P']);

export const createMemberSchema = z.object({
  // Section A - Data Pribadi
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter'),
  nik: z.string().optional(),
  birthPlace: z.string().optional(),
  birthDate: z.string().optional(), // ISO date string
  gender: GenderEnum.optional(),
  phone: z.string().min(10, 'Nomor telepon minimal 10 digit'),
  email: z.string().email('Format email tidak valid').optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  maritalStatus: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  infoSource: z.string().optional(),
  postalCode: z.string().optional(),

  // Section B - Akun Member
  memberEmail: z.string().email('Format email tidak valid'),
  memberPassword: z.string().min(8, 'Password minimal 8 karakter'),
  referralCode: z.string().optional(),
  isConsentToPhoto: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'string') {
        return val === 'true' || val === '1';
      }
      return val;
    })
    .default(false),
});

export const updateMemberSchema = z.object({
  fullName: z.string().min(3).optional(),
  nik: z.string().optional(),
  birthPlace: z.string().optional(),
  birthDate: z.string().optional(),
  gender: GenderEnum.optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  maritalStatus: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  infoSource: z.string().optional(),
  postalCode: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const grantAccessSchema = z.object({
  memberNo: z.string().min(1, 'Nomor member wajib diisi'),
});

export const sendNotificationSchema = z.object({
  title: z.string().min(1, 'Judul wajib diisi'),
  message: z.string().min(1, 'Pesan wajib diisi'),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type GrantAccessInput = z.infer<typeof grantAccessSchema>;
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
