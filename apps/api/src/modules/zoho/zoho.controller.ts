import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@utils/response';
import * as service from './zoho.service';

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
