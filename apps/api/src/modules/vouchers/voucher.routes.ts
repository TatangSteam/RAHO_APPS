import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import * as controller from './voucher.controller';

const router = Router();
const VOUCHER_ROLES = [Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.VOUCHER_OPERATOR];
const VOUCHER_ISSUER_ROLES = [Role.SUPER_ADMIN, Role.ADMIN_MANAGER];

router.use(authenticate);
router.get('/dashboard', authorize(VOUCHER_ROLES), controller.dashboard);
router.get('/claims', authorize(VOUCHER_ROLES), controller.listClaims);
router.get('/claims/:voucherId/receipt', authorize(VOUCHER_ROLES), controller.downloadClaimReceipt);
router.post('/claim', authorize(VOUCHER_ROLES), controller.claim);
router.get('/export', authorize([Role.SUPER_ADMIN]), controller.exportCodes);
router.post('/campaigns/:campaignId/generate', authorize([Role.SUPER_ADMIN]), controller.generateCodes);
router.post('/issue', authorize(VOUCHER_ISSUER_ROLES), controller.issue);
router.post('/operators', authorize([Role.SUPER_ADMIN]), controller.createOperator);
router.patch('/operators/:operatorId', authorize([Role.SUPER_ADMIN]), controller.updateOperator);

export default router;
