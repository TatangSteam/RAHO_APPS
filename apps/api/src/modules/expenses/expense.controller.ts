import { createHash } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { safeDeleteFile, uploadFile } from '@config/minio';
import { sendSuccess } from '@utils/response';
import { approvalExpenseSchema, createExpenseSchema, listExpensesQuerySchema, rejectExpenseSchema, updateExpenseSchema } from './expense.schema';
import { approveExpense, createExpense, getExpenseEvidence, listExpenses, payExpense, rejectExpense, submitExpense, updateExpense } from './expense.service';

export async function create(req: Request, res: Response, next: NextFunction) {
  let uploadedKey: string | undefined;
  try {
    const input = createExpenseSchema.parse(req.body);
    const checksum = req.file ? createHash('sha256').update(req.file.buffer).digest('hex') : undefined;
    const requestHash = createHash('sha256').update(JSON.stringify({ ...input, expenseDate: input.expenseDate.toISOString(), checksum })).digest('hex');
    const extension = req.file?.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
    const evidence = req.file ? {
      fileUrl: `uploads/expenses/${input.branchId}/${requestHash}.${extension}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      checksum,
    } : {};
    if (req.file && evidence.fileUrl) {
      uploadedKey = evidence.fileUrl;
      await uploadFile(req.file.buffer, uploadedKey, req.file.mimetype);
    }
    const result = await createExpense(req.user.userId, input, evidence);
    sendSuccess(res, result, result.idempotentReplay ? 200 : 201);
  } catch (error) {
    if (uploadedKey) await safeDeleteFile(uploadedKey);
    next(error);
  }
}
export async function list(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listExpenses(req.user.userId, listExpensesQuerySchema.parse(req.query))); } catch (error) { next(error); }
}
export async function update(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await updateExpense(req.user.userId, req.params.id, updateExpenseSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function submit(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await submitExpense(req.user.userId, req.params.id)); } catch (error) { next(error); }
}
export async function approve(req: Request, res: Response, next: NextFunction) {
  try { const input = approvalExpenseSchema.parse(req.body); sendSuccess(res, await approveExpense(req.user.userId, req.params.id, input.note)); } catch (error) { next(error); }
}
export async function reject(req: Request, res: Response, next: NextFunction) {
  try { const input = rejectExpenseSchema.parse(req.body); sendSuccess(res, await rejectExpense(req.user.userId, req.params.id, input.reason)); } catch (error) { next(error); }
}
export async function pay(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await payExpense(req.user.userId, req.params.id)); } catch (error) { next(error); }
}
export async function evidence(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await getExpenseEvidence(req.user.userId, req.params.id)); } catch (error) { next(error); }
}
