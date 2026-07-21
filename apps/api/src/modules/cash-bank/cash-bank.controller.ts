import { NextFunction, Request, Response } from 'express';
import { sendCreated, sendSuccess } from '@utils/response';
import { createCashBankAccountSchema, listCashBankAccountsQuerySchema, listCashBankTransactionsQuerySchema } from './cash-bank.schema';
import { createCashBankAccount, listCashBankAccounts, listCashBankTransactions } from './cash-bank.service';

export async function createAccount(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await createCashBankAccount(req.user.userId, createCashBankAccountSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function listAccounts(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listCashBankAccounts(req.user.userId, listCashBankAccountsQuerySchema.parse(req.query))); } catch (error) { next(error); }
}
export async function listTransactions(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listCashBankTransactions(req.user.userId, listCashBankTransactionsQuerySchema.parse(req.query))); } catch (error) { next(error); }
}
