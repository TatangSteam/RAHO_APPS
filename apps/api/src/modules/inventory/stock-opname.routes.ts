import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { requirePermission } from '@middleware/requirePermission';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import * as controller from './stock-opname.controller';

const router = Router();
router.use(authenticate);
router.get('/', requirePermission(PERMISSIONS.INVENTORY_OPNAME_READ), controller.list);
router.post('/', requirePermission(PERMISSIONS.INVENTORY_OPNAME_CREATE), controller.create);
router.post('/:id/submit', requirePermission(PERMISSIONS.INVENTORY_OPNAME_CREATE), controller.submit);
router.post('/:id/approve', requirePermission(PERMISSIONS.INVENTORY_ADJUSTMENT_APPROVE), controller.approve);
router.post('/:id/reject', requirePermission(PERMISSIONS.INVENTORY_ADJUSTMENT_APPROVE), controller.reject);
export default router;
