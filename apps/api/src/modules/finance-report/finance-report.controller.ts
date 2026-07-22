import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@utils/response';
import { financeReportQuerySchema, generalLedgerQuerySchema } from './finance-report.schema';
import * as service from './finance-report.service';
import type { ZodTypeAny } from 'zod';

const handler = (fn: (userId: string, query: any) => Promise<unknown>, schema: ZodTypeAny = financeReportQuerySchema) => async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await fn(req.user.userId, schema.parse(req.query))); } catch (error) { next(error); }
};

export const dashboard = handler(service.financeDashboard);
export const profitLoss = handler(service.profitLoss);
export const trialBalance = handler(service.trialBalance);
export const generalLedger = handler(service.generalLedger, generalLedgerQuerySchema);
export const cashBank = handler(service.cashBankReport);
export const deferredRevenue = handler(service.deferredRevenueReport);
export const reconciliation = handler(service.reconciliation);
