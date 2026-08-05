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
import * as expenseService from './zoho.expense.service';
import * as partnershipService from './zoho.partnership.service';
import * as purchaseOrderService from './zoho.purchase-order.service';
import * as billService from './zoho.bill.service';
import * as vendorPaymentService from './zoho.vendor-payment.service';
import * as inventoryAdjustmentService from './zoho.inventory-adjustment.service';
import * as webhookService from './zoho.webhook.service';
import * as reconciliationService from './zoho.reconciliation.service';
import * as goLiveService from './zoho.go-live.service';
import * as setupService from './zoho.setup.service';
import * as originService from './zoho.origin.service';

const resolveMappingOriginSchema = z.object({
  dataOrigin: z.enum(['ERP', 'MANUAL_ZOHO']),
  managementMode: z.enum(['ERP_MANAGED', 'MANUAL_ONLY']),
  note: z.string().trim().min(5).max(500),
});

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
  entityType: z.enum(['MEMBER', 'SUPPLIER', 'PARTNERSHIP_BRANCH']).default('MEMBER'),
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

const expenseListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
});

const expensePaidThroughMappingSchema = z.object({
  cashBankAccountId: z.string().cuid(),
  zohoAccountId: z.string().trim().min(1).max(100),
});

const partnershipSaleListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
});

const purchaseOrderListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
});

const billListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
});

const grniListSchema = billListSchema.extend({
  overdueOnly: z.enum(['true', 'false']).optional()
    .transform((value) => value === 'true'),
});

const vendorPaymentListSchema = billListSchema;
const inventoryAdjustmentListSchema = billListSchema;
const sprint14ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().trim().min(1).max(50).optional(),
});
const resolveExceptionSchema = z.object({
  note: z.string().trim().min(5).max(1000),
});
const goLiveConfigSchema = z.object({
  masterFrozen: z.boolean().optional(),
  canaryBranchIds: z.array(z.string().cuid()).max(20).optional(),
  canaryCustomerId: z.string().cuid().nullable().optional(),
  canaryVendorId: z.string().cuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
const goLiveModeSchema = z.object({
  mode: z.enum(['OFF', 'DRY_RUN', 'CANARY', 'LIVE']),
});
const goLiveApprovalSchema = z.object({
  area: z.enum(['FINANCE', 'LOGISTICS']),
});
const rollbackSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

export async function connect(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, service.getAuthorizationUrl(req.user.userId)); } catch (error) { next(error); }
}

export async function callback(req: Request, res: Response) {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const accountsServer = typeof req.query['accounts-server'] === 'string'
      ? req.query['accounts-server']
      : null;
    const zohoError = typeof req.query.error === 'string' ? req.query.error : '';
    if (zohoError) return res.redirect(service.webRedirect('error', zohoError));
    if (!code || !state) return res.redirect(service.webRedirect('error', 'Callback Zoho tidak lengkap.'));
    return res.redirect(await service.handleCallback(code, state, accountsServer));
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

export async function setup(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await setupService.setupZohoReadiness(req.user.userId)); } catch (error) { next(error); }
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

export async function expenses(req: Request, res: Response, next: NextFunction) {
  try {
    const query = expenseListSchema.parse(req.query);
    sendSuccess(res, await expenseService.listExpenseMappings(req.user.userId, {
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  } catch (error) { next(error); }
}

export async function expenseConfig(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await expenseService.getExpenseConfig(req.user.userId)); } catch (error) { next(error); }
}

export async function mapExpenseAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const body = glAccountMappingSchema.parse(req.body);
    sendSuccess(res, await expenseService.saveExpenseAccountMapping(body.accountCode, body.zohoAccountId));
  } catch (error) { next(error); }
}

export async function mapExpensePaidThrough(req: Request, res: Response, next: NextFunction) {
  try {
    const body = expensePaidThroughMappingSchema.parse(req.body);
    sendSuccess(res, await expenseService.saveExpensePaidThroughMapping(
      req.user.userId,
      body.cashBankAccountId,
      body.zohoAccountId,
    ));
  } catch (error) { next(error); }
}

export async function previewExpense(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await expenseService.previewExpense(req.params.id)); } catch (error) { next(error); }
}

