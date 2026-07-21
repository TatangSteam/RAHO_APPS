import { z } from 'zod';

const permissionCode = z.string().trim().min(3).max(120);

export const createRoleTemplateSchema = z.object({
  code: z.string().trim().min(3).max(80).regex(/^[A-Z0-9_]+$/),
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).optional(),
  permissionCodes: z.array(permissionCode).default([]),
});

export const updateRoleTemplateSchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const replaceRoleTemplatePermissionsSchema = z.object({
  permissionCodes: z.array(permissionCode).max(250),
});

export const replaceUserOverridesSchema = z.object({
  overrides: z.array(z.object({
    permissionCode,
    effect: z.enum(['ALLOW', 'DENY']),
    branchId: z.string().min(1).nullable().optional(),
    reason: z.string().trim().min(3).max(500),
    validUntil: z.string().datetime().nullable().optional(),
  })).max(250),
}).superRefine((data, ctx) => {
  const keys = data.overrides.map((item) => `${item.permissionCode}:${item.branchId || 'GLOBAL'}`);
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['overrides'], message: 'Permission override dalam scope yang sama tidak boleh duplikat.' });
  }
});

export const replaceUserBranchScopeSchema = z.object({
  branchIds: z.array(z.string().min(1)).min(1).max(100),
  primaryBranchId: z.string().min(1).nullable().optional(),
}).superRefine((data, ctx) => {
  const unique = new Set(data.branchIds);
  if (unique.size !== data.branchIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['branchIds'], message: 'Branch ID tidak boleh duplikat.' });
  }
  if (data.primaryBranchId && !unique.has(data.primaryBranchId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['primaryBranchId'], message: 'Primary branch harus ada di branchIds.' });
  }
});

export const assignUserRoleTemplateSchema = z.object({
  roleTemplateId: z.string().min(1).nullable(),
});

export type CreateRoleTemplateInput = z.infer<typeof createRoleTemplateSchema>;
export type UpdateRoleTemplateInput = z.infer<typeof updateRoleTemplateSchema>;
export type ReplaceUserOverridesInput = z.infer<typeof replaceUserOverridesSchema>;
export type ReplaceUserBranchScopeInput = z.infer<typeof replaceUserBranchScopeSchema>;
export type AssignUserRoleTemplateInput = z.infer<typeof assignUserRoleTemplateSchema>;
