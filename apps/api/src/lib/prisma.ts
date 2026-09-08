import { Prisma, PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseProfile, databaseProfiles, env } from '@config/env';

declare global {
  // Prevent multiple Prisma instances in development (hot-reload)
  // eslint-disable-next-line no-var
  var __prismaClients: Map<string, PrismaClient> | undefined;
}

const prismaLogLevels: Prisma.LogLevel[] = env.NODE_ENV === 'development'
  ? env.PRISMA_QUERY_LOG
    ? ['query', 'warn', 'error']
    : ['warn', 'error']
  : ['error'];

const clients = global.__prismaClients ?? new Map<string, PrismaClient>();
const registeredProfiles = new Map<string, DatabaseProfile>(
  databaseProfiles.map((profile) => [profile.id, profile]),
);
const databaseContext = new AsyncLocalStorage<{
  profileId: string;
  runtimeRevision: number;
}>();
let activeProfileId = env.DATABASE_DEFAULT_PROFILE_ID;
let runtimeRevision = 0;

function profileById(profileId: string) {
  return registeredProfiles.get(profileId);
}

export function registerDatabaseProfile(profile: DatabaseProfile): void {
  const existing = registeredProfiles.get(profile.id);
  if (existing?.url !== profile.url) {
    const staleClient = clients.get(profile.id);
    clients.delete(profile.id);
    if (staleClient) void staleClient.$disconnect().catch(() => undefined);
  }
  registeredProfiles.set(profile.id, profile);
}

export async function validateDatabaseProfile(profile: DatabaseProfile): Promise<void> {
  const client = new PrismaClient({
    log: ['error'],
    datasources: { db: { url: profile.url } },
  });
  try {
    await client.$connect();
    await client.user.findFirst({ select: { id: true } });
  } finally {
    await client.$disconnect();
  }
}

export function getPrismaClient(profileId = getCurrentDatabaseProfileId()): PrismaClient {
  const profile = profileById(profileId);
  if (!profile) throw new Error(`Profile database \"${profileId}\" tidak ditemukan.`);

  const existing = clients.get(profile.id);
  if (existing) return existing;

  const client = new PrismaClient({
    log: prismaLogLevels,
    datasources: { db: { url: profile.url } },
  });
  clients.set(profile.id, client);
  return client;
}

export function getActiveDatabaseProfileId(): string {
  return activeProfileId;
}

export function getCurrentDatabaseProfileId(): string {
  return databaseContext.getStore()?.profileId ?? activeProfileId;
}

export function getCurrentDatabaseRuntimeRevision(): number {
  return databaseContext.getStore()?.runtimeRevision ?? runtimeRevision;
}

export function runWithDatabaseProfile<T>(profileId: string, callback: () => T): T {
  if (!profileById(profileId)) throw new Error(`Profile database \"${profileId}\" tidak ditemukan.`);
  return databaseContext.run({ profileId, runtimeRevision }, callback);
}

export function runWithActiveDatabase<T>(callback: () => T): T {
  return runWithDatabaseProfile(activeProfileId, callback);
}

let activationQueue: Promise<void> = Promise.resolve();

export async function activateDatabaseProfile(profileId: string): Promise<void> {
  const activate = async () => {
    const client = getPrismaClient(profileId);
    await client.$connect();
    await client.$queryRaw`SELECT 1`;
    await client.user.findFirst({ select: { id: true } });
    if (activeProfileId !== profileId) runtimeRevision += 1;
    activeProfileId = profileId;
  };
  const result = activationQueue.then(activate, activate);
  activationQueue = result.catch(() => undefined);
  return result;
}

export function listDatabaseProfiles() {
  return [...registeredProfiles.values()].map(({ id, label }) => ({
    id,
    label,
    isActive: id === activeProfileId,
  })).sort((left, right) => left.label.localeCompare(right.label, 'id'));
}

export async function disconnectAllPrismaClients(): Promise<void> {
  await Promise.all([...clients.values()].map((client) => client.$disconnect()));
}

/**
 * Stable proxy so existing services keep importing `prisma`, while each
 * request remains pinned to the database that was active when it began.
 */
const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

if (env.NODE_ENV !== 'production') {
  global.__prismaClients = clients;
}

export { prisma };
