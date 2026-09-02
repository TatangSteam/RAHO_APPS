import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '@utils/response';
import { whatsappConnectionManager } from './whatsapp-connection.manager';
import { SESSION_REPORT_BACKGROUND_KEYS } from './whatsapp-backgrounds';
import { WhatsAppDeliveryStatus } from '@prisma/client';
import * as adminService from './whatsapp-admin.service';

const configSchema = z.object({ backgroundKey: z.enum(SESSION_REPORT_BACKGROUND_KEYS) });
const deliveryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(WhatsAppDeliveryStatus).optional(),
});

export async function status(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, await whatsappConnectionManager.status());
  } catch (error) { next(error); }
}

export async function qr(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await whatsappConnectionManager.requestQr(req.user.userId);
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, await whatsappConnectionManager.status());
  } catch (error) { next(error); }
}

export async function reconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await whatsappConnectionManager.start(req.user.userId);
    sendSuccess(res, await whatsappConnectionManager.status());
  } catch (error) { next(error); }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await whatsappConnectionManager.logout(req.user.userId);
    sendSuccess(res, { disconnected: true });
  } catch (error) { next(error); }
}

export async function updateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { backgroundKey } = configSchema.parse(req.body);
    await whatsappConnectionManager.updateDefaultBackground(backgroundKey, req.user.userId);
    sendSuccess(res, await whatsappConnectionManager.status());
  } catch (error) { next(error); }
}

export async function uploadBackground(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw {
        status: 400,
        code: 'WHATSAPP_BACKGROUND_REQUIRED',
        message: 'Pilih file background yang akan diunggah.',
      };
    }
    const background = await whatsappConnectionManager.uploadCustomBackground(req.file, req.user.userId);
    sendSuccess(res, { background, status: await whatsappConnectionManager.status() });
  } catch (error) { next(error); }
}

export async function deliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = deliveryQuerySchema.parse(req.query);
    sendSuccess(res, await adminService.listDeliveries({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
    }));
  } catch (error) { next(error); }
}

export async function retryDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await adminService.retryDelivery(req.params.deliveryId, req.user.userId));
  } catch (error) { next(error); }
}