export async function enqueueExpense(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await expenseService.enqueueExpense(req.params.id)); } catch (error) { next(error); }
}

export async function reconcileExpenses(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await expenseService.reconcileExpenses(req.user.userId)); } catch (error) { next(error); }
}

export async function partnershipSales(req: Request, res: Response, next: NextFunction) {
  try {
    const query = partnershipSaleListSchema.parse(req.query);
    sendSuccess(res, await partnershipService.listPartnershipSales(req.user.userId, {
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  } catch (error) { next(error); }
}

export async function previewPartnershipSale(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await partnershipService.previewPartnershipSale(req.user.userId, req.params.id),
    );
  } catch (error) { next(error); }
}

export async function enqueuePartnershipSale(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await partnershipService.enqueuePartnershipSale(req.user.userId, req.params.id),
    );
  } catch (error) { next(error); }
}

export async function enqueuePartnershipCustomer(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await partnershipService.enqueuePartnershipCustomer(req.user.userId, req.params.branchId),
    );
  } catch (error) { next(error); }
}

export async function reconcilePartnershipSales(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(res, await partnershipService.reconcilePartnershipSales(req.user.userId));
  } catch (error) { next(error); }
}

export async function purchaseOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const query = purchaseOrderListSchema.parse(req.query);
    sendSuccess(res, await purchaseOrderService.listPurchaseOrderMappings(
      req.user.userId,
      { ...query, page: query.page ?? 1, limit: query.limit ?? 20 },
    ));
  } catch (error) { next(error); }
}

export async function previewPurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await purchaseOrderService.previewPurchaseOrder(req.user.userId, req.params.id),
    );
  } catch (error) { next(error); }
}

export async function enqueuePurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await purchaseOrderService.enqueuePurchaseOrder(req.user.userId, req.params.id),
    );
  } catch (error) { next(error); }
}

export async function enqueuePurchaseOrderDependencies(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await purchaseOrderService.enqueuePurchaseOrderDependencies(
        req.user.userId,
        req.params.id,
      ),
    );
  } catch (error) { next(error); }
}

export async function reconcilePurchaseOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(res, await purchaseOrderService.reconcilePurchaseOrders(req.user.userId));
  } catch (error) { next(error); }
}

export async function bills(req: Request, res: Response, next: NextFunction) {
  try {
    const query = billListSchema.parse(req.query);
    sendSuccess(res, await billService.listBills(req.user.userId, {
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  } catch (error) { next(error); }
}

export async function previewBill(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await billService.previewBill(req.user.userId, req.params.id));
  } catch (error) { next(error); }
}

export async function enqueueBill(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await billService.enqueueBill(req.user.userId, req.params.id));
  } catch (error) { next(error); }
}

export async function enqueueBillDependencies(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await billService.enqueueBillDependencies(req.user.userId, req.params.id),
    );
  } catch (error) { next(error); }
}

export async function grni(req: Request, res: Response, next: NextFunction) {
  try {
    const query = grniListSchema.parse(req.query);
    sendSuccess(res, await billService.listGrniExceptions(req.user.userId, {
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  } catch (error) { next(error); }
}

export async function reconcileBills(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await billService.reconcileBills(req.user.userId));
  } catch (error) { next(error); }
}

export async function vendorPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const query = vendorPaymentListSchema.parse(req.query);
    sendSuccess(res, await vendorPaymentService.listVendorPayments(req.user.userId, {
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  } catch (error) { next(error); }
}

export async function vendorPaymentConfig(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(res, await vendorPaymentService.getVendorPaymentConfig(req.user.userId));
  } catch (error) { next(error); }
}

export async function previewVendorPayment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await vendorPaymentService.previewVendorPayment(req.user.userId, req.params.id),
    );
  } catch (error) { next(error); }
}

export async function enqueueVendorPayment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await vendorPaymentService.enqueueVendorPayment(req.user.userId, req.params.id),
    );
  } catch (error) { next(error); }
}

export async function reconcileVendorPayments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await vendorPaymentService.reconcileVendorPayments(req.user.userId),
    );
  } catch (error) { next(error); }
}

