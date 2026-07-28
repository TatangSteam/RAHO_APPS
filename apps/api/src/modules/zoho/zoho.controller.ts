import { NextFunction, Request, Response } from 'express';
import { IntegrationEventStatus, ZohoDiscoveryResourceType } from '@prisma/client';
import { z } from 'zod';
import { sendSuccess } from '@utils/response';
import * as service from './zoho.service';
import * as queueService from './zoho.queue.service';
import * as discoveryService from './zoho.discovery.service';

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
