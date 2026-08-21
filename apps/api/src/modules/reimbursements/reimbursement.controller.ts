import { createHash, randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { extractKeyFromUrl, safeDeleteFile, uploadFile } from '@config/minio';
import { sendSuccess } from '@utils/response';
import {
  createReimbursementSchema,
  listReimbursementsQuerySchema,
  payReimbursementSchema,
  reimbursementDecisionSchema,
  updateReimbursementSchema,
} from './reimbursement.schema';
import {
  cancelReimbursement,
  createReimbursement,
  decideReimbursement,
  getReimbursement,
  getReimbursementAttachment,
  listReimbursements,
  payReimbursement,
  submitReimbursement,
  updateReimbursement,
  type ReimbursementEvidence,
} from './reimbursement.service';

function files(req: Request) {
  return (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
}

async function uploadEvidence(req: Request, branchId: string, postingKey: string) {
  const uploadedKeys: string[] = [];
  const evidence: ReimbursementEvidence[] = [];
  for (const file of files(req)) {
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const extension = file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
    const key = `uploads/reimbursements/${branchId}/${createHash('sha256').update(postingKey).digest('hex').slice(0, 20)}/${randomUUID()}-${checksum.slice(0, 20)}.${extension}`;
    const uploaded = await uploadFile(file.buffer, key, file.mimetype);
    uploadedKeys.push(key);
    evidence.push({ fileUrl: uploaded.url, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype, checksum });
  }
  return { evidence, uploadedKeys };
}

export async function create(req: Request, res: Response, next: NextFunction) {
  let uploadedKeys: string[] = [];
  try {
    const input = createReimbursementSchema.parse(req.body);
    const uploaded = await uploadEvidence(req, input.branchId, input.postingKey);
    uploadedKeys = uploaded.uploadedKeys;
    const result = await createReimbursement(req.user.userId, input, uploaded.evidence);
    if (result.idempotentReplay) await Promise.all(uploadedKeys.map((key) => safeDeleteFile(key)));
    sendSuccess(res, result, result.idempotentReplay ? 200 : 201);
  } catch (error) {
    await Promise.all(uploadedKeys.map((key) => safeDeleteFile(key)));
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  let uploadedKeys: string[] = [];
  try {
    const input = updateReimbursementSchema.parse(req.body);
    const existing = await getReimbursement(req.user.userId, req.params.id);
    const uploaded = await uploadEvidence(req, existing.branchId, existing.postingKey);
    uploadedKeys = uploaded.uploadedKeys;
    const result = await updateReimbursement(req.user.userId, req.params.id, input, uploaded.evidence);
    await Promise.all(result.replacedFileUrls.map((url) => safeDeleteFile(extractKeyFromUrl(url))));
    sendSuccess(res, result.reimbursement);
  } catch (error) {
    await Promise.all(uploadedKeys.map((key) => safeDeleteFile(key)));
    next(error);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listReimbursements(req.user.userId, listReimbursementsQuerySchema.parse(req.query))); } catch (error) { next(error); }
}
export async function detail(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await getReimbursement(req.user.userId, req.params.id)); } catch (error) { next(error); }
}
export async function submit(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await submitReimbursement(req.user.userId, req.params.id)); } catch (error) { next(error); }
}
export async function decide(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await decideReimbursement(req.user.userId, req.params.id, reimbursementDecisionSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function cancel(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await cancelReimbursement(req.user.userId, req.params.id)); } catch (error) { next(error); }
}
export async function pay(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await payReimbursement(req.user.userId, req.params.id, payReimbursementSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function attachment(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await getReimbursementAttachment(req.user.userId, req.params.id, req.params.attachmentId)); } catch (error) { next(error); }
}
