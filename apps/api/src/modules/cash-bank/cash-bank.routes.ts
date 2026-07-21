import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { createAccount, listAccounts, listTransactions } from './cash-bank.controller';

const router = Router();
router.use(authenticate);
router.get('/accounts', listAccounts);
router.post('/accounts', createAccount);
router.get('/transactions', listTransactions);
export default router;
