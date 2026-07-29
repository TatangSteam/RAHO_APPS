import jwt from 'jsonwebtoken';
import { env } from '@config/env';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { encryptToken } from './zoho.crypto';
import {
  exchangeAuthorizationCode,
  getActiveZohoClient,
  getMissingRequiredScopes,
  listOrganizationsWithToken,
  ZOHO_REQUIRED_SCOPES,
  ZOHO_SCOPE_VERSION,
} from './zoho.client';
import { normalizeZohoError } from './zoho.error';

const SCOPES = ZOHO_REQUIRED_SCOPES.join(',');

type OAuthState = { userId: string; purpose: 'zoho-oauth' };
function assertConfigured() {
  if (!env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET || !env.ZOHO_REDIRECT_URI || !env.ZOHO_TOKEN_ENCRYPTION_KEY) {
    throw new AppError(503, 'ZOHO_NOT_CONFIGURED', 'Credential OAuth Zoho belum lengkap pada server.');
  }
}

function stateSecret(): string {
  return `${env.JWT_ACCESS_SECRET}:zoho-oauth`;
}

function webRedirect(status: 'success' | 'error', message?: string): string {
  const base = env.ZOHO_WEB_REDIRECT_URL || `${env.CORS_ORIGIN.split(',')[0]}/admin/integrations/zoho`;
  const url = new URL(base);
  url.searchParams.set('zoho', status);
  if (message) url.searchParams.set('message', message.slice(0, 180));
  return url.toString();
}

export function getAuthorizationUrl(userId: string) {
  assertConfigured();
  const state = jwt.sign(
    { userId, purpose: 'zoho-oauth' } satisfies OAuthState,
    stateSecret(),
    { expiresIn: '10m', issuer: 'raho-api', audience: 'zoho-oauth' },
  );
  const url = new URL('/oauth/v2/auth', env.ZOHO_ACCOUNTS_BASE_URL);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('client_id', env.ZOHO_CLIENT_ID!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('redirect_uri', env.ZOHO_REDIRECT_URI!);
  url.searchParams.set('state', state);
  return { authorizationUrl: url.toString() };
}

export async function handleCallback(code: string, state: string) {
  assertConfigured();
  let payload: OAuthState;
  try {
    payload = jwt.verify(state, stateSecret(), {
      issuer: 'raho-api',
      audience: 'zoho-oauth',
    }) as OAuthState;
  } catch {
    throw new AppError(400, 'ZOHO_STATE_INVALID', 'Sesi koneksi Zoho tidak valid atau kedaluwarsa.');
  }
  if (payload.purpose !== 'zoho-oauth') throw new AppError(400, 'ZOHO_STATE_INVALID', 'State OAuth tidak valid.');
  const user = await prisma.user.findFirst({ where: { id: payload.userId, isActive: true, role: 'SUPER_ADMIN' } });
  if (!user) throw new AppError(403, 'AUTH_FORBIDDEN', 'Pengguna tidak berwenang menghubungkan Zoho.');

  const token = await exchangeAuthorizationCode(code);
  if (!token.access_token || !token.refresh_token) {
    throw new AppError(502, 'ZOHO_TOKEN_FAILED', token.error || 'Zoho tidak mengembalikan refresh token. Cabut izin aplikasi lalu coba kembali.');
  }
  const apiDomain = token.api_domain || env.ZOHO_API_BASE_URL;
  const organizations = await listOrganizationsWithToken(apiDomain, token.access_token);
  if (!organizations.length) {
    throw new AppError(422, 'ZOHO_ORGANIZATION_NOT_FOUND', 'Tidak ada organisasi Zoho Books yang dapat diakses.');
  }

  const encryptedAccessToken = encryptToken(token.access_token);
  const encryptedRefreshToken = encryptToken(token.refresh_token);
  const expiresAt = new Date(Date.now() + (token.expires_in || 3600) * 1000);
  const dataCenter = new URL(env.ZOHO_ACCOUNTS_BASE_URL).hostname;
  await prisma.$transaction(async (tx) => {
    await tx.zohoConnection.updateMany({ data: { isActive: false, updatedById: user.id } });
    for (const [index, organization] of organizations.entries()) {
      await tx.zohoConnection.upsert({
        where: { organizationId: organization.organization_id },
        create: {
          organizationId: organization.organization_id,
          organizationName: organization.name,
          dataCenter,
          apiDomain,
          encryptedAccessToken,
          encryptedRefreshToken,
          accessTokenExpiresAt: expiresAt,
          scopes: token.scope || SCOPES,
          scopeVersion: ZOHO_SCOPE_VERSION,
          isActive: index === 0,
          organizationCurrencyId: organization.currency_id,
          organizationCurrencyCode: organization.currency_code,
          organizationTimeZone: organization.time_zone,
          lastCheckedAt: new Date(),
          createdById: user.id,
          updatedById: user.id,
        },
        update: {
          organizationName: organization.name,
          dataCenter,
          apiDomain,
          encryptedAccessToken,
          encryptedRefreshToken,
          accessTokenExpiresAt: expiresAt,
          scopes: token.scope || SCOPES,
          scopeVersion: ZOHO_SCOPE_VERSION,
          isActive: index === 0,
          organizationCurrencyId: organization.currency_id,
          organizationCurrencyCode: organization.currency_code,
          organizationTimeZone: organization.time_zone,
          lastCheckedAt: new Date(),
          lastError: null,
          updatedById: user.id,
        },
      });
    }
  });
  return webRedirect('success');
}

export async function getStatus() {
  const connections = await prisma.zohoConnection.findMany({
    orderBy: [{ isActive: 'desc' }, { organizationName: 'asc' }],
    select: {
      id: true, organizationId: true, organizationName: true, dataCenter: true,
      scopes: true, scopeVersion: true, isActive: true, lastCheckedAt: true, lastError: true,
      organizationCurrencyCode: true, organizationTimeZone: true, discoveryLastRunAt: true,
      contactExternalIdFieldId: true, contactExternalIdApiName: true, contactExternalIdIsUnique: true,
      locationsSupported: true, locationsCapabilityError: true,
      inventoryAdjustmentsSupported: true, inventoryAdjustmentsCapabilityError: true,
      inventoryAdjustmentsLastCheckedAt: true,
      createdAt: true, updatedAt: true,
    },
  });
  const itemAccountMappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: { in: connections.map((connection) => connection.id) },
      entityType: 'ACCOUNT_ROLE',
      localEntityId: { in: ['ITEM_SALES', 'ITEM_PURCHASE', 'ITEM_INVENTORY'] },
      status: 'ACTIVE',
    },
    select: { zohoConnectionId: true, localEntityId: true },
  });
  return {
    configured: Boolean(env.ZOHO_CLIENT_ID && env.ZOHO_CLIENT_SECRET && env.ZOHO_REDIRECT_URI && env.ZOHO_TOKEN_ENCRYPTION_KEY),
    redirectUri: env.ZOHO_REDIRECT_URI || null,
    connected: connections.some((item) => item.isActive),
    dryRun: env.ZOHO_SYNC_DRY_RUN,
    workerEnabled: env.ZOHO_SYNC_WORKER_ENABLED,
    requiredScopeVersion: env.ZOHO_REQUIRED_SCOPE_VERSION,
    connections: connections.map((connection) => {
      const missingScopes = getMissingRequiredScopes(connection.scopes);
      return {
        ...connection,
        missingScopes,
        contactSyncReady: Boolean(
          connection.contactExternalIdFieldId
          && connection.contactExternalIdApiName
          && connection.contactExternalIdIsUnique
        ),
        itemSyncReady: new Set(
          itemAccountMappings
            .filter((mapping) => mapping.zohoConnectionId === connection.id)
            .map((mapping) => mapping.localEntityId),
        ).size === 3,
        locationSyncReady: connection.locationsSupported === true,
        invoiceSyncReady: !missingScopes.includes('ZohoBooks.invoices.CREATE')
          && !missingScopes.includes('ZohoBooks.invoices.UPDATE'),
        paymentSyncReady: !missingScopes.includes('ZohoBooks.customerpayments.CREATE')
          && !missingScopes.includes('ZohoBooks.customerpayments.UPDATE')
          && !missingScopes.includes('ZohoBooks.invoices.DELETE'),
        expenseSyncReady: !missingScopes.includes('ZohoBooks.expenses.READ')
          && !missingScopes.includes('ZohoBooks.expenses.CREATE')
          && !missingScopes.includes('ZohoBooks.expenses.UPDATE'),
        purchaseOrderSyncReady: !missingScopes.includes('ZohoBooks.purchaseorders.READ')
          && !missingScopes.includes('ZohoBooks.purchaseorders.CREATE')
          && !missingScopes.includes('ZohoBooks.purchaseorders.UPDATE'),
        billSyncReady: !missingScopes.includes('ZohoBooks.bills.READ')
          && !missingScopes.includes('ZohoBooks.bills.CREATE')
          && !missingScopes.includes('ZohoBooks.bills.UPDATE'),
        vendorPaymentSyncReady: !missingScopes.includes('ZohoBooks.vendorpayments.READ')
          && !missingScopes.includes('ZohoBooks.vendorpayments.CREATE')
          && !missingScopes.includes('ZohoBooks.vendorpayments.UPDATE'),
        reconnectRequired:
          connection.scopeVersion < env.ZOHO_REQUIRED_SCOPE_VERSION || missingScopes.length > 0,
      };
    }),
  };
}

