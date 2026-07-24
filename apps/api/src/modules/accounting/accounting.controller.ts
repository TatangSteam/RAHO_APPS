import { NextFunction, Request, Response } from 'express';
import { sendCreated, sendSuccess } from '@utils/response';
import {
  createAccountSchema,
  createAccountingPeriodSchema,
  listAccountingPeriodsQuerySchema,
  listAccountsQuerySchema,
  listJournalsQuerySchema,
  postManualJournalSchema,
  updateAccountSchema,
  updateAccountingPeriodStatusSchema,
} from './accounting.schema';
import {
  createAccountService,
  createAccountingPeriodService,
  getJournalService,
  getJournalsBySourceService,
  listAccountingPeriodsService,
  listAccountsService,
  listJournalsService,
  postJournal,
  updateAccountService,
  updateAccountingPeriodStatusService,
} from './accounting.service';
import type { PostJournalInput } from './posting.contract';
import { errors } from '@middleware/errorHandler';

export async function listAccounts(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listAccountsService(listAccountsQuerySchema.parse(req.query))); } catch (error) { next(error); }
}
export async function createAccount(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await createAccountService(req.user.userId, createAccountSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function updateAccount(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await updateAccountService(req.user.userId, req.params.id, updateAccountSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function listPeriods(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listAccountingPeriodsService(req.user.userId, listAccountingPeriodsQuerySchema.parse(req.query))); } catch (error) { next(error); }
}
export async function createPeriod(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await createAccountingPeriodService(req.user.userId, createAccountingPeriodSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function updatePeriodStatus(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await updateAccountingPeriodStatusService(req.user.userId, req.params.id, updateAccountingPeriodStatusSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function postManualJournal(req: Request, res: Response, next: NextFunction) {
  try {
    const input = postManualJournalSchema.parse(req.body);
    const postingKey = `MANUAL_JOURNAL:${input.requestId}`;
    const idempotencyKey = req.get('Idempotency-Key');
    if (!idempotencyKey) throw errors.badRequest('IDEMPOTENCY_KEY_REQUIRED', 'Header Idempotency-Key wajib diisi.');
    if (idempotencyKey !== postingKey) {
      throw errors.badRequest('IDEMPOTENCY_KEY_MISMATCH', 'Header Idempotency-Key tidak sesuai dengan request jurnal manual.');
    }
    const dateCode = input.transactionDate.toISOString().slice(0, 10).replaceAll('-', '');
    const sourceId = `MJ-${dateCode}-${input.requestId.slice(0, 8).toUpperCase()}`;
    const { requestId, ...journalInput } = input;
    const result = await postJournal({
      ...journalInput,
      postingKey,
      sourceLinks: [{
        sourceType: 'MANUAL_JOURNAL',
        sourceId,
        sourceNumber: sourceId,
        relationType: 'PRIMARY',
      }],
      metadata: { ...(journalInput.metadata || {}), manualRequestId: requestId },
      actorUserId: req.user.userId,
    } as PostJournalInput);
    sendSuccess(res, result, result.idempotentReplay ? 200 : 201);
  } catch (error) { next(error); }
}
export async function listJournals(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listJournalsService(req.user.userId, listJournalsQuerySchema.parse(req.query))); } catch (error) { next(error); }
}
export async function getJournal(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await getJournalService(req.user.userId, req.params.id)); } catch (error) { next(error); }
}
export async function getJournalsBySource(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await getJournalsBySourceService(req.user.userId, req.params.sourceType, req.params.sourceId)); } catch (error) { next(error); }
}
