import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@utils/response';
import * as schema from './purchasing.schema';
import * as service from './purchasing.service';

const run = (handler: (req: Request) => Promise<unknown>, created = false) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result: any = await handler(req);
    sendSuccess(res, result, created && !result?.idempotentReplay ? 201 : 200);
  } catch (error) { next(error); }
};

export const suppliers = run((req) => service.listSuppliers(req.user.userId));
export const createSupplier = run((req) => service.createSupplier(req.user.userId, schema.createSupplierSchema.parse(req.body)), true);
export const updateSupplier = run((req) => service.updateSupplier(req.user.userId, req.params.id, schema.updateSupplierSchema.parse(req.body)));
export const purchaseRequests = run((req) => service.listPurchaseRequests(req.user.userId, schema.listPurchasingSchema.parse(req.query).branchId));
export const createPurchaseRequest = run((req) => service.createPurchaseRequest(req.user.userId, schema.createPurchaseRequestSchema.parse(req.body)), true);
export const submitPurchaseRequest = run((req) => service.submitPurchaseRequest(req.user.userId, req.params.id));
export const approvePurchaseRequest = run((req) => service.approvePurchaseRequest(req.user.userId, req.params.id, schema.approvePurchaseRequestSchema.parse(req.body)));
export const rejectPurchaseRequest = run((req) => service.rejectPurchaseRequest(req.user.userId, req.params.id, schema.rejectSchema.parse(req.body).reason));
export const purchaseOrders = run((req) => service.listPurchaseOrders(req.user.userId, schema.listPurchasingSchema.parse(req.query).branchId));
export const createPurchaseOrder = run((req) => service.createPurchaseOrder(req.user.userId, schema.createPurchaseOrderSchema.parse(req.body)), true);
export const postGoodsReceipt = run((req) => service.postGoodsReceipt(req.user.userId, req.params.id, schema.createGoodsReceiptSchema.parse(req.body)), true);
export const accountsPayable = run((req) => service.listAccountsPayable(req.user.userId, schema.listPurchasingSchema.parse(req.query).branchId));
export const postSupplierInvoice = run((req) => service.postSupplierInvoice(req.user.userId, schema.createSupplierInvoiceSchema.parse(req.body)), true);
export const paySupplierInvoice = run((req) => service.paySupplierInvoice(req.user.userId, req.params.id, schema.createSupplierPaymentSchema.parse(req.body)), true);
