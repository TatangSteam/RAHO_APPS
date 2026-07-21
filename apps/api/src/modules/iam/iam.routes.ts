import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { requirePermission } from '@middleware/requirePermission';
import { PERMISSIONS } from './permission-catalog';
import {
  assignUserRoleTemplate,
  createRoleTemplate,
  getMyAccess,
  getUserAccess,
  listPermissions,
  listRoleTemplates,
  replaceRoleTemplatePermissions,
  replaceUserBranchScope,
  replaceUserOverrides,
  updateRoleTemplate,
} from './iam.controller';

const router = Router();
router.use(authenticate);

router.get('/me', getMyAccess);
router.get('/permissions', requirePermission(PERMISSIONS.IAM_PERMISSION_READ), listPermissions);
router.get('/role-templates', requirePermission(PERMISSIONS.IAM_PERMISSION_READ), listRoleTemplates);
router.post('/role-templates', requirePermission(PERMISSIONS.IAM_PERMISSION_MANAGE), createRoleTemplate);
router.patch('/role-templates/:id', requirePermission(PERMISSIONS.IAM_PERMISSION_MANAGE), updateRoleTemplate);
router.put('/role-templates/:id/permissions', requirePermission(PERMISSIONS.IAM_PERMISSION_MANAGE), replaceRoleTemplatePermissions);
router.get('/users/:userId/access', requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_READ), getUserAccess);
router.put('/users/:userId/role-template', requirePermission(PERMISSIONS.IAM_USER_MANAGE_ROLE), assignUserRoleTemplate);
router.put('/users/:userId/overrides', requirePermission(PERMISSIONS.IAM_PERMISSION_MANAGE), replaceUserOverrides);
router.put('/users/:userId/branches', requirePermission(PERMISSIONS.IAM_BRANCH_SCOPE_MANAGE), replaceUserBranchScope);

export default router;
