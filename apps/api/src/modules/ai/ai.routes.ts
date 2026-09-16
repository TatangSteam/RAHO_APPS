import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { Role, Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticate } from '@middleware/authenticate';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@lib/logger';
import { chatBody, compareQuery, overdueQuery, performanceQuery, tasksQuery, todayQuery } from './ai.schema';
import { compareMyPerformance, getMyPerformance, getMyTasks } from './ai.service';
import { chatThroughOpenClaw, resolveOpenClawSession } from './openclaw.service';

export const aiRouter = Router();
aiRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
aiRouter.use((req, res, next) => {
  const internalKey = req.header('x-rain-session-key');
  const remote = req.socket.remoteAddress || '';
  const isLoopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  const internalUser = isLoopback ? resolveOpenClawSession(internalKey) : null;
  if (internalUser) {
    req.user = {
      id: internalUser.userId, userId: internalUser.userId, email: '', role: internalUser.role,
      branchId: null, branchCode: null, fullName: internalUser.fullName, staffCode: internalUser.staffCode,
    };
    req.isImpersonating = false;
    next();
    return;
  }
  const originalJson = res.json;
  res.json = function (body) {
    res.json = originalJson;
    if (res.statusCode >= 400) {
      const status = res.statusCode;
      if (status >= 500) res.status(503);
      return originalJson.call(res, {
        contractVersion: 'rain.v1', success: false, source: 'erp', isDemo: false,
        error: { code: status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : 'SERVICE_UNAVAILABLE',
          message: status === 401 ? 'Silakan login kembali.' : status === 403 ? 'Akses tidak diizinkan.' : 'Autentikasi belum tersedia.' },
      });
    }
    return originalJson.call(res, body);
  };
  void authenticate(req, res, (error?: unknown) => {
    res.json = originalJson;
    next(error);
  });
});
aiRouter.use((req, _res, next) => {
  if (req.user.role === Role.MEMBER) return next(new AppError(403, 'FORBIDDEN', 'RAIN hanya tersedia untuk akun internal ERP.'));
  next();
});
aiRouter.use(rateLimit({
  windowMs: 60000, max: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.user.userId,
  message: { contractVersion: 'rain.v1', success: false, source: 'erp', isDemo: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Maksimal 30 permintaan RAIN per menit. Coba sebentar lagi.' } },
}));
const handle = (work: (req: Request) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await work(req)); } catch (error) { next(error); }
};
aiRouter.get('/me/performance/today', handle((req) => {
  todayQuery.parse(req.query);
  return getMyPerformance(req.user, { period: 'today' });
}));
aiRouter.get('/me/performance/compare', handle((req) => {
  const q = compareQuery.parse(req.query);
  return compareMyPerformance(req.user,
    { period: q.periodA, startDate: q.startDateA, endDate: q.endDateA },
    { period: q.periodB, startDate: q.startDateB, endDate: q.endDateB });
}));
aiRouter.get('/me/performance', handle((req) => getMyPerformance(req.user, performanceQuery.parse(req.query))));
aiRouter.get('/me/tasks/overdue', handle((req) => getMyTasks(req.user, overdueQuery.parse(req.query), true)));
aiRouter.get('/me/tasks', handle((req) => getMyTasks(req.user, tasksQuery.parse(req.query))));
aiRouter.post('/chat', handle((req) => {
  todayQuery.parse(req.query);
  const body = chatBody.parse(req.body);
  return chatThroughOpenClaw(req.user, body.message, body.conversationId ?? randomUUID());
}));

// Module-local contract: do not alter error behavior of existing ERP endpoints.
aiRouter.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  let status = 503;
  let code = 'SERVICE_UNAVAILABLE';
  let message = 'Data task belum dapat dimuat. Silakan coba lagi.';
  if (error instanceof ZodError) { status = 400; code = 'INVALID_ARGUMENT'; message = 'Parameter tidak valid atau tidak didukung.'; }
  else if (error instanceof AppError) { status = error.status; code = error.code; message = error.message; }
  else if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2028', 'P1008', 'P2024'].includes(error.code)) {
    status = 504; code = 'TIMEOUT'; message = 'Permintaan melewati batas waktu. Coba lagi.';
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010'
    && (error.meta?.code === '57014')) { status = 504; code = 'TIMEOUT'; message = 'Permintaan melewati batas waktu. Coba lagi.'; }
  if (status >= 500) logger.error('[RAIN] Task read failed', { code });
  res.status(status).json({ contractVersion: 'rain.v1', success: false, source: 'erp', isDemo: false, error: { code, message } });
});