export async function inventoryAdjustments(req: Request, res: Response, next: NextFunction) {
  try {
    const query = inventoryAdjustmentListSchema.parse(req.query);
    sendSuccess(res, await inventoryAdjustmentService.listInventoryAdjustmentEvents(
      req.user.userId,
      { page: query.page ?? 1, limit: query.limit ?? 20 },
    ));
  } catch (error) { next(error); }
}

export async function inventoryAdjustmentCapability(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(res, await inventoryAdjustmentService.getInventoryAdjustmentCapability());
  } catch (error) { next(error); }
}

export async function probeInventoryAdjustmentCapability(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(res, await inventoryAdjustmentService.probeInventoryAdjustmentCapability());
  } catch (error) { next(error); }
}

export async function exportInventoryAdjustments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const csv = await inventoryAdjustmentService.controlledInventoryExport(req.user.userId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="zoho-inventory-adjustments.csv"');
    res.status(200).send(csv);
  } catch (error) { next(error); }
}

export async function reconcileInventoryAdjustments(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(res, await inventoryAdjustmentService.reconcileInventoryAdjustments());
  } catch (error) { next(error); }
}

export async function receiveWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody
      || Buffer.from(JSON.stringify(req.body));
    const result = await webhookService.receiveZohoWebhook({
      organizationId: req.params.organizationId,
      payload: req.body,
      rawBody,
      headers: req.headers,
    });
    res.status(202).json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function webhookInbox(req: Request, res: Response, next: NextFunction) {
  try {
    const query = sprint14ListSchema.parse(req.query);
    sendSuccess(res, await webhookService.listWebhookInbox({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
    }));
  } catch (error) { next(error); }
}

export async function retryWebhookCorrelation(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await webhookService.retryPendingWebhookCorrelation(req.params.id));
  } catch (error) { next(error); }
}

export async function reconciliationRuns(req: Request, res: Response, next: NextFunction) {
  try {
    const query = sprint14ListSchema.parse(req.query);
    sendSuccess(res, await reconciliationService.listReconciliationRuns({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
    }));
  } catch (error) { next(error); }
}

export async function runFullReconciliation(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await reconciliationService.startReconciliationRun({
      actorUserId: req.user.userId,
      triggerSource: 'MANUAL',
    }));
  } catch (error) { next(error); }
}

export async function resolveReconciliationException(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = resolveExceptionSchema.parse(req.body);
    sendSuccess(res, await reconciliationService.resolveReconciliationResult(
      req.params.id,
      req.user.userId,
      input.note,
    ));
  } catch (error) { next(error); }
}

export async function resolveMappingOrigin(req: Request, res: Response, next: NextFunction) {
  try {
    const input = resolveMappingOriginSchema.parse(req.body);
    sendSuccess(res, await originService.resolveMappingOrigin({
      mappingId: req.params.id,
      actorUserId: req.user.userId,
      dataOrigin: input.dataOrigin!,
      managementMode: input.managementMode!,
      note: input.note!,
    }));
  } catch (error) { next(error); }
}

export async function goLiveControl(_req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await goLiveService.getGoLiveControl()); } catch (error) { next(error); }
}

export async function configureGoLive(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await goLiveService.configureGoLiveControl({
      actorUserId: req.user.userId,
      ...goLiveConfigSchema.parse(req.body),
    }));
  } catch (error) { next(error); }
}

export async function setGoLiveMode(req: Request, res: Response, next: NextFunction) {
  try {
    const input = goLiveModeSchema.parse(req.body);
    sendSuccess(res, await goLiveService.setGoLiveMode(req.user.userId, input.mode));
  } catch (error) { next(error); }
}

export async function approveGoLive(req: Request, res: Response, next: NextFunction) {
  try {
    const input = goLiveApprovalSchema.parse(req.body);
    sendSuccess(res, await goLiveService.approveGoLive(req.user.userId, input.area));
  } catch (error) { next(error); }
}

export async function rollbackGoLive(req: Request, res: Response, next: NextFunction) {
  try {
    const input = rollbackSchema.parse(req.body);
    sendSuccess(res, await goLiveService.rollbackGoLive(req.user.userId, input.reason));
  } catch (error) { next(error); }
}

export async function recordCanaryDay(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await goLiveService.recordMismatchFreeBusinessDay(req.user.userId));
  } catch (error) { next(error); }
}
