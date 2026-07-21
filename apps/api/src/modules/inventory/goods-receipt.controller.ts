import { NextFunction, Request, Response } from 'express';
import { sendCreated, sendSuccess } from '@utils/response';
import type {
  GoodsReceiptListQuery,
  PostGoodsReceiptInput,
  PurchaseOrderListQuery,
} from './goods-receipt.schema';
import {
  getGoodsReceipt,
  listGoodsReceipts,
  listReceivablePurchaseOrders,
  postGoodsReceipt,
} from './services/goods-receipt.service';

export class GoodsReceiptController {
  async purchaseOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await listReceivablePurchaseOrders(req.user!.userId, req.query as unknown as PurchaseOrderListQuery);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await listGoodsReceipts(req.user!.userId, req.query as unknown as GoodsReceiptListQuery);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await getGoodsReceipt(req.user!.userId, req.params.receiptId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async post(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await postGoodsReceipt(
        req.user!.userId,
        req.params.purchaseOrderId,
        req.body as PostGoodsReceiptInput,
      );
      sendCreated(res, result);
    } catch (error) {
      next(error);
    }
  }
}
