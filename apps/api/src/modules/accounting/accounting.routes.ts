import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { requirePermission } from '@middleware/requirePermission';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import {
  createAccount,
  createPeriod,
  getJournal,
  getJournalsBySource,
  listAccounts,
  listJournals,
  listPeriods,
  postManualJournal,
  updateAccount,
  updatePeriodStatus,
} from './accounting.controller';

const router = Router();
router.use(authenticate);

router.get('/accounts', requirePermission(PERMISSIONS.ACCOUNT_READ), listAccounts);
router.post('/accounts', requirePermission(PERMISSIONS.ACCOUNT_MANAGE), createAccount);
router.patch('/accounts/:id', requirePermission(PERMISSIONS.ACCOUNT_MANAGE), updateAccount);

router.get('/periods', listPeriods);
// Period services resolve global vs branch-scoped permission from the payload/resource.
router.post('/periods', createPeriod);
router.patch('/periods/:id/status', updatePeriodStatus);

// Source route must be registered before /journals/:id.
router.get('/journals/source/:sourceType/:sourceId', getJournalsBySource);
router.get('/journals', listJournals);
router.post('/journals', postManualJournal);
router.get('/journals/:id', getJournal);

export default router;
