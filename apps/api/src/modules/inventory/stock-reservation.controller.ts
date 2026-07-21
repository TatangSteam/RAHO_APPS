import { NextFunction, Request, Response } from 'express';
import { sendCreated, sendSuccess } from '@utils/response';
import {
  approveStockRequestReservationSchema,
  releaseStockReservationSchema,
  stockReservationQuerySchema,
} from './stock-reservation.schema';
import {
  approveAndReserveStockRequest,
  listStockReservations,
  releaseStockRequestReservations,
} from './services/stock-reservation.service';

export class StockReservationController {
  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      sendCreated(res, await approveAndReserveStockRequest(
        req.user.userId,
        req.params.requestId,
        approveStockRequestReservationSchema.parse(req.body),
      ));
    } catch (error) { next(error); }
  }

  async release(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await releaseStockRequestReservations(
        req.user.userId,
        req.params.requestId,
        releaseStockReservationSchema.parse(req.body),
      ));
    } catch (error) { next(error); }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await listStockReservations(
        req.user.userId,
        stockReservationQuerySchema.parse(req.query),
      ));
    } catch (error) { next(error); }
  }
}
