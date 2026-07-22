import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@utils/response';
import {
  inventoryValuationQuerySchema,
  logisticsDashboardQuerySchema,
  stockCardQuerySchema,
} from './logistics-report.schema';
import {
  getInventoryValuation,
  getLogisticsDashboard,
  getStockCard,
} from './services/logistics-report.service';

export class LogisticsReportController {
  async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await getLogisticsDashboard(req.user.userId, logisticsDashboardQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  }

  async stockCard(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await getStockCard(req.user.userId, stockCardQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  }

  async valuation(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await getInventoryValuation(req.user.userId, inventoryValuationQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  }
}
