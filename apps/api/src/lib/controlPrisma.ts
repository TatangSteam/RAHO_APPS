import { PrismaClient } from '@prisma/client';
import { env } from '@config/env';

declare global {
  // eslint-disable-next-line no-var
  var __controlPrisma: PrismaClient | undefined;
}

/** Fixed control-plane client; it never follows the runtime database selector. */
export const controlPrisma = global.__controlPrisma ?? new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
  log: env.NODE_ENV === 'development' && env.PRISMA_QUERY_LOG
    ? ['query', 'warn', 'error']
    : ['error'],
});

if (env.NODE_ENV !== 'production') global.__controlPrisma = controlPrisma;
