import { NextFunction, Request, Response } from 'express';
import { sendCreated, sendSuccess } from '@utils/response';
import {
  assignUserRoleTemplateSchema,
  createRoleTemplateSchema,
  replaceRoleTemplatePermissionsSchema,
  replaceUserBranchScopeSchema,
  replaceUserOverridesSchema,
  updateRoleTemplateSchema,
} from './iam.schema';
import {
  assignUserRoleTemplateService,
  createRoleTemplateService,
  getUserAccessService,
  listPermissionsService,
  listRoleTemplatesService,
  replaceRoleTemplatePermissionsService,
  replaceUserBranchScopeService,
  replaceUserOverridesService,
  updateRoleTemplateService,
} from './iam.service';
import { getAuthorizationContext } from './authorization.service';

export async function listPermissions(_req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listPermissionsService()); } catch (error) { next(error); }
}
export async function listRoleTemplates(_req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listRoleTemplatesService()); } catch (error) { next(error); }
}
export async function createRoleTemplate(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await createRoleTemplateService(req.user.userId, createRoleTemplateSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function updateRoleTemplate(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await updateRoleTemplateService(req.user.userId, req.params.id, updateRoleTemplateSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function replaceRoleTemplatePermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const input = replaceRoleTemplatePermissionsSchema.parse(req.body);
    sendSuccess(res, await replaceRoleTemplatePermissionsService(req.user.userId, req.params.id, input.permissionCodes));
  } catch (error) { next(error); }
}
export async function getUserAccess(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await getUserAccessService(req.user.userId, req.params.userId)); } catch (error) { next(error); }
}
export async function replaceUserOverrides(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await replaceUserOverridesService(req.user.userId, req.params.userId, replaceUserOverridesSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function replaceUserBranchScope(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await replaceUserBranchScopeService(req.user.userId, req.params.userId, replaceUserBranchScopeSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function getMyAccess(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await getAuthorizationContext(req.user.userId)); } catch (error) { next(error); }
}

export async function assignUserRoleTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const input = assignUserRoleTemplateSchema.parse(req.body);
    sendSuccess(res, await assignUserRoleTemplateService(req.user.userId, req.params.userId, input));
  } catch (error) { next(error); }
}
