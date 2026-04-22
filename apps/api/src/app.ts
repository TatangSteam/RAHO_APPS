import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from '@config/env';
import { logger } from '@lib/logger';
import { errorHandler } from '@middleware/errorHandler';

// ── Route Modules ─────────────────────────────────────────────
import { authRouter } from '@modules/auth/auth.routes';
import { dashboardRouter } from '@modules/dashboard/dashboard.routes';
import { meRouter } from '@modules/me/me.routes';
import { usersRouter } from '@modules/users/users.routes';
import { branchesRouter } from '@modules/branches/branches.routes';
import membersRouter from './modules/members/members.routes';
import packagesRouter from './modules/packages/packages.routes';
import sessionsRouter from './modules/sessions/sessions.routes';
import diagnosisRouter from './modules/diagnosis/diagnosis.routes';
import nonTherapyRouter from './modules/non-therapy/non-therapy.routes';
import invoicesRouter from './modules/invoices/invoices.routes';
import inventoryRouter from './modules/inventory/inventory.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import auditRouter from './modules/audit/audit.routes';

export function createApp(): Application {
  const app = express();

  // ── Security Headers ───────────────────────────────────────
  app.use(helmet());

  // ── CORS ───────────────────────────────────────────────────
  const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Branch-Id', 'Cache-Control'],
    }),
  );

  // ── Body Parsers ───────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Compression ───────────────────────────────────────────
  app.use(compression());

  // ── HTTP Request Logger ───────────────────────────────────
  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(
      morgan('combined', {
        stream: { write: (msg) => logger.info(msg.trim()) },
      }),
    );
  }

  // ── Global Rate Limiter ───────────────────────────────────
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
        },
      },
    }),
  );

  // ── Auth Specific Rate Limiter ────────────────────────────
  const authLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 1 menit.',
      },
    },
  });

  // ── Health Check ──────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  });

  // ── API Routes ────────────────────────────────────────────
  const prefix = env.API_PREFIX;

  app.use(`${prefix}/auth`, authLimiter, authRouter);

  // Dashboard routes
  app.use(`${prefix}/dashboard`, dashboardRouter);

  // Member portal routes
  app.use(`${prefix}/me`, meRouter);

  // Users module
  app.use(`${prefix}/users`, usersRouter);

  // Branches module
  app.use(`${prefix}/branches`, branchesRouter);

  // Members module (includes package routes)
  app.use(`${prefix}/members`, membersRouter);

  // Packages module (pricing management only)
  app.use(`${prefix}`, packagesRouter);

  // Treatment sessions module
  app.use(`${prefix}/treatment-sessions`, sessionsRouter);

  // Diagnosis module
  app.use(`${prefix}/diagnosis`, diagnosisRouter);

  // Non-therapy products module
  app.use(`${prefix}/non-therapy`, nonTherapyRouter);

  // Diagnosis module
  app.use(`${prefix}/diagnosis`, diagnosisRouter);

  // Invoices module
  app.use(`${prefix}/invoices`, invoicesRouter);

  // Inventory module
  app.use(`${prefix}/inventory`, inventoryRouter);

  // Audit logs module
  app.use(`${prefix}/audit-logs`, auditRouter);

  // Admin module
  app.use(`${prefix}/admin`, adminRoutes);

  // Future module routes registered here:
  // app.use(`${prefix}/treatment-sessions`, sessionsRouter);
  // app.use(`${prefix}/inventory`, inventoryRouter);
  // app.use(`${prefix}/stock-requests`, stockRequestsRouter);
  // app.use(`${prefix}/shipments`, shipmentsRouter);
  // app.use(`${prefix}/notifications`, notificationsRouter);
  // app.use(`${prefix}/chat`, chatRouter);
  // app.use(`${prefix}/dashboard`, dashboardRouter);
  // app.use(`${prefix}/admin`, adminRouter);
  // app.use(`${prefix}/me`, memberPortalRouter);

  // ── 404 Handler ───────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Endpoint tidak ditemukan.',
      },
    });
  });

  // ── Global Error Handler (must be last) ───────────────────
  app.use(errorHandler);

  return app;
}
