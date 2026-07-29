import { NextFunction, Request, Response } from 'express';
import { IntegrationEventStatus, ZohoDiscoveryResourceType } from '@prisma/client';
import { z } from 'zod';
import { sendSuccess } from '@utils/response';
import * as service from './zoho.service';
import * as queueService from './zoho.queue.service';
import * as discoveryService from './zoho.discovery.service';
import * as contactService from './zoho.contact.service';
import * as masterService from './zoho.master.service';
import * as invoiceService from './zoho.invoice.service';
import * as paymentService from './zoho.payment.service';
import * as retainerService from './zoho.retainer.service';

const queueQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(IntegrationEventStatus).optional(),
  eventType: z.string().trim().min(1).optional(),
  branchId: z.string().trim().min(1).optional(),
});

const ignoreSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

const discoveryQuerySchema = z.object({
  resourceType: z.nativeEnum(ZohoDiscoveryResourceType).optional(),
});

const contactListSchema = z.object({
  entityType: z.enum(['MEMBER', 'SUPPLIER']).default('MEMBER'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
});

const approveReviewSchema = z.object({
  zohoContactId: z.string().trim().min(1).max(100),
});

const masterListSchema = z.object({
  entityType: z.enum(['MASTER_PRODUCT', 'PACKAGE_PRICING', 'BRANCH_LOCATION', 'STOCK_LOCATION'])
    .default('MASTER_PRODUCT'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
});

const approveMasterReviewSchema = z.object({
  zohoEntityId: z.string().trim().min(1).max(100),
});

const accountRoleMappingSchema = z.object({
  role: z.enum(['ITEM_SALES', 'ITEM_PURCHASE', 'ITEM_INVENTORY']),
  zohoAccountId: z.string().trim().min(1).max(100),
});

const uomMappingSchema = z.object({
  uomId: z.string().trim().min(1).max(100),
  zohoUnit: z.string().trim().min(1).max(50),
});

const invoiceListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
});

const taxMappingSchema = z.object({
  percent: z.coerce.number().min(0).max(100),
  zohoTaxId: z.string().trim().min(1).max(100),
});

const paymentListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
});

const paymentAccountMappingSchema = z.object({
  cashBankAccountId: z.string().cuid(),
  zohoAccountId: z.string().trim().min(1).max(100),
});

const paymentMethodMappingSchema = z.object({
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'DEBIT', 'CREDIT', 'QRIS', 'OTHER']),
  zohoMode: z.enum(['cash', 'check', 'creditcard', 'banktransfer', 'bankremittance', 'autotransaction', 'others']),
});

const retainerListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
});

const glAccountMappingSchema = z.object({
  accountCode: z.string().trim().min(1).max(50),
  zohoAccountId: z.string().trim().min(1).max(100),
});

export async function connect(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, service.getAuthorizationUrl(req.user.userId)); } catch (error) { next(error); }
}

export async function callback(req: Request, res: Response) {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const zohoError = typeof req.query.error === 'string' ? req.query.error : '';
    if (zohoError) return res.redirect(service.webRedirect('error', zohoError));
    if (!code || !state) return res.redirect(service.webRedirect('error', 'Callback Zoho tidak lengkap.'));
    return res.redirect(await service.handleCallback(code, state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Koneksi Zoho gagal.';
    return res.redirect(service.webRedirect('error', message));
  }
}

export async function status(_req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.getStatus()); } catch (error) { next(error); }
}
export async function test(_req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.testConnection()); } catch (error) { next(error); }
}
export async function activate(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.activateConnection(req.params.id, req.user.userId)); } catch (error) { next(error); }
}
export async function disconnect(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await service.disconnect(req.user.userId)); } catch (error) { next(error); }
}

export async function events(req: Request, res: Response, next: NextFunction) {
  try {
    const query = queueQuerySchema.parse(req.query);
    sendSuccess(res, await queueService.listEvents(req.user.userId, {
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  } catch (error) { next(error); }
}

export async function event(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await queueService.getEvent(req.user.userId, req.params.id)); } catch (error) { next(error); }
}

export async function retryEvent(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await queueService.retryEvent(req.user.userId, req.params.id)); } catch (error) { next(error); }
}

export async function ignoreEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const body = ignoreSchema.parse(req.body);
    sendSuccess(res, await queueService.ignoreEvent(req.user.userId, req.params.id, body.reason));
  } catch (error) { next(error); }
}

export async function discovery(req: Request, res: Response, next: NextFunction) {
  try {
    const query = discoveryQuerySchema.parse(req.query);
    sendSuccess(res, await discoveryService.getDiscovery(query.resourceType));
  } catch (error) { next(error); }
}

export async function runDiscovery(_req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await discoveryService.runDiscovery()); } catch (error) { next(error); }
}

export async function contacts(req: Request, res: Response, next: NextFunction) {
  try {
    const query = contactListSchema.parse(req.query);
    sendSuccess(res, await contactService.listContactMappings({
      ...query,
      entityType: query.entityType ?? 'MEMBER',
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  } catch (error) { next(error); }
}

export async function previewContact(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await contactService.previewContact(req.params.entityType, req.params.id));
  } catch (error) { next(error); }
}

export async function matchContact(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await contactService.findContactMatch(req.params.entityType, req.params.id));
  } catch (error) { next(error); }
}

