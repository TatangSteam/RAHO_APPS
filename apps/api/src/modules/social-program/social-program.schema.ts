import { z } from 'zod';

export const SOCIAL_BOOSTER_TYPES = ['NO', 'GT', 'MB', 'KCL', 'H2S', 'HK', 'O3'] as const;

export const createSocialProgramSchema = z.object({
  memberId: z.string().min(1),
  branchId: z.string().min(1),
  basicSessions: z.number().int().min(1).max(100).default(1),
  freeBooster: z.boolean().default(false),
  boosterType: z.enum(SOCIAL_BOOSTER_TYPES).optional(),
  freeBoosterSessions: z.number().int().min(0).max(100).default(0),
  reason: z.string().trim().min(8, 'Alasan Program Sosial minimal 8 karakter').max(500),
}).superRefine((input, ctx) => {
  if (input.freeBooster && !input.boosterType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['boosterType'], message: 'Jenis Booster gratis wajib dipilih.' });
  }
  if (input.freeBooster && input.freeBoosterSessions < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['freeBoosterSessions'], message: 'Kuota Booster gratis minimal 1 sesi.' });
  }
  if (input.freeBoosterSessions > input.basicSessions) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['freeBoosterSessions'], message: 'Kuota Booster tidak boleh melebihi sesi Basic sosial.' });
  }
  if (!input.freeBooster && (input.boosterType || input.freeBoosterSessions > 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['freeBooster'], message: 'Aktifkan opsi Booster gratis terlebih dahulu.' });
  }
});

export const socialProgramDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().max(500).optional(),
}).refine((input) => input.decision === 'APPROVE' || Boolean(input.note && input.note.length >= 3), {
  path: ['note'],
  message: 'Alasan penolakan wajib diisi.',
});

export const listSocialProgramsSchema = z.object({
  branchId: z.string().min(1).optional(),
  memberId: z.string().min(1).optional(),
  status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REJECTED', 'ACTIVATION_FAILED', 'CANCELLED']).optional(),
});

export type CreateSocialProgramInput = z.infer<typeof createSocialProgramSchema>;
export type SocialProgramDecisionInput = z.infer<typeof socialProgramDecisionSchema>;
export type ListSocialProgramsInput = z.infer<typeof listSocialProgramsSchema>;
