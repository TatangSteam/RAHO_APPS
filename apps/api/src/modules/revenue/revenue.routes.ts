import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { requirePermission } from '@middleware/requirePermission';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import * as controller from './revenue.controller';

const router = Router();
router.use(authenticate);
router.get('/policies', requirePermission(PERMISSIONS.DEFERRED_REVENUE_READ), controller.policies);
router.put('/policies', requirePermission(PERMISSIONS.REVENUE_POLICY_MANAGE), controller.savePolicy);
router.get('/contracts', requirePermission(PERMISSIONS.DEFERRED_REVENUE_READ), controller.contracts);
router.get('/events', requirePermission(PERMISSIONS.DEFERRED_REVENUE_READ), controller.events);
router.get('/profitability', requirePermission(PERMISSIONS.DEFERRED_REVENUE_READ), controller.profitability);
export default router;
