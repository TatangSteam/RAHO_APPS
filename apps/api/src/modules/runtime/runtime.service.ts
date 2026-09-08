import { Prisma } from '@prisma/client';
import { databaseProfiles, env, type DatabaseProfile } from '@config/env';
import { controlPrisma } from '@lib/controlPrisma';
import {
  getCurrentDatabaseProfileId,
  listDatabaseProfiles,
  registerDatabaseProfile,
  validateDatabaseProfile,
} from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { decryptRuntimeSecret, encryptRuntimeSecret } from './runtime.crypto';

export type ZohoApiRuntimeConfig = {
  id: string;
  label: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accountsBaseUrl: string;
  apiBaseUrl: string;
  source: 'ENV' | 'REGISTRY';
};

const ENV_ZOHO_API_PROFILE_ID = 'env-default';
const ENV_DATABASE_PROFILE_IDS = new Set(databaseProfiles.map((profile) => profile.id));
const ZOHO_ACCOUNTS_HOSTS = new Set([
  'accounts.zoho.com', 'accounts.zoho.eu', 'accounts.zoho.in',
  'accounts.zoho.com.au', 'accounts.zoho.jp', 'accounts.zoho.ca',
  'accounts.zoho.sa', 'accounts.zoho.com.cn',
]);
const ZOHO_API_HOSTS = new Set([
  'www.zohoapis.com', 'www.zohoapis.eu', 'www.zohoapis.in',
  'www.zohoapis.com.au', 'www.zohoapis.jp', 'www.zohoapis.ca',
  'www.zohoapis.sa', 'www.zohoapis.com.cn',
]);

function envZohoApiConfig(): ZohoApiRuntimeConfig | null {
  if (!env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET || !env.ZOHO_REDIRECT_URI) return null;
  return {
    id: ENV_ZOHO_API_PROFILE_ID,
    label: 'API Zoho dari server',
    clientId: env.ZOHO_CLIENT_ID,
    clientSecret: env.ZOHO_CLIENT_SECRET,
    redirectUri: env.ZOHO_REDIRECT_URI,
    accountsBaseUrl: env.ZOHO_ACCOUNTS_BASE_URL,
    apiBaseUrl: env.ZOHO_API_BASE_URL,
    source: 'ENV',
  };
}

function normalizeZohoBaseUrl(value: string, allowedHosts: Set<string>, field: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(400, 'ZOHO_API_PROFILE_INVALID', `${field} tidak valid.`);
  }
  if (
    url.protocol !== 'https:'
    || !allowedHosts.has(url.hostname.toLowerCase())
    || (url.pathname !== '/' && url.pathname !== '')
    || url.username || url.password || url.port || url.search || url.hash
  ) {
    throw new AppError(400, 'ZOHO_API_PROFILE_INVALID', `${field} bukan domain resmi Zoho.`);
  }
  return `https://${url.hostname.toLowerCase()}`;
}

function normalizeRedirectUri(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(400, 'ZOHO_API_PROFILE_INVALID', 'Redirect URI tidak valid.');
  }
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localHttp) {
    throw new AppError(400, 'ZOHO_API_PROFILE_INVALID', 'Redirect URI wajib HTTPS, kecuali localhost.');
  }
  return url.toString();
}

function databaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(400, 'DATABASE_URL_INVALID', 'Connection URL database tidak valid.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new AppError(400, 'DATABASE_URL_INVALID', 'Hanya database PostgreSQL yang didukung.');
  }
  return value;
}

function registryZohoConfig(row: {
  id: string;
  label: string;
  encryptedClientId: string;
  encryptedClientSecret: string;
  redirectUri: string;
  accountsBaseUrl: string;
  apiBaseUrl: string;
}): ZohoApiRuntimeConfig {
  return {
    id: row.id,
    label: row.label,
    clientId: decryptRuntimeSecret(row.encryptedClientId),
    clientSecret: decryptRuntimeSecret(row.encryptedClientSecret),
    redirectUri: row.redirectUri,
    accountsBaseUrl: row.accountsBaseUrl,
    apiBaseUrl: row.apiBaseUrl,
    source: 'REGISTRY',
  };
}

