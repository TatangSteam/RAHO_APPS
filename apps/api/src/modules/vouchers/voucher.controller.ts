import type { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { sendCreated, sendSuccess } from '@utils/response';
import { claimVoucherSchema, createVoucherOperatorSchema, exportVoucherCodesSchema, generateVoucherCodesSchema, issueVoucherSchema, updateVoucherOperatorSchema } from './voucher.schema';
import { claimVoucher, createVoucherOperator, exportVoucherCodes, generateVoucherCodes, getVoucherDashboard, issueVoucher, updateVoucherOperator } from './voucher.service';

export async function dashboard(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await getVoucherDashboard(req.user.userId, req.user.role as Role)); } catch (error) { next(error); }
}

export async function issue(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await issueVoucher(req.user.userId, req.user.role as Role, issueVoucherSchema.parse(req.body))); } catch (error) { next(error); }
}

export async function claim(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await claimVoucher(req.user.userId, req.user.role as Role, claimVoucherSchema.parse(req.body))); } catch (error) { next(error); }
}

export async function createOperator(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await createVoucherOperator(req.user.userId, req.user.role as Role, createVoucherOperatorSchema.parse(req.body))); } catch (error) { next(error); }
}

export async function updateOperator(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await updateVoucherOperator(req.user.userId, req.user.role as Role, req.params.operatorId, updateVoucherOperatorSchema.parse(req.body))); } catch (error) { next(error); }
}

export async function exportCodes(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await exportVoucherCodes(req.user.userId, req.user.role as Role, exportVoucherCodesSchema.parse(req.query));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(200).send(`\uFEFF${result.csv}`);
  } catch (error) { next(error); }
}

export async function generateCodes(req: Request, res: Response, next: NextFunction) {
  try {
    sendCreated(res, await generateVoucherCodes(req.user.userId, req.user.role as Role, req.params.campaignId, generateVoucherCodesSchema.parse(req.body)));
  } catch (error) { next(error); }
}
