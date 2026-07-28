import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { env } from '@config/env';
import { logger } from '@lib/logger';
import { errorHandler } from '@middleware/errorHandler';
import { apiRateLimiter } from '@middleware/rateLimiter';

// ── Route Modules ─────────────────────────────────────────────
import { authRouter } from '@modules/auth/auth.routes';
import { dashboardRouter } from '@modules/dashboard/dashboard.routes';
import { meRouter } from '@modules/me/me.routes';
import { usersRouter } from '@modules/users/users.routes';
import { adminManagerRouter } from '@modules/users/admin-manager.routes';
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
import referralsRouter from './modules/referrals/referrals.routes';
import filesRouter from './modules/files/files.routes';
import iamRouter from './modules/iam/iam.routes';
import accountingRouter from './modules/accounting/accounting.routes';
import cashBankRouter from './modules/cash-bank/cash-bank.routes';
import openingBalanceRouter from './modules/opening-balance/opening-balance.routes';
import expenseRouter from './modules/expenses/expense.routes';
import purchasingRouter from './modules/purchasing/purchasing.routes';
import revenueRouter from './modules/revenue/revenue.routes';
import workflowApprovalRouter from './modules/workflow/approval.routes';
import stockOpnameRouter from './modules/inventory/stock-opname.routes';
import financeReportRouter from './modules/finance-report/finance-report.routes';
import notificationRouter from './modules/notifications/notification.routes';
import zohoRouter from './modules/zoho/zoho.routes';

export function createApp(): Application {
  const app = express();

  // ── Security Headers ───────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  }));

  // ── CORS ───────────────────────────────────────────────────
  const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim());
  const isDevelopmentLocalOrigin = (origin: string): boolean => {
    if (env.NODE_ENV !== 'development') return false;
    try {
      const { hostname, protocol } = new URL(origin);
      if (!['http:', 'https:'].includes(protocol)) return false;
      return hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname === '[::1]'
        || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
        || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
        || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname);
    } catch {
      return false;
    }
  };
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || isDevelopmentLocalOrigin(origin)) {
          callback(null, true);
        } else {
          logger.warn('CORS origin rejected', { origin });
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Branch-Id', 'X-E2E-Test', 'Cache-Control'],
    }),
  );

  // ── Body Parsers ───────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Compression ───────────────────────────────────────────
  app.use(compression());

  // behind one reverse proxy (Nginx Proxy Manager)
  app.set('trust proxy', 1);

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
  app.use(apiRateLimiter);

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

  app.use(`${prefix}/auth`, authRouter);
  app.use(`${prefix}/iam`, iamRouter);
  app.use(`${prefix}/accounting`, accountingRouter);
  app.use(`${prefix}/cash-bank`, cashBankRouter);
  app.use(`${prefix}/opening-balances`, openingBalanceRouter);
  app.use(`${prefix}/expenses`, expenseRouter);
  app.use(`${prefix}/purchasing`, purchasingRouter);
  app.use(`${prefix}/revenue`, revenueRouter);
  app.use(`${prefix}/workflow`, workflowApprovalRouter);
  app.use(`${prefix}/finance-reports`, financeReportRouter);
  app.use(`${prefix}/notifications`, notificationRouter);
  app.use(`${prefix}/integrations/zoho`, zohoRouter);

  // Dashboard routes
  app.use(`${prefix}/dashboard`, dashboardRouter);

  // Member portal routes
  app.use(`${prefix}/me`, meRouter);

  // Users module
  app.use(`${prefix}/users`, usersRouter);

  // Admin Manager module
  app.use(`${prefix}/admin-manager`, adminManagerRouter);

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
  app.use(`${prefix}/inventory/stock-opnames`, stockOpnameRouter);
  app.use(`${prefix}/inventory`, inventoryRouter);

  // Referrals module
  app.use(`${prefix}/referrals`, referralsRouter);

  // Audit logs module
  app.use(`${prefix}/audit-logs`, auditRouter);

  // Admin module
  app.use(`${prefix}/admin`, adminRoutes);

  // Files module (serve files from MinIO through API)
  app.use(`${prefix}/files`, filesRouter);

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