export async function testConnection() {
  assertConfigured();
  const client = await getActiveZohoClient(false);
  const connection = client.connection;
  try {
    await client.request('/books/v3/organizations', { organizationScoped: false });
    await prisma.zohoConnection.update({ where: { id: connection.id }, data: { lastCheckedAt: new Date(), lastError: null } });
    return { healthy: true, organizationName: connection.organizationName };
  } catch (error) {
    const normalized = normalizeZohoError(error);
    const detail = `${normalized.code}: ${normalized.message}`.slice(0, 500);
    await prisma.zohoConnection.update({ where: { id: connection.id }, data: { lastCheckedAt: new Date(), lastError: detail } });
    throw new AppError(
      502,
      'ZOHO_CONNECTION_FAILED',
      `Koneksi ke Zoho gagal (${normalized.code}). Hubungkan ulang jika masalah berlanjut.`,
    );
  }
}

export async function activateConnection(id: string, userId: string) {
  const target = await prisma.zohoConnection.findUnique({ where: { id } });
  if (!target) throw new AppError(404, 'ZOHO_ORGANIZATION_NOT_FOUND', 'Organisasi Zoho tidak ditemukan.');
  await prisma.$transaction([
    prisma.zohoConnection.updateMany({ data: { isActive: false, updatedById: userId } }),
    prisma.zohoConnection.update({ where: { id }, data: { isActive: true, updatedById: userId } }),
  ]);
  return getStatus();
}

export async function disconnect(_userId: string) {
  await prisma.zohoConnection.deleteMany();
  return { disconnected: true };
}

export { webRedirect };
