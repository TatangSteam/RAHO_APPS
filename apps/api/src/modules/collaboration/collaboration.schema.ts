import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const createTeamSchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: optionalText(500),
  taskVisibilityPolicy: z.enum(['ASSIGNEE_ONLY', 'ALL_TEAM_MEMBERS']).default('ALL_TEAM_MEMBERS'),
});

export const updateTeamSchema = createTeamSchema.partial().extend({
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['LEADER', 'STAFF']).default('STAFF'),
});

export const updateMemberSchema = z.object({
  role: z.enum(['LEADER', 'STAFF']).optional(),
  status: z.enum(['ACTIVE', 'REMOVED']).optional(),
});

export const primaryLeaderSchema = z.object({ membershipId: z.string().min(1) });

const taskFields = z.object({
  title: z.string().trim().min(3).max(200),
  description: optionalText(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueAt: z.string().datetime().optional().nullable(),
  assigneeIds: z.array(z.string().min(1)).max(20).default([]),
  isRequired: z.boolean().default(true),
});

export const createTaskSchema = taskFields.extend({ teamId: z.string().min(1) });
export const createSubtaskSchema = taskFields.omit({ isRequired: true }).extend({
  isRequired: z.boolean().default(true),
});
export const updateTaskSchema = taskFields.partial().extend({ version: z.number().int().positive() });
export const updateTaskStatusSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_REVISION', 'COMPLETED', 'CANCELLED']),
  version: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500).optional(),
});
export const createCommentSchema = z.object({ content: z.string().trim().min(1).max(3000) });
export const bootstrapQuerySchema = z.object({
  teamId: z.string().optional(),
  status: z.enum(['ALL', 'TODO', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_REVISION', 'COMPLETED', 'CANCELLED']).default('ALL'),
  search: z.string().trim().max(100).default(''),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;

