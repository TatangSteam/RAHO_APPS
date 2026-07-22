import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { requirePermission } from '@middleware/requirePermission';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import * as controller from './approval.controller';

const router = Router();
router.use(authenticate);
router.get('/inbox', requirePermission(PERMISSIONS.WORKFLOW_APPROVAL_READ), controller.inbox);
router.get('/rules', requirePermission(PERMISSIONS.WORKFLOW_APPROVAL_READ), controller.rules);
router.post('/rules', requirePermission(PERMISSIONS.WORKFLOW_RULE_MANAGE), controller.createRule);
export default router;
