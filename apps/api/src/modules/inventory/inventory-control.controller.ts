import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@utils/response';
import {
  adjustmentDecisionSchema,
  countStockOpnameSchema,
  completeMultiBagUsageSchema,
  createAdjustmentSchema,
  listInventoryControlSchema,
  startStockOpnameSchema,
  resolveDiscrepancySchema,
} from './inventory-control.schema';
import { completeMultiBagUsage, resolveShipmentDiscrepancy } from './services/inventory-discrepancy-homecare.service';
import {
  cancelStockOpname,
  countStockOpname,
  createAdjustment,
  decideAdjustment,
  decideStockOpname,
  listAdjustmentReasons,
  listAdjustments,
  listStockOpnames,
  postAdjustment,
  postStockOpname,
  startStockOpname,
  submitAdjustment,
  submitStockOpname,
} from './services/inventory-control.service';

export class InventoryControlController {
  private run(handler: () => Promise<unknown>, res: Response, next: NextFunction, status = 200) {
    handler().then((data) => sendSuccess(res, data, status)).catch(next);
  }

  reasons(req: Request, res: Response, next: NextFunction) {
    return this.run(() => listAdjustmentReasons(req.user!.userId), res, next);
  }

  listAdjustments(req: Request, res: Response, next: NextFunction) {
    return this.run(() => listAdjustments(req.user!.userId, listInventoryControlSchema.parse(req.query)), res, next);
  }

  createAdjustment(req: Request, res: Response, next: NextFunction) {
    return this.run(() => createAdjustment(req.user!.userId, createAdjustmentSchema.parse(req.body)), res, next, 201);
  }

  submitAdjustment(req: Request, res: Response, next: NextFunction) {
    return this.run(() => submitAdjustment(req.user!.userId, req.params.id), res, next);
  }

  decideAdjustment(req: Request, res: Response, next: NextFunction) {
    return this.run(() => decideAdjustment(req.user!.userId, req.params.id, adjustmentDecisionSchema.parse(req.body)), res, next);
  }

  postAdjustment(req: Request, res: Response, next: NextFunction) {
    return this.run(() => postAdjustment(req.user!.userId, req.params.id), res, next);
  }

  listOpnames(req: Request, res: Response, next: NextFunction) {
    return this.run(() => listStockOpnames(req.user!.userId, listInventoryControlSchema.parse(req.query)), res, next);
  }

  startOpname(req: Request, res: Response, next: NextFunction) {
    return this.run(() => startStockOpname(req.user!.userId, startStockOpnameSchema.parse(req.body)), res, next, 201);
  }

  countOpname(req: Request, res: Response, next: NextFunction) {
    return this.run(() => countStockOpname(req.user!.userId, req.params.id, countStockOpnameSchema.parse(req.body)), res, next);
  }

  submitOpname(req: Request, res: Response, next: NextFunction) {
    return this.run(() => submitStockOpname(req.user!.userId, req.params.id), res, next);
  }

  decideOpname(req: Request, res: Response, next: NextFunction) {
    return this.run(() => decideStockOpname(req.user!.userId, req.params.id, adjustmentDecisionSchema.parse(req.body)), res, next);
  }

  postOpname(req: Request, res: Response, next: NextFunction) {
    return this.run(() => postStockOpname(req.user!.userId, req.params.id), res, next);
  }

  cancelOpname(req: Request, res: Response, next: NextFunction) {
    const note = String(req.body?.note || '').trim();
    if (note.length < 3) return next({ status: 400, code: 'CANCEL_NOTE_REQUIRED', message: 'Catatan pembatalan wajib diisi.' });
    return this.run(() => cancelStockOpname(req.user!.userId, req.params.id, note), res, next);
  }

  resolveDiscrepancy(req: Request, res: Response, next: NextFunction) {
    return this.run(
      () => resolveShipmentDiscrepancy(req.user!.userId, req.params.id, resolveDiscrepancySchema.parse(req.body)),
      res,
      next,
    );
  }

  completeMultiBagUsage(req: Request, res: Response, next: NextFunction) {
    return this.run(
      () => completeMultiBagUsage(req.user!.userId, completeMultiBagUsageSchema.parse(req.body)),
      res,
      next,
      201,
    );
  }
}
