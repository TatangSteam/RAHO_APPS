import { createApp } from './app';
import { env } from '@config/env';
import { disconnectAllPrismaClients, prisma, runWithActiveDatabase } from '@lib/prisma';
import { logger } from '@lib/logger';
import { controlPrisma } from '@lib/controlPrisma';
import { startZohoWorker, stopZohoWorker } from '@modules/zoho/zoho.worker';
import { registerZohoHandlers } from '@modules/zoho/zoho.handlers';
import {
  startZohoReconciliationScheduler,
  stopZohoReconciliationScheduler,
} from '@modules/zoho/zoho.reconciliation.service';
import { startWhatsAppRuntime, stopWhatsAppRuntime } from '@modules/whatsapp/whatsapp-runtime';

async function bootstrap(): Promise<void> {
  // ── Verify Database Connection ─────────────────────────────
  try {
    await prisma.$connect();
    logger.info('✅ Database connected');
  } catch (err) {
    logger.error('❌ Database connection failed', err);
    process.exit(1);
  }

  // ── Start HTTP Server ──────────────────────────────────────
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 RAHO API running on port ${env.PORT}`);
    logger.info(`   Environment : ${env.NODE_ENV}`);
    logger.info(`   API prefix  : ${env.API_PREFIX}`);
    logger.info(`   Health      : http://localhost:${env.PORT}/health`);
  });
  registerZohoHandlers();
  startZohoWorker();
  startZohoReconciliationScheduler();
  try {
    await runWithActiveDatabase(() => startWhatsAppRuntime());
  } catch (error) {
    // WhatsApp is an optional side effect. A broken pairing/auth state must not
    // make core RAHO transactions unavailable.
    logger.error('WhatsApp runtime failed to start; API remains available', error);
  }

  // ── Graceful Shutdown ─────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    stopZohoWorker();
    stopZohoReconciliationScheduler();
    await stopWhatsAppRuntime();
    logger.info(`\n${signal} received — shutting down gracefully`);

    server.close(async () => {
      await Promise.all([
        disconnectAllPrismaClients(),
        controlPrisma.$disconnect(),
      ]);
      logger.info('🛑 Server closed, database disconnected');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('💀 Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('💥 Uncaught Exception', err);
    void shutdown('UncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('💥 Unhandled Rejection', reason);
    void shutdown('UnhandledRejection');
  });
}

bootstrap();