export async function enqueueContact(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await contactService.enqueueContact(req.params.entityType, req.params.id));
  } catch (error) { next(error); }
}

export async function approveContactReview(req: Request, res: Response, next: NextFunction) {
  try {
    const body = approveReviewSchema.parse(req.body);
    sendSuccess(res, await contactService.approveContactReview(req.user.userId, req.params.id, body.zohoContactId));
  } catch (error) { next(error); }
}

export async function rejectContactReview(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await contactService.rejectContactReview(req.user.userId, req.params.id));
  } catch (error) { next(error); }
}

export async function masters(req: Request, res: Response, next: NextFunction) {
  try {
    const query = masterListSchema.parse(req.query);
    sendSuccess(res, await masterService.listMasterMappings({
      ...query,
      entityType: query.entityType ?? 'MASTER_PRODUCT',
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  } catch (error) { next(error); }
}

export async function masterConfig(_req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await masterService.getMasterConfig()); } catch (error) { next(error); }
}

export async function previewMaster(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await masterService.previewMaster(req.params.entityType, req.params.id)); } catch (error) { next(error); }
}

export async function matchMaster(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await masterService.findMasterMatch(req.params.entityType, req.params.id)); } catch (error) { next(error); }
}

export async function enqueueMaster(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await masterService.enqueueMaster(req.params.entityType, req.params.id)); } catch (error) { next(error); }
}

export async function mapItemAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const body = accountRoleMappingSchema.parse(req.body);
    sendSuccess(res, await masterService.saveAccountRoleMapping(body.role, body.zohoAccountId));
  } catch (error) { next(error); }
}

export async function mapUom(req: Request, res: Response, next: NextFunction) {
  try {
    const body = uomMappingSchema.parse(req.body);
    sendSuccess(res, await masterService.saveUomMapping(body.uomId, body.zohoUnit));
  } catch (error) { next(error); }
}

export async function approveMasterReview(req: Request, res: Response, next: NextFunction) {
  try {
    const body = approveMasterReviewSchema.parse(req.body);
    sendSuccess(res, await masterService.approveMasterReview(req.user.userId, req.params.id, body.zohoEntityId));
  } catch (error) { next(error); }
}

export async function rejectMasterReview(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await masterService.rejectMasterReview(req.user.userId, req.params.id)); } catch (error) { next(error); }
}

export async function invoices(req: Request, res: Response, next: NextFunction) {
  try {
    const query = invoiceListSchema.parse(req.query);
    sendSuccess(res, await invoiceService.listInvoiceMappings({
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  } catch (error) { next(error); }
}

export async function invoiceConfig(_req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await invoiceService.getInvoiceConfig()); } catch (error) { next(error); }
}

export async function previewInvoice(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await invoiceService.previewInvoice(req.params.id)); } catch (error) { next(error); }
}

export async function enqueueInvoice(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await invoiceService.enqueueInvoice(req.params.id)); } catch (error) { next(error); }
}

export async function mapInvoiceTax(req: Request, res: Response, next: NextFunction) {
  try {
    const body = taxMappingSchema.parse(req.body);
    sendSuccess(res, await invoiceService.saveTaxMapping(body.percent, body.zohoTaxId));
  } catch (error) { next(error); }
}

export async function payments(req: Request, res: Response, next: NextFunction) {
  try {
    const query = paymentListSchema.parse(req.query);
    sendSuccess(res, await paymentService.listPaymentMappings(req.user.userId, {
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  } catch (error) { next(error); }
}

export async function paymentConfig(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await paymentService.getPaymentConfig(req.user.userId)); } catch (error) { next(error); }
}

export async function mapPaymentAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const body = paymentAccountMappingSchema.parse(req.body);
    sendSuccess(res, await paymentService.saveCashBankMapping(
      req.user.userId,
      body.cashBankAccountId,
      body.zohoAccountId,
    ));
  } catch (error) { next(error); }
}

export async function mapPaymentMethod(req: Request, res: Response, next: NextFunction) {
  try {
    const body = paymentMethodMappingSchema.parse(req.body);
    sendSuccess(res, await paymentService.savePaymentMethodMapping(
      req.user.userId,
      body.paymentMethod,
      body.zohoMode,
    ));
  } catch (error) { next(error); }
}

export async function previewPayment(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await paymentService.previewPayment(req.params.id)); } catch (error) { next(error); }
}

export async function enqueuePayment(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await paymentService.enqueuePayment(req.params.id)); } catch (error) { next(error); }
}

export async function reconcilePayments(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await paymentService.reconcilePayments(req.user.userId)); } catch (error) { next(error); }
}

export async function retainers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = retainerListSchema.parse(req.query);
    sendSuccess(res, await retainerService.listRetainerRevenue(req.user.userId, {
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  } catch (error) { next(error); }
}

export async function retainerConfig(_req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await retainerService.getRetainerConfig()); } catch (error) { next(error); }
}

export async function mapRetainerAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const body = glAccountMappingSchema.parse(req.body);
    sendSuccess(res, await retainerService.saveGlAccountMapping(body.accountCode, body.zohoAccountId));
  } catch (error) { next(error); }
}

export async function reconcileRetainers(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await retainerService.reconcileRetainerRevenue(req.user.userId)); } catch (error) { next(error); }
}
