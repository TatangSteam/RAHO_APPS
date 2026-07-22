import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { requirePermission } from '@middleware/requirePermission';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import * as controller from './finance-report.controller';

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.JOURNAL_READ));
router.get('/dashboard', controller.dashboard);
router.get('/profit-loss', controller.profitLoss);
router.get('/trial-balance', controller.trialBalance);
router.get('/general-ledger', controller.generalLedger);
router.get('/cash-bank', controller.cashBank);
router.get('/deferred-revenue', controller.deferredRevenue);
router.get('/reconciliation', controller.reconciliation);
export default router;
