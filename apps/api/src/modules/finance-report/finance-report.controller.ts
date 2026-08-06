import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@utils/response';
import { financeReportQuerySchema, generalLedgerQuerySchema } from './finance-report.schema';
import * as service from './finance-report.service';
import type { ZodType } from 'zod';

const handler = <T>(fn: (userId: string, query: T) => Promise<unknown>, schema: ZodType<T>) => async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await fn(req.user.userId, schema.parse(req.query))); } catch (error) { next(error); }
};

export const dashboard = handler(service.financeDashboard, financeReportQuerySchema);
export const profitLoss = handler(service.profitLoss, financeReportQuerySchema);
export const trialBalance = handler(service.trialBalance, financeReportQuerySchema);
export const generalLedger = handler(service.generalLedger, generalLedgerQuerySchema);
export const cashBank = handler(service.cashBankReport, financeReportQuerySchema);
export const deferredRevenue = handler(service.deferredRevenueReport, financeReportQuerySchema);
export const reconciliation = handler(service.reconciliation, financeReportQuerySchema);
