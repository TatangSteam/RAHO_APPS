import { ApprovalDecisionType } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { sendCreated, sendSuccess } from '@utils/response';
import { createStockOpnameSchema, rejectStockOpnameSchema, stockOpnameDecisionSchema, stockOpnameListSchema } from './stock-opname.schema';
import { createStockOpname, decideStockOpname, listStockOpnames, submitStockOpname } from './services/stock-opname.service';

export async function create(req: Request, res: Response, next: NextFunction) { try { sendCreated(res, await createStockOpname(req.user.userId, createStockOpnameSchema.parse(req.body))); } catch (error) { next(error); } }
export async function submit(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await submitStockOpname(req.user.userId, req.params.id)); } catch (error) { next(error); } }
export async function approve(req: Request, res: Response, next: NextFunction) { try { const body = stockOpnameDecisionSchema.parse(req.body); sendSuccess(res, await decideStockOpname(req.user.userId, req.params.id, ApprovalDecisionType.APPROVE, body.note)); } catch (error) { next(error); } }
export async function reject(req: Request, res: Response, next: NextFunction) { try { const body = rejectStockOpnameSchema.parse(req.body); sendSuccess(res, await decideStockOpname(req.user.userId, req.params.id, ApprovalDecisionType.REJECT, body.note)); } catch (error) { next(error); } }
export async function list(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await listStockOpnames(req.user.userId, stockOpnameListSchema.parse(req.query))); } catch (error) { next(error); } }
