import axios from 'axios';
import jwt from 'jsonwebtoken';
import { env } from '@config/env';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { decryptToken, encryptToken } from './zoho.crypto';

const SCOPES = [
  'ZohoBooks.settings.READ',
  'ZohoBooks.contacts.READ',
  'ZohoBooks.items.READ',
  'ZohoBooks.invoices.READ',
].join(',');

type OAuthState = { userId: string; purpose: 'zoho-oauth' };
type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  api_domain?: string;
  scope?: string;
  error?: string;
};
type Organization = {
  organization_id: string;
  name: string;
};

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

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env.ZOHO_CLIENT_ID!,
    client_secret: env.ZOHO_CLIENT_SECRET!,
    redirect_uri: env.ZOHO_REDIRECT_URI!,
    code,
  });
  const tokenResult = await axios.post<TokenResponse>(
    new URL('/oauth/v2/token', env.ZOHO_ACCOUNTS_BASE_URL).toString(),
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
  );
  const token = tokenResult.data;
  if (!token.access_token || !token.refresh_token) {
    throw new AppError(502, 'ZOHO_TOKEN_FAILED', token.error || 'Zoho tidak mengembalikan refresh token. Cabut izin aplikasi lalu coba kembali.');
  }
  const apiDomain = token.api_domain || env.ZOHO_API_BASE_URL;
  const organizations = await axios.get<{ organizations: Organization[] }>(
    new URL('/books/v3/organizations', apiDomain).toString(),
    { headers: { Authorization: `Zoho-oauthtoken ${token.access_token}` }, timeout: 20_000 },
  );
  if (!organizations.data.organizations?.length) {
    throw new AppError(422, 'ZOHO_ORGANIZATION_NOT_FOUND', 'Tidak ada organisasi Zoho Books yang dapat diakses.');
  }

  const encryptedAccessToken = encryptToken(token.access_token);
  const encryptedRefreshToken = encryptToken(token.refresh_token);
  const expiresAt = new Date(Date.now() + (token.expires_in || 3600) * 1000);
  const dataCenter = new URL(env.ZOHO_ACCOUNTS_BASE_URL).hostname;
  await prisma.$transaction(async (tx) => {
    await tx.zohoConnection.updateMany({ data: { isActive: false, updatedById: user.id } });
    for (const [index, organization] of organizations.data.organizations.entries()) {
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
          isActive: index === 0,
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
          isActive: index === 0,
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
      isActive: true, lastCheckedAt: true, lastError: true, createdAt: true, updatedAt: true,
    },
  });
  return {
    configured: Boolean(env.ZOHO_CLIENT_ID && env.ZOHO_CLIENT_SECRET && env.ZOHO_REDIRECT_URI && env.ZOHO_TOKEN_ENCRYPTION_KEY),
    redirectUri: env.ZOHO_REDIRECT_URI || null,
    connected: connections.some((item) => item.isActive),
    connections,
  };
}

async function refreshAccessToken(connection: { id: string; encryptedRefreshToken: string; apiDomain: string }) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.ZOHO_CLIENT_ID!,
    client_secret: env.ZOHO_CLIENT_SECRET!,
    refresh_token: decryptToken(connection.encryptedRefreshToken),
  });
  const response = await axios.post<TokenResponse>(
    new URL('/oauth/v2/token', env.ZOHO_ACCOUNTS_BASE_URL).toString(),
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
  );
  if (!response.data.access_token) throw new Error(response.data.error || 'Access token refresh failed');
  await prisma.zohoConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encryptToken(response.data.access_token),
      accessTokenExpiresAt: new Date(Date.now() + (response.data.expires_in || 3600) * 1000),
      lastError: null,
    },
  });
  return response.data.access_token;
}

export async function testConnection() {
  assertConfigured();
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  try {
    const accessToken = connection.accessTokenExpiresAt.getTime() < Date.now() + 60_000
      ? await refreshAccessToken(connection)
      : decryptToken(connection.encryptedAccessToken);
    await axios.get(new URL('/books/v3/organizations', connection.apiDomain).toString(), {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      timeout: 20_000,
    });
    await prisma.zohoConnection.update({ where: { id: connection.id }, data: { lastCheckedAt: new Date(), lastError: null } });
    return { healthy: true, organizationName: connection.organizationName };
  } catch {
    await prisma.zohoConnection.update({ where: { id: connection.id }, data: { lastCheckedAt: new Date(), lastError: 'Pemeriksaan koneksi gagal' } });
    throw new AppError(502, 'ZOHO_CONNECTION_FAILED', 'Koneksi ke Zoho gagal. Hubungkan ulang jika masalah berlanjut.');
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
