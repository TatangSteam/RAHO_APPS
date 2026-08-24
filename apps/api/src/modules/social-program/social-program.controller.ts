import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@utils/response';
import {
  createSocialProgramSchema,
  listSocialProgramsSchema,
  socialProgramDecisionSchema,
} from './social-program.schema';
import {
  createSocialProgram,
  decideSocialProgram,
  getSocialProgram,
  listSocialPrograms,
  retrySocialProgramActivation,
} from './social-program.service';

export async function create(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await createSocialProgram(req.user.userId, createSocialProgramSchema.parse(req.body)), 201); } catch (error) { next(error); }
}
export async function list(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await listSocialPrograms(req.user.userId, listSocialProgramsSchema.parse(req.query))); } catch (error) { next(error); }
}
export async function detail(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await getSocialProgram(req.user.userId, req.params.id)); } catch (error) { next(error); }
}
export async function decide(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await decideSocialProgram(req.user.userId, req.params.id, socialProgramDecisionSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function retryActivation(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await retrySocialProgramActivation(req.user.userId, req.params.id)); } catch (error) { next(error); }
}
