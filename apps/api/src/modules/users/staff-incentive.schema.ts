import { z } from 'zod';

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

export const chsCoordinatorAssignmentSchema = z.object({
  scope: z.enum(['TEAM', 'BRANCH']),
  coordinatorUserId: z.string().min(1),
  branchId: z.string().min(1),
  homecareTeamId: z.string().min(1).optional(),
  effectiveFrom: z.string().regex(dateOnly, 'Tanggal mulai harus berformat YYYY-MM-DD.'),
  effectiveUntil: z.string().regex(dateOnly, 'Tanggal selesai harus berformat YYYY-MM-DD.').optional(),
  notes: z.string().max(500).optional(),
}).superRefine((value, context) => {
  if (value.scope === 'TEAM' && !value.homecareTeamId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['homecareTeamId'], message: 'Tim Homecare wajib dipilih.' });
  }
  if (value.scope === 'BRANCH' && value.homecareTeamId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['homecareTeamId'], message: 'Scope cabang tidak menggunakan tim Homecare.' });
  }
});

export const chsCoordinatorBranchAssignmentsSchema = z.object({
  coordinatorUserId: z.string().min(1),
  branchIds: z.array(z.string().min(1)).min(1, 'Minimal satu cabang wajib dipilih.'),
  effectiveFrom: z.string().regex(dateOnly, 'Tanggal mulai harus berformat YYYY-MM-DD.'),
  effectiveUntil: z.string().regex(dateOnly, 'Tanggal selesai harus berformat YYYY-MM-DD.').optional(),
  notes: z.string().max(500).optional(),
});

export const doctorHeadAssignmentSchema = z.object({
  doctorHeadUserId: z.string().min(1),
  branchId: z.string().min(1),
  effectiveFrom: z.string().regex(dateOnly, 'Tanggal mulai harus berformat YYYY-MM-DD.'),
  effectiveUntil: z.string().regex(dateOnly, 'Tanggal selesai harus berformat YYYY-MM-DD.').optional(),
  notes: z.string().max(500).optional(),
});

export const doctorHeadBranchAssignmentsSchema = doctorHeadAssignmentSchema
  .omit({ branchId: true })
  .extend({ branchIds: z.array(z.string().min(1)).min(1, 'Minimal satu cabang wajib dipilih.') });
