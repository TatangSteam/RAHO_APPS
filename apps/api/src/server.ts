import { createApp } from './app';
import { env } from '@config/env';
import { prisma } from '@lib/prisma';
import { logger } from '@lib/logger';

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

  // ── Graceful Shutdown ─────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`\n${signal} received — shutting down gracefully`);

    server.close(async () => {
      await prisma.$disconnect();
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
