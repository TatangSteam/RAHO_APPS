import type { Request, Response, NextFunction } from 'express';
import { DiagnosisService } from './diagnosis.service';
import { sendSuccess } from '../../utils/response';

const diagnosisService = new DiagnosisService();

export class DiagnosisController {
  async getCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await diagnosisService.getCategories();
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
