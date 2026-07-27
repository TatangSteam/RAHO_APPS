import { NextFunction, Request, Response } from 'express';
import { sendCreated, sendSuccess } from '@utils/response';
import { createOpeningBalanceSchema, listOpeningBalancesQuerySchema, rejectOpeningBalanceSchema, updateOpeningBalanceSchema } from './opening-balance.schema';
import { createOpeningBalance, listOpeningBalances, postOpeningBalance, rejectOpeningBalance, submitOpeningBalance, updateOpeningBalance } from './opening-balance.service';

export async function create(req: Request, res: Response, next: NextFunction) {
  try { const result = await createOpeningBalance(req.user.userId, createOpeningBalanceSchema.parse(req.body)); sendSuccess(res, result, result.idempotentReplay ? 200 : 201); } catch (error) { next(error); }
}
export async function list(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listOpeningBalances(req.user.userId, listOpeningBalancesQuerySchema.parse(req.query))); } catch (error) { next(error); }
}
export async function update(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await updateOpeningBalance(req.user.userId, req.params.id, updateOpeningBalanceSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function submit(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await submitOpeningBalance(req.user.userId, req.params.id)); } catch (error) { next(error); }
}
export async function post(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await postOpeningBalance(req.user.userId, req.params.id)); } catch (error) { next(error); }
}
export async function reject(req: Request, res: Response, next: NextFunction) {
  try { const input = rejectOpeningBalanceSchema.parse(req.body); sendSuccess(res, await rejectOpeningBalance(req.user.userId, req.params.id, input.reason)); } catch (error) { next(error); }
}
