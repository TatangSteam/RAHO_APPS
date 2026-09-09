import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const emptyStringToUndefined = (value: unknown): unknown => (
  typeof value === 'string' && !value.trim() ? undefined : value
);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  API_URL: z.string().url().optional().default('http://localhost:4000'),

  DATABASE_URL: z.string().url(),
  DATABASE_PROFILES_JSON: z.preprocess(emptyStringToUndefined, z.string().optional()),
  DATABASE_DEFAULT_PROFILE_ID: z.string().trim().min(1).max(40).default('default'),
  RUNTIME_CONFIG_ENCRYPTION_KEY: z.preprocess(emptyStringToUndefined, z.string().min(32).optional()),
  PRISMA_QUERY_LOG: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('3h'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string(),
  MINIO_SECRET_KEY: z.string(),
  MINIO_BUCKET: z.string().default('raho-uploads'),
  MINIO_USE_SSL: z.string().transform((v) => v === 'true').default('false'),
  MINIO_PUBLIC_URL: z.string().url(),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
  E2E_DISABLE_RATE_LIMIT: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),

  VOUCHER_CODE_ENCRYPTION_KEY: z.preprocess(emptyStringToUndefined, z.string().min(32).optional()),

  WHATSAPP_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  WHATSAPP_WORKER_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  WHATSAPP_PROVIDER: z.enum(['DISABLED', 'BAILEYS']).default('DISABLED'),
  WHATSAPP_ENCRYPTION_KEY: z.preprocess(emptyStringToUndefined, z.string().min(32).optional()),
  WHATSAPP_WORKER_INTERVAL_MS: z.coerce.number().int().min(1_000).default(5_000),
  WHATSAPP_QR_TIMEOUT_MS: z.coerce.number().int().min(20_000).max(300_000).default(60_000),

  ZOHO_CLIENT_ID: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).optional()),
  ZOHO_CLIENT_SECRET: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).optional()),
  ZOHO_REDIRECT_URI: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  ZOHO_TOKEN_ENCRYPTION_KEY: z.preprocess(emptyStringToUndefined, z.string().min(32).optional()),
  ZOHO_ACCOUNTS_BASE_URL: z.string().url().default('https://accounts.zoho.com'),
  ZOHO_API_BASE_URL: z.string().url().default('https://www.zohoapis.com'),
  ZOHO_WEB_REDIRECT_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  ZOHO_REQUIRED_SCOPE_VERSION: z.coerce.number().int().positive().default(12),
  ZOHO_GRNI_SLA_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  ZOHO_TREATMENT_REVENUE_MODE: z.enum(['DOCUMENT', 'JOURNAL']).default('DOCUMENT'),
  ZOHO_CONTACT_RAHO_ID_CUSTOM_FIELD_ID: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(1).optional(),
  ),
  ZOHO_CONTACT_RAHO_ID_CUSTOM_FIELD_API_NAME: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().regex(/^cf_[a-z0-9_]+$/i).optional(),
  ),
  ZOHO_SYNC_DRY_RUN: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  ZOHO_SYNC_WORKER_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  ZOHO_SYNC_WORKER_INTERVAL_MS: z.coerce.number().int().min(1_000).default(5_000),
  ZOHO_SYNC_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  ZOHO_SYNC_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(25).default(8),
  ZOHO_SYNC_LEASE_MS: z.coerce.number().int().min(5_000).default(60_000),
  ZOHO_WEBHOOK_SECRET: z.preprocess(
    emptyStringToUndefined,
    z.string().min(12).max(100).optional(),
  ),
  ZOHO_RECONCILIATION_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  ZOHO_RECONCILIATION_INTERVAL_MS: z.coerce.number().int().min(60_000).default(3_600_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

const databaseProfileSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/i),
  label: z.string().trim().min(1).max(80),
  url: z.string().url(),
});

export type DatabaseProfile = z.infer<typeof databaseProfileSchema>;

function parseDatabaseProfiles(): DatabaseProfile[] {
  if (!env.DATABASE_PROFILES_JSON) {
    return [{
      id: env.DATABASE_DEFAULT_PROFILE_ID,
      label: 'Database Utama',
      url: env.DATABASE_URL,
    }];
  }

  try {
    const profiles = z.array(databaseProfileSchema).min(1).max(10)
      .parse(JSON.parse(env.DATABASE_PROFILES_JSON));
    const normalizedIds = profiles.map((profile) => profile.id.toLowerCase());
    if (new Set(normalizedIds).size !== normalizedIds.length) {
      throw new Error('ID profile database harus unik.');
    }
    if (!profiles.some((profile) => profile.id === env.DATABASE_DEFAULT_PROFILE_ID)) {
      throw new Error(`DATABASE_DEFAULT_PROFILE_ID "${env.DATABASE_DEFAULT_PROFILE_ID}" tidak ditemukan.`);
    }
    return profiles;
  } catch (error) {
    console.error('❌ DATABASE_PROFILES_JSON tidak valid:', error);
    process.exit(1);
  }
}

/** Daftar koneksi server-side. URL tidak pernah dikirimkan ke browser. */
export const databaseProfiles = parseDatabaseProfiles();
