import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@utils/response';
import { revenueListQuerySchema, upsertRevenuePolicySchema } from './revenue.schema';
import { listRevenueContracts, listRevenuePolicies, listTreatmentEvents, upsertRevenuePolicy } from './revenue.service';

export async function policies(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await listRevenuePolicies(req.user.userId)); } catch (error) { next(error); } }
export async function savePolicy(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await upsertRevenuePolicy(req.user.userId, upsertRevenuePolicySchema.parse(req.body))); } catch (error) { next(error); } }
export async function contracts(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await listRevenueContracts(req.user.userId, revenueListQuerySchema.parse(req.query))); } catch (error) { next(error); } }
export async function events(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await listTreatmentEvents(req.user.userId, revenueListQuerySchema.parse(req.query).branchId)); } catch (error) { next(error); } }
