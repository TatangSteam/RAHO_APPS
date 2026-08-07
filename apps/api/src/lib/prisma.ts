import { Prisma, PrismaClient } from '@prisma/client';
import { env } from '@config/env';

declare global {
  // Prevent multiple Prisma instances in development (hot-reload)
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prismaLogLevels: Prisma.LogLevel[] = env.NODE_ENV === 'development'
  ? env.PRISMA_QUERY_LOG
    ? ['query', 'warn', 'error']
    : ['warn', 'error']
  : ['error'];

const prisma =
  global.__prisma ??
  new PrismaClient({
    log: prismaLogLevels,
  });

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export { prisma };
