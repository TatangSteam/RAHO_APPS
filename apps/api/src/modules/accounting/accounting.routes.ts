import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { requirePermission } from '@middleware/requirePermission';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import {
  createAccount,
  createPeriod,
  deleteAccount,
  deletePeriod,
  getJournal,
  getJournalsBySource,
  listAccounts,
  listJournals,
  listPeriods,
  postManualJournal,
  reverseManualJournal,
  updateAccount,
  updatePeriod,
  updatePeriodStatus,
} from './accounting.controller';

const router = Router();
router.use(authenticate);

router.get('/accounts', requirePermission(PERMISSIONS.ACCOUNT_READ), listAccounts);
router.post('/accounts', requirePermission(PERMISSIONS.ACCOUNT_MANAGE), createAccount);
router.patch('/accounts/:id', requirePermission(PERMISSIONS.ACCOUNT_MANAGE), updateAccount);
router.delete('/accounts/:id', requirePermission(PERMISSIONS.ACCOUNT_MANAGE), deleteAccount);

router.get('/periods', listPeriods);
// Period services resolve global vs branch-scoped permission from the payload/resource.
router.post('/periods', createPeriod);
router.patch('/periods/:id', updatePeriod);
router.patch('/periods/:id/status', updatePeriodStatus);
router.delete('/periods/:id', deletePeriod);

// Source route must be registered before /journals/:id.
router.get('/journals/source/:sourceType/:sourceId', getJournalsBySource);
router.get('/journals', listJournals);
router.post('/journals', postManualJournal);
router.post('/journals/:id/reverse', reverseManualJournal);
router.get('/journals/:id', getJournal);

export default router;
