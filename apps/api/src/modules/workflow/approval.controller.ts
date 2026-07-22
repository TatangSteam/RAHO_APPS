import { NextFunction, Request, Response } from 'express';
import { sendCreated, sendSuccess } from '@utils/response';
import { approvalInboxQuerySchema, createApprovalRuleSchema } from './approval.schema';
import { createApprovalRule, listApprovalInbox, listApprovalRules } from './approval.service';

export async function createRule(req: Request, res: Response, next: NextFunction) { try { sendCreated(res, await createApprovalRule(req.user.userId, createApprovalRuleSchema.parse(req.body))); } catch (error) { next(error); } }
export async function rules(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await listApprovalRules(req.user.userId)); } catch (error) { next(error); } }
export async function inbox(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await listApprovalInbox(req.user.userId, approvalInboxQuerySchema.parse(req.query))); } catch (error) { next(error); } }
