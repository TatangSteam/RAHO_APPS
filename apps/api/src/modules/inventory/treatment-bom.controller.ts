import { NextFunction, Request, Response } from 'express';
import { sendCreated, sendSuccess } from '@utils/response';
import {
  createTreatmentBomSchema,
  treatmentBomListQuerySchema,
  updateTreatmentBomSchema,
} from './treatment-bom.schema';
import {
  activateTreatmentBom,
  createTreatmentBom,
  getTreatmentBom,
  listTreatmentBoms,
  updateTreatmentBom,
} from './services/treatment-bom.service';

export class TreatmentBomController {
  async list(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await listTreatmentBoms(req.user.userId, treatmentBomListQuerySchema.parse(req.query))); } catch (error) { next(error); }
  }
  async get(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await getTreatmentBom(req.user.userId, req.params.bomId)); } catch (error) { next(error); }
  }
  async create(req: Request, res: Response, next: NextFunction) {
    try { sendCreated(res, await createTreatmentBom(req.user.userId, createTreatmentBomSchema.parse(req.body))); } catch (error) { next(error); }
  }
  async update(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await updateTreatmentBom(req.user.userId, req.params.bomId, updateTreatmentBomSchema.parse(req.body))); } catch (error) { next(error); }
  }
  async activate(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await activateTreatmentBom(req.user.userId, req.params.bomId)); } catch (error) { next(error); }
  }
}
