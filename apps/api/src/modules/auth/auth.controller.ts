import { Request, Response, NextFunction } from 'express';
import { loginSchema, refreshSchema, logoutSchema } from './auth.schema';
import { loginService, refreshService, getMeService } from './auth.service';
import { sendSuccess } from '@utils/response';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const result = await loginService(input);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokens = await refreshService(refreshToken);
    sendSuccess(res, tokens);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    logoutSchema.parse(req.body);
    // Stateless JWT — client discards token.
    // Extend here with DB-backed token blacklist if needed.
    sendSuccess(res, { message: 'Logout berhasil.' });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await getMeService(req.user.userId);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}