function duplicateError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function hydrateDatabaseProfiles(): Promise<void> {
  const rows = await controlPrisma.runtimeDatabaseProfile.findMany({
    where: { isEnabled: true },
    orderBy: { label: 'asc' },
  });
  rows.forEach((row) => registerDatabaseProfile({
    id: row.id,
    label: row.label,
    url: decryptRuntimeSecret(row.encryptedUrl),
  }));
}

export async function getDatabaseProfiles() {
  await hydrateDatabaseProfiles();
  return listDatabaseProfiles();
}

export async function addDatabaseProfile(input: {
  id: string;
  label: string;
  url: string;
  actor: string;
}) {
  if (ENV_DATABASE_PROFILE_IDS.has(input.id)) {
    throw new AppError(409, 'DATABASE_PROFILE_EXISTS', 'ID profile sudah dipakai konfigurasi server.');
  }
  const profile: DatabaseProfile = {
    id: input.id,
    label: input.label,
    url: databaseUrl(input.url),
  };
  try {
    await validateDatabaseProfile(profile);
  } catch {
    throw new AppError(
      422,
      'DATABASE_CONNECTION_FAILED',
      'Database tidak dapat dihubungi atau schema RAHO belum lengkap.',
    );
  }
  try {
    await controlPrisma.runtimeDatabaseProfile.create({
      data: {
        id: profile.id,
        label: profile.label,
        encryptedUrl: encryptRuntimeSecret(profile.url),
        createdBy: input.actor,
        updatedBy: input.actor,
      },
    });
  } catch (error) {
    if (duplicateError(error)) {
      throw new AppError(409, 'DATABASE_PROFILE_EXISTS', 'ID profile database sudah tersedia.');
    }
    throw error;
  }
  registerDatabaseProfile(profile);
  return listDatabaseProfiles();
}

export async function listZohoApiProfiles() {
  const rows = await controlPrisma.runtimeZohoApiProfile.findMany({ orderBy: { label: 'asc' } });
  const storedActive = rows.find((row) => row.isActive);
  const envConfig = envZohoApiConfig();
  return {
    activeProfileId: storedActive?.id || envConfig?.id || null,
    profiles: [
      ...(envConfig ? [{
        id: envConfig.id,
        label: envConfig.label,
        redirectUri: envConfig.redirectUri,
        accountsBaseUrl: envConfig.accountsBaseUrl,
        apiBaseUrl: envConfig.apiBaseUrl,
        source: envConfig.source,
        isActive: !storedActive,
      }] : []),
      ...rows.map((row) => ({
        id: row.id,
        label: row.label,
        redirectUri: row.redirectUri,
        accountsBaseUrl: row.accountsBaseUrl,
        apiBaseUrl: row.apiBaseUrl,
        source: 'REGISTRY' as const,
        isActive: row.isActive,
      })),
    ],
  };
}

export async function getZohoApiConfig(profileId: string): Promise<ZohoApiRuntimeConfig> {
  if (profileId === ENV_ZOHO_API_PROFILE_ID) {
    const config = envZohoApiConfig();
    if (config) return config;
  }
  const row = await controlPrisma.runtimeZohoApiProfile.findUnique({ where: { id: profileId } });
  if (!row) throw new AppError(404, 'ZOHO_API_PROFILE_NOT_FOUND', 'Profile API Zoho tidak ditemukan.');
  return registryZohoConfig(row);
}

export async function getActiveZohoApiConfig(): Promise<ZohoApiRuntimeConfig | null> {
  const row = await controlPrisma.runtimeZohoApiProfile.findFirst({ where: { isActive: true } });
  return row ? registryZohoConfig(row) : envZohoApiConfig();
}

