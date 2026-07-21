import { NextFunction, Request, Response } from 'express';
import { assertBranchAccess } from '@modules/iam/authorization.service';
import { sendError } from '@utils/response';

export async function requireBranchAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    sendError(res, 401, 'AUTH_TOKEN_MISSING', 'Token autentikasi diperlukan.');
    return;
  }
  const branchId = req.params?.branchId ?? req.query?.branchId ?? req.body?.branchId;
  if (typeof branchId !== 'string' || !branchId.trim()) {
    sendError(res, 400, 'BRANCH_REQUIRED', 'Branch ID diperlukan.');
    return;
  }
  try {
    await assertBranchAccess(req.user.userId, branchId);
    next();
  } catch (error) {
    next(error);
  }
}
