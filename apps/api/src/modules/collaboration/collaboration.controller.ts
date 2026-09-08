import type { NextFunction, Request, Response } from 'express';
import { sendCreated, sendSuccess } from '@utils/response';
import {
  addMemberSchema,
  bootstrapQuerySchema,
  createCommentSchema,
  createSubtaskSchema,
  createTaskSchema,
  createTeamSchema,
  primaryLeaderSchema,
  updateMemberSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  updateTeamSchema,
} from './collaboration.schema';
import * as service from './collaboration.service';

export async function bootstrap(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.getBootstrap(req.user.userId, bootstrapQuerySchema.parse(req.query))); } catch (error) { next(error); }
}
export async function createTeam(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await service.createTeam(req.user.userId, createTeamSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function updateTeam(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.updateTeam(req.user.userId, req.params.teamId, updateTeamSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function deleteTeam(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.deleteTeam(req.user.userId, req.params.teamId)); } catch (error) { next(error); }
}
export async function addMember(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await service.addTeamMember(req.user.userId, req.params.teamId, addMemberSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function updateMember(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.updateTeamMember(req.user.userId, req.params.teamId, req.params.membershipId, updateMemberSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function setPrimaryLeader(req: Request, res: Response, next: NextFunction) {
  try {
    const input = primaryLeaderSchema.parse(req.body);
    sendSuccess(res, await service.setPrimaryLeader(req.user.userId, req.params.teamId, input.membershipId));
  } catch (error) { next(error); }
}
export async function createTask(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await service.createTask(req.user.userId, createTaskSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function getTask(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.getTaskDetail(req.user.userId, req.params.taskId)); } catch (error) { next(error); }
}
export async function createSubtask(req: Request, res: Response, next: NextFunction) {
  try { sendCreated(res, await service.createSubtask(req.user.userId, req.params.taskId, createSubtaskSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.updateTask(req.user.userId, req.params.taskId, updateTaskSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function updateTaskStatus(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.updateTaskStatus(req.user.userId, req.params.taskId, updateTaskStatusSchema.parse(req.body))); } catch (error) { next(error); }
}
export async function createComment(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createCommentSchema.parse(req.body);
    sendCreated(res, await service.createComment(req.user.userId, req.params.taskId, input.content));
  } catch (error) { next(error); }
}