export async function hasActiveZohoApiConfig(): Promise<boolean> {
  return Boolean(await getActiveZohoApiConfig()) && Boolean(env.ZOHO_TOKEN_ENCRYPTION_KEY);
}

export async function addZohoApiProfile(input: {
  label: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accountsBaseUrl: string;
  apiBaseUrl: string;
  actor: string;
}) {
  const redirectUri = normalizeRedirectUri(input.redirectUri);
  const accountsBaseUrl = normalizeZohoBaseUrl(input.accountsBaseUrl, ZOHO_ACCOUNTS_HOSTS, 'Accounts URL');
  const apiBaseUrl = normalizeZohoBaseUrl(input.apiBaseUrl, ZOHO_API_HOSTS, 'API URL');
  const row = await controlPrisma.$transaction(async (tx) => {
    await tx.runtimeZohoApiProfile.updateMany({ data: { isActive: false, updatedBy: input.actor } });
    return tx.runtimeZohoApiProfile.create({
      data: {
        label: input.label,
        encryptedClientId: encryptRuntimeSecret(input.clientId),
        encryptedClientSecret: encryptRuntimeSecret(input.clientSecret),
        redirectUri,
        accountsBaseUrl,
        apiBaseUrl,
        isActive: true,
        createdBy: input.actor,
        updatedBy: input.actor,
      },
    });
  });
  return { id: row.id, ...(await listZohoApiProfiles()) };
}

export async function activateZohoApiProfile(profileId: string, actor: string) {
  if (profileId === ENV_ZOHO_API_PROFILE_ID) {
    if (!envZohoApiConfig()) throw new AppError(404, 'ZOHO_API_PROFILE_NOT_FOUND', 'Profile API Zoho server tidak tersedia.');
    await controlPrisma.runtimeZohoApiProfile.updateMany({ data: { isActive: false, updatedBy: actor } });
    return listZohoApiProfiles();
  }
  const exists = await controlPrisma.runtimeZohoApiProfile.findUnique({ where: { id: profileId }, select: { id: true } });
  if (!exists) throw new AppError(404, 'ZOHO_API_PROFILE_NOT_FOUND', 'Profile API Zoho tidak ditemukan.');
  await controlPrisma.$transaction([
    controlPrisma.runtimeZohoApiProfile.updateMany({ data: { isActive: false, updatedBy: actor } }),
    controlPrisma.runtimeZohoApiProfile.update({ where: { id: profileId }, data: { isActive: true, updatedBy: actor } }),
  ]);
  return listZohoApiProfiles();
}

export async function bindZohoOrganizationToApiProfile(
  organizationId: string,
  zohoApiProfileId: string,
): Promise<void> {
  if (zohoApiProfileId === ENV_ZOHO_API_PROFILE_ID) return;
  await controlPrisma.runtimeZohoOrganizationBinding.upsert({
    where: {
      databaseProfileId_organizationId: {
        databaseProfileId: getCurrentDatabaseProfileId(),
        organizationId,
      },
    },
    create: {
      databaseProfileId: getCurrentDatabaseProfileId(),
      organizationId,
      zohoApiProfileId,
    },
    update: { zohoApiProfileId },
  });
}

export async function getZohoApiConfigForOrganization(
  organizationId: string,
): Promise<ZohoApiRuntimeConfig | null> {
  const binding = await controlPrisma.runtimeZohoOrganizationBinding.findUnique({
    where: {
      databaseProfileId_organizationId: {
        databaseProfileId: getCurrentDatabaseProfileId(),
        organizationId,
      },
    },
    include: { zohoApiProfile: true },
  });
  if (binding) return registryZohoConfig(binding.zohoApiProfile);
  // Existing connections created before runtime profiles always retain the
  // server credential that originally created them.
  return envZohoApiConfig() || getActiveZohoApiConfig();
}
